import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import {
  getActorName, getPreference, createNotificationIdempotent, maybeSendEmail, resolvePartner,
} from "../../shared/notifyCommon.ts";

// Membuat SATU notifikasi ringkasan untuk bulkCreate transaksi bersama
// (impor laporan, scan banyak bon). Dipanggil dari frontend setelah bulkCreate.
// Bila count <= 0 atau pasangan tidak ada, tidak membuat apa-apa.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const batchId = body.batch_id;
    const count = Number(body.count) || 0;
    if (!batchId) return Response.json({ error: "batch_id required" }, { status: 400 });
    if (count <= 0) return Response.json({ skipped: "empty_batch" });

    const { partnerId, partnerEmail } = await resolvePartner(base44, me.id);
    if (!partnerId) return Response.json({ skipped: "no_partner" });

    const pref = await getPreference(base44, partnerId);
    if (pref?.mute) return Response.json({ skipped: "muted" });
    if (pref?.daily_digest) return Response.json({ skipped: "daily_digest" });

    const actorName = me.full_name || me.email || "Pasangan";
    const title = `${actorName} mencatat ${count} transaksi baru`;
    const bodyText = `Sebanyak ${count} transaksi bersama baru ditambahkan.`;

    const eventKey = `bulk:${batchId}`;
    const result = await createNotificationIdempotent(base44, {
      target_user_id: partnerId,
      actor_name: actorName,
      action: "bulk",
      entity_kind: "bulk",
      event_key: eventKey,
      title,
      body: bodyText,
      ref_id: null,
    });

    await maybeSendEmail(base44, pref, partnerEmail, actorName, title, bodyText);

    return Response.json({ status: "success", ...result, partner_id: partnerId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}