// Kategori aset investasi — SATU sumber logika, dipakai daftar aset, detail,
// form, dan impor. Kategori ditebak otomatis dari nama/ticker/bursa; pilihan
// manual pengguna (instrument_manual) selalu menang.

export const INVESTMENT_CATEGORIES = [
  { key: "pasar_uang", label: "Pasar uang", hint: "Likuid & stabil — lazim untuk dana darurat" },
  { key: "etf", label: "ETF" },
  { key: "saham", label: "Saham" },
  { key: "reksadana", label: "Reksa dana" },
  { key: "sukuk", label: "Sukuk/SBN" },
  { key: "lainnya", label: "Lainnya" },
];
export const CATEGORY_LABEL = Object.fromEntries(INVESTMENT_CATEGORIES.map((c) => [c.key, c.label]));
const VALID = new Set(INVESTMENT_CATEGORIES.map((c) => c.key));

// ETF syariah/umum yang lazim dibeli lewat Al Rajhi Capital, Derayah, dll.
const ETF_TICKERS = new Set([
  "SPUS", "HLAL", "SPSK", "SPRE", "SPTE", "SPWO", "UMMA", "ISUS", "ISDW", "ISWD", "IGDA",
  "SPY", "VOO", "IVV", "VTI", "QQQ", "VT", "VXUS", "SCHD", "GLD", "IAU",
]);
const STOCK_EXCHANGES = /^(TASI|TADAWUL|NOMU|IDX|BEI|NYSE|NASDAQ|ARCA|NYSEARCA|LSE|HKEX|SGX)$/i;

/** Tebak kategori dari data aset (nama, ticker, bursa, satuan). */
export function inferInstrument(a = {}) {
  const name = String(a.name || "");
  const ticker = String(a.ticker || "").trim().toUpperCase()
    || (name.match(/\(([A-Z0-9.]{2,8})\)\s*$/)?.[1] || "");
  const exchange = String(a.exchange || "").trim();
  const n = name.toLowerCase();

  if (/pasar uang|money market|liquidity|likuid|murabah|cash fund|kas syariah/.test(n)) return "pasar_uang";
  if (/reksa ?dana/.test(n)) return "reksadana";
  if (/\betf\b|exchange traded|\bspdr\b|ishares|vanguard|\bsp funds\b/.test(n) || ETF_TICKERS.has(ticker)) return "etf";
  if (/\bsukuk\b|obligasi|\bsbn\b|\bsbsn\b|\bbond\b|\b(sr|st|sbr|ori|pbs|sw)[- ]?0?\d{2,3}\b/.test(n)) return "sukuk";
  if (/\bfunds?\b|mutual|\bnav\b|unit trust/.test(n)) return "reksadana";
  if (a.unit === "lembar" || STOCK_EXCHANGES.test(exchange) || /^\d{4}$/.test(ticker) || /^[A-Z]{4}$/.test(ticker)) return "saham";
  return "lainnya";
}

/**
 * Kategori efektif sebuah aset investasi.
 * - Pilihan manual pengguna selalu dipakai.
 * - Selain itu, tebakan yang LEBIH SPESIFIK menyempurnakan label lama
 *   (mis. impor lama menandai dana pasar uang sebagai "reksadana",
 *   atau ETF sebagai "saham").
 */
export function investmentCategory(a = {}) {
  const set = VALID.has(a.instrument) ? a.instrument : "";
  if (set && a.instrument_manual) return set;
  const guess = inferInstrument(a);
  if (!set || set === "lainnya") return guess;
  if (guess === "pasar_uang" && set === "reksadana") return guess;
  if (guess === "etf" && (set === "saham" || set === "reksadana")) return guess;
  return set;
}

/**
 * Id aset tempat dana darurat disimpan: "Disimpan di" pada target berjenis
 * Dana darurat (boleh beberapa aset). Target lama tanpa alokasi memakai
 * rekening sumbernya sebagai cadangan agar label lama tidak hilang.
 */
export function emergencyAssetIds(goals = []) {
  const ids = new Set();
  for (const g of goals || []) {
    if (g?.type !== "darurat") continue;
    const alloc = Array.isArray(g.allocated_asset_ids) ? g.allocated_asset_ids.filter(Boolean) : [];
    if (alloc.length) alloc.forEach((id) => ids.add(id));
    else if (g.linked_asset_id) ids.add(g.linked_asset_id);
  }
  return ids;
}

/**
 * Ringkasan per kategori untuk aset investasi: [{ key, label, count, value, pct }],
 * urut nilai terbesar. `valueOf(a)` = nilai dalam mata uang tampilan.
 */
export function categoryBreakdown(assets = [], valueOf = (a) => Number(a.value) || 0) {
  const by = new Map();
  let total = 0;
  for (const a of assets) {
    const k = investmentCategory(a);
    const v = Math.max(0, Number(valueOf(a)) || 0);
    total += v;
    const e = by.get(k) || { key: k, label: CATEGORY_LABEL[k], count: 0, value: 0 };
    e.count += 1; e.value += v;
    by.set(k, e);
  }
  return [...by.values()]
    .map((e) => ({ ...e, pct: total > 0 ? (e.value / total) * 100 : 0 }))
    .sort((x, y) => y.value - x.value || y.count - x.count);
}
