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

const num = (v) => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  // "1,782.99" / "1.782,99" / "Rp 22.287.562,64"
  let s = String(v).replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
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
    currency: normalizeCurrency(raw.currency, defaults.currency || "IDR"),
    quantity: num(raw.quantity),
    avg_cost: num(raw.avg_cost),
    total_cost: num(raw.total_cost),
    last_price: num(raw.last_price),
    market_value: num(raw.market_value),
    gain: num(raw.gain),
    platform: String(raw.platform || defaults.platform || "").trim(),
    as_of: String(raw.as_of || defaults.as_of || "").slice(0, 10),
  };
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
    instrument: isGold ? undefined : h.instrument,
    last_price: h.last_price ? round4(h.last_price) : undefined,
    price_date: priceDate,
    import_source: src,
  };
  if (existing) return base; // pembaruan: nama, visibilitas, tanggal beli & catatan dipertahankan
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

Angka: tulis sebagai number murni (titik desimal), tanpa simbol mata uang/pemisah ribuan. Jangan menebak angka yang tidak terlihat — kosongkan.
Jawab HANYA JSON sesuai skema.`;

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
          quantity: { type: "number" }, avg_cost: { type: "number" }, total_cost: { type: "number" },
          last_price: { type: "number" }, market_value: { type: "number" }, gain: { type: "number" },
          platform: { type: "string" }, as_of: { type: "string" },
        },
      },
    },
  },
};
