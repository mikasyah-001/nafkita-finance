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

    const emasAssets = assets.filter((a) => a.type === "emas" && a.visibility !== "private");
    const emasGrams = emasAssets.reduce((s, a) => s + (a.quantity || 0), 0);

    if (emasGrams < 85) {
      return Response.json({ sent: 0, emasGrams, wajib: false });
    }

    let sent = 0;
    for (const u of users) {
      if (!u.email) continue;
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: u.email,
          subject: "Pengingat: Zakat Emas Anda 🕌",
          body:
            "Assalamu'alaikum " + (u.full_name || u.email) + ",\n\n" +
            "Total emas keluarga Anda saat ini " + emasGrams + " gram telah mencapai nisab (85 gram). " +
            "Jangan lupa menunaikan zakat mal sebesar 2,5% dari nilai emas Anda setelah genap 1 tahun (haul).\n\n" +
            "Semoga Allah memberkahi harta Anda.\n\nNAFKITA"
        });
        sent++;
      } catch (e) {
        // skip individual send errors
      }
    }

    return Response.json({ sent, emasGrams, wajib: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}