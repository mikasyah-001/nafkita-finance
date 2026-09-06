// Skema cadangan seragam (dipakai bersama oleh backupToDrive & restoreFromDrive).
export const BACKUP_ENTITIES = [
  { key: "transactions", entity: "Transaction" },
  { key: "assets", entity: "Asset" },
  { key: "categories", entity: "Category" },
  { key: "budgets", entity: "Budget" },
  { key: "zakatPayments", entity: "ZakatPayment" },
  { key: "snapshots", entity: "AssetSnapshot" },
  { key: "templates", entity: "TransactionTemplate" },
  { key: "investmentLots", entity: "InvestmentLot" },
];

export const BACKUP_VERSION = 2;

const normAmount = (n) => Number(n) || 0;

// Fingerprint transaksi — sama dengan src/lib/duplicateDetect.js (frontend).
export function txFingerprint(tx = {}) {
  const d = tx.date ? new Date(tx.date) : null;
  const merchant = String(tx.merchant || "").toLowerCase().trim();
  if (merchant) {
    const dateTimeKey = d && !isNaN(d) ? new Date(d).toISOString().slice(0, 16) : "";
    return [tx.type || "expense", normAmount(tx.amount), tx.currency || "IDR", dateTimeKey, merchant, tx.visibility || "shared"].join("|");
  }
  const dateKey = d && !isNaN(d) ? new Date(d).toISOString().slice(0, 10) : "";
  return [tx.type || "expense", normAmount(tx.amount), tx.currency || "IDR", dateKey, tx.category || "", tx.visibility || "shared"].join("|");
}

export function assetFingerprint(a = {}) {
  return [String(a.name || "").toLowerCase().trim(), a.type || "", a.currency || "IDR"].join("|");
}

export function categoryFingerprint(c = {}) {
  return [String(c.name || "").toLowerCase().trim(), c.type || ""].join("|");
}

export function budgetFingerprint(b = {}) {
  return [b.category || "", b.period || "", b.currency || "IDR", b.visibility || "shared"].join("|");
}