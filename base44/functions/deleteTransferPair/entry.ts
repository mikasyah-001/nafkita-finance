import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { roundForCurrency } from "../../shared/assetAdjust.ts";
import { recordAssetMutation } from "../../shared/assetMutation.ts";
import { canDeleteTransfer } from "../../shared/transferRules.js";

// Menghapus sepasang transaksi transfer dan mengembalikan saldo KEDUA rekening
// (termasuk rekening pasangan — lewat service role). Boleh dilakukan oleh
// pembuat transfer atau pemilik salah satu rekening (mis. pasangan penerima).
// Tiap sisi dikembalikan dalam mata uangnya sendiri (aman untuk beda kurs).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch { /* tanpa sesi */ }
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { transaction_id } = body;
    if (!transaction_id) return Response.json({ error: "transaction_id wajib diisi" }, { status: 400 });

    const svc = base44.asServiceRole.entities;
    const tx = await svc.Transaction.get(transaction_id).catch(() => null);
    if (!tx) return Response.json({ error: "tx_not_found" }, { status: 404 });
    if (!tx.transfer_pair_id) return Response.json({ error: "bukan_transfer" }, { status: 400 });

    const pairId = tx.transfer_pair_id;
    const res = await svc.Transaction.filter({ transfer_pair_id: pairId }, "-created_date", 10);
    const legs = (res?.items || res || []).filter((t) => t.transfer_pair_id === pairId);

    const assetsById = {};
    for (const leg of legs) {
      if (leg.linked_asset_id && !assetsById[leg.linked_asset_id])
        assetsById[leg.linked_asset_id] = await svc.Asset.get(leg.linked_asset_id).catch(() => null);
    }
    if (!canDeleteTransfer(legs, assetsById, me.id))
      return Response.json({ error: "forbidden", message: "Hanya pengirim atau pemilik rekening yang bisa menghapus transfer ini" }, { status: 403 });

    // Keaslian transfer: field transfer_pair_id bisa diisi pemilik transaksi
    // lewat RLS update, jadi "pasangan transfer" bisa dipalsukan. Bukti yang
    // tidak bisa dipalsukan klien = jejak AssetMutation (create hanya service
    // role) dengan source_ref = pairId untuk setiap rekening yang tersentuh.
    // Saldo dibalik sesuai jejak itu, bukan sesuai angka di transaksi.
    if (legs.length !== 2 || new Set(legs.map((l) => l.created_by_id)).size !== 1 || new Set(legs.map((l) => l.type)).size !== 2)
      return Response.json({ error: "invalid_transfer", message: "Data transfer tidak utuh — hubungi admin" }, { status: 409 });
    const muts = await svc.AssetMutation.filter({ source_ref: pairId }, "-created_date", 20).catch(() => []);
    const mutByAsset = {};
    for (const m of muts || []) if (m.change_type === "transfer" && !mutByAsset[m.asset_id]) mutByAsset[m.asset_id] = m;
    const onlyMine = legs.every((l) => !l.linked_asset_id || assetsById[l.linked_asset_id]?.created_by_id === me.id);
    for (const leg of legs) {
      if (!leg.linked_asset_id || !assetsById[leg.linked_asset_id]) continue;
      const m = mutByAsset[leg.linked_asset_id];
      if (m) leg._reverse = -((Number(m.new_value) || 0) - (Number(m.previous_value) || 0));
      else if (onlyMine) leg._reverse = leg.type === "income" ? -(Number(leg.amount) || 0) : (Number(leg.amount) || 0); // data lama, hanya rekening sendiri
      else return Response.json({ error: "unverified_transfer", message: "Transfer ini tidak bisa diverifikasi — saldo rekening pasangan tidak diubah. Hubungi admin." }, { status: 409 });
    }

    // Kembalikan saldo tiap sisi (keluar → tambah, masuk → kurangi).
    const restored = [];
    try {
      for (const leg of legs) {
        const asset = assetsById[leg.linked_asset_id];
        if (!asset) continue;
        const reverse = leg._reverse;
        const prev = Number(asset.value) || 0;
        const next = roundForCurrency(prev + reverse, asset.currency);
        await svc.Asset.update(asset.id, { value: next });
        asset.value = next;
        restored.push({ asset, prev, next, leg });
      }
    } catch (e) {
      for (const r of restored.reverse()) { try { await svc.Asset.update(r.asset.id, { value: r.prev }); } catch { /* biarkan */ } }
      return Response.json({ error: "restore_failed", message: "Gagal mengembalikan saldo, transfer tidak dihapus" }, { status: 500 });
    }

    for (const leg of legs) {
      try { await svc.Transaction.delete(leg.id); } catch (e) { console.error("[deleteTransferPair] hapus", leg.id, e?.message); }
    }
    for (const r of restored) {
      try {
        await recordAssetMutation(base44, {
          asset_id: r.asset.id, previous_value: r.prev, new_value: r.next, change_type: "transfer", source_ref: pairId,
          source_description: `Transfer dibatalkan: ${r.leg.merchant || ""}`, actor_id: me.id, actor_name: me.full_name || me.email,
          currency: r.asset.currency || "IDR",
        });
      } catch { /* jejak opsional */ }
    }

    return Response.json({ ok: true, deleted: legs.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
