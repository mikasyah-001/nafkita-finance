import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Mengambil kurs terbaru dari API gratis (open.er-api.com) dan menyimpannya
// ke entitas ExchangeRate. Bila kurs untuk hari ini sudah ada, dilewati.
// Parameter:
//   base_currency: kode mata uang dasar (default "USD")
//   target_currencies: daftar kode mata uang tujuan (opsional; kosong = semua)
export default async function (req: any) {
  const base44 = createClientFromRequest(req);
  const base_currency = (req.body?.base_currency || "USD").toUpperCase();
  const target_currencies: string[] = (req.body?.target_currencies || []).map((c: string) => c.toUpperCase());

  try {
    const url = `https://open.er-api.com/v6/latest/${base_currency}`;
    const response = await fetch(url);
    if (!response.ok) {
      return { ok: false, error: "Gagal mengambil kurs dari API" };
    }
    const data = await response.json();
    if (!data.rates) {
      return { ok: false, error: "Format API tidak valid" };
    }

    const today = new Date().toISOString().slice(0, 10);
    const saved: { quote_currency: string; rate: number }[] = [];

    for (const [quote, rate] of Object.entries(data.rates)) {
      const q = quote.toUpperCase();
      if (target_currencies.length && !target_currencies.includes(q)) continue;

      // Cek apakah kurs untuk hari ini sudah ada
      const existing = await base44.asServiceRole.entities.ExchangeRate.filter({
        base_currency,
        quote_currency: q,
        date: today,
      });
      if (existing && existing.length > 0) continue;

      await base44.asServiceRole.entities.ExchangeRate.create({
        base_currency,
        quote_currency: q,
        rate: rate as number,
        date: today,
        source: "api",
      });
      saved.push({ quote_currency: q, rate: rate as number });
    }

    return { ok: true, base: base_currency, date: today, count: saved.length, rates: saved };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Kesalahan tak terduga" };
  }
}