import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { txEffect, roundForCurrency } from "../../shared/assetAdjust.ts";

// Menghapus transaksi + mengembalikan saldo aset terkait secara atomik.
// Urutan: hapus transaksi dulu (bila gagal, saldo tidak disentuh),
// lalu kembalikan saldo aset. Hanya pemilik transaksi yang boleh menghapus.
// Saldo negatif diizinkan; pembulatan per mata uang.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { transaction_id } = body;
    if (!transaction_id)
      return Response.json({ error: "missing_id" }, { status: 400 });

    const tx = await base44.entities.Transaction.get(transaction_id);
    if (!tx) return Response.json({ error: "tx_not_found" }, { status: 404 });
    if (tx.created_by_id !== me.id)
      return Response.json({ error: "forbidden" }, { status: 403 });

    // Sesuaikan saldo aset LEBIH DULU, lalu hapus transaksi.
    // Urutan ini memungkinkan rollback bila penghapusan gagal.
    if (tx.linked_asset_id) {
      const asset = await base44.entities.Asset.get(tx.linked_asset_id);
      if (!asset) return Response.json({ error: "asset_not_found" }, { status: 404 });
      if (asset.created_by_id !== me.id)
        return Response.json({ error: "forbidden" }, { status: 403 });
      const prevValue = asset.value;
      const delta = -txEffect(tx);
      const newValue = roundForCurrency((asset.value || 0) + delta, asset.currency);
      await base44.entities.Asset.update(tx.linked_asset_id, { value: newValue });

      // Hapus transaksi; bila gagal, kembalikan saldo aset.
      try {
        await base44.entities.Transaction.delete(transaction_id);
      } catch (e) {
        try { await base44.entities.Asset.update(tx.linked_asset_id, { value: prevValue }); }
        catch (rbErr) { console.error("[deleteTransactionWithAsset] rollback failed for asset", tx.linked_asset_id, rbErr); }
        return Response.json({ error: e?.message || "delete_failed" }, { status: 500 });
      }
    } else {
      // Tidak ada aset terkait — langsung hapus.
      await base44.entities.Transaction.delete(transaction_id);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}