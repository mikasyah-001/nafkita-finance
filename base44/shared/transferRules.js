// Aturan transfer antar-rekening (satu logika, dipakai backend saveTransfer &
// diuji dengan node --test). Rekening asal harus milik sendiri. Rekening tujuan
// boleh milik sendiri ATAU milik pasangan aktif (bukan rekening pribadinya).
// Beda mata uang: wajib nominal "diterima" dalam mata uang rekening tujuan.

const up = (c) => String(c || "IDR").toUpperCase();
export const MONEY_TYPES = ["bank", "tunai"];

export function planTransfer({ from, to, meId, partnerId = null, amount, receivedAmount = null, visibility = "shared" }) {
  const amt = Number(amount);
  if (!from || !to) return { error: "Pilih rekening asal dan tujuan" };
  if (from.id === to.id) return { error: "Rekening asal dan tujuan tidak boleh sama" };
  if (!(amt > 0)) return { error: "Nominal harus lebih dari 0" };
  if (!MONEY_TYPES.includes(from.type || "bank") || !MONEY_TYPES.includes(to.type || "bank"))
    return { error: "Transfer hanya antar rekening bank atau uang tunai" };
  if (from.created_by_id !== meId) return { error: "Rekening asal harus milik Anda sendiri" };

  const toPartner = to.created_by_id !== meId;
  if (toPartner) {
    if (!partnerId || to.created_by_id !== partnerId) return { error: "Rekening tujuan bukan milik Anda atau pasangan aktif" };
    if (to.visibility === "private") return { error: "Rekening pribadi pasangan tidak bisa menjadi tujuan" };
  }

  const fromCur = up(from.currency);
  const toCur = up(to.currency);
  const cross = fromCur !== toCur;
  let received = amt;
  if (cross) {
    received = Number(receivedAmount);
    if (!(received > 0)) return { error: `Isi nominal yang diterima dalam ${toCur}` };
  }

  // Jangkauan: transfer ke pasangan selalu terlihat oleh pasangan di sisi
  // masuk; sisi keluar mengikuti rekening asal (rekening pribadi tetap pribadi).
  const outVisibility = toPartner ? (from.visibility === "private" ? "private" : "shared") : (visibility === "private" ? "private" : "shared");
  const inVisibility = toPartner ? "shared" : outVisibility;

  return { ok: true, toPartner, cross, amount: amt, received, fromCur, toCur, outVisibility, inVisibility };
}

// Siapa yang boleh menghapus transfer: pembuatnya, atau pemilik salah satu
// rekening yang terlibat (mis. pasangan penerima).
export function canDeleteTransfer(legs = [], assetsById = {}, meId) {
  if (!legs.length) return false;
  return legs.some((l) => l.created_by_id === meId || assetsById[l.linked_asset_id]?.created_by_id === meId);
}
