import { base44 } from "@/api/base44Client";
import { txFingerprint } from "@/lib/duplicateDetect";

// Skema cadangan seragam (sama dengan base44/shared/backupFormat.ts untuk Drive).
export const BACKUP_ENTITIES = [
  { key: "transactions", entity: "Transaction" },
  { key: "assets", entity: "Asset" },
  { key: "categories", entity: "Category" },
  { key: "budgets", entity: "Budget" },
  { key: "zakatPayments", entity: "ZakatPayment" },
  { key: "snapshots", entity: "AssetSnapshot" },
  { key: "templates", entity: "TransactionTemplate" },
  { key: "investmentLots", entity: "InvestmentLot" },
  { key: "preferences", entity: "NotificationPreference" },
];

export const BACKUP_VERSION = 2;

const STRIP = ["id", "created_date", "updated_date", "created_by_id"];
const strip = (r) => { const c = { ...r }; STRIP.forEach((k) => delete c[k]); return c; };

const assetFp = (a) => [String(a.name || "").toLowerCase().trim(), a.type || "", a.currency || "IDR"].join("|");
const categoryFp = (c) => [String(c.name || "").toLowerCase().trim(), c.type || ""].join("|");
const budgetFp = (b) => [b.category || "", b.period || "", b.currency || "IDR", b.visibility || "shared"].join("|");

export async function exportBackup() {
  const data = {};
  for (const e of BACKUP_ENTITIES) {
    data[e.key] = await base44.entities[e.entity].list("-created_date", 5000);
  }
  return {
    app: "NAFKITA",
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    counts: Object.fromEntries(BACKUP_ENTITIES.map((e) => [e.key, data[e.key].length])),
    data,
  };
}

// Memulihkan cadangan. mode: "merge" (lewati duplikat) | "replace" (hapus data sendiri dulu).
// Remap InvestmentLot.asset_id ke ID aset baru hasil pemulihan.
export async function importBackup(backup, mode, userId) {
  const d = backup.data || {};

  // Muat data existing untuk dedup.
  const existing = {};
  for (const e of BACKUP_ENTITIES) {
    existing[e.key] = await base44.entities[e.entity].list("-created_date", 5000);
  }

  // Mode Ganti total: hapus data milik sendiri, lalu muat ulang existing.
  if (mode === "replace" && userId) {
    for (const e of BACKUP_ENTITIES) {
      try { await base44.entities[e.entity].deleteMany({ created_by_id: userId }); } catch {}
    }
    for (const e of BACKUP_ENTITIES) {
      existing[e.key] = await base44.entities[e.entity].list("-created_date", 5000);
    }
  }

  // 1) Aset lebih dulu — bangun peta oldId -> newId.
  const assetIdMap = {};
  const existingAssetFps = new Set(existing.assets.map(assetFp));
  const assetsToCreate = [];
  for (const a of (d.assets || [])) {
    const fp = assetFp(a);
    if (existingAssetFps.has(fp)) {
      const ex = existing.assets.find((x) => assetFp(x) === fp);
      if (a.id && ex?.id) assetIdMap[a.id] = ex.id;
      continue;
    }
    assetsToCreate.push(a);
  }
  const createdAssets = assetsToCreate.length
    ? await base44.entities.Asset.bulkCreate(assetsToCreate.map(strip))
    : [];
  createdAssets.forEach((na, i) => {
    const oldId = assetsToCreate[i].id;
    if (oldId && na?.id) assetIdMap[oldId] = na.id;
  });

  // 2) Kategori.
  const existingCatFps = new Set(existing.categories.map(categoryFp));
  const catsToCreate = (d.categories || []).filter((c) => !existingCatFps.has(categoryFp(c)));
  if (catsToCreate.length) await base44.entities.Category.bulkCreate(catsToCreate.map(strip));

  // 3) Transaksi (dedup fingerprint).
  const existingTxFps = new Set(existing.transactions.map(txFingerprint));
  const txToCreate = (d.transactions || []).filter((t) => !existingTxFps.has(txFingerprint(t)));
  if (txToCreate.length) {
    const restoreBatch = "restore-" + Date.now();
    await base44.entities.Transaction.bulkCreate(txToCreate.map((t) => ({ ...strip(t), notif_batch_id: restoreBatch })));
  }

  // 4) Anggaran.
  const existingBudgetFps = new Set(existing.budgets.map(budgetFp));
  const budgetsToCreate = (d.budgets || []).filter((b) => !existingBudgetFps.has(budgetFp(b)));
  if (budgetsToCreate.length) await base44.entities.Budget.bulkCreate(budgetsToCreate.map(strip));

  // 5) Entitas lain (zakat, snapshot, template, preferensi).
  for (const key of ["zakatPayments", "snapshots", "templates", "preferences"]) {
    const e = BACKUP_ENTITIES.find((x) => x.key === key);
    const recs = (d[key] || []).map(strip);
    if (recs.length) await base44.entities[e.entity].bulkCreate(recs);
  }

  // 6) Lot investasi — remap asset_id; lewati lot yatim.
  const lotsToCreate = (d.investmentLots || []).map((l) => {
    if (l.asset_id && !assetIdMap[l.asset_id]) return null;
    return { ...l, asset_id: l.asset_id ? assetIdMap[l.asset_id] : l.asset_id };
  }).filter(Boolean).map(strip);
  if (lotsToCreate.length) await base44.entities.InvestmentLot.bulkCreate(lotsToCreate);

  return {
    transactions: txToCreate.length,
    assets: assetsToCreate.length,
    categories: catsToCreate.length,
    budgets: budgetsToCreate.length,
    zakatPayments: (d.zakatPayments || []).length,
    snapshots: (d.snapshots || []).length,
    templates: (d.templates || []).length,
    preferences: (d.preferences || []).length,
    investmentLots: lotsToCreate.length,
  };
}