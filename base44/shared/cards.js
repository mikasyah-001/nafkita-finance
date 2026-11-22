// Logika murni "Dompet kartu" & SMS bank — dipakai backend function dan diuji
// dengan node --test. Prinsip keamanan: Nafkita TIDAK menyimpan nomor kartu
// lengkap, CVC/CVV, PIN ATM, atau OTP. Yang disimpan: nama, jenis, 4 digit
// terakhir, masa berlaku & foto depan bernomor tersamar (di balik PIN).

export const CARD_KINDS = ["debit", "credit", "emoney", "prepaid"];
export const CARD_NETWORKS = ["visa", "mastercard", "mada", "gpn", "amex", "jcb", "unionpay", "flazz", "emoney", "brizzi", "tapcash", "lainnya"];
export const CARD_STATUSES = ["active", "paused", "unmapped", "ignored"];
// Jenis aset yang boleh menjadi "rekening" sebuah kartu.
export const CARD_ASSET_TYPES = { debit: ["bank"], prepaid: ["bank", "tunai", "lainnya"], emoney: ["tunai", "lainnya", "bank"], credit: [] };

export const onlyDigits = (s) => String(s ?? "").replace(/\D/g, "");

// 4 digit terakhir dari apa pun yang diketik (nomor lengkap pun dipotong
// di sini, jadi nomor lengkap tidak pernah sampai ke server).
export function toLast4(input) {
  const d = onlyDigits(input);
  return d.length >= 4 ? d.slice(-4) : "";
}

export function validExpiry(month, year, now = new Date()) {
  const m = Number(month), y = Number(year);
  if (!Number.isInteger(m) || m < 1 || m > 12) return false;
  const full = y < 100 ? 2000 + y : y;
  if (!Number.isInteger(full) || full < now.getFullYear() - 1 || full > now.getFullYear() + 25) return false;
  return true;
}

export function expiryState(month, year, now = new Date()) {
  if (!validExpiry(month, year, now)) return null;
  const y = Number(year) < 100 ? 2000 + Number(year) : Number(year);
  const end = new Date(y, Number(month), 0, 23, 59, 59); // hari terakhir bulan itu
  const days = Math.floor((end - now) / 86400000);
  return days < 0 ? "expired" : days <= 60 ? "soon" : "ok";
}

// Teks yang tampak seperti CVC/nomor kartu lengkap tidak boleh tersimpan di
// kolom bebas (nama/catatan): 13–19 digit berurutan, atau "cvv/cvc ### ".
export function containsSensitiveCardData(text) {
  const s = String(text ?? "");
  if (/\b(?:\d[ -]?){13,19}\b/.test(s)) return true;
  if (/\b(cvv|cvc|cvn|kode keamanan)\b[^0-9]{0,6}\d{3,4}\b/i.test(s)) return true;
  return false;
}

export function cardAssetAllowed(kind, asset) {
  if (!asset) return kind === "credit"; // kartu kredit boleh tanpa rekening
  const allowed = CARD_ASSET_TYPES[kind] || [];
  return allowed.includes(asset.type || "bank");
}

// ---------- SMS bank ----------

const ARABIC_DIGITS = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9", "٫": ".", "٬": "," };
const normalizeDigits = (s) => String(s ?? "").replace(/[٠-٩٫٬]/g, (c) => ARABIC_DIGITS[c]);

export function isOtpSms(text) {
  return /\b(otp|one[- ]time|kode (verifikasi|otp|rahasia)|verification code|jangan berikan|do not share)\b|رمز (التحقق|المرور)|كلمة المرور لمرة/i.test(String(text ?? ""));
}

const CUR = "(SAR|SR|USD|IDR|Rp\\.?|EUR|ر\\.?\\s?س|ريال|رس)";
const NUM = "([0-9][0-9.,]*)";
const CUR_CODE = (raw) => {
  const r = String(raw || "").toLowerCase().replace(/\s/g, "");
  if (r.startsWith("rp") || r === "idr") return "IDR";
  if (r === "usd") return "USD";
  if (r === "eur") return "EUR";
  return "SAR"; // SAR, SR, ر.س, ريال, رس
};

