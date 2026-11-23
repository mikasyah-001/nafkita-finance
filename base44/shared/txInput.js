// Validasi input transaksi dari klien — SATU aturan untuk backend function
// (saveTransactionWithAsset, saveTransactionBatch) dan frontend.
//
// Hanya field yang boleh diatur pengguna yang diteruskan. Field sistem seperti
// approval_status, approval_id, transfer_pair_id, savings_goal_id,
// is_adjustment, is_debt_settlement, is_savings_deposit, created_by_id TIDAK
// pernah diambil dari klien — dulu bisa disuntikkan lalu dipakai fungsi
// service-role (mis. menghapus "transfer" palsu yang mengubah saldo aset orang lain).
export const TX_INPUT_FIELDS = [
  "type", "amount", "currency", "category", "date", "merchant", "notes",
  "photo_url", "tags", "visibility", "input_by_name", "notif_batch_id", "linked_asset_id",
];
export const TX_TYPES = ["income", "expense", "sedekah"];
export const MAX_AMOUNT = 1e13; // di atas ini hampir pasti salah ketik/serangan

// URL yang aman dirender sebagai tautan/gambar/iframe: hanya https (atau data
// gambar dari kamera). Menolak javascript:, data:text/html, vbscript:, dll.
export function isSafeUrl(url) {
  if (url == null || url === "") return true;
  const s = String(url).trim();
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(s)) return true;
  try {
    const u = new URL(s);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}
export const safeUrl = (url) => (url && isSafeUrl(url) ? String(url).trim() : "");

const clip = (v, n) => (v == null ? v : String(v).slice(0, n));

/**
 * @param {object} raw     input klien
 * @param {object} opts    { partial: true } untuk update (field yang tak dikirim dibiarkan)
 * @returns {{ data?: object, error?: string }}
 */
export function sanitizeTxInput(raw, { partial = false } = {}) {
  if (!raw || typeof raw !== "object") return { error: "missing_transaction" };
  const t = {};
  for (const k of TX_INPUT_FIELDS) if (raw[k] !== undefined) t[k] = raw[k];

  if (t.type !== undefined && !TX_TYPES.includes(t.type)) return { error: "invalid_type" };
  if (!partial && t.type === undefined) return { error: "invalid_type" };

  if (t.amount !== undefined || !partial) {
    const n = typeof t.amount === "number" ? t.amount : Number(String(t.amount ?? "").trim());
    if (!Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) return { error: "invalid_amount" };
    t.amount = n;
  }
  if (t.currency !== undefined) {
    const c = String(t.currency || "IDR").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(c)) return { error: "invalid_currency" };
    t.currency = c;
  }
  if (t.visibility !== undefined && !["shared", "private"].includes(t.visibility)) return { error: "invalid_visibility" };
  if (t.date !== undefined && t.date !== null && Number.isNaN(new Date(t.date).getTime())) return { error: "invalid_date" };
  if (t.photo_url !== undefined && !isSafeUrl(t.photo_url)) return { error: "invalid_photo_url" };
  if (t.tags !== undefined) {
    if (!Array.isArray(t.tags)) return { error: "invalid_tags" };
    t.tags = t.tags.filter((x) => typeof x === "string").slice(0, 20).map((x) => x.slice(0, 40));
  }
  if (t.linked_asset_id !== undefined && t.linked_asset_id !== null && typeof t.linked_asset_id !== "string") return { error: "invalid_asset" };
  t.category = clip(t.category, 80);
  t.merchant = clip(t.merchant, 200);
  t.notes = clip(t.notes, 2000);
  t.input_by_name = clip(t.input_by_name, 120);
  t.notif_batch_id = clip(t.notif_batch_id, 120);
  for (const k of Object.keys(t)) if (t[k] === undefined) delete t[k];
  return { data: t };
}
