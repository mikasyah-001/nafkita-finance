import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isAuthorizedCall } from "../../shared/workflowAuth.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    if (!await isAuthorizedCall(req, base44)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await base44.asServiceRole.entities.User.list();
    const assets = await base44.asServiceRole.entities.Asset.list();

    const sharedAssets = assets.filter((a) => a.visibility !== "private");
    const emasAssets = sharedAssets.filter((a) => a.type === "emas");
    const emasGrams = emasAssets.reduce((s, a) => s + (a.quantity || 0), 0);
    const nonEmasValue = sharedAssets.filter((a) => a.type !== "emas").reduce((s, a) => s + (a.value || 0), 0);

    // Cek harga emas pasar untuk nisab simpanan
    let goldPrice = 0;
    try {
      const r = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: "Cari harga emas per gram di Indonesia saat ini (Antam). Jawab hanya angka harga per gram dalam Rupiah.",
        add_context_from_internet: true,
        response_json_schema: { type: "object", properties: { price_per_gram: { type: "number" } } },
      });
      goldPrice = r.price_per_gram || 0;
    } catch (e) {
      // abaikan gagal ambil harga
    }

    const nisab = goldPrice * 85;
    const wajibEmas = emasGrams >= 85;
    const wajibSimpanan = goldPrice > 0 && nonEmasValue >= nisab;

    if (!wajibEmas && !wajibSimpanan) {
      return Response.json({ sent: 0, emasGrams, nonEmasValue, goldPrice, wajib: false });
    }

    const kewajiban = [];
    if (wajibEmas) kewajiban.push("emas " + emasGrams + " gram (zakat 2,5% dari nilai emas)");
    if (wajibSimpanan) kewajiban.push("simpanan " + nonEmasValue + " (zakat 2,5%)");

    let sent = 0;
    for (const u of users) {
      if (!u.email) continue;
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: u.email,
          subject: "Pengingat: Zakat Harta Anda 🕌",
          body:
            "Assalamu'alaikum " + (u.full_name || u.email) + ",\n\n" +
            "Harta keluarga Anda telah mencapai nisab zakat. Kewajiban zakat yang perlu Anda tunaikan (2,5% setelah genap 1 tahun/haul):\n" +
            kewajiban.map((k) => "- " + k).join("\n") + "\n\n" +
            "Jangan lupa bayar zakat agar harta tetap berkah. Anda bisa tandai 'Bayarkan Zakat' di aplikasi NAFKITA setelah membayar.\n\n" +
            "Semoga Allah memberkahi harta Anda.\n\nNAFKITA"
        });
        sent++;
      } catch (e) {
        // skip individual send errors
      }
    }

    return Response.json({ sent, emasGrams, nonEmasValue, goldPrice, wajib: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}