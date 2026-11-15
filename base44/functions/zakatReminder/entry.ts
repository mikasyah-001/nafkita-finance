import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { isAuthorizedCall } from "../../shared/workflowAuth.ts";
import { resolvePartnerId, assetVisibleTo } from "../../shared/partnerResolve.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { fetchGoldPricesBackend, computeZakatMal, haulPeriodBackend, isPlausibleGoldPriceIdr } from "../../shared/zakat.ts";

// Pengingat zakat mal — memakai computeZakatMal (cermin src/lib/zakat.js),
// sehingga email & halaman Zakat memakai aturan yang sama: harta simpanan
// digabung dalam IDR, utang jatuh tempo dikurangkan, rumah/tanah tidak dihitung.
// Dikirim bila wajib zakat, belum lunas di periode haul, dan haul ≤ 30 hari lagi
// (atau tanggal haul belum diatur).
const fmtMoney = (val, cur) => {
  const n = Math.round(val);
  if (cur === "IDR") return "Rp " + n.toLocaleString("id-ID");
  if (cur === "SAR") return "SAR " + n.toLocaleString("en-US");
  return "$ " + n.toLocaleString("en-US");
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    if (!(await isAuthorizedCall(req, base44))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await fetchAll(base44.asServiceRole.entities.User);
    const allAssets = await fetchAll(base44.asServiceRole.entities.Asset);
    const allDebts = await fetchAll(base44.asServiceRole.entities.Debt);
    const allPayments = await fetchAll(base44.asServiceRole.entities.ZakatPayment);
    let rateMap = {};
    try {
      const rates = await fetchAll(base44.asServiceRole.entities.ExchangeRate);
      rateMap = { IDR: 1 };
      (rates || []).forEach((r) => {
        const b = (r.base_currency || "").toUpperCase(), q = (r.quote_currency || "").toUpperCase(), v = Number(r.rate) || 0;
        if (v > 0 && q === "IDR" && b !== "IDR") rateMap[b] = v;
        else if (v > 0 && b === "IDR" && q !== "IDR") rateMap[q] = 1 / v;
      });
    } catch { /* tanpa kurs: aset non-IDR tidak dihitung */ }

    // Harga emas IDR — diambil sekali; isian manual pengguna diutamakan.
    const goldPrices = await fetchGoldPricesBackend(base44);
    const autoGold = isPlausibleGoldPriceIdr(goldPrices.IDR) ? goldPrices.IDR : 0;
    const hijriYear = Number(new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric" }).formatToParts(new Date()).find((p) => p.type === "year")?.value || 0);

    let sent = 0;
    let skipped = 0;

    for (const u of users) {
      if (!u.email) continue;
      const partnerId = await resolvePartnerId(base44, u.id);
      const myAssets = allAssets.filter((a) => assetVisibleTo(a, u.id, partnerId));
      const myDebts = allDebts.filter((d) => d.created_by_id === u.id);
      const goldPrice = isPlausibleGoldPriceIdr(u.zakat_gold_price) ? Number(u.zakat_gold_price) : autoGold;
      if (!goldPrice) { skipped++; continue; }

      const r = computeZakatMal({ assets: myAssets, debts: myDebts, goldPrice, rateMap, includeReceivables: u.zakat_include_receivables !== false });
      const period = haulPeriodBackend(u.zakat_haul_date);
      if (!r.reachesNisab || !period.isDue) { skipped++; continue; }

      const paid = allPayments
        .filter((z) => z.created_by_id === u.id && z.status === "paid" && (period.key ? z.period_key === period.key : z.zakat_type === "mal" && z.year === hijriYear))
        .reduce((s, z) => s + (Number(z.amount) || 0), 0);
      const remaining = Math.max(0, r.zakat - paid);
      if (remaining <= 0) { skipped++; continue; }

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: u.email,
          subject: "Pengingat zakat mal — NAFKITA",
          body:
            "Assalamu'alaikum " + (u.full_name || u.email) + ",\n\n" +
            "Perkiraan zakat mal Anda:\n" +
            "- Harta bersih (kas, tabungan, emas, investasi, piutang lancar − utang jatuh tempo): " + fmtMoney(r.net, "IDR") + "\n" +
            "- Nisab (85 gr emas): " + fmtMoney(r.nisab, "IDR") + "\n" +
            "- Zakat 2,5%: " + fmtMoney(r.zakat, "IDR") + (paid > 0 ? " (sudah dibayar " + fmtMoney(paid, "IDR") + ")" : "") + "\n" +
            "- Sisa yang perlu ditunaikan: " + fmtMoney(remaining, "IDR") + "\n" +
            (period.due ? "- Jatuh tempo haul: " + period.due.toISOString().slice(0, 10) + "\n" : "") +
            "\nRumah tinggal, tanah, dan kendaraan pakai tidak dihitung. Angka ini perkiraan, bukan fatwa; konsultasikan dengan amil/BAZNAS setempat.\n" +
            "Setelah membayar, catat di menu Zakat NAFKITA.\n\nNAFKITA",
        });
        sent++;
      } catch {
        // lewati kegagalan kirim per pengguna
      }
    }

    return Response.json({ sent, skipped, goldPriceIDR: autoGold, wajib: sent > 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}