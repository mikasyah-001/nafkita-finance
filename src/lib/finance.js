import { format } from "date-fns";
import { id } from "date-fns/locale";
import { isReportable } from "../../base44/shared/reportable.js";

export function formatRupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export function formatRupiahShort(n) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 1e9) return "Rp " + (v / 1e9).toFixed(1).replace(".", ",") + " M";
  if (abs >= 1e6) return "Rp " + (v / 1e6).toFixed(1).replace(".", ",") + " jt";
  if (abs >= 1e4) return "Rp " + Math.round(v / 1e3) + " rb";
  return formatRupiah(v);
}

// Katalog mata uang bawaan (dapat diperluas pengguna lewat Pengaturan).
export const currencies = [
  { code: "IDR", label: "Rupiah", symbol: "Rp" },
  { code: "SAR", label: "Riyal Saudi", symbol: "\u20C1" },
  { code: "USD", label: "Dolar AS", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "Pound Sterling", symbol: "£" },
  { code: "AED", label: "Dirham UAE", symbol: "AED" },
  { code: "MYR", label: "Ringgit Malaysia", symbol: "RM" },
  { code: "SGD", label: "Dolar Singapura", symbol: "S$" },
  { code: "JPY", label: "Yen Jepang", symbol: "¥" },
  { code: "TRY", label: "Lira Turki", symbol: "₺" },
  { code: "EGP", label: "Pound Mesir", symbol: "E£" },
  { code: "PKR", label: "Rupiah Pakistan", symbol: "₨" },
];

export const CURRENCY_CODES = currencies.map((c) => c.code);

// Mata uang kustom per pengguna — didaftarkan saat data user dimuat
// agar formatMoney/currencySymbol dapat memakai simbol yang sesuai.
let _customCurrencies = [];
export function setCustomCurrencies(list) { _customCurrencies = Array.isArray(list) ? list : []; }
export function getCustomCurrencies() { return _customCurrencies; }
export function findCurrency(code) {
  const c = (code || "IDR").toUpperCase();
  return [...currencies, ..._customCurrencies].find((x) => x.code === c);
}
export function allCurrencies() { return [...currencies, ..._customCurrencies]; }

// Simbol riyal Saudi resmi (SAMA, Feb 2025; Unicode 17 U+20C1). Ditampilkan
// dengan font "Saudi Riyal" (src/index.css). Untuk PDF/CSV/email yang tidak
// bisa memuat font tambahan, pakai formatMoneyPlain() (kode "SAR").
export const SAR_SIGN = "\u20C1";

// Format dengan KODE mata uang (tanpa simbol khusus) — untuk ekspor & email.
export function formatMoneyPlain(n, currency = "IDR") {
  const c = (currency || "IDR").toUpperCase();
  if (c === "SAR") return "SAR " + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
  return formatMoney(n, c);
}

export function formatMoney(n, currency = "IDR") {
  const c = (currency || "IDR").toUpperCase();
  const v = Number(n) || 0;
  if (c === "IDR") return formatRupiah(v);
  if (c === "USD") return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  if (c === "SAR") return SAR_SIGN + "\u00A0" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  const sym = currencySymbol(c);
  return `${sym} ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}`;
}

export function formatMoneyShort(n, currency = "IDR") {
  const c = (currency || "IDR").toUpperCase();
  if (c === "IDR") return formatRupiahShort(n);
  return formatMoney(n, c);
}

export function currencySymbol(code) {
  const c = (code || "IDR").toUpperCase();
  if (c === "IDR") return "Rp";
  if (c === "USD") return "$";
  if (c === "SAR") return SAR_SIGN;
  const f = findCurrency(c);
  return f ? f.symbol : c;
}

// Bangun peta kurs terhadap IDR: { KODE: nilai_per_IDR }.
// Asumsi: rate disimpan sebagai 1 unit base_currency = rate IDR (konvensi BI).
// Mendukung juga arah terbalik (base IDR, quote asing) sebagai fallback.
export function buildRateMap(rates) {
  const map = { IDR: 1 };
  const usdBridge = [];
  (rates || []).forEach((r) => {
    const base = (r.base_currency || "").toUpperCase();
    const quote = (r.quote_currency || "").toUpperCase();
    const rate = Number(r.rate) || 0;
    if (!base || rate <= 0) return;
    if (quote === "IDR" && base !== "IDR") {
      map[base] = rate; // 1 base = rate IDR
    } else if (base === "IDR" && quote !== "IDR") {
      map[quote] = 1 / rate; // 1 IDR = rate quote → 1 quote = 1/rate IDR
    } else if (base === "USD" && quote !== "IDR" && quote !== "USD") {
      usdBridge.push({ quote, rate });
    }
  });
  // Turunkan X→IDR dari jembatan USD: rate(X→IDR) = rate(USD→IDR) / rate(USD→X).
  const usdToIdr = map.USD;
  if (usdToIdr) {
    usdBridge.forEach(({ quote, rate }) => {
      if (map[quote]) return; // jangan timpa kurs langsung
      map[quote] = usdToIdr / rate;
    });
  }
  return map;
}

// Cek apakah kurs untuk mata uang tertentu tersedia di rateMap.
export function hasRate(currency, rateMap = {}) {
  const c = (currency || "IDR").toUpperCase();
  if (c === "IDR") return true;
  return rateMap[c] != null && rateMap[c] > 0;
}

// Apakah konversi from → to bisa dilakukan dengan rateMap saat ini.
export function canConvert(fromCurrency, toCurrency, rateMap = {}) {
  const from = (fromCurrency || "IDR").toUpperCase();
  const to = (toCurrency || "IDR").toUpperCase();
  return from === to || (hasRate(from, rateMap) && hasRate(to, rateMap));
}

// Format daftar nominal yang tidak terkonversi: { SAR: 500 } → "SAR 500".
export function formatUnconverted(map = {}) {
  return Object.entries(map)
    .filter(([, v]) => v)
    .map(([c, v]) => formatMoney(v, c))
    .join(", ");
}

