import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { txEffect, roundForCurrency, currencyMismatch, CURRENCY_MISMATCH } from "../../shared/assetAdjust.ts";
import { recordAssetMutation } from "../../shared/assetMutation.ts";
import { needsApproval, createApprovalRequest, notifyApprovalRequest } from "../../shared/transactionApproval.ts";
import { resolvePartnerId } from "../../shared/partnerResolve.ts";

// Menyimpan transaksi + menyesuaikan saldo aset terkait secara atomik.
// Bila transaction_id diberikan → update; jika tidak → create.
//
// Urutan atomik:
// - Create: sesuaikan aset dulu, bila gagal batalkan (transaksi tidak dibuat).
//   Bila pembuatan transaksi gagal setelah aset disesuaikan, kembalikan saldo aset.
// - Update: sesuaikan aset (balik efek lama, terapkan efek baru) dulu,
//   bila gagal batalkan. Bila update transaksi gagal, kembalikan saldo aset.
//
// Hanya aset milik sendiri (created_by_id === me.id) yang boleh ditautkan.
// Saldo negatif diizinkan; pembulatan per mata uang (IDR 0, SAR/USD 2 desimal).
export default async function (req) {
  // Klaim item kotak masuk (Catat Otomatis): dilepas lagi bila penyimpanan gagal.
  let incomingClaim = null;
  let incomingDone = false;
  let releaseIncoming = null;
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { transaction, transaction_id, incoming_id } = body;
    if (!transaction)
      return Response.json({ error: "missing_transaction" }, { status: 400 });

    // Konfirmasi item kotak masuk "Catat Otomatis": hanya milik sendiri & belum
    // diproses. Ditandai "saved" setelah transaksi berhasil dibuat.
    let incoming = null;
    if (incoming_id) {
      if (transaction_id) return Response.json({ error: "incoming_create_only" }, { status: 400 });
      incoming = await base44.asServiceRole.entities.IncomingTransaction.get(incoming_id).catch(() => null);
      if (!incoming || incoming.owner_id !== me.id)
        return Response.json({ error: "incoming_not_found" }, { status: 404 });
      if (incoming.status !== "new")
        return Response.json({ error: "incoming_already_processed" }, { status: 409 });
      // Klaim sebelum menyentuh saldo: tulis klaim unik lalu baca ulang. Hanya
      // pemegang klaim terakhir yang lanjut — dua sesi yang menekan "Simpan"
      // bersamaan tidak sama-sama membuat transaksi.
      const svcIncoming = base44.asServiceRole.entities.IncomingTransaction;
      const claim = crypto.randomUUID();
      await svcIncoming.update(incoming.id, { status: "processing", claim_id: claim });
      const check = await svcIncoming.get(incoming.id).catch(() => null);
      if (!check || check.claim_id !== claim)
        return Response.json({ error: "incoming_already_processed" }, { status: 409 });
      incomingClaim = claim;
      releaseIncoming = () => svcIncoming.update(incoming.id, { status: "new", claim_id: null });
    }
    const markIncoming = async (txId) => {
      if (!incoming) return;
      incomingDone = true; // transaksi sudah ada → jangan dilepas walau penandaan gagal
      try {
        await base44.asServiceRole.entities.IncomingTransaction.update(incoming.id, { status: "saved", transaction_id: txId });
      } catch (e) { console.error("[saveTransactionWithAsset] gagal menandai kotak masuk", incoming.id, e); }
    };

    const linkedAssetId = transaction.linked_asset_id || null;
    const isUpdate = !!transaction_id;

    // --- UPDATE ---
    if (isUpdate) {
      const oldTx = await base44.entities.Transaction.get(transaction_id);
      if (!oldTx) return Response.json({ error: "tx_not_found" }, { status: 404 });
      if (oldTx.created_by_id !== me.id && me.role !== "admin")
        return Response.json({ error: "forbidden" }, { status: 403 });

      // #4: Field approval_status/approval_id hanya boleh diubah lewat function
      // persetujuan (approveTransaction/rejectTransaction/cancelApproval), bukan
      // langsung oleh klien. Tolak bila klien mencoba mengubahnya.
      if (transaction.approval_status !== undefined || transaction.approval_id !== undefined) {
        return Response.json({ error: "approval_field_protected" }, { status: 403 });
      }

      // #1: Transaksi yang masih pending (menunggu persetujuan pasangan) tidak
      // boleh diedit — efeknya belum diterapkan ke aset. Edit/hapus ditangani
      // lewat cancelApproval. Lihat juga UI TransactionDetail.jsx.
      if (oldTx.approval_status === "pending") {
        return Response.json({ error: "pending_approval_locked" }, { status: 409 });
      }

      const oldLinked = oldTx.linked_asset_id || null;
      const newLinked = linkedAssetId;

      // #6: Bila field sensitif berubah dan transaksi hasil edit kini melewati
      // ambang persetujuan, alihkan ke alur approval: balik efek lama ke aset
      // (efek lama sudah diterapkan saat transaksi dibuat/disetujui), lalu set
      // transaksi menjadi pending dan buat permintaan persetujuan baru.
      const sensitiveChanged =
        Number(transaction.amount) !== Number(oldTx.amount) ||
        (transaction.type && transaction.type !== oldTx.type) ||
        (transaction.category != null && transaction.category !== oldTx.category) ||
        newLinked !== oldLinked ||
        ((transaction.visibility || "shared") !== (oldTx.visibility || "shared"));

      if (sensitiveChanged && await needsApproval(base44, me, transaction)) {
        if (oldLinked) {
          const asset = await base44.entities.Asset.get(oldLinked);
          if (!asset) return Response.json({ error: "asset_not_found" }, { status: 404 });
          if (asset.created_by_id !== me.id)
            return Response.json({ error: "forbidden" }, { status: 403 });
          const prevValue = asset.value;
          const newValue = roundForCurrency((asset.value || 0) - txEffect(oldTx), asset.currency);
          await base44.entities.Asset.update(oldLinked, { value: newValue });
          await recordAssetMutation(base44, {
            asset_id: oldLinked, previous_value: prevValue, new_value: newValue,
            change_type: "transaction", source_ref: transaction_id,
            source_description: `Edit → minta persetujuan ulang: ${transaction.merchant || transaction.category || ""}`,
            actor_id: me.id, actor_name: me.full_name || me.email,
            currency: asset.currency || "IDR",
          });
        }
        const updated = await base44.entities.Transaction.update(transaction_id, {
          ...transaction,
          linked_asset_id: newLinked || undefined,
        });
        const partnerId = await resolvePartnerId(base44, me.id);
        const approval = await createApprovalRequest(base44, me, updated, partnerId);
        await notifyApprovalRequest(base44, me, updated, approval, partnerId);
        return Response.json({ ok: true, transaction: updated, approval, needs_approval: true });
      }

      const adjustments = [];
      if (oldLinked && oldLinked === newLinked) {
        const delta = txEffect(transaction) - txEffect(oldTx);
        if (Math.abs(delta) > 1e-9) adjustments.push({ assetId: oldLinked, delta });
      } else {
        if (oldLinked) adjustments.push({ assetId: oldLinked, delta: -txEffect(oldTx) });
        if (newLinked) adjustments.push({ assetId: newLinked, delta: txEffect(transaction) });
      }

      // Terapkan penyesuaian aset, catat nilai sebelumnya untuk rollback.
      const prevValues = [];
      for (const adj of adjustments) {
        const asset = await base44.entities.Asset.get(adj.assetId);
        if (!asset) return Response.json({ error: "asset_not_found" }, { status: 404 });
        if (adj.assetId === newLinked && currencyMismatch(asset, { currency: transaction.currency ?? oldTx.currency }))
          return Response.json(CURRENCY_MISMATCH, { status: 409 });
        if (asset.created_by_id !== me.id)
          return Response.json({ error: "forbidden" }, { status: 403 });
        const newValue = roundForCurrency((asset.value || 0) + adj.delta, asset.currency);
        await base44.entities.Asset.update(adj.assetId, { value: newValue });
        await recordAssetMutation(base44, {
          asset_id: adj.assetId, previous_value: asset.value, new_value: newValue,
          change_type: "transaction", source_ref: transaction_id,
          source_description: `Update transaksi: ${transaction.merchant || transaction.category || ""}`,
          actor_id: me.id, actor_name: me.full_name || me.email,
          currency: asset.currency || "IDR",
        });
        prevValues.push({ assetId: adj.assetId, prev: asset.value });
      }

      // Update transaksi; bila gagal, kembalikan saldo aset.
      try {
        const updated = await base44.entities.Transaction.update(transaction_id, {
          ...transaction,
          linked_asset_id: newLinked || undefined,
        });
        return Response.json({ ok: true, transaction: updated });
      } catch (e) {
        for (const pv of prevValues) {
          try { await base44.entities.Asset.update(pv.assetId, { value: pv.prev }); }
          catch (rbErr) { console.error("[saveTransactionWithAsset] rollback failed for asset", pv.assetId, rbErr); }
        }
        return Response.json({ error: e?.message || "update_failed" }, { status: 500 });
      }
    }

    // --- CREATE ---
    // Cek apakah transaksi memerlukan persetujuan pasangan.
    const requireApproval = await needsApproval(base44, me, transaction);
    if (requireApproval && linkedAssetId) {
      const asset = await base44.entities.Asset.get(linkedAssetId).catch(() => null);
      if (asset && currencyMismatch(asset, transaction)) return Response.json(CURRENCY_MISMATCH, { status: 409 });
    }
    if (requireApproval) {
      const partnerId = await resolvePartnerId(base44, me.id);
      let pendingTx;
      try {
        pendingTx = await base44.entities.Transaction.create({
          ...transaction,
          linked_asset_id: linkedAssetId || undefined,
          input_by_name: transaction.input_by_name || me.full_name || me.email,
          approval_status: "pending",
        });
      } catch (e) {
        return Response.json({ error: e?.message || "create_failed" }, { status: 500 });
      }
      const approval = await createApprovalRequest(base44, me, pendingTx, partnerId);
      await notifyApprovalRequest(base44, me, pendingTx, approval, partnerId);
      await markIncoming(pendingTx.id);
      return Response.json({ ok: true, transaction: pendingTx, approval, needs_approval: true });
    }

    let assetAdjusted = false;
    let assetPrevValue = null;
    let assetCurrency = "IDR";

    if (linkedAssetId) {
      const asset = await base44.entities.Asset.get(linkedAssetId);
      if (!asset) return Response.json({ error: "asset_not_found" }, { status: 404 });
      if (asset.created_by_id !== me.id)
        return Response.json({ error: "forbidden" }, { status: 403 });
      if (currencyMismatch(asset, transaction)) return Response.json(CURRENCY_MISMATCH, { status: 409 });
      assetPrevValue = asset.value;
      assetCurrency = asset.currency || "IDR";
      const delta = txEffect(transaction);
      const newValue = roundForCurrency((asset.value || 0) + delta, assetCurrency);
      await base44.entities.Asset.update(linkedAssetId, { value: newValue });
      assetAdjusted = true;
    }

    let created;
    try {
      created = await base44.entities.Transaction.create({
        ...transaction,
        linked_asset_id: linkedAssetId || undefined,
        input_by_name: transaction.input_by_name || me.full_name || me.email,
      });
    } catch (e) {
      if (assetAdjusted && linkedAssetId) {
        try { await base44.entities.Asset.update(linkedAssetId, { value: assetPrevValue }); }
        catch (rbErr) { console.error("[saveTransactionWithAsset] rollback failed for asset", linkedAssetId, rbErr); }
      }
      return Response.json({ error: e?.message || "create_failed" }, { status: 500 });
    }

    // Catat mutasi aset immutable.
    if (assetAdjusted && linkedAssetId) {
      await recordAssetMutation(base44, {
        asset_id: linkedAssetId, previous_value: assetPrevValue,
        new_value: roundForCurrency((assetPrevValue || 0) + txEffect(transaction), assetCurrency),
        change_type: "transaction", source_ref: created.id,
        source_description: `Transaksi: ${transaction.merchant || transaction.category || ""}`,
        actor_id: me.id, actor_name: me.full_name || me.email,
        currency: assetCurrency,
      });
    }

    await markIncoming(created.id);
    return Response.json({ ok: true, transaction: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  } finally {
    if (incomingClaim && !incomingDone && releaseIncoming) {
      try { await releaseIncoming(); } catch (e) { console.error("[saveTransactionWithAsset] gagal melepas klaim kotak masuk", e); }
    }
  }
}
