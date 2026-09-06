import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { isAuthorizedCall } from "../../shared/workflowAuth.ts";
import { resolvePartnerId, assetVisibleTo } from "../../shared/partnerResolve.ts";
import { fetchAll } from "../../shared/fetchAll.ts";

const NISAB_GRAM = 85;
const CURRENCIES = ["IDR", "SAR", "USD"];

// Parsing harga emas tahan-bentuk: cek beberapa kemungkinan field respons LLM.
const extractGoldPrice = (r) => {
  if (!r) return 0;
  if (typeof r.price_per_gram === "number") return r.price_per_gram;
  if (typeof r.price === "number") return r.price;
  if (typeof r.gold_price === "number") return r.gold_price;
  if (Array.isArray(r.sources) && r.sources.length) {
    const s = r.sources.find((x) => typeof x.price_per_gram === "number");
    if (s) return s.price_per_gram;
  }
  return 0;
};

const fetchGoldPrice = async (base44, currency) => {
  const prompt =
    currency === "IDR"
      ? "Cari harga emas per gram di Indonesia saat ini (Antam). Jawab hanya angka harga per gram dalam Rupiah."
      : currency === "SAR"
      ? "Find the current gold price per gram in Saudi Arabia in SAR (riyal). Answer only the price per gram as a number."
      : "Find the current gold price per gram in USD. Answer only the price per gram as a number.";
  try {
    const r = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: { type: "object", properties: { price_per_gram: { type: "number" } } },
    });
    return extractGoldPrice(r);
  } catch {
    return 0;
  }
};

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

    // Ambil harga emas per mata uang untuk nisab per mata uang.
    const goldPrices = {};
    for (const cur of CURRENCIES) {
      goldPrices[cur] = await fetchGoldPrice(base44, cur);
    }

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

      const kewajiban = [];

      for (const cur of CURRENCIES) {
        const curAssets = myAssets.filter((a) => (a.currency || "IDR") === cur);
        if (curAssets.length === 0) continue;

        const emasAssets = curAssets.filter((a) => a.type === "emas");
        const emasGrams = emasAssets.reduce((s, a) => s + (a.quantity || 0), 0);
        const goldPrice = goldPrices[cur];
        const emasValue = goldPrice > 0 ? emasGrams * goldPrice : emasAssets.reduce((s, a) => s + (a.value || 0), 0);
        const nonEmasValue = curAssets.filter((a) => a.type !== "emas").reduce((s, a) => s + (a.value || 0), 0);
        const nisab = goldPrice * NISAB_GRAM;

        const wajibEmas = emasGrams >= NISAB_GRAM;
        const wajibSimpanan = goldPrice > 0 && nonEmasValue >= nisab;

        if (wajibEmas && !emasPaid) {
          kewajiban.push(`emas ${emasGrams} gram [${cur}] (zakat 2,5% = ${fmtMoney(emasValue * 0.025, cur)})`);
        }
        if (wajibSimpanan && !simpananPaid) {
          kewajiban.push(`simpanan ${fmtMoney(nonEmasValue, cur)} (zakat 2,5% = ${fmtMoney(nonEmasValue * 0.025, cur)})`);
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