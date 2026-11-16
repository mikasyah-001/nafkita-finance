// ─────────────────────────────────────────────────────────────────────────
// IMPOR PORTOFOLIO dari aplikasi investasi luar (foto/PDF → AI → tinjau).
// Logika murni (tanpa React/AI) agar bisa diuji: normalisasi, rekonsiliasi
// angka, penggabungan antar-screenshot, pencocokan aset lama, dan payload.
// ─────────────────────────────────────────────────────────────────────────
import { formatMoneyPlain } from "./finance.js";

export const INSTRUMENTS = {
  saham: "Saham",
  reksadana: "Reksa dana",
  etf: "ETF",
  sukuk: "Sukuk/SBN",
  emas: "Emas digital",
  lainnya: "Lainnya",
};

// Angka dari AI bisa berupa number atau teks apa adanya ("⃁ 5,570.40",
// "Rp 22.287.562,64", "-161.51", "(319.91)"). Dibersihkan di sini, bukan oleh AI.
export const num = (v, currency = "") => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const raw = String(v).trim();
  const neg = /^\(.*\)$/.test(raw) || /[-−–]\s*[\d.,]/.test(raw);
  let s = raw.replace(/[^\d.,]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const dots = (s.match(/\./g) || []).length, commas = (s.match(/,/g) || []).length;
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  if (dots && commas) {
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (dots > 1) {
    s = s.replace(/\./g, ""); // 22.287.562
  } else if (commas > 1) {
    s = s.replace(/,/g, ""); // 1,782,990
  } else if (commas === 1) {
    // "1,782" ribuan (format Inggris) vs "0,5" desimal (format Indonesia)
    s = /^\d{1,3},\d{3}$/.test(s) && String(currency).toUpperCase() !== "IDR" ? s.replace(",", "") : s.replace(",", ".");
  } else if (dots === 1 && String(currency).toUpperCase() === "IDR" && /^\d{1,3}\.\d{3}$/.test(s)) {
    s = s.replace(".", ""); // Rp 537.562 → ribuan
  }
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
};

export function normalizeCurrency(raw, fallback = "IDR") {
  const s = String(raw || "").trim().toUpperCase();
  if (!s) return fallback;
  if (s.includes("SAR") || s.includes("⃁") || s.includes("ر.س") || s.includes("ريال") || s === "SR") return "SAR";
  if (s.includes("USD") || s === "$" || s.includes("US$")) return "USD";
  if (s.includes("IDR") || s.startsWith("RP")) return "IDR";
  if (/^[A-Z]{3}$/.test(s)) return s;
  return fallback;
}

// Bila AI tak mengisi mata uang, tebak dari simbol pada angka mentah.
function guessCurrency(raw) {
  const t = ["market_value", "last_price", "avg_cost", "total_cost"].map((k) => String(raw[k] ?? "")).join(" ");
  if (/\u20C1|SAR|ر\.س/.test(t)) return "SAR";
  if (/\$|USD/.test(t)) return "USD";
  if (/Rp|IDR/i.test(t)) return "IDR";
  return "";
}

const normName = (s) => String(s || "").toLowerCase().replace(/\.{2,}|…/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Bersihkan satu baris hasil AI → bentuk standar. */
export function normalizeHolding(raw, defaults = {}) {
  const kindRaw = String(raw.instrument || raw.kind || "").toLowerCase();
  const instrument = /emas|gold/.test(kindRaw) ? "emas"
    : /reksa|fund|mutual|pasar uang/.test(kindRaw) ? "reksadana"
    : /etf/.test(kindRaw) ? "etf"
    : /sukuk|sbn|bond|obligasi/.test(kindRaw) ? "sukuk"
    : /saham|stock|equity|share/.test(kindRaw) ? "saham"
    : (raw.ticker ? "saham" : "lainnya");
  const h = {
    name: String(raw.name || "").trim(),
    ticker: String(raw.ticker || "").trim().toUpperCase(),
    exchange: String(raw.exchange || "").trim().toUpperCase(),
    instrument,
    currency: normalizeCurrency(raw.currency || guessCurrency(raw), defaults.currency || "IDR"),
    quantity: num(raw.quantity),
    platform: String(raw.platform || defaults.platform || "").trim(),
    as_of: String(raw.as_of || defaults.as_of || "").slice(0, 10),
  };
  h.lots = mergeLots((raw.lots || []).map(normalizeLot));
  for (const k of ["avg_cost", "total_cost", "last_price", "market_value", "gain"]) h[k] = num(raw[k], h.currency);
  // Angka yang benar-benar tertera (bukan hasil hitung) — dipakai saat menggabung.
  h.given = NUMS.filter((k) => h[k] != null);
  return reconcileHolding(h);
}

/**
 * Lengkapi angka yang hilang dari yang tersedia & tandai yang tidak konsisten.
 * nilai = jumlah × harga; modal = jumlah × rata-rata = nilai − untung.
 */
export function reconcileHolding(h) {
  const r = { ...h, warnings: [] };
  const q = r.quantity;
  if (r.market_value == null && q && r.last_price) r.market_value = round2(q * r.last_price);
  // Untung/rugi dari aplikasi itu presisi; rata-rata yang tampil sering sudah
  // dibulatkan (65,14 × 88 = 5.732,32 vs modal asli 5.731,91). Maka bila untung
  // tertera, modal = nilai − untung lebih dulu, baru jumlah × rata-rata.
  if (r.total_cost == null && r.market_value != null && r.gain != null) r.total_cost = round2(r.market_value - r.gain);
  if (r.total_cost == null && q && r.avg_cost) r.total_cost = round2(q * r.avg_cost);
  if (r.avg_cost == null && q && r.total_cost) r.avg_cost = r.total_cost / q;
  if (r.last_price == null && q && r.market_value) r.last_price = r.market_value / q;
  if (r.gain == null && r.market_value != null && r.total_cost != null) r.gain = round2(r.market_value - r.total_cost);
  if (q && r.last_price && r.market_value && Math.abs(q * r.last_price - r.market_value) / r.market_value > 0.03) {
    r.warnings.push("Nilai pasar ≠ jumlah × harga terakhir. Periksa angka.");
  }
  if (!r.name && !r.ticker) r.warnings.push("Nama instrumen tidak terbaca.");
  if (!(r.market_value > 0)) r.warnings.push("Nilai pasar belum ada.");
  return r;
}

const round2 = (n) => Math.round(n * 100) / 100;
const NUMS = ["quantity", "avg_cost", "total_cost", "last_price", "market_value", "gain"];

const keyOf = (h) => `${h.ticker || normName(h.name)}|${h.currency}`;
const sameHolding = (a, b) => {
  if (a.currency !== b.currency) return false;
  if (a.ticker && b.ticker) return a.ticker === b.ticker;
  const na = normName(a.name), nb = normName(b.name);
  if (!na || !nb) return false;
  // Nama terpotong di daftar ("SAUDI AR...") vs lengkap di detail ("SAUDI ARAMCO").
  return na === nb || (Math.min(na.length, nb.length) >= 6 && (na.startsWith(nb) || nb.startsWith(na)));
};

/** Gabungkan baris yang sama dari beberapa screenshot; angka terlengkap menang. */
export function mergeHoldings(list) {
  const out = [];
  for (const h of list) {
    const hit = out.find((o) => sameHolding(o, h));
    if (!hit) { out.push({ ...h }); continue; }
    for (const k of ["name", "ticker", "exchange", "platform", "as_of"]) {
      if (!hit[k] || (k === "name" && h[k] && h[k].length > hit[k].length && !/\.{2,}|…/.test(h[k]))) hit[k] = h[k] || hit[k];
    }
    if (hit.instrument === "lainnya" && h.instrument !== "lainnya") hit.instrument = h.instrument;
    hit.lots = mergeLots(hit.lots || [], h.lots || []);
    const hg = new Set(hit.given || []), bg = new Set(h.given || []);
    for (const k of NUMS) {
      const a = hit[k], b = h[k];
      if (b == null) continue;
      const aGiven = hg.has(k), bGiven = bg.has(k);
      // Angka tertera > angka hasil hitung; sesama tertera → yang lebih presisi.
      if (a == null || (!aGiven && bGiven) || (aGiven === bGiven && decimals(b) > decimals(a) && Math.abs(a - b) / Math.max(Math.abs(a), 1e-9) < 0.02)) {
        hit[k] = b;
        if (bGiven) hg.add(k);
      }
    }
    hit.given = [...hg];
  }
  // Hitung ulang turunan dari angka tertera saja.
  return out.map((h) => {
    const g = new Set(h.given || []);
    const clean = { ...h, warnings: undefined };
    NUMS.forEach((k) => { if (!g.has(k)) clean[k] = null; });
    return reconcileHolding(clean);
  });
}
const decimals = (n) => { const s = String(n); const i = s.indexOf("."); return i < 0 ? 0 : s.length - i - 1; };

/** Cari aset lama yang sama (impor ulang → perbarui, bukan duplikat). */
export function matchExistingAsset(h, assets = []) {
  const type = h.instrument === "emas" ? "emas_digital" : "investasi";
  const cands = assets.filter((a) => a.type === type && (a.currency || "IDR").toUpperCase() === h.currency);
  if (h.ticker) {
    const t = cands.find((a) => (a.ticker || "").toUpperCase() === h.ticker || new RegExp(`\\b${escapeRe(h.ticker)}\\b`, "i").test(a.name || ""));
    if (t) return t;
  }
  const n = normName(h.name);
  if (!n) return null;
  return cands.find((a) => {
    const an = normName(String(a.name || "").replace(/\(.*?\)/g, ""));
    return an === n || (Math.min(an.length, n.length) >= 6 && (an.startsWith(n) || n.startsWith(an)));
  }) || null;
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function displayName(h) {
  if (h.ticker && h.name && !h.name.toUpperCase().includes(h.ticker)) return `${h.name} (${h.ticker})`;
  return h.name || h.ticker;
}

/**
 * Payload entitas Asset.
 * investasi: purchase_price = MODAL TOTAL (sesuai assetCost), quantity = unit.
 * emas_digital: purchase_price = harga beli PER GRAM, quantity = gram.
 */
export function holdingToAsset(h, { visibility = "shared", existing = null, today = new Date().toISOString().slice(0, 10) } = {}) {
  const isGold = h.instrument === "emas";
  const priceDate = h.as_of || today;
  const src = [h.platform, "impor"].filter(Boolean).join(" · ");
  const base = {
    name: existing?.name || displayName(h),
    type: isGold ? "emas_digital" : "investasi",
    currency: h.currency,
    value: round2(h.market_value || 0),
    quantity: h.quantity || 0,
    unit: isGold ? "gram" : h.instrument === "saham" ? "lembar" : "unit",
    purchase_price: isGold ? round4(h.avg_cost || 0) : round2(h.total_cost || 0),
    broker: h.platform || existing?.broker || "",
    ticker: h.ticker || existing?.ticker || "",
    exchange: h.exchange || existing?.exchange || undefined,
    instrument: isGold ? undefined : h.instrument,
    last_price: h.last_price ? round4(h.last_price) : undefined,
    price_date: priceDate,
    import_source: src,
    // Nilai dari layar broker = sumber utama. Bila dilengkapi harga online saat impor → "online".
    value_source: h.price_source ? "online" : "broker",
  };
  // Tanggal beli = lot beli paling awal (untuk emas, dipakai menghitung haul zakat).
  const firstBuy = lotSummary(h.lots || []).firstDate;
  if (firstBuy && (!existing?.purchase_date || firstBuy < String(existing.purchase_date).slice(0, 10))) base.purchase_date = firstBuy;
  if (existing) return base; // pembaruan: nama, visibilitas & catatan dipertahankan
  return { ...base, visibility, notes: `Diimpor dari ${h.platform || "aplikasi investasi"} per ${priceDate}.` };
}
const round4 = (n) => Math.round(n * 10000) / 10000;

/** Ringkasan per mata uang untuk layar tinjau. */
export function summarize(holdings) {
  const m = {};
  holdings.forEach((h) => {
    const e = (m[h.currency] ||= { value: 0, cost: 0, count: 0 });
    e.value += h.market_value || 0;
    e.cost += h.total_cost || 0;
    e.count++;
  });
  return Object.entries(m).map(([currency, v]) => ({ currency, ...v, gain: v.value - v.cost, label: formatMoneyPlain(v.value, currency) }));
}

/** Prompt & skema untuk AI (dipakai halaman impor). */
export const HOLDINGS_PROMPT = `Kamu membaca screenshot/PDF dari aplikasi investasi (saham, reksa dana, ETF, sukuk/SBN, atau dompet emas). Bisa berbahasa Indonesia, Inggris, atau Arab.

Ambil SETIAP kepemilikan (holding) yang tertera — satu baris per instrumen. JANGAN masukkan baris ringkasan portofolio (Total Investasi, Market Value total, Total Cash, Today Gain) sebagai holding.

Untuk tiap holding isi:
- name: nama instrumen apa adanya (mis. "ALRAJHI", "SAUDI ARAMCO", "Mandiri Pasar Uang Syariah Kelas A", "Saving and Liquidity SAR", "Gold")
- ticker: kode/simbol bila ada (mis. "1120", "2222", "SPUS"); kosongkan bila tidak ada
- exchange: bursa bila ada (mis. "TASI", "ARCA")
- instrument: salah satu saham | reksadana | etf | sukuk | emas | lainnya (dompet emas / Gold Wallet = emas; fund/reksa dana/pasar uang = reksadana)
- currency: kode mata uang (SAR untuk simbol riyal ⃁/ر.س, USD untuk $, IDR untuk Rp)
- quantity: jumlah unit/lembar/gram (angka)
- avg_cost: harga rata-rata/Avg. Cost per unit (untuk emas: harga beli per gram)
- total_cost: Total Cost / modal bila tertera
- last_price: harga terakhir per unit (Last Price; untuk emas pakai harga JUAL/Sell Price per gram)
- market_value: nilai pasar saat ini (Market Value / Nilai Saat Ini)
- gain: untung/rugi nominal (negatif bila rugi)
- platform: nama aplikasi/broker bila terlihat (mis. "Al Rajhi Capital", "Bibit", "Derayah"); kosongkan bila tidak jelas
- as_of: tanggal data bila tertera (yyyy-mm-dd), mis. "Data per 04 Nov 2026" → 2026-11-04

RIWAYAT LOT (daftar "lots" di tingkat atas, TERPISAH dari "holdings"): bila layar menampilkan riwayat pembelian per lot (Lots Breakdown, riwayat transaksi beli/jual, riwayat dompet emas), masukkan SETIAP baris ke "lots": ticker & name instrumen (dari judul layar, mis. "1120"/"ALRAJHI"), date (yyyy-mm-dd, mis. "13 May 2026" → 2026-05-13), side ("buy"/"sell"), quantity, price (harga per unit/gram), currency. Jangan lewatkan satu baris pun. Pada layar lot, "holdings" cukup berisi name/ticker/last_price dari judul.

Pemetaan layar rincian (Details) broker: Market Value → market_value; Quantity → quantity; Avg. Cost / Avg. Price PL → avg_cost (pilih yang paling banyak desimal); Total Cost / Cost Value PL → total_cost (pilih yang paling banyak desimal); Gain/Loss / UPL PL → gain; harga besar di judul (mis. ⃁ 63.30) → last_price.
Layar "Lots Breakdown" hanya berisi lots + harga judul — jangan mengosongkan angka dari layar Details lain; tiap layar dibaca terpisah.

Angka: salin PERSIS seperti tertera sebagai teks (boleh dengan simbol/pemisah ribuan, mis. "⃁ 5,570.40", "-161.51", "Rp 22.287.562,64"). Jangan menebak angka yang tidak terlihat — kosongkan.
Jawab HANYA JSON sesuai skema.`;

// Angka diminta sebagai TEKS apa adanya: model sering gagal mengubah "⃁ 5,570.40"
// menjadi number lalu mengosongkannya. Teks dibersihkan oleh num().
const NUM_T = { type: "string" };

export const HOLDINGS_SCHEMA = {
  type: "object",
  properties: {
    holdings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" }, ticker: { type: "string" }, exchange: { type: "string" },
          instrument: { type: "string" }, currency: { type: "string" },
          quantity: NUM_T, avg_cost: NUM_T, total_cost: NUM_T,
          last_price: NUM_T, market_value: NUM_T, gain: NUM_T,
          platform: { type: "string" }, as_of: { type: "string" },
        },
      },
    },
    // Lot sebagai daftar terpisah (tidak bersarang di holding) — model lebih
    // andal mengisi array datar. attachLots() menempelkannya ke holding.
    lots: {
      type: "array",
      items: {
        type: "object",
        properties: { ticker: { type: "string" }, name: { type: "string" }, date: { type: "string" }, side: { type: "string" }, quantity: NUM_T, price: NUM_T, currency: { type: "string" } },
      },
    },
  },
};

