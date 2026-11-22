import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Menghapus aset (rekening bank, tunai, emas, investasi, dll.) dengan rapi.
// Hanya pemilik aset (created_by_id === me.id) yang boleh menghapus.
//
// Sebelum aset dihapus, semua yang menunjuk ke aset ini DILEPAS (bukan dihapus)
// agar tidak ada data yatim yang membuat fitur lain gagal:
//   - Transaction.linked_asset_id     → dikosongkan (riwayat transaksi tetap ada;
//                                        bila tidak, edit transaksi lama gagal "asset_not_found")
//   - RecurringBill / Debt.linked_asset_id → dikosongkan
//   - SavingsGoal.linked_asset_id / allocated_asset_ids → dilepas
//   - CardLabel (Catat Otomatis)     → kembali "unmapped" (transaksi kartu tak lagi dicatat)
//   - IncomingTransaction (baru)     → rekening dikosongkan, bisa dipilih ulang di Kotak Masuk
//   - InvestmentLot                  → dihapus (bagian dari aset itu sendiri)
// AssetMutation, AssetSnapshot & Reconciliation dibiarkan sebagai jejak audit.
//
// Body: { asset_id, dry_run? } — dry_run: hanya hitung dampak (untuk dialog konfirmasi).

const list = (res) => res?.items || res || [];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch { /* tanpa sesi */ }
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const assetId = body.asset_id;
    if (!assetId) return Response.json({ error: "asset_id required" }, { status: 400 });

    const asset = await base44.entities.Asset.get(assetId).catch(() => null);
    if (!asset) return Response.json({ error: "asset_not_found" }, { status: 404 });
    if (asset.created_by_id !== me.id)
      return Response.json({ error: "forbidden", message: "Hanya pemilik yang bisa menghapus aset ini" }, { status: 403 });

    const svc = base44.asServiceRole.entities;
    const find = async (entity, q, limit = 5000) => {
      try { return list(await svc[entity].filter(q, "-created_date", limit)); }
      catch (e) { console.error(`[deleteAssetWithLots] baca ${entity}`, e?.message); return []; }
    };

    const [txs, bills, debts, goalsLinked, goalsAll, labels, incoming, lots] = await Promise.all([
      find("Transaction", { linked_asset_id: assetId }),
      find("RecurringBill", { linked_asset_id: assetId }),
      find("Debt", { linked_asset_id: assetId }),
      find("SavingsGoal", { linked_asset_id: assetId }),
      find("SavingsGoal", { created_by_id: me.id }, 500),
      find("CardLabel", { owner_id: me.id, asset_id: assetId }),
      find("IncomingTransaction", { owner_id: me.id, asset_id: assetId, status: "new" }),
      find("InvestmentLot", { asset_id: assetId }, 2000),
    ]);
    const goalsAllocated = goalsAll.filter((g) => Array.isArray(g.allocated_asset_ids) && g.allocated_asset_ids.includes(assetId));
    const goalIds = new Set([...goalsLinked, ...goalsAllocated].map((g) => g.id));

    const impact = {
      transactions: txs.length,
      recurring_bills: bills.length,
      debts: debts.length,
      savings_goals: goalIds.size,
      card_labels: labels.length,
      inbox_items: incoming.length,
      investment_lots: lots.length,
    };
    if (body.dry_run) return Response.json({ ok: true, dry_run: true, asset: { id: asset.id, name: asset.name }, impact });

    // Lepas tautan (per record — jumlahnya kecil untuk aset keluarga).
    const failures = [];
    const each = async (label, rows, fn) => {
      for (const r of rows) {
        try { await fn(r); } catch (e) { failures.push(label); console.error(`[deleteAssetWithLots] ${label}`, r.id, e?.message); }
      }
    };
    await each("Transaction", txs, (t) => svc.Transaction.update(t.id, { linked_asset_id: null }));
    await each("RecurringBill", bills, (b) => svc.RecurringBill.update(b.id, { linked_asset_id: null }));
    await each("Debt", debts, (d) => svc.Debt.update(d.id, { linked_asset_id: null }));
    await each("SavingsGoal", [...goalsLinked, ...goalsAllocated].filter((g, i, arr) => arr.findIndex((x) => x.id === g.id) === i), (g) => {
      const patch = {};
      if (g.linked_asset_id === assetId) patch.linked_asset_id = null;
      if (Array.isArray(g.allocated_asset_ids) && g.allocated_asset_ids.includes(assetId))
        patch.allocated_asset_ids = g.allocated_asset_ids.filter((x) => x !== assetId);
      return svc.SavingsGoal.update(g.id, patch);
    });
    await each("CardLabel", labels, (l) => svc.CardLabel.update(l.id, { asset_id: null, status: "unmapped" }));
    await each("IncomingTransaction", incoming, (it) => svc.IncomingTransaction.update(it.id, { asset_id: null }));

    // Bila ada tautan yang gagal dilepas, JANGAN hapus aset (hindari data yatim);
    // pengguna bisa mencoba lagi — langkah di atas aman diulang.
    if (failures.length) {
      return Response.json({ error: "unlink_failed", message: "Sebagian data gagal dilepas dari aset. Coba lagi.", failed: [...new Set(failures)] }, { status: 500 });
    }

    if (lots.length) {
      try { await svc.InvestmentLot.deleteMany({ asset_id: assetId }); }
      catch (e) { console.error("[deleteAssetWithLots] hapus lot", e?.message); }
    }
    await base44.entities.Asset.delete(assetId);

    return Response.json({ ok: true, asset_id: assetId, impact, lots_deleted: lots.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
