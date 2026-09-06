import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Endpoint admin: daftar transaksi lintas keluarga dengan pagination cursor.
// Hanya menampilkan transaksi non-private (kebijakan privasi).
// Memverifikasi role admin; 403 bila bukan admin.
// Payload: { before_date?, user_filter?, limit? }
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (me.role !== "admin")
      return Response.json({ error: "forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const pageSize = Math.min(Number(body.limit) || 100, 500);
    const filter = { visibility: { $ne: "private" } };
    if (body.user_filter) filter.created_by_id = body.user_filter;
    if (body.before_date) filter.date = { $lt: body.before_date };

    const txs = await base44.asServiceRole.entities.Transaction.filter(
      filter, "-date", pageSize
    );

    return Response.json({
      transactions: txs || [],
      has_more: (txs || []).length === pageSize,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}