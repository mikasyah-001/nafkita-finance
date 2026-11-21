// Logika murni untuk "Catat Otomatis" (Apple Pay via Shortcuts iOS).
// Tanpa dependensi — dipakai backend function (Deno) dan diuji dengan node --test.
//
// Desain label: shortcut di iPhone mengirim LABEL yang ditentukan pengguna
// (mis. "rajhi-harian"), bukan nama kartu dari Apple. Label dipetakan ke satu
// aset Nafkita. Label tak dikenal → transaksi TIDAK disimpan.

export const LABEL_MAX = 32;
export const DUPLICATE_WINDOW_MIN = 10;

// "Al Rajhi Harian" → "al-rajhi-harian". Huruf kecil, angka, tanda "-".
export function normalizeLabel(input) {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LABEL_MAX)
    .replace(/-+$/g, "");
}

const ARABIC_DIGITS = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9", "٫": ".", "٬": "," };

// Kode mata uang 3 huruf yang tertulis di teks nominal (mis. "USD 12.00").
const SYMBOLS = [["﷼", "SAR"], ["ر.س", "SAR"], ["rp", "IDR"], ["$", "USD"], ["€", "EUR"], ["£", "GBP"]];
export function detectCurrency(input) {
  if (typeof input !== "string") return null;
  const code = input.toUpperCase().match(/\b([A-Z]{3})\b/);
  if (code) return code[1];
  const lower = input.toLowerCase();
  for (const [sym, cur] of SYMBOLS) if (lower.includes(sym)) return cur;
  return null;
}

