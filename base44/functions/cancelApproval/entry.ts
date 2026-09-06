import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Membatalkan permintaan persetujuan yang masih pending.
// - Hanya requester (pembuat transaksi) yang boleh membatalkan.
// - Set status approval = cancelled, transaksi approval_status = rejected.
// - Aset TIDAK disesuaikan (memang belum disesuaikan saat pending).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { approval_id } = body;
    if (!approval_id) return Response.json({ error: "approval_id wajib diisi" }, { status: 400 });

    const approval = await base44.entities.TransactionApproval.get(approval_id);
    if (!approval) return Response.json({ error: "approval_not_found" }, { status: 404 });
    if (approval.requester_id !== me.id)
      return Response.json({ error: "forbidden" }, { status: 403 });
    if (approval.status !== "pending")
      return Response.json({ error: "sudah_diproses" }, { status: 400 });

    // Update approval status.
    await base44.asServiceRole.entities.TransactionApproval.update(approval_id, {
      status: "cancelled",
      decided_at: new Date().toISOString(),
    });

    // Update transaksi approval_status ke rejected (transaksi dibatalkan).
    await base44.asServiceRole.entities.Transaction.update(approval.transaction_id, {
      approval_status: "rejected",
    });

    return Response.json({ ok: true, approval_id, status: "cancelled" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}