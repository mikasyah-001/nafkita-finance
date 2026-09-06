import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Mengambil kurs terhadap IDR dan menyimpannya ke entitas ExchangeRate.
// Strategi: minta kurs "1 USD ke setiap mata uang" (termasuk IDR) — prompt yang
// terbukti andal — lalu turunkan kurs langsung X→IDR untuk tiap mata uang asing:
//   rate(X→IDR) = rate(USD→IDR) / rate(USD→X)
// Disimpan dengan konvensi base_currency = mata uang asing, quote_currency = "IDR".
// Sumber diutamakan BI via web search; fallback ke pengetahuan model (source="api").
// Parameter:
//   target_currencies: daftar kode mata uang asing (opsional; kosong = umum)
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const target_currencies: string[] = (body?.target_currencies || []).map((c: string) => c.toUpperCase());

    const targetList = target_currencies.length
      ? ["IDR", ...target_currencies].join(", ")
      : "IDR, USD, SAR, EUR, GBP, JPY, MYR, SGD, AED, TRY, EGP, PKR";

    const ask = async (useWeb: boolean) => {
      const r: any = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `What is the current exchange rate for 1 USD to each of these currencies today (prefer Bank Indonesia / BI kurs tengah if available): ${targetList}? Return ONLY a JSON object mapping each currency code to its exchange rate number. Example: {"IDR": 15800, "SAR": 3.75}. Do not include any explanation or markdown.`,
        add_context_from_internet: useWeb,
        response_json_schema: {
          type: "object",
          properties: {
            rates: { type: "object", additionalProperties: { type: "number" } },
          },
        },
        model: "gemini_3_flash",
      });
      return r?.rates || r || {};
    };

    let rates = await ask(true);
    let usedFallback = false;
    if (!Object.keys(rates).some((k) => k !== "source" && typeof (rates as any)[k] === "number")) {
      rates = await ask(false);
      usedFallback = true;
    }

    const today = new Date().toISOString().slice(0, 10);
    const usdIdr = Number(rates?.IDR) || 0;
    const saved: { base_currency: string; rate: number }[] = [];
    let anySaved = false;

    if (usdIdr > 0) {
      // Simpan USD→IDR langsung.
      const existingUsd = await base44.asServiceRole.entities.ExchangeRate.filter({
        base_currency: "USD", quote_currency: "IDR", date: today,
      });
      if (!existingUsd || existingUsd.length === 0) {
        await base44.asServiceRole.entities.ExchangeRate.create({
          base_currency: "USD", quote_currency: "IDR", rate: usdIdr, date: today, source: usedFallback ? "api" : "bi",
        });
        saved.push({ base_currency: "USD", rate: usdIdr });
        anySaved = true;
      }

      // Turunkan X→IDR untuk tiap mata uang asing lain dari kurs USD→X.
      for (const [cur, rate] of Object.entries(rates)) {
        const c = cur.toUpperCase();
        if (c === "IDR" || c === "USD") continue;
        if (target_currencies.length && !target_currencies.includes(c)) continue;
        if (typeof rate !== "number" || rate <= 0) continue;
        const xToIdr = usdIdr / rate; // 1 unit c = (usdIdr / rate) IDR
        if (!isFinite(xToIdr) || xToIdr <= 0) continue;

        const existing = await base44.asServiceRole.entities.ExchangeRate.filter({
          base_currency: c, quote_currency: "IDR", date: today,
        });
        if (existing && existing.length > 0) continue;

        await base44.asServiceRole.entities.ExchangeRate.create({
          base_currency: c, quote_currency: "IDR", rate: xToIdr, date: today, source: usedFallback ? "api" : "bi",
        });
        saved.push({ base_currency: c, rate: xToIdr });
        anySaved = true;
      }
    }

    return Response.json({ ok: true, date: today, source: anySaved ? (usedFallback ? "api" : "bi") : "api", count: saved.length, rates: saved });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}