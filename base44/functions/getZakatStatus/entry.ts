import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { resolvePartnerId, assetVisibleTo } from "../../shared/partnerResolve.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { fetchGoldPricesBackend, computeZakatMal, isPlausibleGoldPriceIdr } from "../../shared/zakat.ts";

// Status zakat mal (gabungan, IDR) untuk user yang login — aturan sama dengan
// src/lib/zakat.js. Aset: milik sendiri + bersama pasangan; utang/piutang milik sendiri.
// Halaman Zakat di aplikasi menghitung di frontend; fungsi ini untuk integrasi lain.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const partnerId = await resolvePartnerId(base44, me.id);

    // Ambil aset visible (sama seperti listVisibleAssets).
    const own = await fetchAll(base44.asServiceRole.entities.Asset, { created_by_id: me.id });
    let partnerAssets = [];
    if (partnerId) {
      const raw = await fetchAll(base44.asServiceRole.entities.Asset, { created_by_id: partnerId, visibility: "shared" });
      partnerAssets = (raw || []).filter((a) => assetVisibleTo(a, me.id, partnerId));
    }
    const assets = [...(own || []), ...partnerAssets];

    // Ambil kurs untuk konversi total gabungan ke IDR.
    let rateMap = {};
    try {
      const rates = await fetchAll(base44.asServiceRole.entities.ExchangeRate);
      rateMap = buildRateMapSimple(rates);
    } catch {}

    // Ambil harga emas per mata uang.
    const goldPrices = await fetchGoldPricesBackend(base44);

    const debts = await fetchAll(base44.asServiceRole.entities.Debt, { created_by_id: me.id });
    const goldPrice = isPlausibleGoldPriceIdr(me.zakat_gold_price) ? Number(me.zakat_gold_price)
      : isPlausibleGoldPriceIdr(goldPrices.IDR) ? goldPrices.IDR : 0;
    const result = computeZakatMal({ assets, debts, goldPrice, rateMap, includeReceivables: me.zakat_include_receivables !== false });

    return Response.json({
      ...result,
      currency: "IDR",
      goldPrice,
      partner_id: partnerId,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Versi sederhana buildRateMap untuk konversi total ke IDR.
function buildRateMapSimple(rates) {
  const map = { IDR: 1 };
  (rates || []).forEach((r) => {
    const base = (r.base_currency || "").toUpperCase();
    const quote = (r.quote_currency || "").toUpperCase();
    const rate = Number(r.rate) || 0;
    if (!base || rate <= 0) return;
    if (quote === "IDR" && base !== "IDR") map[base] = rate;
    else if (base === "IDR" && quote !== "IDR") map[quote] = 1 / rate;
  });
  return map;
}