// Konversi amount dari fromCurrency ke toCurrency via jembatan IDR.
// rateMap: output buildRateMap (nilai 1 unit mata uang dalam IDR).
// Bila kurs tidak tersedia, kembalikan 0 — lihat canConvert().
export function convertTo(amount, fromCurrency, toCurrency, rateMap = {}) {
  const from = (fromCurrency || "IDR").toUpperCase();
  const to = (toCurrency || "IDR").toUpperCase();
  const amt = Number(amount) || 0;
  if (from === to) return amt;
  const fromRate = rateMap[from] ?? (from === "IDR" ? 1 : null);
  const toRate = rateMap[to] ?? (to === "IDR" ? 1 : null);
  // Kurs tidak tersedia → 0 (dikeluarkan dari total). Sebelumnya nominal
  // mentah dijumlahkan apa adanya (mis. 500 SAR terhitung Rp 500), yang
  // diam-diam membuat total salah. Tampilan wajib memberi tahu nominal yang
  // dikecualikan lewat canConvert()/hasRate().
  if (!fromRate || !toRate) return 0;
  const inIdr = amt * fromRate;
  return inIdr / toRate;
}

// Ringkasan transaksi dipisah per mata uang (tanpa konversi).
// Saldo = pemasukan − pengeluaran − sedekah. Mata uang terdeteksi otomatis
// dari transaksi, ditambah daftar mata uang aktif pengguna (bila diberikan).
export function summarizeByCurrency(txs, currencyList = []) {
  const out = {};
  const ensure = (c) => { if (!out[c]) out[c] = { income: 0, expense: 0, sedekah: 0, balance: 0, count: 0 }; };
  (currencyList || []).forEach((c) => ensure((c || "IDR").toUpperCase()));
  (txs || []).forEach((t) => {
    // Aturan bersama: transfer, pending, penyesuaian & setoran target tidak dihitung.
    if (!isReportable(t)) return;
    const c = (t.currency || "IDR").toUpperCase();
    ensure(c);
    const amt = Number(t.amount) || 0;
    if (t.type === "income") out[c].income += amt;
    else if (t.type === "expense") out[c].expense += amt;
    else if (t.type === "sedekah") out[c].sedekah += amt;
    out[c].count += 1;
  });
  Object.values(out).forEach((v) => { v.balance = v.income - v.expense - v.sedekah; });
  return out;
}

// Ringkasan konsolidasi: konversi tiap transaksi ke displayCurrency via rateMap
// sebelum diagregasi. Menggantikan summarizeByCurrency untuk tampilan yang
// seharusnya menampilkan nilai dalam satu mata uang tampilan.
// Saldo = pemasukan − pengeluaran − sedekah.
export function summarizeConsolidated(txs, displayCurrency = "IDR", rateMap = {}, currencyList = []) {
  const to = (displayCurrency || "IDR").toUpperCase();
  const out = { income: 0, expense: 0, sedekah: 0, balance: 0, count: 0, currencies: new Set(), unconverted: {} };
  (currencyList || []).forEach((c) => out.currencies.add((c || "IDR").toUpperCase()));
  (txs || []).forEach((t) => {
    if (!isReportable(t)) return;
    const from = (t.currency || "IDR").toUpperCase();
    out.currencies.add(from);
    if (!canConvert(from, to, rateMap)) {
      // Tidak dijumlahkan; dicatat agar UI bisa menyebut "belum termasuk".
      const sign = t.type === "income" ? 1 : -1;
      out.unconverted[from] = (out.unconverted[from] || 0) + sign * (Number(t.amount) || 0);
      return;
    }
    const amt = convertTo(Number(t.amount) || 0, from, to, rateMap);
    if (t.type === "income") out.income += amt;
    else if (t.type === "expense") out.expense += amt;
    else if (t.type === "sedekah") out.sedekah += amt;
    out.count += 1;
  });
  out.balance = out.income - out.expense - out.sedekah;
  return out;
}

// Filter transfer antar-rekening (transaksi dengan transfer_pair_id) dari daftar.
export function filterTransfers(txs) {
  return (txs || []).filter((t) => !t.transfer_pair_id);
}

// Filter transaksi yang layak masuk laporan/ringkasan — aturan bersama
// frontend & backend, lihat base44/shared/reportable.js.
export const filterReportableTx = isReportable;

