import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { hasActivePartnership, hasPendingPartnership } from "../../shared/partnerResolve.ts";
import { fetchAll } from "../../shared/fetchAll.ts";

// Kode referensi diturunkan deterministik dari user id (sama dengan src/lib/refCode.js).
const deriveRefCode = (userId) => {
  if (!userId) return "";
  const tail = String(userId).replace(/[^a-f0-9]/gi, "").slice(-10);
  if (!tail) return "";
  const num = parseInt(tail, 16);
  if (isNaN(num)) return "";
  return "NK" + num.toString(36).toUpperCase().padStart(7, "0").slice(0, 7);
};

// Inviter memilih perannya sendiri; invitee otomatis mendapat peran pelengkap.
const complement = (r) => (r === "suami" ? "istri" : "suami");

// Menghubungkan dua akun yang sudah terdaftar lewat kode referensi.
// Membuat Partnership berstatus "pending"; pasangan menyetujui dari halaman Profil.
// RLS Partnership create = null, jadi pembuatan lewat service role (backend).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const code = String(body.code || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!code) return Response.json({ error: "Kode referensi wajib diisi" }, { status: 400 });
    if (code === deriveRefCode(me.id))
      return Response.json({ error: "Itu kode Anda sendiri" }, { status: 400 });

    const inviter_role = String(body.inviter_role || "");
    if (!["suami", "istri"].includes(inviter_role))
      return Response.json({ error: "invalid_role" }, { status: 400 });
    const invitee_role = complement(inviter_role);

    const users = await fetchAll(base44.asServiceRole.entities.User);
    const target = (users || []).find((u) => u.id && deriveRefCode(u.id) === code);
    if (!target) return Response.json({ error: "Kode referensi tidak ditemukan" }, { status: 404 });
    if (!target.email) return Response.json({ error: "Akun pasangan tidak valid" }, { status: 400 });

    if (await hasActivePartnership(base44, me.id))
      return Response.json({ error: "Anda sudah terhubung dengan pasangan" }, { status: 400 });
    if (await hasActivePartnership(base44, target.id))
      return Response.json({ error: "Pasangan tersebut sudah terhubung dengan orang lain" }, { status: 400 });
    if (await hasPendingPartnership(base44, me.id, me.email))
      return Response.json({ error: "Selesaikan undangan/permintaan yang ada dahulu" }, { status: 400 });

    await base44.asServiceRole.entities.Partnership.create({
      inviter_id: me.id,
      invitee_email: target.email,
      invitee_id: target.id,
      status: "pending",
      inviter_role,
      invitee_role,
    });

    return Response.json({
      status: "success",
      target: { id: target.id, full_name: target.full_name, email: target.email },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}