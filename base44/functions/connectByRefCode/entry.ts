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

// Email disamarkan di respons: kode referensi bukan rahasia kuat, jadi siapa pun
// yang mendapatkan kode tidak boleh langsung tahu email lengkap pemiliknya.
const maskEmail = (e) => {
  const [u, d] = String(e || "").split("@");
  if (!d) return "";
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, u.length - 2)))}@${d}`;
};
const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";
const MAX_PER_HOUR = 5;

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

    // Batasi percobaan: mencegah menebak kode massal / spam permintaan koneksi.
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const recent = await fetchAll(base44.asServiceRole.entities.Partnership, { inviter_id: me.id }).catch(() => []);
    if ((recent || []).filter((p) => String(p.created_date || "") >= hourAgo).length >= MAX_PER_HOUR)
      return Response.json({ error: "Terlalu banyak percobaan. Coba lagi dalam 1 jam." }, { status: 429 });

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
      // Disamarkan: pengundang bisa membaca record ini (RLS data.inviter_id), dan
      // pemilik kode belum menyetujui. Pencocokan invitee memakai invitee_id.
      invitee_email: maskEmail(target.email),
      invitee_id: target.id,
      status: "pending",
      inviter_role,
      invitee_role,
    });

    return Response.json({
      status: "success",
      target: { full_name: firstName(target.full_name), email: maskEmail(target.email) },
    });
  } catch (error) {
    console.error("[connectByRefCode]", error?.message);
    return Response.json({ error: "connect_failed" }, { status: 500 });
  }
}