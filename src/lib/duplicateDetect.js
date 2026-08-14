/**
 * Smart duplicate detection for transactions.
 *
 * Duplikat = tanggal, jam, no transaksi (merchant), nominal, tipe, mata uang,
 * dan jangkauan semua sama.
 *
 * Jika hanya nominal & tanggal sama (tanpa jam / no transaksi yang sama),
 * BUKAN duplikat. Karena itu duplikasi hanya dipertimbangkan ketika merchant
 * (no transaksi) tidak kosong.
 */

export const isDuplicable = (tx = {}) => {
  const merchant = String(tx.merchant || "").trim();
  return merchant.length > 0;
};

export const txFingerprint = (tx = {}) => {
  const d = tx.date ? new Date(tx.date) : null;
  // YYYY-MM-DDTHH:mm -> tanggal + jam menit
  const dateTimeKey = d && !isNaN(d) ? d.toISOString().slice(0, 16) : "";
  const merchant = String(tx.merchant || "").toLowerCase().trim();
  return [
    tx.type || "expense",
    Math.round(Number(tx.amount) || 0),
    tx.currency || "IDR",
    dateTimeKey,
    merchant,
    tx.visibility || "shared",
  ].join("|");
};

/** Find the first existing transaction that duplicates `tx`. */
export const findDuplicate = (tx, existingList = []) => {
  if (!isDuplicable(tx)) return undefined;
  const fp = txFingerprint(tx);
  return (existingList || []).find((e) => e && isDuplicable(e) && txFingerprint(e) === fp);
};

/** Remove internal duplicates within a batch, keeping the first occurrence. */
export const dedupeBatch = (items = []) => {
  const seen = new Set();
  const result = [];
  (items || []).forEach((it) => {
    if (!isDuplicable(it)) {
      result.push(it);
      return;
    }
    const fp = txFingerprint(it);
    if (seen.has(fp)) return;
    seen.add(fp);
    result.push(it);
  });
  return result;
};

/** Split items into those that are new vs. those that already exist. */
export const filterAgainstExisting = (items = [], existing = []) => {
  const existingFps = new Set((existing || []).filter(isDuplicable).map(txFingerprint));
  const toSave = [];
  const skipped = [];
  (items || []).forEach((it) => {
    if (isDuplicable(it) && existingFps.has(txFingerprint(it))) skipped.push(it);
    else toSave.push(it);
  });
  return { toSave, skipped };
};