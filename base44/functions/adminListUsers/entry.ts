import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { fetchAll } from "../../shared/fetchAll.ts";

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

    return Response.json({
      users: users || [],
      partnerships: partnerships || [],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}