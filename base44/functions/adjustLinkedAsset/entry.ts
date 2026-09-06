import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { txEffect, roundForCurrency } from "../../shared/assetAdjust.ts";

// Menyesuaikan saldo aset bank yang ditautkan ke sebuah transaksi.
// Menerima (transaction_id, action, prev_snapshot?) dan menghitung delta sendiri
// dari data transaksi — bukan menerima delta bebas dari klien.
// Memverifikasi: pemanggil adalah pemilik transaksi (created_by_id === me.id)
// DAN pemilik aset (created_by_id === me.id) — aset shared pasangan tidak boleh
// disesuaikan tanpa kepemilikan penuh.
// Pembulatan mengikuti mata uang: IDR 0 desimal, SAR/USD 2 desimal.
// Saldo negatif diizinkan (overdraft/utang terlihat, tidak dijepit ke nol).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { transaction_id, action, prev_snapshot } = body;
    if (!transaction_id || !action)
      return Response.json({ error: "missing_params" }, { status: 400 });

    const tx = await base44.asServiceRole.entities.Transaction.get(transaction_id);
    if (!tx) return Response.json({ error: "tx_not_found" }, { status: 404 });
    if (tx.created_by_id !== me.id)
      return Response.json({ error: "forbidden" }, { status: 403 });

    if (action === "delete") {
      if (!tx.linked_asset_id) return Response.json({ ok: true, skipped: true });
      const asset = await base44.asServiceRole.entities.Asset.get(tx.linked_asset_id);
      if (!asset) return Response.json({ ok: true, skipped: true });
      if (asset.created_by_id !== me.id)
        return Response.json({ error: "forbidden" }, { status: 403 });
      const delta = -txEffect(tx);
      const newValue = roundForCurrency((asset.value || 0) + delta, asset.currency);
      await base44.asServiceRole.entities.Asset.update(tx.linked_asset_id, { value: newValue });
      return Response.json({ ok: true, asset_id: tx.linked_asset_id, value: newValue });
    }

    if (action === "create") {
      if (!tx.linked_asset_id) return Response.json({ ok: true, skipped: true });
      const asset = await base44.asServiceRole.entities.Asset.get(tx.linked_asset_id);
      if (!asset) return Response.json({ ok: true, skipped: true });
      if (asset.created_by_id !== me.id)
        return Response.json({ error: "forbidden" }, { status: 403 });
      const delta = txEffect(tx);
      const newValue = roundForCurrency((asset.value || 0) + delta, asset.currency);
      await base44.asServiceRole.entities.Asset.update(tx.linked_asset_id, { value: newValue });
      return Response.json({ ok: true, asset_id: tx.linked_asset_id, value: newValue });
    }

    if (action === "update") {
      const oldLinked = prev_snapshot?.linked_asset_id || null;
      const newLinked = tx.linked_asset_id || null;
      const oldEffect = oldLinked
        ? txEffect({ type: prev_snapshot.type, amount: prev_snapshot.amount })
        : 0;
      const newEffect = newLinked ? txEffect(tx) : 0;

      if (oldLinked && oldLinked === newLinked) {
        const delta = newEffect - oldEffect;
        if (Math.abs(delta) < 1e-9) return Response.json({ ok: true, skipped: true });
        const asset = await base44.asServiceRole.entities.Asset.get(oldLinked);
        if (!asset) return Response.json({ ok: true, skipped: true });
        if (asset.created_by_id !== me.id)
          return Response.json({ error: "forbidden" }, { status: 403 });
        const newValue = roundForCurrency((asset.value || 0) + delta, asset.currency);
        await base44.asServiceRole.entities.Asset.update(oldLinked, { value: newValue });
        return Response.json({ ok: true, asset_id: oldLinked, value: newValue });
      }

      // Aset berbeda: balik efek lama di aset lama, terapkan efek baru di aset baru.
      if (oldLinked) {
        const oldAsset = await base44.asServiceRole.entities.Asset.get(oldLinked);
        if (oldAsset && oldAsset.created_by_id === me.id) {
          const newValue = roundForCurrency((oldAsset.value || 0) - oldEffect, oldAsset.currency);
          await base44.asServiceRole.entities.Asset.update(oldLinked, { value: newValue });
        }
      }
      if (newLinked) {
        const newAsset = await base44.asServiceRole.entities.Asset.get(newLinked);
        if (newAsset && newAsset.created_by_id === me.id) {
          const newValue = roundForCurrency((newAsset.value || 0) + newEffect, newAsset.currency);
          await base44.asServiceRole.entities.Asset.update(newLinked, { value: newValue });
        }
      }
      return Response.json({ ok: true });
    }

    return Response.json({ error: "invalid_action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}