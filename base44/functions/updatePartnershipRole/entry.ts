import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { fetchAll } from "../../shared/fetchAll.ts";

// Mendeklarasikan/mengoreksi peran suami/istri pada koneksi Partnership aktif.
// Pemanggil memilih perannya sendiri (suami/istri); pasangan otomatis mendapat
// peran pelengkap. Kedua field ditulis sekaligus secara atomik lewat updateMany
// (filter status:"active") agar tidak ada kondisi kedua peran sama.
// Langsung berlaku — tanpa persetujuan pasangan.
const complement = (r) => (r === "suami" ? "istri" : "suami");

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const role = String(body.role || "");
    if (!["suami", "istri"].includes(role))
      return Response.json({ error: "invalid_role" }, { status: 400 });

    const all = await fetchAll(base44.asServiceRole.entities.Partnership);
    const active = (all || []).find(
      (p) => p.status === "active" && (p.inviter_id === me.id || p.invitee_id === me.id)
    );
    if (!active) return Response.json({ error: "no_active_partnership" }, { status: 404 });

    // Tetapkan peran pemanggil + pasangan komplementer berdasarkan posisi.
    const isInviter = active.inviter_id === me.id;
    const inviter_role = isInviter ? role : complement(role);
    const invitee_role = isInviter ? complement(role) : role;

    const result = await base44.asServiceRole.entities.Partnership.updateMany(
      { id: active.id, status: "active" },
      { $set: { inviter_role, invitee_role } }
    );
    const updated = result?.updated ?? result?.modified;
    if (!updated) {
      return Response.json({ error: "update_failed" }, { status: 409 });
    }

    return Response.json({ ok: true, inviter_role, invitee_role });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}