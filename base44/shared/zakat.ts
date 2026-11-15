// Modul bersama perhitungan zakat mal — SATU SUMBER KEBENARAN.
// Dipakai oleh getZakatStatus (UI Zakat.jsx) dan zakatReminder (email tahunan)
// sehingga keduanya tidak pernah bertentangan.
//
// Metodologi: lihat computeZakatMal di bawah (cermin src/lib/zakat.js).
// Catatan: versi lama menghitung nisab terpisah per mata uang & memisahkan
// emas/simpanan — keliru, karena harta simpanan seorang muslim digabung.

export const NISAB_GRAM = 85;
export const ZAKAT_RATE = 0.025;
export const ZAKAT_CURRENCIES = ["IDR", "SAR", "USD"];

// Ambil harga emas per gram per mata uang via InvokeLLM (web search).
// Mengembalikan { IDR, SAR, USD } — nilai 0 bila gagal.
export async function fetchGoldPricesBackend(base44) {
  const out = { IDR: 0, SAR: 0, USD: 0 };
  const prompts = {
    IDR: "Cari harga emas per gram di Indonesia saat ini (Antam). Jawab hanya angka harga per gram dalam Rupiah.",
    SAR: "Find the current gold price per gram in Saudi Arabia in SAR (riyal). Answer only the price per gram as a number.",
    USD: "Find the current gold price per gram in USD. Answer only the price per gram as a number.",
  };
  for (const cur of ZAKAT_CURRENCIES) {
    try {
      const r = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: prompts[cur],
        add_context_from_internet: true,
        response_json_schema: { type: "object", properties: { price_per_gram: { type: "number" } } },
      });
      const v = r?.price_per_gram ?? r?.price ?? r?.gold_price ?? 0;
      out[cur] = typeof v === "number" && v > 0 ? v : 0;
    } catch {
      out[cur] = 0;
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// computeZakatMal — CERMIN dari src/lib/zakat.js (frontend). Ubah bersamaan.
// Menggantikan computeZakatPerCurrency (lama) yang keliru secara syariat:
//  - nisab dihitung terpisah per mata uang & emas/simpanan dipisah,
//  - rumah/tanah/kendaraan ikut dihitung, utang tidak dikurangkan.
// Ketentuan: nisab 85 gr emas (harga saat ini), 2,5%, harta simpanan
// digabung (kas, tabungan, emas nilai pasar, investasi, piutang lancar)
// dalam IDR, dikurangi utang jatuh tempo ≤ 12 bulan; properti/tanah/lainnya
// tidak dihitung; haul 1 tahun hijriah (±354 hari).
// ─────────────────────────────────────────────────────────────────────────
export const HAUL_DAYS = 354;
const ZAKATABLE = { bank: "kas", tunai: "kas", emas: "emas", emas_digital: "emas", investasi: "investasi" };
const DAY_MS = 86400000;
export const isPlausibleGoldPriceIdr = (v) => Number(v) >= 500000 && Number(v) <= 10000000;

export function computeZakatMal({ assets = [], debts = [], goldPrice = 0, rateMap = {}, includeReceivables = true, now = new Date() }) {
  const groups = { kas: 0, emas: 0, investasi: 0, piutang: 0, utang: 0 };
  let goldGrams = 0;
  const toIdr = (amt, cur) => {
    const c = (cur || "IDR").toUpperCase();
    if (c === "IDR") return Number(amt) || 0;
    const r = rateMap[c];
    return r && r > 0 ? (Number(amt) || 0) * r : null;
  };
  for (const a of assets) {
    const g = ZAKATABLE[a.type];
    if (!g) continue;
    if (g === "emas") {
      const grams = Number(a.quantity) || 0;
      goldGrams += grams;
      if (goldPrice > 0) groups.emas += grams * goldPrice;
      continue;
    }
    const v = toIdr(a.value, a.currency);
    if (v != null) groups[g] += v;
  }
  const horizon = now.getTime() + 365 * DAY_MS;
  for (const d of debts) {
    if ((d.status || "active") !== "active") continue;
    const remaining = Math.max(0, (Number(d.amount) || 0) - (Number(d.paid_amount) || 0));
    const v = toIdr(remaining, d.currency);
    if (!v) continue;
    if (d.type === "utang") {
      const due = d.due_date ? new Date(d.due_date).getTime() : null;
      if (due == null || due <= horizon) groups.utang += v;
    } else if (d.type === "piutang" && includeReceivables) groups.piutang += v;
  }
  const gross = groups.kas + groups.emas + groups.investasi + groups.piutang;
  const net = Math.max(0, gross - groups.utang);
  const nisab = goldPrice > 0 ? NISAB_GRAM * goldPrice : 0;
  const reachesNisab = goldPrice > 0 && net >= nisab;
  return { groups, goldGrams, gross, net, nisab, reachesNisab, zakat: reachesNisab ? Math.round(net * ZAKAT_RATE) : 0 };
}

export function haulPeriodBackend(haulStart, now = new Date()) {
  if (!haulStart) return { key: null, due: null, isDue: true };
  const s0 = new Date(haulStart).getTime();
  const n = Math.floor(Math.max(0, now.getTime() - s0) / (HAUL_DAYS * DAY_MS));
  const start = new Date(s0 + n * HAUL_DAYS * DAY_MS);
  const due = new Date(s0 + (n + 1) * HAUL_DAYS * DAY_MS);
  const daysLeft = Math.ceil((due.getTime() - now.getTime()) / DAY_MS);
  return { key: "haul-" + start.toISOString().slice(0, 10), due, daysLeft, isDue: daysLeft <= 30 };
}
