import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { txEffect, roundForCurrency } from "../../shared/assetAdjust.ts";

// Menghapus sepasang transaksi transfer dan membalik penyesuaian saldo aset.
// Menerima transaction_id salah satu leg transfer; akan menemukan pasangannya
// via transfer_pair_id dan menghapus keduanya.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { transaction_id } = body;
    if (!transaction_id)
      return Response.json({ error: "transaction_id wajib diisi" }, { status: 400 });

    const tx = await base44.entities.Transaction.get(transaction_id);
    if (!tx) return Response.json({ error: "tx_not_found" }, { status: 404 });
    if (tx.created_by_id !== me.id)
      return Response.json({ error: "forbidden" }, { status: 403 });
    if (!tx.transfer_pair_id)
      return Response.json({ error: "bukan_transfer" }, { status: 400 });

    const pairId = tx.transfer_pair_id;

    // Cari pasangan transfer (leg lain dengan transfer_pair_id yang sama).
    const pair = await base44.entities.Transaction.filter({ transfer_pair_id: pairId });
    const legs = (pair || []).filter((t) => t.transfer_pair_id === pairId);

    // Balik penyesuaian saldo aset untuk setiap leg.
    for (const leg of legs) {
      if (leg.linked_asset_id) {
        try {
          const asset = await base44.entities.Asset.get(leg.linked_asset_id);
          if (asset) {
            // Balik efek: income -> kurangi, expense -> tambah.
            const reverse = leg.type === "income" ? -(leg.amount) : leg.amount;
            const newVal = roundForCurrency((asset.value || 0) + reverse, asset.currency);
            await base44.entities.Asset.update(leg.linked_asset_id, { value: newVal });
          }
        } catch (e) {
          console.error("[deleteTransferPair] rollback asset failed", leg.linked_asset_id, e);
        }
      }
    }

    // Hapus kedua leg.
    for (const leg of legs) {
      try { await base44.entities.Transaction.delete(leg.id); } catch (e) {
        console.error("[deleteTransferPair] delete tx failed", leg.id, e);
      }
    }

    return Response.json({ ok: true, deleted: legs.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}