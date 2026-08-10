/**
 * Smart duplicate detection for transactions.
 * A fingerprint is built from type, amount, currency, date (day), merchant, and visibility.
 * Two transactions with the same fingerprint are considered duplicates.
 */

export const txFingerprint = (tx = {}) => {
  const dateKey = tx.date ? new Date(tx.date).toISOString().slice(0, 10) : "";
  const merchant = String(tx.merchant || "").toLowerCase().trim();
  return [
    tx.type || "expense",
    Math.round(Number(tx.amount) || 0),
    tx.currency || "IDR",
    dateKey,
    merchant,
    tx.visibility || "shared",
  ].join("|");
};

/** Find the first existing transaction that duplicates `tx`. */
export const findDuplicate = (tx, existingList = []) =>
  existingList.find((e) => e && txFingerprint(e) === txFingerprint(tx));

/** Remove internal duplicates within a batch, keeping the first occurrence. */
export const dedupeBatch = (items = []) => {
  const seen = new Set();
  const result = [];
  items.forEach((it) => {
    const fp = txFingerprint(it);
    if (seen.has(fp)) return;
    seen.add(fp);
    result.push(it);
  });
  return result;
};

/** Split items into those that are new vs. those that already exist. */
export const filterAgainstExisting = (items = [], existing = []) => {
  const existingFps = new Set(existing.map(txFingerprint));
  const toSave = [];
  const skipped = [];
  items.forEach((it) => {
    if (existingFps.has(txFingerprint(it))) skipped.push(it);
    else toSave.push(it);
  });
  return { toSave, skipped };
};