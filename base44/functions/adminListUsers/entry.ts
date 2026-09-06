import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { fetchAll } from "../../shared/fetchAll.ts";
import { logAdminAction } from "../../shared/auditLog.ts";

// Endpoint admin: daftar seluruh pengguna dan partnership dengan paginasi penuh.
// Hanya admin yang dapat mengakses. Mengembalikan users + partnerships lengkap
// (tanpa batas 500) untuk panel admin.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (me.role !== "admin")
      return Response.json({ error: "forbidden" }, { status: 403 });

    const [users, partnerships] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.User),
      fetchAll(base44.asServiceRole.entities.Partnership),
    ]);

    await logAdminAction(base44, {
      actor_id: me.id,
      actor_name: me.full_name || me.email,
      actor_email: me.email,
      action: "view_admin_users",
      target_type: "user",
      details: `Memuat ${users.length} pengguna dan ${partnerships.length} partnership`,
    });

    return Response.json({
      users: users || [],
      partnerships: partnerships || [],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}