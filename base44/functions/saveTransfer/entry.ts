import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { txEffect, roundForCurrency } from "../../shared/assetAdjust.ts";
import { recordAssetMutation } from "../../shared/assetMutation.ts";

// Membuat sepasang transaksi transfer antar-rekening secara atomik.
// - Transaksi "out" (expense) dari rekening asal, menyesuaikan saldo aset asal (-amount).
// - Transaksi "in" (income) ke rekening tujuan, menyesuaikan saldo aset tujuan (+amount).
// - Kedua transaksi memiliki transfer_pair_id yang sama.
// - Transfer tidak memicu notifikasi instan (notif_batch_id).
//
// Rollback: bila pembuatan transaksi kedua gagal, hapus transaksi pertama
// dan kembalikan saldo kedua aset ke nilai semula.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { from_asset_id, to_asset_id, amount, currency, date, notes, visibility } = body;

    if (!from_asset_id || !to_asset_id)
      return Response.json({ error: "from_asset_id dan to_asset_id wajib diisi" }, { status: 400 });
    if (from_asset_id === to_asset_id)
      return Response.json({ error: "Rekening asal dan tujuan tidak boleh sama" }, { status: 400 });
    const amt = Number(amount);
    if (!amt || amt <= 0)
      return Response.json({ error: "Nominal harus > 0" }, { status: 400 });

    const cur = (currency || "IDR").toUpperCase();
    const vis = visibility || "shared";
    const txDate = date || new Date().toISOString();
    const inputByName = me.full_name || me.email;
    const pairId = "trf-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const batchId = "transfer-" + pairId;

    // Ambil kedua aset, validasi kepemilikan.
    const fromAsset = await base44.entities.Asset.get(from_asset_id);
    if (!fromAsset) return Response.json({ error: "aset_asal_tidak_ditemukan" }, { status: 404 });
    if (fromAsset.created_by_id !== me.id)
      return Response.json({ error: "forbidden_asal" }, { status: 403 });

    const toAsset = await base44.entities.Asset.get(to_asset_id);
    if (!toAsset) return Response.json({ error: "aset_tujuan_tidak_ditemukan" }, { status: 404 });
    if (toAsset.created_by_id !== me.id)
      return Response.json({ error: "forbidden_tujuan" }, { status: 403 });

    // Sesuaikan saldo aset asal (-amount).
    const fromPrev = fromAsset.value;
    const fromNew = roundForCurrency((fromAsset.value || 0) - amt, fromAsset.currency);
    await base44.entities.Asset.update(from_asset_id, { value: fromNew });

    await recordAssetMutation(base44, {
      asset_id: from_asset_id, previous_value: fromPrev, new_value: fromNew,
      change_type: "transfer", source_ref: pairId,
      source_description: `Transfer ke ${toAsset.name || "rekening tujuan"}`,
      actor_id: me.id, actor_name: me.full_name || me.email,
      currency: fromAsset.currency || "IDR",
    });

    // Sesuaikan saldo aset tujuan (+amount).
    const toPrev = toAsset.value;
    const toNew = roundForCurrency((toAsset.value || 0) + amt, toAsset.currency);
    try {
      await base44.entities.Asset.update(to_asset_id, { value: toNew });
      await recordAssetMutation(base44, {
        asset_id: to_asset_id, previous_value: toPrev, new_value: toNew,
        change_type: "transfer", source_ref: pairId,
        source_description: `Transfer dari ${fromAsset.name || "rekening asal"}`,
        actor_id: me.id, actor_name: me.full_name || me.email,
        currency: toAsset.currency || "IDR",
      });
    } catch (e) {
      // Rollback aset asal bila aset tujuan gagal.
      try { await base44.entities.Asset.update(from_asset_id, { value: fromPrev }); } catch {}
      return Response.json({ error: e?.message || "gagal_sesuaikan_tujuan" }, { status: 500 });
    }

    // Buat transaksi "out" (expense dari rekening asal).
    let outTx;
    try {
      outTx = await base44.entities.Transaction.create({
        type: "expense",
        amount: amt,
        currency: cur,
        category: "Transfer",
        date: txDate,
        merchant: `Transfer ke ${toAsset.name || "rekening tujuan"}`,
        notes: notes || "",
        input_by_name: inputByName,
        tags: [],
        visibility: vis,
        linked_asset_id: from_asset_id,
        notif_batch_id: batchId,
        transfer_pair_id: pairId,
        transfer_direction: "out",
      });
    } catch (e) {
      // Rollback kedua aset.
      try { await base44.entities.Asset.update(from_asset_id, { value: fromPrev }); } catch {}
      try { await base44.entities.Asset.update(to_asset_id, { value: toPrev }); } catch {}
      return Response.json({ error: e?.message || "gagal_buat_out" }, { status: 500 });
    }

    // Buat transaksi "in" (income ke rekening tujuan).
    let inTx;
    try {
      inTx = await base44.entities.Transaction.create({
        type: "income",
        amount: amt,
        currency: cur,
        category: "Transfer",
        date: txDate,
        merchant: `Transfer dari ${fromAsset.name || "rekening asal"}`,
        notes: notes || "",
        input_by_name: inputByName,
        tags: [],
        visibility: vis,
        linked_asset_id: to_asset_id,
        notif_batch_id: batchId,
        transfer_pair_id: pairId,
        transfer_direction: "in",
      });
    } catch (e) {
      // Rollback: hapus transaksi out + kembalikan kedua aset.
      try { await base44.entities.Transaction.delete(outTx.id); } catch {}
      try { await base44.entities.Asset.update(from_asset_id, { value: fromPrev }); } catch {}
      try { await base44.entities.Asset.update(to_asset_id, { value: toPrev }); } catch {}
      return Response.json({ error: e?.message || "gagal_buat_in" }, { status: 500 });
    }

    return Response.json({ ok: true, transfer_pair_id: pairId, out_tx: outTx, in_tx: inTx });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}