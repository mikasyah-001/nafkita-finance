import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { resolvePartnerId } from "../../shared/partnerResolve.ts";

// Mengembalikan profil pasangan aktif pengguna (hanya data aman untuk ditampilkan).
// Menggantikan pemanggilan User.list di frontend yang sebelumnya membuka seluruh
// data user ke siapa pun yang login. Hanya field berikut yang dikembalikan:
// id, full_name, email, photo_url, default_currency.
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

    const partnerId = await resolvePartnerId(base44, me.id);
    if (!partnerId) return Response.json({ partner: null });

    let u;
    try { u = await base44.asServiceRole.entities.User.get(partnerId); }
    catch { return Response.json({ partner: null }); }
    if (!u) return Response.json({ partner: null });

    return Response.json({
      partner: {
        id: u.id,
        full_name: u.full_name || "",
        email: u.email || "",
        photo_url: u.photo_url || "",
        default_currency: u.default_currency || "IDR",
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}