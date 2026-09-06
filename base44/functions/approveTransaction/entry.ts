import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { txEffect, roundForCurrency } from "../../shared/assetAdjust.ts";
import { recordAssetMutation } from "../../shared/assetMutation.ts";
import { notifyApprovalResult } from "../../shared/transactionApproval.ts";

// Menyetujui transaksi pending.
// - Hanya approver (pasangan) yang boleh menyetujui.
// - Set status approval = approved, transaksi approval_status = approved.
// - Sesuaikan saldo aset yang ditautkan (terapkan txEffect).
// - Catat mutasi aset immutable.
// - Kirim notifikasi hasil ke pembuat transaksi.
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
    if (approval.approver_id !== me.id)
      return Response.json({ error: "forbidden" }, { status: 403 });
    if (approval.status !== "pending")
      return Response.json({ error: "sudah_diproses" }, { status: 400 });

    const tx = await base44.asServiceRole.entities.Transaction.get(approval.transaction_id);
    if (!tx) return Response.json({ error: "tx_not_found" }, { status: 404 });

    // Sesuaikan saldo aset bila ditautkan.
    if (tx.linked_asset_id) {
      const asset = await base44.asServiceRole.entities.Asset.get(tx.linked_asset_id);
      if (asset) {
        const prevValue = asset.value || 0;
        const delta = txEffect(tx);
        const newValue = roundForCurrency(prevValue + delta, asset.currency);
        await base44.asServiceRole.entities.Asset.update(tx.linked_asset_id, { value: newValue });

        // Catat mutasi aset immutable.
        await recordAssetMutation(base44, {
          asset_id: tx.linked_asset_id,
          previous_value: prevValue,
          new_value: newValue,
          change_type: "transaction",
          source_ref: tx.id,
          source_description: `Disetujui: ${tx.merchant || tx.category || "transaksi"}`,
          actor_id: me.id,
          actor_name: me.full_name || me.email,
          currency: asset.currency || "IDR",
        });
      }
    }

    // Update approval status.
    await base44.asServiceRole.entities.TransactionApproval.update(approval_id, {
      status: "approved",
      decided_at: new Date().toISOString(),
      approver_name: me.full_name || me.email,
    });

    // Update transaksi approval_status.
    await base44.asServiceRole.entities.Transaction.update(tx.id, {
      approval_status: "approved",
    });

    // Kirim notifikasi ke pembuat.
    const approverName = me.full_name || me.email || "Pasangan";
    await notifyApprovalResult(base44, approverName, approval, tx, true, null);

    return Response.json({ ok: true, approval_id, status: "approved" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}