import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { isAuthorizedCall } from "../../shared/workflowAuth.ts";
import { resolvePartnerId, assetVisibleTo } from "../../shared/partnerResolve.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { fetchGoldPricesBackend, computeZakatPerCurrency, ZAKAT_CURRENCIES } from "../../shared/zakat.ts";

// Pengingat zakat tahunan (1 Maret) — memakai shared zakat module yang SAMA
// dengan halaman Zakat.jsx (getZakatStatus), sehingga email dan UI tidak pernah
// bertentangan. Nisab dihitung per mata uang (85 gr emas).
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
    const allPayments = await fetchAll(base44.asServiceRole.entities.ZakatPayment);
    const year = new Date().getFullYear();

    // Harga emas per mata uang — diambil sekali untuk semua user.
    const goldPrices = await fetchGoldPricesBackend(base44);

    let sent = 0;
    let skipped = 0;

    for (const u of users) {
      if (!u.email) continue;

      const partnerId = await resolvePartnerId(base44, u.id);
      const myAssets = allAssets.filter((a) => assetVisibleTo(a, u.id, partnerId));

      // Lewati yang sudah lunas tahun ini.
      const myPaid = allPayments.filter((z) => z.created_by_id === u.id && z.year === year && z.status === "paid");
      const emasPaid = myPaid.some((z) => z.zakat_type === "emas");
      const simpananPaid = myPaid.some((z) => z.zakat_type === "simpanan");

      const { perCurrency } = computeZakatPerCurrency(myAssets, goldPrices);

      const kewajiban = [];
      for (const p of perCurrency) {
        if (p.wajibEmas && !emasPaid) {
          kewajiban.push(`emas ${p.emasGrams} gram [${p.currency}] (zakat 2,5% = ${fmtMoney(p.zakatEmas, p.currency)})`);
        }
        if (p.wajibSimpanan && !simpananPaid) {
          kewajiban.push(`simpanan ${fmtMoney(p.nonEmasValue, p.currency)} (zakat 2,5% = ${fmtMoney(p.zakatSimpanan, p.currency)})`);
        }
      }

      if (kewajiban.length === 0) { skipped++; continue; }

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: u.email,
          subject: "Pengingat: Zakat Harta Anda 🕌",
          body:
            "Assalamu'alaikum " + (u.full_name || u.email) + ",\n\n" +
            "Harta Anda telah mencapai nisab zakat. Kewajiban zakat yang perlu Anda tunaikan (2,5% setelah genap 1 tahun/haul):\n" +
            kewajiban.map((k) => "- " + k).join("\n") + "\n\n" +
            "Nisab dihitung per mata uang (85 gram emas). Jangan lupa bayar zakat agar harta tetap berkah. Anda bisa tandai 'Bayarkan Zakat' di aplikasi NAFKITA setelah membayar.\n\n" +
            "Semoga Allah memberkahi harta Anda.\n\nNAFKITA"
        });
        sent++;
      } catch {
        // skip individual send errors
      }
    }

    return Response.json({ sent, skipped, goldPrices, wajib: sent > 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}