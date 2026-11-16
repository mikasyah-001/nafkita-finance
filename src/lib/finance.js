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
  const out = { income: 0, expense: 0, sedekah: 0, balance: 0, count: 0, currencies: new Set(), unconverted: {} };
  (currencyList || []).forEach((c) => out.currencies.add((c || "IDR").toUpperCase()));
  (txs || []).forEach((t) => {
    if (t.transfer_pair_id) return;
    if (t.approval_status && t.approval_status !== "approved") return;
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
  if (!isGoldType(asset?.type)) return null;
  return goldPriceCurrencyHint(asset.purchase_price, asset.currency, candidates, rateMap);
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
