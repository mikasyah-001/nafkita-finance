/**
 * Smart duplicate detection for transactions.
 *
 * Nominal dibandingkan PERSIS (tanpa pembulatan) — sehingga 125.50 SAR/USD
 * tidak keliru dengan 126.
 *
 * - Bila merchant ada: tanggal+jam, merchant, nominal, tipe, mata uang, jangkauan.
 * - Bila merchant kosong: tanggal (tanpa jam), nominal, kategori, tipe, mata uang,
 *   jangkauan — sehingga transaksi tanpa merchant tetap diperiksa sebagai duplikat.
 */

const normAmount = (n) => Number(n) || 0;

export const txFingerprint = (tx = {}) => {
  const d = tx.date ? new Date(tx.date) : null;
  const merchant = String(tx.merchant || "").toLowerCase().trim();
  if (merchant) {
    const dateTimeKey = d && !isNaN(d) ? d.toISOString().slice(0, 16) : "";
    return [tx.type || "expense", normAmount(tx.amount), tx.currency || "IDR", dateTimeKey, merchant, tx.visibility || "shared"].join("|");
  }
  const dateKey = d && !isNaN(d) ? d.toISOString().slice(0, 10) : "";
  return [tx.type || "expense", normAmount(tx.amount), tx.currency || "IDR", dateKey, tx.category || "", tx.visibility || "shared"].join("|");
};

/** Find the first existing transaction that duplicates `tx`. */
export const findDuplicate = (tx, existingList = []) => {
  const fp = txFingerprint(tx);
  return (existingList || []).find((e) => e && txFingerprint(e) === fp);
};

/** Remove internal duplicates within a batch, keeping the first occurrence. */
export const dedupeBatch = (items = []) => {
  const seen = new Set();
  const result = [];
  (items || []).forEach((it) => {
    const fp = txFingerprint(it);
    if (seen.has(fp)) return;
    seen.add(fp);
    result.push(it);
  });
  return result;
};

/** Split items into those that are new vs. those that already exist. */
export const filterAgainstExisting = (items = [], existing = []) => {
  const existingFps = new Set((existing || []).map(txFingerprint));
  const toSave = [];
  const skipped = [];
  (items || []).forEach((it) => {
    if (existingFps.has(txFingerprint(it))) skipped.push(it);
    else toSave.push(it);
  });
  return { toSave, skipped };
};