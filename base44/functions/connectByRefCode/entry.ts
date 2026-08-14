import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Kode referensi diturunkan deterministik dari user id (sama dengan src/lib/refCode.js).
const deriveRefCode = (userId) => {
  if (!userId) return "";
  const tail = String(userId).replace(/[^a-f0-9]/gi, "").slice(-10);
  if (!tail) return "";
  const num = parseInt(tail, 16);
  if (isNaN(num)) return "";
  return "NK" + num.toString(36).toUpperCase().padStart(7, "0").slice(0, 7);
};

// Menghubungkan dua akun yang sudah terdaftar lewat kode referensi.
// Berjalan atas nama user yang login (bukan workflow) -> buat Partnership
// berstatus "pending"; pasangan menyetujui dari halaman Profil/Pengaturan.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const code = String(body.code || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!code) return Response.json({ error: 'Kode referensi wajib diisi' }, { status: 400 });
    if (code === deriveRefCode(me.id))
      return Response.json({ error: 'Itu kode Anda sendiri' }, { status: 400 });

    const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
    const target = (users || []).find((u) => u.id && deriveRefCode(u.id) === code);
    if (!target) return Response.json({ error: 'Kode referensi tidak ditemukan' }, { status: 404 });
    if (!target.email) return Response.json({ error: 'Akun pasangan tidak valid' }, { status: 400 });

    const partnerships = await base44.asServiceRole.entities.Partnership.list('-created_date', 200);

    const myActive = (partnerships || []).filter(
      (p) => p.status === 'active' && (p.inviter_id === me.id || p.invitee_id === me.id)
    );
    if (myActive.length > 0)
      return Response.json({ error: 'Anda sudah terhubung dengan pasangan' }, { status: 400 });

    const targetActive = (partnerships || []).filter(
      (p) => p.status === 'active' && (p.inviter_id === target.id || p.invitee_id === target.id)
    );
    if (targetActive.length > 0)
      return Response.json({ error: 'Pasangan tersebut sudah terhubung dengan orang lain' }, { status: 400 });

    const existingPending = (partnerships || []).find(
      (p) => p.status === 'pending' &&
        ((p.inviter_id === me.id && p.invitee_email === target.email) ||
         (p.invitee_email === me.email && p.inviter_id === target.id))
    );
    if (existingPending)
      return Response.json({ error: 'Permintaan koneksi sudah ada, menunggu persetujuan' }, { status: 400 });

    // Buat sebagai user yang login -> created_by_id = me.id
    await base44.entities.Partnership.create({
      inviter_id: me.id,
      invitee_email: target.email,
      invitee_id: target.id,
      status: 'pending',
    });

    return Response.json({
      status: 'success',
      target: { id: target.id, full_name: target.full_name, email: target.email },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}