// Nominal dari Shortcuts bisa berupa angka atau teks berformat lokal:
// "SAR 12.50", "Rp 25.000", "12,50 ر.س", "1,234.56", "1.234,56", "٢٥٫٥٠".
// Aturan pemisah: bila "." dan "," muncul bersama, yang terakhir = desimal.
// Bila hanya satu jenis: muncul sekali & diikuti 1–2 digit di akhir = desimal;
// selain itu = pemisah ribuan. Hasil selalu positif; NaN/tak terbaca → 0.
export function parseAmount(input) {
  if (typeof input === "number") return Number.isFinite(input) ? Math.abs(input) : 0;
  if (input == null) return 0;
  let s = String(input).replace(/[٠-٩٫٬]/g, (c) => ARABIC_DIGITS[c]);
  // Pemisah hanya sah bila diapit digit (titik di "ر.س" atau "Rp." dibuang).
  s = s.replace(/[.,](?!\d)|(?<!\d)[.,]/g, " ").replace(/[^0-9.,]/g, "");
  if (!s) return 0;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let normalized;
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? "." : ",";
    const thou = dec === "." ? "," : ".";
    normalized = s.split(thou).join("").replace(dec, ".");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ",";
    const parts = s.split(sep);
    const tail = parts[parts.length - 1];
    if (parts.length === 2 && tail.length >= 1 && tail.length <= 2) normalized = parts.join(".");
    else normalized = parts.join("");
  } else {
    normalized = s;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

// Waktu transaksi dari shortcut; tak valid / jauh di masa depan → sekarang.
export function parseOccurredAt(input, now = new Date()) {
  if (!input) return now.toISOString();
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return now.toISOString();
  if (d.getTime() - now.getTime() > 24 * 3600 * 1000) return now.toISOString();
  return d.toISOString();
}

// "STARBUCKS #1234 RIYADH" & "Starbucks" → "starbucks riyadh" vs "starbucks";
// cukup untuk mencocokkan riwayat merchant yang sama.
export function normalizeMerchant(input) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/#\s*\d+/g, " ")
    .replace(/\b\d{3,}\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Kategori dari transaksi terakhir dengan merchant yang sama (atau diawali
// nama yang sama, mis. "starbucks" ↔ "starbucks riyadh").
export function suggestCategory(merchant, history = []) {
  const m = normalizeMerchant(merchant);
  if (!m) return null;
  const sorted = [...history].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  for (const tx of sorted) {
    const hm = normalizeMerchant(tx.merchant);
    if (!hm || !tx.category) continue;
    if (hm === m || hm.startsWith(m + " ") || m.startsWith(hm + " ")) return tx.category;
  }
  return null;
}

// Duplikat: label sama, nominal sama, merchant sama (atau salah satu kosong),
// selisih waktu ≤ jendela. Shortcuts kadang memicu dua kali untuk satu tap.
export function isDuplicate(candidate, recent = [], windowMin = DUPLICATE_WINDOW_MIN) {
  const t = new Date(candidate.occurred_at).getTime();
  const m = normalizeMerchant(candidate.merchant);
  return recent.some((r) => {
    if (r.label !== candidate.label) return false;
    if (Math.abs((Number(r.amount) || 0) - (Number(candidate.amount) || 0)) > 0.005) return false;
    const rm = normalizeMerchant(r.merchant);
    if (m && rm && m !== rm) return false;
    const rt = new Date(r.occurred_at).getTime();
    return Math.abs(rt - t) <= windowMin * 60 * 1000;
  });
}

// Alasan item perlu dicek manual sebelum disimpan (kosong = siap simpan).
export function reviewReason({ amount, merchant, rawCurrency, assetCurrency }) {
  if (!(Number(amount) > 0)) return "Nominal tidak terbaca";
  if (rawCurrency && assetCurrency && rawCurrency !== String(assetCurrency).toUpperCase())
    return `Nominal dalam ${rawCurrency}, rekening dalam ${String(assetCurrency).toUpperCase()}`;
  if (!String(merchant || "").trim()) return "Nama merchant kosong";
  return "";
}

// Token perangkat: "nfk_" + 43 karakter base64url (32 byte acak).
export const TOKEN_PREFIX = "nfk_";
export function looksLikeToken(t) {
  return typeof t === "string" && t.startsWith(TOKEN_PREFIX) && t.length >= 40 && t.length <= 80;
}

// Ambil token dari header Authorization: Bearer … atau field body.token.
export function extractToken(authHeader, body) {
  const h = String(authHeader || "");
  const m = h.match(/^Bearer\s+(\S+)$/i);
  if (m) return m[1];
  return typeof body?.token === "string" ? body.token.trim() : "";
}

// Kamus merchant umum (Saudi & Indonesia) → kategori bawaan Nafkita. Dipakai
// bila riwayat merchant belum ada, agar kategori terisi sejak pembayaran
// pertama. Pola dicocokkan ke nama merchant yang sudah dinormalisasi.
// Kategori hanya disarankan bila ada di daftar kategori pengguna.
export const MERCHANT_KEYWORDS = [
  ["Makanan", /\b(al ?baik|albaik|kudu|herfy|maestro|shawarma|mandi|kabsa|restaurant|restoran|resto|cafe|caf[eé]|coffee|kopi|starbucks|dunkin|tim hortons|barns|half million|dr ?cafe|mcdonald|kfc|burger|pizza|domino|hardee|subway|baskin|bakery|roti|warung|warteg|rumah makan|padang|bakso|mie|ayam|sate|nasi|gofood|grabfood|hungerstation|jahez|mrsool|marsool|talabat|careem food|keeta|chefz|shawarmer|kunafa|knafeh|juice|jus)\b/],
  ["Belanja", /\b(panda|danube|tamimi|othaim|al ?othaim|carrefour|lulu|hyper|bin dawood|nesto|farm superstore|supermarket|minimarket|indomaret|alfamart|alfamidi|hypermart|superindo|transmart|giant|lotte mart|hero|ikea|jarir|extra|centrepoint|max fashion|h ?& ?m|zara|shein|noon|amazon|namshi|tokopedia|shopee|lazada|blibli|bukalapak|uniqlo|mall|market|store|shop|toko)\b/],
  ["Transportasi", /\b(uber|careem|bolt|jeeny|kaiian|gojek|grab|maxim|bluebird|taxi|taksi|aldrees|al ?drees|petromin|sasco|naft|adnoc|aramco|fuel|petrol|gas station|pertamina|shell|bp akr|vivo energy|saptco|haramain|sar train|metro|krl|mrt|transjakarta|tol|parking|parkir|flynas|flyadeal|saudia|garuda|lion air|citilink|airasia|traveloka|tiket\.com)\b/],
  ["Tagihan", /\b(stc|mobily|zain|virgin mobile|lebara|salam|sec|saudi electricity|nwc|national water|telkomsel|indosat|xl|axis|smartfren|tri|by\.u|pln|pdam|indihome|biznet|first media|myrepublic|bpjs|netflix|spotify|apple\.com|icloud|google|youtube|disney|shahid|osn|vidio)\b/],
  ["Kesehatan", /\b(nahdi|al ?dawaa|whites|pharmacy|farmasi|apotek|apotik|kimia farma|k ?24|guardian|watsons|hospital|rumah sakit|rs |klinik|clinic|dr\.?|dental|lab|laboratorium|halodoc|alodokter|sehhaty)\b/],
  ["Pendidikan", /\b(school|sekolah|madrasah|pesantren|university|universitas|kampus|course|kursus|bimbel|ruangguru|zenius|udemy|coursera|gramedia|kinokuniya|bookstore|toko buku)\b/],
  ["Hiburan", /\b(cinema|bioskop|xxi|cgv|cinepolis|vox|muvi|amc|playstation|steam|nintendo|game|timezone|funland|boulevard|riyadh season|winter wonderland)\b/],
];

export function keywordCategory(merchant, categoryNames = null) {
  const m = normalizeMerchant(merchant);
  if (!m) return null;
  for (const [cat, re] of MERCHANT_KEYWORDS) {
    if (!re.test(m)) continue;
    if (!categoryNames) return cat;
    const hit = categoryNames.find((c) => String(c).toLowerCase() === cat.toLowerCase());
    if (hit) return hit;
  }
  return null;
}