// Filter transaksi berdasarkan rentang tanggal (inclusive).
// startDate/endDate dapat berupa Date, ISO string, atau null (tanpa batas).
export function filterPeriod(txs, startDate, endDate) {
  if (!startDate && !endDate) return txs || [];
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  return (txs || []).filter((t) => {
    const d = new Date(t.date);
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
}

// Hitung tanggal berikutnya untuk tagihan berulang berdasarkan frekuensi.
export function computeRecurringNextDate(currentDate, frequency) {
  // Sama dengan backend (processRecurringBills): berbasis UTC dan tanggal
  // dibatasi ke akhir bulan, agar 31 Jan → 28/29 Feb (bukan 3 Maret).
  const [y, m, d] = String(currentDate).slice(0, 10).split("-").map(Number);
  const fmt = (yy, mm, dd) => `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const lastDay = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  if (frequency === "daily" || frequency === "weekly") {
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + (frequency === "daily" ? 1 : 7));
    return dt.toISOString().slice(0, 10);
  }
  if (frequency === "yearly") return fmt(y + 1, m, Math.min(d, lastDay(y + 1, m)));
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return fmt(ny, nm, Math.min(d, lastDay(ny, nm)));
}

// Savings rate memperhitungkan sedekah, dijepit 0–100% dengan label saat di luar rentang.
export function computeSavingsRate(income, expense, sedekah) {
  const inc = Number(income) || 0;
  const net = inc - (Number(expense) || 0) - (Number(sedekah) || 0);
  if (inc <= 0) return { rate: 0, label: "n/a" };
  const rate = (net / inc) * 100;
  if (rate < 0) return { rate: 0, label: "<0%" };
  if (rate > 100) return { rate: 100, label: ">100%" };
  return { rate: Math.round(rate), label: null };
}

export function activeCurrencies(summary) {
  return Object.keys(summary || {}).filter((c) => summary[c]?.count > 0);
}

// Aset yang bisa menjadi sumber/tujuan uang: rekening bank & dompet tunai.
export const isMoneyAsset = (a) => a?.type === "bank" || a?.type === "tunai";

// Pengeluaran luar biasa (tidak rutin, mis. beli kendaraan): ditandai lewat
// tag agar tidak merusak rata-rata harian & tren. Tetap dihitung di total.
export const EXTRAORDINARY_TAG = "luar-biasa";
export const isExtraordinary = (t) => Array.isArray(t?.tags) && t.tags.includes(EXTRAORDINARY_TAG);

// Konstanta & logika zakat ada di src/lib/zakat.js (sumber tunggal).
export const NISAB_GRAM = 85;
export const isGoldType = (type) => type === "emas" || type === "emas_digital";

export function formatNumber(n) {
  return new Intl.NumberFormat("id-ID").format(n || 0);
}

export function formatDate(date, fmt = "dd MMM yyyy") {
  try {
    return format(new Date(date), fmt, { locale: id });
  } catch {
    return "";
  }
}

export const colorMap = {
  rose: { bg: "bg-rose-100 dark:bg-rose-950/40", text: "text-rose-600 dark:text-rose-400", solid: "bg-rose-500", dot: "bg-rose-500" },
  orange: { bg: "bg-orange-100 dark:bg-orange-950/40", text: "text-orange-600 dark:text-orange-400", solid: "bg-orange-500", dot: "bg-orange-500" },
  amber: { bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-600 dark:text-amber-400", solid: "bg-amber-500", dot: "bg-amber-500" },
  green: { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", solid: "bg-emerald-500", dot: "bg-emerald-500" },
  emerald: { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", solid: "bg-emerald-500", dot: "bg-emerald-500" },
  teal: { bg: "bg-teal-100 dark:bg-teal-950/40", text: "text-teal-600 dark:text-teal-400", solid: "bg-teal-500", dot: "bg-teal-500" },
  blue: { bg: "bg-blue-100 dark:bg-blue-950/40", text: "text-blue-600 dark:text-blue-400", solid: "bg-blue-500", dot: "bg-blue-500" },
  indigo: { bg: "bg-indigo-100 dark:bg-indigo-950/40", text: "text-indigo-600 dark:text-indigo-400", solid: "bg-indigo-500", dot: "bg-indigo-500" },
  violet: { bg: "bg-violet-100 dark:bg-violet-950/40", text: "text-violet-600 dark:text-violet-400", solid: "bg-violet-500", dot: "bg-violet-500" },
  pink: { bg: "bg-pink-100 dark:bg-pink-950/40", text: "text-pink-600 dark:text-pink-400", solid: "bg-pink-500", dot: "bg-pink-500" },
  cyan: { bg: "bg-cyan-100 dark:bg-cyan-950/40", text: "text-cyan-600 dark:text-cyan-400", solid: "bg-cyan-500", dot: "bg-cyan-500" },
  red: { bg: "bg-red-100 dark:bg-red-950/40", text: "text-red-600 dark:text-red-400", solid: "bg-red-500", dot: "bg-red-500" },
  slate: { bg: "bg-slate-100 dark:bg-slate-800/60", text: "text-slate-600 dark:text-slate-300", solid: "bg-slate-500", dot: "bg-slate-500" },
};

export const colorOptions = ["orange", "blue", "pink", "red", "teal", "indigo", "violet", "green", "amber", "cyan", "rose", "slate"];

export const defaultCategories = [
  { name: "Makanan", type: "expense", color: "orange", icon: "Utensils", is_default: true },
  { name: "Transportasi", type: "expense", color: "blue", icon: "Car", is_default: true },
  { name: "Belanja", type: "expense", color: "pink", icon: "ShoppingCart", is_default: true },
  { name: "Tagihan", type: "expense", color: "red", icon: "Lightbulb", is_default: true },
  { name: "Kesehatan", type: "expense", color: "teal", icon: "HeartPulse", is_default: true },
  { name: "Pendidikan", type: "expense", color: "indigo", icon: "GraduationCap", is_default: true },
  { name: "Hiburan", type: "expense", color: "violet", icon: "Gamepad2", is_default: true },
  { name: "Lainnya", type: "expense", color: "slate", icon: "MoreHorizontal", is_default: true },
  { name: "Gaji", type: "income", color: "green", icon: "Wallet", is_default: true },
  { name: "Bonus", type: "income", color: "emerald", icon: "Coins", is_default: true },
  { name: "Hadiah", type: "income", color: "amber", icon: "Gift", is_default: true },
  { name: "Pemasukan Lain", type: "income", color: "cyan", icon: "Plus", is_default: true },
];

export function formatDuration(fromDate) {
  if (!fromDate) return "";
  const from = new Date(fromDate);
  if (isNaN(from)) return "";
  const now = new Date();
  let months = (now.getFullYear() - from.getFullYear()) * 12 + (now.getMonth() - from.getMonth());
  if (now.getDate() < from.getDate()) months--;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years > 0 && remMonths > 0) return `${years} thn ${remMonths} bln`;
  if (years > 0) return `${years} thn`;
  if (remMonths > 0) return `${remMonths} bln`;
  const days = Math.floor((now - from) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Hari ini";
  return `${days} hari`;
}

// ── Broker / aplikasi tersimpan ─────────────────────────────────────────────
// Satu sumber: diambil dari aset yang sudah ada, agar tidak mengetik ulang &
// tidak muncul ejaan ganda ("Al Rajhi Capital" vs "al rajhi capital").
// "Bank BSI" = "BSI": awalan "bank" diabaikan agar tidak muncul ganda.
const brokerKey = (s) => String(s || "").toLowerCase().replace(/^\s*bank\s+/, "").replace(/[^a-z0-9\u0600-\u06ff]/g, "");
const tidyBroker = (s) => String(s || "").replace(/\s+/g, " ").trim();

// Ejaan mana yang lebih rapi bila jumlah pemakaian seri: ada huruf besar
// ("Al Rajhi Capital" > "al rajhi capital"), lalu lebih lengkap ("Bank BSI" > "BSI").
const spellingRank = (x, y) => {
  const cap = (t) => (/[A-Z]/.test(t) ? 0 : 1);
  return cap(x) - cap(y) || y.length - x.length || x.localeCompare(y);
};

// Daftar broker yang pernah dipakai, paling sering dulu. `type` → jenis aset itu
// diutamakan; jenis lain hanya bila `includeOtherTypes`.
export function knownBrokers(assets = [], { type, includeOtherTypes = false } = {}) {
  const by = new Map();
  for (const a of assets || []) {
    const name = tidyBroker(a?.broker);
    const k = brokerKey(name);
    if (!k) continue;
    const same = !type || a.type === type;
    if (!same && !includeOtherTypes) continue;
    const e = by.get(k) || { name, count: 0, sameType: 0, spellings: new Map() };
    e.count += 1;
    if (same) e.sameType += 1;
    e.spellings.set(name, (e.spellings.get(name) || 0) + 1);
    by.set(k, e);
  }
  return [...by.values()]
    .map((e) => ({ name: [...e.spellings.entries()].sort((x, y) => y[1] - x[1] || spellingRank(x[0], y[0]))[0][0], count: e.count, sameType: e.sameType }))
    .sort((x, y) => y.sameType - x.sameType || y.count - x.count || x.name.localeCompare(y.name, "id"))
    .map((e) => e.name);
}

// Seragamkan ketikan ke ejaan yang sudah tersimpan: sama persis tanpa
// memperhatikan huruf besar/spasi/tanda baca, atau awalan unik ≥ 4 huruf
// ("Al Rajhi" → "Al Rajhi Capital"). Selain itu ketikan dipakai apa adanya.
// `prefix: false` → hanya pencocokan persis (dipakai untuk daftar lintas jenis,
// agar "Mandiri" untuk bank tidak tertarik ke "Mandiri Sekuritas").
export function canonicalBrokerFor(input, assets = [], type) {
  const sameType = knownBrokers(assets, { type });
  const viaType = canonicalBroker(input, sameType);
  if (viaType !== tidyBroker(input)) return viaType;
  return canonicalBroker(input, knownBrokers(assets), { prefix: false });
}

export function canonicalBroker(input, known = [], { prefix = true } = {}) {
  const name = tidyBroker(input);
  const k = brokerKey(name);
  if (!k) return "";
  const exact = known.find((b) => brokerKey(b) === k);
  if (exact) return exact;
  if (prefix && k.length >= 4) {
    const pre = known.filter((b) => brokerKey(b).startsWith(k));
    if (pre.length === 1) return pre[0];
  }
  return name;
}

// Bank dipakai lintas jenis (tabungan & emas digital di bank yang sama).
export const BANK_LIKE_TYPES = ["bank", "emas_digital"];
export const DEFAULT_BANKS = {
  IDR: ["BCA", "Mandiri", "BSI", "BNI", "BRI"],
  SAR: ["Al Rajhi Bank", "SNB", "Riyad Bank", "Alinma Bank", "Bank Albilad", "Bank Aljazira"],
};

/**
 * Pilihan "tinggal klik" untuk isian bank/broker, urut: dipakai di jenis
 * ini → (untuk bank) bank yang ditetapkan di profil & dipakai jenis bank
 * lain → saran umum. Tanpa duplikat ejaan ("Bank BSI" = "BSI").
 */
export function placeSuggestions({ assets = [], type, savedBanks = [], defaults = [], limit = 12 } = {}) {
  const bankLike = BANK_LIKE_TYPES.includes(type);
  const pool = [
    ...knownBrokers(assets, { type }),
    ...(bankLike ? savedBanks.map(tidyBroker) : []),
    ...(bankLike ? BANK_LIKE_TYPES.filter((t) => t !== type).flatMap((t) => knownBrokers(assets, { type: t })) : []),
    ...defaults,
  ];
  const out = [];
  for (const b of pool) {
    if (!brokerKey(b)) continue;
    if (out.some((x) => brokerKey(x) === brokerKey(b))) continue;
    out.push(b);
  }
  return out.slice(0, limit);
}

/** Tambahkan bank ke daftar tetap di profil; null bila sudah ada / kosong. */
export function withSavedBank(savedBanks = [], name) {
  const n = tidyBroker(name);
  if (!brokerKey(n) || savedBanks.some((b) => brokerKey(b) === brokerKey(n))) return null;
  return [...savedBanks, n];
}

/**
 * Ejaan ganda bank/broker yang telanjur tersimpan ("Al Rajhi Capital" vs
 * "al rajhi capital", "Bank BSI" vs "BSI"). Ejaan terbanyak = baku.
 * → [{ canonical, total, variants: [{ name, ids }] }] hanya bila > 1 ejaan.
 */
export function brokerSpellingGroups(assets = []) {
  const by = new Map();
  for (const a of assets || []) {
    const name = tidyBroker(a?.broker);
    const k = brokerKey(name);
    if (!k) continue;
    const g = by.get(k) || new Map();
    const v = g.get(a.broker) || { name: a.broker, tidy: name, ids: [] };
    v.ids.push(a.id);
    g.set(a.broker, v);
    by.set(k, g);
  }
  const out = [];
  for (const g of by.values()) {
    const variants = [...g.values()].sort((x, y) => y.ids.length - x.ids.length || spellingRank(x.tidy, y.tidy));
    if (variants.length < 2) continue;
    out.push({ canonical: variants[0].tidy, total: variants.reduce((n, v) => n + v.ids.length, 0), variants: variants.map(({ name, ids }) => ({ name, ids })) });
  }
  return out.sort((x, y) => y.total - x.total);
}

/** Daftar bank tersimpan untuk dikelola: dari profil, plus jumlah aset yang memakainya. */
export function savedBankUsage(savedBanks = [], assets = []) {
  return (savedBanks || []).map((name) => ({
    name,
    usedBy: (assets || []).filter((a) => BANK_LIKE_TYPES.includes(a.type) && brokerKey(a.broker) === brokerKey(name)).length,
  }));
}

// Nama aset untuk tampilan: spasi dirapikan, dan kode ticker di akhir nama
// ("SP FUNDS S&P 500 SHARIA (SPUS)") dipisah agar nama tidak terpotong —
// ticker ditampilkan terpisah. Data tersimpan tidak diubah.
export function assetDisplayName(a) {
  const raw = String(a?.name || "").replace(/\s+/g, " ").trim();
  let ticker = String(a?.ticker || "").trim().toUpperCase();
  let name = raw;
  const m = raw.match(/^(.*\S)\s*\(([A-Za-z0-9.\-]{1,12})\)$/);
  // Tanpa ticker tersimpan, hanya kode huruf besar/angka ("(SPUS)", "(2010)") yang
  // dianggap ticker — "(Syariah)" tetap bagian nama.
  if (m && (ticker ? m[2].toUpperCase() === ticker : /^[A-Z0-9.\-]+$/.test(m[2]))) {
    name = m[1];
    ticker = m[2].toUpperCase();
  }
  if (ticker && name.toUpperCase() === ticker) ticker = "";
  return { name: name || raw || "Tanpa nama", ticker };
}

export const assetTypeLabels = {
  bank: { label: "Tabungan/Bank", icon: "Landmark", color: "blue" },
  tunai: { label: "Uang Tunai", icon: "Wallet", color: "green" },
  emas: { label: "Emas", icon: "Coins", color: "amber" },
  emas_digital: { label: "Emas Digital", icon: "Coins", color: "amber" },
  investasi: { label: "Investasi", icon: "Briefcase", color: "green" },
  properti: { label: "Properti", icon: "Home", color: "violet" },
  tanah: { label: "Tanah", icon: "Map", color: "cyan" },
  lainnya: { label: "Lainnya", icon: "Package", color: "slate" },
};
// ── Sumber tunggal ringkasan pengeluaran bulanan ─────────────────────────
// Dipakai Beranda (MonthlySummary) dan halaman Ringkasan agar angka selalu
// sama. Aturan: hanya transaksi "reportable" (bukan transfer antar-rekening,
// bukan pending/ditolak), sesuai cakupan, dan dikonversi ke mata uang tampilan.

export function inScope(t, scope) {
  return scope === "private" ? t.visibility === "private" : t.visibility !== "private";
}

// Batas anggaran efektif = limit + sisa/kelebihan bulan lalu (rollover).
// Dipakai halaman Anggaran, bar anggaran Beranda, dan "Bisakah saya beli?".
export const effectiveLimit = (b) => (Number(b?.limit_amount) || 0) + (Number(b?.rollover_amount) || 0);

export function isInMonth(t, year, month) {
  const d = new Date(t.date);
  return d.getFullYear() === year && d.getMonth() === month;
}

export function monthlyExpenseBreakdown(txs, { year, month, scope = "shared", currency = "IDR", rateMap = {} }) {
  const py = month === 0 ? year - 1 : year;
  const pm = month === 0 ? 11 : month - 1;
  const base = (txs || []).filter((t) => t.type === "expense" && filterReportableTx(t) && inScope(t, scope));
  const cur = (currency || "IDR").toUpperCase();
  const map = {};
  const prevMap = {};
  const currencies = new Set();
  const unconverted = {};
  let count = 0;
  let extraordinary = 0;
  base.forEach((t) => {
    const from = (t.currency || "IDR").toUpperCase();
    const ok = canConvert(from, cur, rateMap);
    const v = convertTo(Number(t.amount) || 0, from, cur, rateMap);
    if (isInMonth(t, year, month)) {
      currencies.add(from);
      if (!ok) { unconverted[from] = (unconverted[from] || 0) + (Number(t.amount) || 0); return; }
      if (isExtraordinary(t)) extraordinary += v;
      if (!map[t.category]) map[t.category] = { value: 0, count: 0 };
      map[t.category].value += v;
      map[t.category].count += 1;
      count += 1;
    } else if (isInMonth(t, py, pm)) {
      prevMap[t.category] = (prevMap[t.category] || 0) + v;
    }
  });
  const total = Object.values(map).reduce((a, b) => a + b.value, 0);
  const prevTotal = Object.values(prevMap).reduce((a, b) => a + b, 0);
  const rows = Object.entries(map)
    .map(([name, v]) => ({ name, value: v.value, count: v.count, prev: prevMap[name] || 0 }))
    .sort((a, b) => b.value - a.value);
  // routineTotal: total tanpa pengeluaran luar biasa — dipakai rata-rata/hari.
  return { rows, total, prevTotal, count, currencies: [...currencies], unconverted, extraordinary, routineTotal: total - extraordinary };
}

// Label sumbu grafik yang ringkas & konsisten: 500 rb, 12 jt, 1,2 M (tanpa simbol).
export function formatAxis(v) {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  const fmt = (x) => x.toLocaleString("id-ID", { maximumFractionDigits: x < 10 ? 1 : 0 });
  if (a >= 1e12) return `${fmt(n / 1e12)} T`;
  if (a >= 1e9) return `${fmt(n / 1e9)} M`;
  if (a >= 1e6) return `${fmt(n / 1e6)} jt`;
  if (a >= 1e3) return `${fmt(n / 1e3)} rb`;
  return fmt(n);
}

// ── Rencana bulanan (pemasukan & menabung) ──────────────────────────────
// Disimpan sebagai Budget dengan kind "income_plan"/"savings_plan".
// Anggaran kategori lama tidak punya kind → dianggap "expense".
export const PLAN_KINDS = { income: "income_plan", savings: "savings_plan" };
export const PLAN_CATEGORY = { income_plan: "Rencana Pemasukan", savings_plan: "Rencana Menabung" };
export const isExpenseBudget = (b) => (b?.kind || "expense") === "expense";

export function monthlyPlan(budgets, { period, scope = "shared", currency = "IDR" }) {
  const match = (b, kind) => b.kind === kind && b.period === period && (b.visibility || "shared") === scope && (b.currency || "IDR") === currency;
  const inc = (budgets || []).find((b) => match(b, PLAN_KINDS.income));
  const sav = (budgets || []).find((b) => match(b, PLAN_KINDS.savings));
  return {
    income: inc ? Number(inc.limit_amount) || 0 : 0,
    savings: sav ? Number(sav.limit_amount) || 0 : 0,
    incomeRecord: inc || null,
    savingsRecord: sav || null,
  };
}

// Progres rencana: capaian vs target, dijepit 0–100 untuk bar.
export function planProgress(actual, target) {
  if (!target || target <= 0) return { pct: 0, reached: false, remaining: 0 };
  const pct = Math.max(0, Math.min(100, (actual / target) * 100));
  return { pct, reached: actual >= target, remaining: Math.max(0, target - actual) };
}

// ── Jatah belanja harian ──────────────────────────────────────────
// "Sisa yang boleh dibelanjakan bulan ini, dibagi hari tersisa (termasuk
// hari ini)". Dasar anggaran: rencana pemasukan bila diatur, kalau tidak
// pemasukan nyata bulan ini; rencana menabung selalu disisihkan dulu.
// Sumber tunggal untuk Beranda, menu Lainnya, dan "Bisakah saya beli ini?".
export function spendingPace({ income = 0, expense = 0, sedekah = 0, planIncome = 0, planSavings = 0, now = new Date(), extraSpend = 0 } = {}) {
  const y = now.getFullYear(), m = now.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);
  const base = planIncome > 0 ? planIncome : income;
  const budget = Math.max(0, base - (planSavings || 0));
  const spent = (Number(expense) || 0) + (Number(sedekah) || 0) + (Number(extraSpend) || 0);
  if (budget <= 0 && spent <= 0) return null;
  const remaining = budget - spent;
  return {
    source: planIncome > 0 ? "plan" : "income",
    budget,
    spent,
    remaining,
    over: remaining < 0,
    pct: budget > 0 ? Math.min(100, (spent / budget) * 100) : 100,
    daysLeft,
    daysInMonth,
    perDay: Math.max(0, remaining) / daysLeft,
  };
}

// ── Aturan input aset per jenis (sumber tunggal untuk form & test) ─────
// emas/emas_digital: jumlah gram × harga beli/gram. tanah: luas m² × harga/m².
// bank/tunai: hanya nilai saldo (tanpa harga beli). Lainnya: nilai + harga beli total.
export const ASSET_UNIT = { emas: "gram", emas_digital: "gram", tanah: "m²" };
export const assetUsesQuantity = (type) => !!ASSET_UNIT[type];
// Semua jenis aset boleh bermata uang selain IDR (mis. emas fisik dibeli di
// Makkah dalam SAR). Dulu emas fisik & tanah dipaksa IDR saat disimpan,
// sementara mata uang & label form bisa berbeda → nominal salah tafsir.
// Mata uang kini selalu eksplisit di form dan disimpan apa adanya.

// ── Deteksi salah tafsir mata uang ─────────────────────────────────────
// Kurs kasar (IDR per 1 unit) HANYA untuk mendeteksi nominal yang
// kemungkinan diketik dalam mata uang lain — bukan untuk perhitungan.
const ROUGH_IDR_PER_UNIT = { IDR: 1, SAR: 4300, AED: 4400, USD: 16000, EUR: 17500, GBP: 20500, SGD: 12000, MYR: 3600, QAR: 4400, KWD: 52000, JPY: 105, CNY: 2200, TRY: 450, EGP: 330 };
export const GOLD_PRICE_MIN_IDR = 500_000;
export const GOLD_PRICE_MAX_IDR = 10_000_000;

export function idrPerUnit(currency, rateMap = {}) {
  const c = (currency || "IDR").toUpperCase();
  if (c === "IDR") return 1;
  return Number(rateMap[c]) > 0 ? Number(rateMap[c]) : ROUGH_IDR_PER_UNIT[c] || null;
}

const inGoldRange = (idr) => idr >= GOLD_PRICE_MIN_IDR && idr <= GOLD_PRICE_MAX_IDR;

/**
 * Harga emas per gram yang tidak masuk akal untuk mata uangnya.
 * Mengembalikan null bila wajar/tidak bisa dinilai, atau
 * { suggest, message } — suggest = mata uang yang lebih mungkin dimaksud.
 * Contoh: 1.250.000 dengan mata uang SAR → setara ±Rp 5,4 miliar/gr → suggest IDR.
 */
export function goldPriceCurrencyHint(pricePerGram, currency, candidates = [], rateMap = {}) {
  const p = Number(pricePerGram) || 0;
  const c = (currency || "IDR").toUpperCase();
  const r = idrPerUnit(c, rateMap);
  if (!(p > 0) || !r || inGoldRange(p * r)) return null;
  const pool = [...new Set(["IDR", ...candidates.map((x) => String(x).toUpperCase())])].filter((x) => x !== c);
  const suggest = pool.find((x) => { const rx = idrPerUnit(x, rateMap); return rx && inGoldRange(p * rx); });
  if (!suggest) return null;
  return {
    suggest,
    message: `${formatMoneyPlain(p, c)}/gr tidak wajar untuk emas (setara ±${formatMoneyPlain(Math.round(p * r), "IDR")}/gr). Sepertinya nominal ini dalam ${suggest}.`,
  };
}

/** Harga beli emas per gram di luar rentang wajar untuk mata uangnya. */
export function goldPriceLooksWrong(asset, rateMap = {}) {
  if (!isGoldType(asset?.type)) return false;
  const p = Number(asset.purchase_price) || 0;
  const r = idrPerUnit(asset.currency, rateMap);
  return p > 0 && !!r && !inGoldRange(p * r);
}

/** Aset emas yang harga beli per gram-nya tampak salah mata uang. */
export function assetCurrencyIssue(asset, candidates = [], rateMap = {}) {
  if (isGoldType(asset?.type)) return goldPriceCurrencyHint(asset.purchase_price, asset.currency, candidates, rateMap);
  // Aset non-emas: nominal Rupiah yang terlanjur berlabel mata uang asing
  // (mis. Rp1.008.000 tersimpan sebagai $1.008.000 ≈ Rp17,8 M). Ambang lebih
  // ketat dari petunjuk saat mengetik, agar aset asing yang memang besar tidak
  // ditandai: ≥ 500.000 unit DAN setara ≥ Rp5 miliar.
  const c = (asset?.currency || "IDR").toUpperCase();
  if (c === "IDR") return null;
  const r = idrPerUnit(c, rateMap);
  const v = Math.max(Number(asset?.value) || 0, Number(asset?.purchase_price) || 0);
  if (!r || v < 500_000 || v * r < 5_000_000_000) return null;
  return {
    suggest: "IDR",
    message: `${formatMoneyPlain(v, c)} setara ±${formatMoneyPlain(Math.round(v * r), "IDR")}. Sepertinya angka ini Rupiah yang terlanjur berlabel ${c} (mis. chip mata uang tersentuh).`,
  };
}

/**
 * Nominal transaksi dalam mata uang asing yang kemungkinan diketik dalam
 * Rupiah (mis. SAR 150.000 ≈ Rp 645 juta untuk belanja harian).
 * Peringatan lunak saja — pengguna tetap boleh menyimpan.
 */
export function amountCurrencyHint(amount, currency, rateMap = {}) {
  const a = Number(amount) || 0;
  const c = (currency || "IDR").toUpperCase();
  if (c === "IDR" || a < 50_000) return null;
  const r = idrPerUnit(c, rateMap);
  if (!r || a * r < 100_000_000) return null;
  return { suggest: "IDR", message: `${formatMoneyPlain(a, c)} setara ±${formatMoneyPlain(Math.round(a * r), "IDR")}. Yakin bukan Rupiah?` };
}

/** Pembulatan nominal sesuai mata uang: Rupiah bulat, lainnya 2 desimal. */
export function roundMoney(n, currency = "IDR") {
  const x = Number(n) || 0;
  return (currency || "IDR").toUpperCase() === "IDR" ? Math.round(x) : Math.round(x * 100) / 100;
}

/**
 * Konversi sekumpulan isian nominal saat mata uang form diganti.
 * Mengembalikan null bila kurs tidak tersedia. Isian kosong/0 dibiarkan.
 * Dipakai bersama oleh semua form (lihat hooks/useCurrencySwitch) agar
 * mengganti mata uang TIDAK diam-diam menafsirkan ulang angka.
 */
export function convertAmounts(amounts = {}, from, to, rateMap = {}) {
  const f = (from || "IDR").toUpperCase();
  const t = (to || "IDR").toUpperCase();
  if (f === t) return { ...amounts };
  if (!canConvert(f, t, rateMap)) return null;
  const out = {};
  for (const [k, v] of Object.entries(amounts)) {
    const n = Number(v);
    out[k] = n > 0 ? String(roundMoney(convertTo(n, f, t, rateMap), t)) : v;
  }
  return out;
}

/**
 * Ganti mata uang form = konversi langsung dengan kurs, berpatokan pada angka
 * ASLI yang diketik. `origin` mengingat angka asli selama angka belum diketik
 * ulang, sehingga IDR → SAR → USD → IDR kembali tepat ke angka semula (tanpa
 * pembulatan berantai). Mengembalikan { ok:false } bila kurs tidak tersedia —
 * mata uang TIDAK boleh diganti tanpa konversi (itu sumber bug salah tafsir).
 */
export function switchCurrencyAmounts({ origin = null, currency, amounts = {}, to, rateMap = {} }) {
  const cur = (currency || "IDR").toUpperCase();
  const target = (to || "IDR").toUpperCase();
  const sig = JSON.stringify(amounts);
  const src = origin && origin.sig === sig ? origin : { currency: cur, amounts };
  const hasAmount = Object.values(src.amounts).some((v) => Number(v) > 0);
  if (!hasAmount) return { ok: true, amounts, origin: null };
  if (target === src.currency) return { ok: true, amounts: { ...src.amounts }, origin: null };
  const conv = convertAmounts(src.amounts, src.currency, target, rateMap);
  if (!conv) return { ok: false };
  return { ok: true, amounts: conv, origin: { currency: src.currency, amounts: src.amounts, sig: JSON.stringify(conv) } };
}

/** Pratinjau konversi "≈ Rp 1.075.000" untuk input bermata uang asing. */
export function conversionPreview(amount, from, to = "IDR", rateMap = {}) {
  const a = Number(amount) || 0;
  const f = (from || "IDR").toUpperCase();
  const t = (to || "IDR").toUpperCase();
  if (!(a > 0) || f === t || !canConvert(f, t, rateMap)) return "";
  return `≈ ${formatMoneyPlain(convertTo(a, f, t, rateMap), t)}`;
}
export const assetHasPurchase = (type) => type !== "bank" && type !== "tunai";

// Saat jenis diganti: kosongkan isian yang maknanya berbeda (gram vs m² vs total)
// agar tidak terbawa diam-diam, dan kunci mata uang untuk jenis berbasis Rupiah.
export function switchAssetType(form, type) {
  const sameUnit = (ASSET_UNIT[form.type] || "") === (ASSET_UNIT[type] || "");
  return {
    ...form,
    type,
    unit: ASSET_UNIT[type] || "",
    quantity: sameUnit ? form.quantity : "",
    purchase_price: sameUnit && assetHasPurchase(type) ? form.purchase_price : "",
    value: isGoldType(type) ? "" : form.value,
    currency: form.currency,
  };
}

// Validasi + susun payload. Mengembalikan { error } atau { payload }.
export function buildAssetPayload(form) {
  const num = (v) => (v === "" || v == null ? null : Number(v));
  const qty = num(form.quantity), price = num(form.purchase_price), val = num(form.value);
  const t = form.type;
  if (!String(form.name || "").trim()) return { error: "Isi nama aset" };
  for (const [v, label] of [[qty, "Jumlah"], [price, "Harga beli"], [val, "Nilai"]]) {
    if (v != null && (!Number.isFinite(v) || v < 0)) return { error: `${label} tidak boleh negatif` };
  }
  let value;
  if (isGoldType(t)) {
    if (!qty) return { error: "Isi jumlah gram emas" };
    if (!price) return { error: "Isi harga beli per gram" };
    value = qty * price;
  } else if (t === "tanah") {
    if (!qty) return { error: "Isi luas tanah" };
    if (!price) return { error: "Isi harga beli per m²" };
    value = val || qty * price; // perkiraan harga sekarang; bila kosong = harga beli
  } else {
    if (val == null) return { error: "Isi nilai aset" };
    value = val;
  }
  return {
    payload: {
      name: String(form.name).trim(),
      type: t,
      value,
      quantity: assetUsesQuantity(t) ? qty : 0,
      unit: ASSET_UNIT[t] || "",
      purchase_date: assetHasPurchase(t) ? form.purchase_date || "" : "",
      purchase_price: assetHasPurchase(t) ? price || 0 : 0,
      purchase_proof_url: assetHasPurchase(t) ? form.purchase_proof_url || "" : "",
      owner: form.owner || "",
      notes: form.notes || "",
      broker: form.broker || "",
      currency: (form.currency || "IDR").toUpperCase(),
      visibility: form.visibility || "shared",
    },
  };
}

// ── Nilai pasar & untung/rugi aset (sumber tunggal) ─────────────────────
// Harga emas acuan disimpan dalam IDR/gram. Untuk emas digital bermata uang
// lain, harga dikonversi ke mata uang aset lewat kurs (bila tersedia).
export function goldPriceIn(currency, goldPriceIdr, rateMap = {}) {
  const c = (currency || "IDR").toUpperCase();
  if (!(goldPriceIdr > 0)) return 0;
  if (c === "IDR") return goldPriceIdr;
  return canConvert("IDR", c, rateMap) ? convertTo(goldPriceIdr, "IDR", c, rateMap) : 0;
}

// Nilai beli total dalam mata uang aset.
export function assetCost(a) {
  const price = Number(a?.purchase_price) || 0;
  if (!price) return 0;
  return (isGoldType(a.type) || a.type === "tanah") && a.quantity ? price * Number(a.quantity) : price;
}

// Nilai saat ini dalam mata uang aset: emas = gram × harga pasar (bila ada).
export function assetMarketValue(a, goldPriceIdr = 0, rateMap = {}) {
  if (isGoldType(a?.type) && Number(a.quantity) > 0) {
    const p = goldPriceIn(a.currency, goldPriceIdr, rateMap);
    if (p > 0) return Number(a.quantity) * p;
  }
  return Number(a?.value) || 0;
}

// Untung/rugi. available=false bila nilai pasar emas belum bisa dihitung
// (harga emas/kurs belum ada) atau harga beli kosong — jangan tampilkan 0%.
export function assetGain(a, goldPriceIdr = 0, rateMap = {}) {
  const cost = assetCost(a);
  const value = assetMarketValue(a, goldPriceIdr, rateMap);
  const goldPriced = !isGoldType(a?.type) || goldPriceIn(a.currency, goldPriceIdr, rateMap) > 0;
  // Harga beli/gr yang mustahil untuk mata uangnya (mis. Rupiah tersimpan
  // sebagai SAR) → untung/rugi tidak ditampilkan daripada menyesatkan.
  const currencySuspect = goldPriceLooksWrong(a, rateMap);
  const available = cost > 0 && goldPriced && !currencySuspect;
  const gain = available ? value - cost : 0;
  return { cost, value, gain, pct: available ? (gain / cost) * 100 : 0, available, needsGoldPrice: isGoldType(a?.type) && !goldPriced, currencySuspect };
}

// Untung/rugi gabungan beberapa aset: dihitung PER ASET dalam mata uangnya
// sendiri (assetGain), lalu nilai & modal tiap aset dikonversi ke mata uang
// tampilan dengan kurs masing-masing sebelum dijumlahkan. Aset yang untung/
// ruginya tidak bisa dihitung (tanpa harga beli, harga emas belum ada, mata
// uang mencurigakan, atau kurs belum tersedia) tidak ikut.
export function portfolioGain(assets = [], displayCurrency = "IDR", { goldPrice = 0, rateMap = {} } = {}) {
  const to = String(displayCurrency || "IDR").toUpperCase();
  let cost = 0, value = 0, count = 0;
  for (const a of assets) {
    const g = assetGain(a, goldPrice, rateMap);
    if (!g.available) continue;
    const from = String(a.currency || "IDR").toUpperCase();
    if (from !== to && !canConvert(from, to, rateMap)) continue;
    cost += convertTo(g.cost, from, to, rateMap);
    value += convertTo(g.value, from, to, rateMap);
    count += 1;
  }
  const gain = value - cost;
  return { cost, value, gain, pct: cost > 0 ? (gain / cost) * 100 : 0, count };
}
