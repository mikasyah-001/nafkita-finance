import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Mengambil riwayat mutasi aset dengan filter.
// Parameter: asset_id (opsional), change_type (opsional), start_date, end_date.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { asset_id, change_type, start_date, end_date } = body;

    const filter = {};
    if (asset_id) filter.asset_id = asset_id;
    if (change_type) filter.change_type = change_type;

    const mutations = await base44.entities.AssetMutation.filter(filter, "-created_date", 500);

    let filtered = mutations || [];
    if (start_date) {
      const start = new Date(start_date);
      filtered = filtered.filter((m) => new Date(m.created_date) >= start);
    }
    if (end_date) {
      const end = new Date(end_date);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((m) => new Date(m.created_date) <= end);
    }

    return Response.json({ mutations: filtered });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}