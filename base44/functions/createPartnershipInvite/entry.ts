import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { hasActivePartnership, hasPendingPartnership } from "../../shared/partnerResolve.ts";

// Membuat undangan Partnership (status pending) atas nama pemanggil.
// inviter_id selalu = me.id (divalidasi, tidak bisa dipalsukan).
// Mencegah pasangan ganda: tolak bila user sudah punya koneksi aktif
// atau undangan/permintaan pending yang masih terbuka.
// RLS Partnership create = null, jadi hanya backend (service role) yang bisa membuat.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return Response.json({ error: "missing_email" }, { status: 400 });
    if (email === (me.email || "").toLowerCase())
      return Response.json({ error: "self_invite" }, { status: 400 });

    if (await hasActivePartnership(base44, me.id))
      return Response.json({ error: "already_connected" }, { status: 409 });
    if (await hasPendingPartnership(base44, me.id, me.email))
      return Response.json({ error: "pending_exists" }, { status: 409 });

    // Undang ke aplikasi (abaikan error bila pasangan sudah terdaftar).
    try { await base44.users.inviteUser(email, "user"); } catch {}

    await base44.asServiceRole.entities.Partnership.create({
      inviter_id: me.id,
      invitee_email: email,
      status: "pending",
    });

    return Response.json({ ok: true, email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}