function parseNumber(raw) {
  let s = String(raw || "").replace(/[.,]$/, "");
  const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? "." : ",";
    s = s.split(dec === "." ? "," : ".").join("").replace(dec, ".");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ",";
    const parts = s.split(sep);
    s = parts.length === 2 && parts[1].length <= 2 ? parts.join(".") : parts.join("");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Urai SMS transaksi bank (Arab/Inggris/Indonesia). Heuristik umum; aturan
 * khusus per bank bisa ditambahkan setelah ada contoh SMS asli.
 * → { ok, amount, currency, last4, merchant, direction: "out"|"in", reason }
 */
export function parseBankSms(text) {
  const t = normalizeDigits(text).replace(/\r/g, "");
  if (!t.trim()) return { ok: false, reason: "empty" };
  if (isOtpSms(t)) return { ok: false, reason: "otp" };

  let amount = 0, currency = null;
  const labeled = t.match(new RegExp(`(?:amount|amt|nominal|sejumlah|jumlah|مبلغ|بمبلغ)[:\\s]*${CUR}?\\s*${NUM}\\s*${CUR}?`, "i"));
  const before = t.match(new RegExp(`${CUR}\\s*${NUM}`, "i"));
  const after = t.match(new RegExp(`${NUM}\\s*${CUR}`, "i"));
  if (labeled) { amount = parseNumber(labeled[2]); currency = CUR_CODE(labeled[1] || labeled[3]); if (!labeled[1] && !labeled[3]) currency = null; }
  if (!(amount > 0) && before) { amount = parseNumber(before[2]); currency = CUR_CODE(before[1]); }
  if (!(amount > 0) && after) { amount = parseNumber(after[1]); currency = CUR_CODE(after[2]); }
  if (labeled && !currency) { const c = (before || after); if (c) currency = CUR_CODE(before ? before[1] : after[2]); }
  if (!(amount > 0)) return { ok: false, reason: "no_amount" };

  const l4 = t.match(/(?:\*{1,}|x{2,}|•{2,}|(?:card|kartu|بطاقة|رقم البطاقة)[^0-9\n]{0,12}\**)\s*(\d{4})(?!\d)/i);
  const merchantMatch = t.match(/(?:\bat\b|\bmerchant\b|\bdi\b|\bke\b|\bto\b|لدى|من عند|عند|التاجر)[:\s]+([^\n;:]{2,60})/i);
  let merchant = merchantMatch ? merchantMatch[1].trim().replace(/\s{2,}/g, " ") : "";
  // Potong ekor yang bukan nama toko: tanggal, kartu/rekening, saldo.
  merchant = merchant.replace(/\s+(on|pada|في|tgl|tanggal|kartu|card|rek|rekening|saldo|balance|بطاقة)\b.*$/i, "").replace(/\s*\*+\d*.*$/, "").replace(/[.,]+$/, "").trim();

  const incoming = /(credit(ed)?\b|deposit|received|incoming|transfer in|salary|refund|masuk|dikreditkan|diterima|إيداع|واردة|راتب|استرداد|مستردة)/i.test(t)
    && !/(purchase|pembelian|belanja|debit(ed)?\b|شراء|خصم|سحب)/i.test(t);
  return { ok: true, amount, currency, last4: l4 ? l4[1] : "", merchant, direction: incoming ? "in" : "out" };
}

// Satu pembelian bisa terkirim dua kali dari sumber berbeda (Apple Pay + SMS
// bank). Nama merchant di keduanya sering beda, jadi yang dicocokkan: rekening,
// nominal, arah, dan waktu (±30 menit) dengan sumber yang BERBEDA.
export function findCrossSourceTwin(candidate, recent = [], windowMin = 30) {
  const t = new Date(candidate.occurred_at).getTime();
  const amt = Number(candidate.amount) || 0;
  if (!(amt > 0) || Number.isNaN(t)) return null;
  return recent.find((r) => {
    if ((r.source || "apple_pay") === (candidate.source || "apple_pay")) return false;
    if (candidate.asset_id && r.asset_id !== candidate.asset_id) return false;
    if ((r.direction || "out") !== (candidate.direction || "out")) return false;
    if (Math.abs((Number(r.amount) || 0) - amt) > 0.005) return false;
    if (r.status === "dismissed") return false;
    const rt = new Date(r.occurred_at).getTime();
    return !Number.isNaN(rt) && Math.abs(rt - t) <= windowMin * 60000;
  }) || null;
}

// Cari kartu untuk SMS: 4 digit terakhir dulu (paling spesifik), lalu label.
export function matchCardForSms(cards = [], { last4 = "", label = "" } = {}) {
  const live = cards;
  if (last4) {
    const byL4 = live.filter((c) => c.last4 === last4);
    if (byL4.length === 1) return byL4[0];
    if (byL4.length > 1) return byL4.find((c) => label && c.wallet_label === label) || byL4.find((c) => c.status === "active") || byL4[0];
  }
  if (label) return live.find((c) => c.wallet_label === label) || null;
  return null;
}
