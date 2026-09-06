import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Mengambil daftar aturan notifikasi pengguna.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const rules = await base44.entities.NotificationRule.filter(
      { created_by_id: me.id },
      "-created_date",
      500
    );

    return Response.json({ rules: rules || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}