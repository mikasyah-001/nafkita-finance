import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { notifyApprovalResult } from "../../shared/transactionApproval.ts";

// Menolak transaksi pending.
// - Hanya approver (pasangan) yang boleh menolak.
// - Set status approval = rejected, transaksi approval_status = rejected.
// - Aset TIDAK disesuaikan.
// - Kirim notifikasi hasil ke pembuat transaksi dengan alasan.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { approval_id, reason } = body;
    if (!approval_id) return Response.json({ error: "approval_id wajib diisi" }, { status: 400 });

    const approval = await base44.entities.TransactionApproval.get(approval_id);
    if (!approval) return Response.json({ error: "approval_not_found" }, { status: 404 });
    if (approval.approver_id !== me.id)
      return Response.json({ error: "forbidden" }, { status: 403 });
    if (approval.status !== "pending")
      return Response.json({ error: "sudah_diproses" }, { status: 400 });

    const tx = await base44.asServiceRole.entities.Transaction.get(approval.transaction_id);
    if (!tx) return Response.json({ error: "tx_not_found" }, { status: 404 });

    // Update approval status.
    await base44.asServiceRole.entities.TransactionApproval.update(approval_id, {
      status: "rejected",
      decided_at: new Date().toISOString(),
      approver_name: me.full_name || me.email,
      rejection_reason: reason || "",
    });

    // Update transaksi approval_status.
    await base44.asServiceRole.entities.Transaction.update(tx.id, {
      approval_status: "rejected",
    });

    // Kirim notifikasi ke pembuat.
    const approverName = me.full_name || me.email || "Pasangan";
    await notifyApprovalResult(base44, approverName, approval, tx, false, reason);

    return Response.json({ ok: true, approval_id, status: "rejected" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}