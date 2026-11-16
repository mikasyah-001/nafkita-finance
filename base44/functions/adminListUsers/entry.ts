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

    // Pengguna & partnership dimuat terpisah: satu gagal tidak mengosongkan panel.
    const [ru, rp] = await Promise.allSettled([
      fetchAll(base44.asServiceRole.entities.User),
      fetchAll(base44.asServiceRole.entities.Partnership),
    ]);
    const errors = [];
    const pick = (r, source) => {
      if (r.status === "fulfilled") return r.value || [];
      const message = r.reason?.message || String(r.reason);
      console.error(`adminListUsers: gagal memuat ${source}:`, message);
      errors.push({ source, message });
      return [];
    };
    const users = pick(ru, "pengguna");
    const partnerships = pick(rp, "pasangan");
    if (errors.length === 2) {
      return Response.json({ error: `Gagal memuat pengguna & pasangan: ${errors.map((e) => e.message).join("; ")}`, errors }, { status: 500 });
    }

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
      errors,
    });
  } catch (error) {
    console.error("adminListUsers:", error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}