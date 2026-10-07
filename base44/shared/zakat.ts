// Modul bersama perhitungan zakat mal — SATU SUMBER KEBENARAN.
// Dipakai oleh getZakatStatus (UI Zakat.jsx) dan zakatReminder (email tahunan)
// sehingga keduanya tidak pernah bertentangan.
//
// Metodologi: nisab dihitung PER MATA UANG (85 gr emas × harga emas dalam
// mata uang tersebut). Emas dan simpanan diperlakukan terpisah per currency.
// Ini lebih benar secara syariat daripada menggabungkan semua ke IDR.

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

// Hitung zakat per mata uang dari daftar aset.
// assets: array aset (punya type, quantity, value, currency)
// goldPrices: { IDR, SAR, USD } hasil fetchGoldPricesBackend
// rateMap: opsional, untuk konversi total gabungan ke IDR (konteks ringkasan)
//
// Return: {
//   perCurrency: [{ currency, emasGrams, emasValue, nonEmasValue, nisab,
//                    wajibEmas, wajibSimpanan, zakatEmas, zakatSimpanan, totalHarta, totalZakat }],
//   totalHartaIDR, totalZakatIDR
// }
export function computeZakatPerCurrency(assets, goldPrices, rateMap = {}) {
  const perCurrency = [];
  for (const cur of ZAKAT_CURRENCIES) {
    const curAssets = (assets || []).filter((a) => (a.currency || "IDR").toUpperCase() === cur);
    if (curAssets.length === 0) continue;

    const emasAssets = curAssets.filter((a) => (a.type === "emas" || a.type === "emas_digital"));
    const emasGrams = emasAssets.reduce((s, a) => s + (a.quantity || 0), 0);
    const goldPrice = goldPrices[cur] || 0;
    const emasValue = goldPrice > 0
      ? emasGrams * goldPrice
      : emasAssets.reduce((s, a) => s + (a.value || 0), 0);
    const nonEmasValue = curAssets
      .filter((a) => (a.type !== "emas" && a.type !== "emas_digital"))
      .reduce((s, a) => s + (a.value || 0), 0);

    const nisab = goldPrice * NISAB_GRAM;
    const wajibEmas = emasGrams >= NISAB_GRAM;
    const wajibSimpanan = goldPrice > 0 && nonEmasValue >= nisab;
    const zakatEmas = wajibEmas ? emasValue * ZAKAT_RATE : 0;
    const zakatSimpanan = wajibSimpanan ? nonEmasValue * ZAKAT_RATE : 0;

    perCurrency.push({
      currency: cur,
      emasGrams,
      emasValue,
      nonEmasValue,
      nisab,
      goldPrice,
      wajibEmas,
      wajibSimpanan,
      zakatEmas,
      zakatSimpanan,
      totalHarta: emasValue + nonEmasValue,
      totalZakat: zakatEmas + zakatSimpanan,
    });
  }

  // Total gabungan dalam IDR (untuk ringkasan konteks).
  const toIdr = (amt, cur) => {
    if (cur === "IDR") return amt;
    const r = rateMap[cur];
    return r && r > 0 ? amt * r : 0;
  };
  const totalHartaIDR = perCurrency.reduce((s, p) => s + toIdr(p.totalHarta, p.currency), 0);
  const totalZakatIDR = perCurrency.reduce((s, p) => s + toIdr(p.totalZakat, p.currency), 0);

  return { perCurrency, totalHartaIDR, totalZakatIDR };
}