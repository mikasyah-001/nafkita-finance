import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Endpoint admin: ambil satu transaksi berdasarkan ID (termasuk private) untuk audit.
// Memverifikasi role admin; 403 bila bukan admin.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (me.role !== "admin")
      return Response.json({ error: "forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const id = String(body.id || "");
    if (!id) return Response.json({ error: "missing_id" }, { status: 400 });

    const tx = await base44.asServiceRole.entities.Transaction.get(id);
    if (!tx) return Response.json({ error: "not_found" }, { status: 404 });

    return Response.json({ transaction: tx });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}