// ─── LOT / TANGGAL PEMBELIAN ──────────────────────────────────────────────
// Prinsip (agar tidak tumpang tindih):
//  1. Total aset (jumlah, modal, nilai) = sumber kebenaran (rincian broker/isian).
//  2. Lot = riwayat tanggal & harga beli. Lot TIDAK menimpa total aset.
//  3. Selisih lot vs total ditampilkan apa adanya (screenshot lot belum lengkap,
//     saham bonus/pemecahan, atau sudah ada penjualan).
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, agu: 8, agt: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, des: 12 };

export function normalizeLotDate(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,})\.?[\s-]+(\d{4})/); // 13 May 2026 / 13-Mei-2026
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return `${m[3]}-${String(MONTHS[m[2].slice(0, 3).toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // 13/05/2026 (dd/mm/yyyy)
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

export function normalizeLot(raw) {
  const side = /sell|jual|بيع/i.test(String(raw.side || raw.type || "")) ? "sell" : "buy";
  const quantity = Math.abs(num(raw.quantity) || 0);
  const price = num(raw.price ?? raw.price_per_unit) || 0;
  const date = normalizeLotDate(raw.date);
  if (!date || !(quantity > 0)) return null;
  return { date, side, quantity, price, amount: round2(quantity * price) };
}

export const lotKey = (l) => `${l.date}|${l.side || "buy"}|${Number(l.quantity)}|${Number(l.price ?? l.price_per_unit)}`;

/** Gabung lot dari beberapa screenshot (list bisa tumpang tindih saat digulir). */
export function mergeLots(...lists) {
  const seen = new Map();
  lists.flat().filter(Boolean).forEach((l) => { if (!seen.has(lotKey(l))) seen.set(lotKey(l), l); });
  return [...seen.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/** Cocokkan riwayat lot dengan total kepemilikan. */
export function lotSummary(lots = [], holdingQty = null) {
  const buys = lots.filter((l) => l.side !== "sell");
  const sells = lots.filter((l) => l.side === "sell");
  const buyQty = buys.reduce((s, l) => s + Number(l.quantity || 0), 0);
  const sellQty = sells.reduce((s, l) => s + Number(l.quantity || 0), 0);
  const netQty = round4(buyQty - sellQty);
  const buyCost = round2(buys.reduce((s, l) => s + Number(l.amount ?? l.quantity * (l.price ?? l.price_per_unit) ?? 0), 0));
  const dates = buys.map((l) => l.date).sort();
  const total = Number(holdingQty) || 0;
  const diff = total ? round4(total - netQty) : 0;
  let status = "none", message = "";
  if (lots.length && total) {
    if (Math.abs(diff) < 1e-6) { status = "complete"; message = `Riwayat lot lengkap: ${fmtQty(netQty)} dari ${fmtQty(total)}.`; }
    else if (diff > 0) { status = "partial"; message = `Riwayat lot mencakup ${fmtQty(netQty)} dari ${fmtQty(total)} (kurang ${fmtQty(diff)}). Tambahkan screenshot lot yang belum terlihat, atau selisih berasal dari saham bonus/pemecahan.`; }
    else { status = "over"; message = `Lot terbaca ${fmtQty(netQty)}, melebihi total ${fmtQty(total)}. Mungkin ada penjualan yang belum terbaca — periksa lot.`; }
  }
  return { count: lots.length, buyQty, sellQty, netQty, buyCost, firstDate: dates[0] || "", lastDate: dates.at(-1) || "", diff, status, message };
}
const fmtQty = (n) => String(Number(n.toFixed(4)));

/** Lot yang perlu dibuat: buang yang sudah ada (impor sebelumnya atau DCA manual yang sama). */
export function lotsToCreate(lots = [], existingLots = []) {
  const have = new Set(existingLots.map((l) => lotKey({ date: String(l.date || "").slice(0, 10), side: l.side || "buy", quantity: l.quantity, price: l.price_per_unit })));
  return lots.filter((l) => !have.has(lotKey(l)));
}

// ─── HARGA ONLINE: validasi (murni) ─────────────────────────────────────
export const MAX_DEVIATION = 0.35; // >35% dari harga terakhir diketahui → curigai salah instrumen

/** Validasi satu harga online terhadap instrumen yang diminta. */
export function validateLivePrice(p, it, today = new Date()) {
  const price = num(p.price, it.currency);
  const currency = normalizeCurrency(p.currency, it.currency);
  const base = { price, currency, as_of: String(p.as_of || "").slice(0, 10), source: p.source || "", url: p.url || "" };
  if (!(price > 0)) return { ...base, ok: false, reason: "Harga tidak ditemukan" };
  if (currency !== (it.currency || "").toUpperCase()) return { ...base, ok: false, reason: `Mata uang ${currency} ≠ ${it.currency}` };
  if (it.ref_price > 0 && Math.abs(price - it.ref_price) / it.ref_price > MAX_DEVIATION) {
    return { ...base, ok: false, reason: `Selisih ${Math.round((Math.abs(price - it.ref_price) / it.ref_price) * 100)}% dari harga terakhir — mungkin instrumen lain` };
  }
  if (base.as_of) {
    const age = (today - new Date(base.as_of)) / 864e5;
    if (age > 10) return { ...base, ok: false, reason: `Data lama (${base.as_of})` };
  }
  return { ...base, ok: true, reason: "" };
}


/**
 * Hasil AI satu berkas → daftar holding mentah dengan lot terpasang.
 * Lot boleh datang (a) di dalam holding atau (b) sebagai daftar terpisah
 * di tingkat atas `lots` (lebih andal dibaca model). (b) ditempel ke holding
 * dengan kode/nama sama; bila layar hanya punya satu holding, ke holding itu;
 * bila tak ada holding sama sekali, dibuat holding ringkas dari info lot.
 */
export function attachLots(data = {}) {
  const holdings = (data.holdings || []).filter((h) => h && (h.name || h.ticker)).map((h) => ({ ...h, lots: [...(h.lots || [])] }));
  const flat = (data.lots || []).filter(Boolean);
  const keyH = (h) => String(h.ticker || "").trim().toUpperCase() || normName(h.name);
  for (const l of flat) {
    const k = String(l.ticker || "").trim().toUpperCase() || normName(l.name);
    let h = (k && holdings.find((x) => keyH(x) === k || (l.name && normName(x.name) && normName(l.name).startsWith(normName(x.name)))))
      || (holdings.length === 1 ? holdings[0] : null);
    if (!h) {
      if (!l.ticker && !l.name) continue;
      h = { name: l.name || "", ticker: l.ticker || "", currency: l.currency || "", lots: [] };
      holdings.push(h);
    }
    h.lots.push({ date: l.date, side: l.side, quantity: l.quantity, price: l.price });
  }
  return holdings;
}

// ─── ASAL NILAI PASAR ───────────────────────────────────────────────────
// Prioritas: broker (aplikasi tempat beli) > manual > online (perkiraan).

/** Sumber harga resmi yang dipakai broker/aplikasi tempat membeli. */
export function brokerPriceSource({ broker = "", exchange = "", instrument = "", currency = "" } = {}) {
  const b = broker.toLowerCase(), x = exchange.toUpperCase();
  if (/rajhi|derayah|snb|alinma|riyad|albilad|aljazira|sab invest|saudi fransi/.test(b) || x === "TASI" || x === "NOMU") {
    if (instrument === "reksadana") return `NAV resmi dana di situs pengelola/${broker || "broker Saudi"} (bukan harga bursa)`;
    if (x && x !== "TASI" && x !== "NOMU") return `harga penutupan bursa ${x} sebagaimana ditampilkan ${broker || "broker"}`;
    return "harga resmi Saudi Exchange (saudiexchange.sa / Tadawul) — sama dengan yang ditampilkan Al Rajhi Capital";
  }
  if (/bibit|bareksa|ajaib|ipot|stockbit|mandiri|bni|bca|bri/.test(b) || currency === "IDR") {
    if (instrument === "reksadana") return `NAB/unit resmi terbaru (situs manajer investasi, Bibit/Bareksa, atau KSEI)`;
    return "harga penutupan resmi Bursa Efek Indonesia (idx.co.id)";
  }
  if (x === "ARCA" || x === "NYSE" || x === "NASDAQ" || currency === "USD") return `harga penutupan resmi bursa AS (${x || "NYSE/NASDAQ"})`;
  return "sumber resmi bursa/pengelola instrumen";
}

/** Label asal nilai untuk ditampilkan di kartu aset & halaman investasi. */
export function valueSourceInfo(asset = {}) {
  const date = asset.price_date ? String(asset.price_date).slice(0, 10) : "";
  const src = asset.value_source || (/^Harga online/.test(asset.import_source || "") ? "online" : asset.import_source ? "broker" : "manual");
  const broker = asset.broker || String(asset.import_source || "").replace(/\s*·\s*impor$/, "");
  if (src === "broker") return { kind: "broker", label: `Dari ${broker || "aplikasi broker"}`, date };
  if (src === "online") return { kind: "online", label: "Perkiraan harga online", date };
  return { kind: "manual", label: "Diisi manual", date };
}
