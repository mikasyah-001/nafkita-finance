import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { hasActivePartnership } from "../../shared/partnerResolve.ts";

// Menerima undangan Partnership: memverifikasi invitee_email cocok dengan
// email pemanggil, mencegah pasangan ganda (penerima maupun pengundang belum
// terhubung), lalu mengisi invitee_id + status active secara atomik.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const partnership_id = String(body.partnership_id || "");
    if (!partnership_id)
      return Response.json({ error: "missing_id" }, { status: 400 });

    const p = await base44.asServiceRole.entities.Partnership.get(partnership_id);
    if (!p) return Response.json({ error: "not_found" }, { status: 404 });
    if (p.status !== "pending")
      return Response.json({ error: "not_pending" }, { status: 409 });
    if ((p.invitee_email || "").toLowerCase() !== (me.email || "").toLowerCase())
      return Response.json({ error: "forbidden" }, { status: 403 });

    // Cek pasangan ganda untuk kedua pihak.
    if (await hasActivePartnership(base44, me.id))
      return Response.json({ error: "already_connected" }, { status: 409 });
    if (await hasActivePartnership(base44, p.inviter_id))
      return Response.json({ error: "inviter_connected" }, { status: 409 });

    await base44.asServiceRole.entities.Partnership.update(partnership_id, {
      invitee_id: me.id,
      status: "active",
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}