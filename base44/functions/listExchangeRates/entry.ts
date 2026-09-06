import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Mengembalikan daftar kurs dengan filter opsional.
// Parameter:
//   base_currency: filter berdasarkan mata uang dasar (opsional)
//   date: filter berdasarkan tanggal tertentu (opsional; default = tanggal terbaru)
export default async function (req: any) {
  const base44 = createClientFromRequest(req);
  const base_currency = req.body?.base_currency;
  const date = req.body?.date;

  try {
    const query: Record<string, string> = {};
    if (base_currency) query.base_currency = base_currency.toUpperCase();
    if (date) query.date = date;

    const rates = await base44.entities.ExchangeRate.filter(query, "-date", 500);
    return { ok: true, rates: rates || [] };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Kesalahan tak terduga" };
  }
}