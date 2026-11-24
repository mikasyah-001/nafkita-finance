import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { hitRateLimit } from "../../shared/rateLimit.ts";
import { resolvePartnerId, assetVisibleTo } from "../../shared/partnerResolve.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { fetchGoldPricesBackend, computeZakatMal, isPlausibleGoldPriceIdr, haulPeriodBackend } from "../../shared/zakat.ts";

// Status zakat mal (gabungan, IDR) untuk user yang login — aturan sama dengan
// src/lib/zakat.js. Aset: milik sendiri + bersama pasangan; utang/piutang milik sendiri.
// Halaman Zakat di aplikasi menghitung di frontend; fungsi ini untuk integrasi lain.
//
// { action: "email" }: kirim ringkasan zakat ke email pemanggil SENDIRI.
// Angka dihitung di server (bukan teks dari klien) dan penerima selalu
// me.email — dulu halaman memanggil Core.SendEmail langsung dari browser
// dengan isi & penerima yang bisa diubah klien. Dibatasi 1x per 10 menit.
const EMAIL_INTERVAL_MS = 10 * 60 * 1000;
const fmtIdr = (v) => "Rp " + Math.round(Number(v) || 0).toLocaleString("id-ID");
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

    const body = await req.json().catch(() => ({}));
    if (body?.action === "email") {
      if (!me.email) return Response.json({ error: "no_email" }, { status: 400 });
      if (!(await hitRateLimit(base44, `zakat_email:${me.id}`, 1, EMAIL_INTERVAL_MS))) return Response.json({ error: "too_soon" }, { status: 429 });
      if (!goldPrice) return Response.json({ error: "no_gold_price" }, { status: 409 });
      const period = haulPeriodBackend(me.zakat_haul_date);
      const hijriYear = Number(new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric" }).formatToParts(new Date()).find((p) => p.type === "year")?.value || 0);
      const payments = await fetchAll(base44.asServiceRole.entities.ZakatPayment, { created_by_id: me.id });
      const paid = (payments || [])
        .filter((z) => z.status === "paid" && (period.key ? z.period_key === period.key : z.zakat_type === "mal" && z.year === hijriYear))
        .reduce((sum, z) => sum + (Number(z.amount_idr ?? z.amount) || 0), 0);
      const remaining = Math.max(0, result.zakat - paid);
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: me.email,
        subject: "Pengingat zakat mal — NAFKITA",
        body:
          `Assalamu'alaikum ${String(me.full_name || "").slice(0, 80)},\n\n` +
          "Ringkasan zakat mal (perkiraan):\n" +
          `- Harta bersih: ${fmtIdr(result.net)}\n` +
          `- Nisab (85 gr emas @ ${fmtIdr(goldPrice)}): ${fmtIdr(result.nisab)}\n` +
          `- Zakat 2,5%: ${fmtIdr(result.zakat)}\n` +
          `- Sudah dibayar periode ini: ${fmtIdr(paid)}\n` +
          `- Sisa: ${fmtIdr(remaining)}\n` +
          (period.due ? `- Jatuh tempo haul: ${period.due.toISOString().slice(0, 10)}\n` : "") +
          "\nAngka ini perkiraan, bukan fatwa. Konsultasikan dengan amil/BAZNAS setempat.\n\nNAFKITA",
      });
      return Response.json({ ok: true, sent_to: me.email });
    }

    return Response.json({
      ...result,
      currency: "IDR",
      goldPrice,
      partner_id: partnerId,
    });
  } catch (error) {
    console.error("[getZakatStatus]", error?.message);
    return Response.json({ error: "zakat_failed" }, { status: 500 });
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