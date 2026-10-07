import { format } from "date-fns";
import { id } from "date-fns/locale";

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
  { code: "SAR", label: "Riyal Saudi", symbol: "SAR" },
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

export function formatMoney(n, currency = "IDR") {
  const c = (currency || "IDR").toUpperCase();
  const v = Number(n) || 0;
  if (c === "IDR") return formatRupiah(v);
  if (c === "USD") return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  if (c === "SAR") return "SAR " + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
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
  if (c === "SAR") return "SAR";
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

// Konversi amount dari fromCurrency ke toCurrency via jembatan IDR.
// rateMap: output buildRateMap (nilai 1 unit mata uang dalam IDR).
// Bila kurs tidak tersedia, kembalikan amount asli (fallback aman).
export function convertTo(amount, fromCurrency, toCurrency, rateMap = {}) {
  const from = (fromCurrency || "IDR").toUpperCase();
  const to = (toCurrency || "IDR").toUpperCase();
  const amt = Number(amount) || 0;
  if (from === to) return amt;
  const fromRate = rateMap[from] ?? (from === "IDR" ? 1 : null);
  const toRate = rateMap[to] ?? (to === "IDR" ? 1 : null);
  if (!fromRate || !toRate) return amt; // kurs tidak tersedia, kembalikan asli
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
    // Transfer antar-rekening tidak dihitung sebagai pemasukan/pengeluaran.
    if (t.transfer_pair_id) return;
    // Transaksi pending/rejected tidak dihitung dalam ringkasan.
    if (t.approval_status && t.approval_status !== "approved") return;
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
  const out = { income: 0, expense: 0, sedekah: 0, balance: 0, count: 0, currencies: new Set() };
  (currencyList || []).forEach((c) => out.currencies.add((c || "IDR").toUpperCase()));
  (txs || []).forEach((t) => {
    if (t.transfer_pair_id) return;
    if (t.approval_status && t.approval_status !== "approved") return;
    const from = (t.currency || "IDR").toUpperCase();
    out.currencies.add(from);
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

// Filter transaksi yang layak masuk laporan/ringkasan:
// - eksklusikan transfer antar-rekening (bukan pengeluaran riil)
// - eksklusikan transaksi pending/rejected (belum disetujui pasangan)
export function filterReportableTx(t) {
  if (!t) return false;
  if (t.transfer_pair_id) return false;
  if (t.approval_status && t.approval_status !== "approved") return false;
  return true;
}

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
  const d = new Date(currentDate);
  switch (frequency) {
    case "daily": d.setDate(d.getDate() + 1); break;
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "yearly": d.setFullYear(d.getFullYear() + 1); break;
    case "monthly":
    default: d.setMonth(d.getMonth() + 1); break;
  }
  return d.toISOString().slice(0, 10);
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

// Kalkulasi zakat mal yang seragam (dipakai Reports & ZakatStatus).
// Emas dan simpanan diperlakukan terpisah: emas nisab 85 gr, simpanan nisab = 85 gr emas.
export const NISAB_GRAM = 85;
export const isGoldType = (type) => type === "emas" || type === "emas_digital";

export function computeZakat({ emasGrams = 0, emasValue = 0, nonEmasValue = 0, goldPrice = 0 }) {
  const nisab = goldPrice > 0 ? goldPrice * NISAB_GRAM : 0;
  const emasReached = emasGrams >= NISAB_GRAM;
  const simpananReached = goldPrice > 0 && nonEmasValue >= nisab;
  return {
    nisab,
    emasReached,
    simpananReached,
    zakatEmas: emasReached ? emasValue * 0.025 : 0,
    zakatSimpanan: simpananReached ? nonEmasValue * 0.025 : 0,
  };
}

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

export const assetTypeLabels = {
  bank: { label: "Tabungan/Bank", icon: "Landmark", color: "blue" },
  emas: { label: "Emas", icon: "Coins", color: "amber" },
  emas_digital: { label: "Emas Digital", icon: "Coins", color: "amber" },
  investasi: { label: "Investasi", icon: "Briefcase", color: "green" },
  properti: { label: "Properti", icon: "Home", color: "violet" },
  tanah: { label: "Tanah", icon: "Map", color: "cyan" },
  lainnya: { label: "Lainnya", icon: "Package", color: "slate" },
};