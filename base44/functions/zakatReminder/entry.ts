import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isAuthorizedCall } from "../../shared/workflowAuth.ts";
import { resolvePartnerId, assetVisibleTo } from "../../shared/partnerResolve.ts";

const NISAB_GRAM = 85;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    if (!await isAuthorizedCall(req, base44)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await base44.asServiceRole.entities.User.list();
    const allAssets = await base44.asServiceRole.entities.Asset.list();
    const allPayments = await base44.asServiceRole.entities.ZakatPayment.list();
    const year = new Date().getFullYear();

    // Harga emas pasar untuk nisab simpanan.
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

    const nisab = goldPrice * NISAB_GRAM;
    let sent = 0;
    let skipped = 0;

    for (const u of users) {
      if (!u.email) continue;

      // Aset yang terlihat oleh user ini (sendiri + pasangan aktif).
      const partnerId = await resolvePartnerId(base44, u.id);
      const myAssets = allAssets.filter((a) => assetVisibleTo(a, u.id, partnerId));
      const emasAssets = myAssets.filter((a) => a.type === "emas");
      const emasGrams = emasAssets.reduce((s, a) => s + (a.quantity || 0), 0);
      const emasValue = goldPrice > 0 ? emasGrams * goldPrice : emasAssets.reduce((s, a) => s + (a.value || 0), 0);
      const nonEmasValue = myAssets.filter((a) => a.type !== "emas").reduce((s, a) => s + (a.value || 0), 0);

      const wajibEmas = emasGrams >= NISAB_GRAM;
      const wajibSimpanan = goldPrice > 0 && nonEmasValue >= nisab;
      if (!wajibEmas && !wajibSimpanan) continue;

      // Lewati yang sudah lunas tahun ini.
      const myPaid = allPayments.filter((z) => z.created_by_id === u.id && z.year === year && z.status === "paid");
      const emasPaid = myPaid.some((z) => z.zakat_type === "emas");
      const simpananPaid = myPaid.some((z) => z.zakat_type === "simpanan");

      const kewajiban = [];
      if (wajibEmas && !emasPaid) kewajiban.push("emas " + emasGrams + " gram (zakat 2,5% = Rp " + Math.round(emasValue * 0.025).toLocaleString("id-ID") + ")");
      if (wajibSimpanan && !simpananPaid) kewajiban.push("simpanan Rp " + Math.round(nonEmasValue).toLocaleString("id-ID") + " (zakat 2,5% = Rp " + Math.round(nonEmasValue * 0.025).toLocaleString("id-ID") + ")");

      if (kewajiban.length === 0) { skipped++; continue; }

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: u.email,
          subject: "Pengingat: Zakat Harta Anda 🕌",
          body:
            "Assalamu'alaikum " + (u.full_name || u.email) + ",\n\n" +
            "Harta Anda telah mencapai nisab zakat. Kewajiban zakat yang perlu Anda tunaikan (2,5% setelah genap 1 tahun/haul):\n" +
            kewajiban.map((k) => "- " + k).join("\n") + "\n\n" +
            "Jangan lupa bayar zakat agar harta tetap berkah. Anda bisa tandai 'Bayarkan Zakat' di aplikasi NAFKITA setelah membayar.\n\n" +
            "Semoga Allah memberkahi harta Anda.\n\nNAFKITA"
        });
        sent++;
      } catch (e) {
        // skip individual send errors
      }
    }

    return Response.json({ sent, skipped, goldPrice, nisab, wajib: sent > 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}