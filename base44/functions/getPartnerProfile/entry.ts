import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { fetchAll } from "../../shared/fetchAll.ts";

// Mengembalikan profil pasangan aktif pengguna (hanya data aman untuk ditampilkan).
// Menggantikan pemanggilan User.list di frontend yang sebelumnya membuka seluruh
// data user ke siapa pun yang login. Hanya field berikut yang dikembalikan:
// id, full_name, email, photo_url, default_currency, last_active_at — plus
// info koneksi (sejak kapan terhubung, peran masing-masing).
//
// Catatan: entity User bawaan tidak menerapkan RLS read (platform mengatur
// perizinan User sendiri dan top-level rls tidak diterapkan), sehingga fungsi
// ini adalah lapisan perlindungan utama — frontend wajib memakainya, bukan
// User.list langsung.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const partnerships = await fetchAll(base44.asServiceRole.entities.Partnership);
    const active = (partnerships || []).find(
      (p) => p.status === "active" && (p.inviter_id === me.id || p.invitee_id === me.id)
    );
    const partnerId = active ? (active.inviter_id === me.id ? active.invitee_id : active.inviter_id) : null;
    if (!partnerId) return Response.json({ partner: null });

    let u;
    try { u = await base44.asServiceRole.entities.User.get(partnerId); }
    catch { return Response.json({ partner: null }); }
    if (!u) return Response.json({ partner: null });

    // Sejak kapan terhubung: connected_at (diisi saat undangan diterima).
    // Koneksi lama belum punya field ini → pakai waktu notifikasi "accepted"
    // ke pengundang (tercatat persis saat diterima) lalu simpan agar stabil.
    // Bila tidak ada jejak sama sekali, kembalikan perkiraan (created_date).
    let connectedAt = active.connected_at || null;
    let connectedExact = !!connectedAt;
    if (!connectedAt) {
      try {
        const n = await base44.asServiceRole.entities.Notification.filter(
          { target_user_id: active.inviter_id, event_key: `partnership:${active.id}:accepted` },
          "created_date",
          1,
        );
        if (n?.[0]?.created_date) {
          connectedAt = n[0].created_date;
          connectedExact = true;
          await base44.asServiceRole.entities.Partnership.update(active.id, { connected_at: connectedAt }).catch(() => {});
        }
      } catch { /* abaikan */ }
    }
    if (!connectedAt) connectedAt = active.created_date || null;

    const iAmInviter = active.inviter_id === me.id;
    return Response.json({
      partner: {
        id: u.id,
        full_name: u.full_name || "",
        email: u.email || "",
        photo_url: u.photo_url || "",
        default_currency: u.default_currency || "IDR",
        last_active_at: u.last_active_at || null,
        joined_at: u.created_date || null,
      },
      connection: {
        partnership_id: active.id,
        connected_at: connectedAt,
        connected_exact: connectedExact,
        invited_by: iAmInviter ? "me" : "partner",
        my_role: (iAmInviter ? active.inviter_role : active.invitee_role) || null,
        partner_role: (iAmInviter ? active.invitee_role : active.inviter_role) || null,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}