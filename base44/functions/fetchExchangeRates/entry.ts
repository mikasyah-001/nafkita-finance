import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Mengambil kurs terbaru menggunakan InvokeLLM dengan web search, lalu
// menyimpannya ke entitas ExchangeRate. Bila kurs untuk hari ini sudah ada, dilewati.
// Parameter:
//   base_currency: kode mata uang dasar (default "USD")
//   target_currencies: daftar kode mata uang tujuan (opsional; kosong = umum)
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const base_currency = (body?.base_currency || "USD").toUpperCase();
    const target_currencies: string[] = (body?.target_currencies || []).map((c: string) => c.toUpperCase());

    const targetList = target_currencies.length
      ? target_currencies.join(", ")
      : "IDR, SAR, EUR, GBP, JPY, MYR, SGD, AED, TRY, EGP, PKR";

    const result: any = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `What is the current exchange rate for 1 ${base_currency} to each of these currencies today: ${targetList}? Return ONLY a JSON object mapping each currency code to its exchange rate number. Example: {"IDR": 15800, "SAR": 3.75}. Do not include any explanation or markdown.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          rates: {
            type: "object",
            additionalProperties: { type: "number" },
          },
        },
      },
      model: "gemini_3_flash",
    });

    const rates = result?.rates || result || {};
    const today = new Date().toISOString().slice(0, 10);
    const saved: { quote_currency: string; rate: number }[] = [];

    for (const [quote, rate] of Object.entries(rates)) {
      const q = quote.toUpperCase();
      if (q === base_currency) continue;
      if (target_currencies.length && !target_currencies.includes(q)) continue;
      if (typeof rate !== "number" || rate <= 0) continue;

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
        rate,
        date: today,
        source: "api",
      });
      saved.push({ quote_currency: q, rate });
    }

    return Response.json({ ok: true, base: base_currency, date: today, count: saved.length, rates: saved });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}