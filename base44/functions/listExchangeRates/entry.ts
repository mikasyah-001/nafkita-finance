import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Mengembalikan daftar kurs dengan filter opsional.
// Parameter:
//   base_currency: filter berdasarkan mata uang dasar (opsional)
//   date: filter berdasarkan tanggal tertentu (opsional)
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const base_currency = body?.base_currency;
    const date = body?.date;

    const query: Record<string, string> = {};
    if (base_currency) query.base_currency = base_currency.toUpperCase();
    if (date) query.date = date;

    const rates = await base44.entities.ExchangeRate.filter(query, "-date", 500);
    return Response.json({ rates: rates || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}