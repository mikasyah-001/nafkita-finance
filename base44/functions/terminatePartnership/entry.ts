import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Mengakhiri Partnership (batalkan undangan, tolak permintaan, atau putuskan
// koneksi aktif). Memverifikasi pemanggil adalah pihak yang terlibat.
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

    const involved =
      p.inviter_id === me.id ||
      p.invitee_id === me.id ||
      (p.invitee_email || "").toLowerCase() === (me.email || "").toLowerCase();
    if (!involved) return Response.json({ error: "forbidden" }, { status: 403 });

    await base44.asServiceRole.entities.Partnership.delete(partnership_id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}