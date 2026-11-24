import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { currencyMismatch, CURRENCY_MISMATCH, txEffect, roundForCurrency } from "../../shared/assetAdjust.ts";
import { recordAssetMutation } from "../../shared/assetMutation.ts";
import { notifyApprovalResult, validateApprovalDecision, claimApproval, releaseApproval } from "../../shared/transactionApproval.ts";

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

    const check = await validateApprovalDecision(base44, me, approval, tx);
    if (!check.ok) return Response.json({ error: check.error, message: check.message }, { status: check.status });
    if (!(await claimApproval(base44, approval_id)))
      return Response.json({ error: "sudah_diproses" }, { status: 409 });
    // Urutan aman (tanpa transaksi DB): saldo → status transaksi → status
    // persetujuan → notifikasi. Klaim hanya dilepas bila BELUM ada efek yang
    // tersimpan, atau efeknya berhasil dibatalkan — agar coba-ulang tidak
    // memotong saldo dua kali. Notifikasi gagal tidak membatalkan keputusan.
    let applied = null; // { assetId, prev } setelah saldo berubah
    try {
      if (tx.linked_asset_id) {
        const asset = await base44.asServiceRole.entities.Asset.get(tx.linked_asset_id);
        // Mata uang rekening berubah sejak transaksi diajukan → jangan ubah saldo
        // dengan angka mata uang lain; minta pengaju memperbaiki atau tolak.
        if (asset && currencyMismatch(asset, tx)) { await releaseApproval(base44, approval_id); return Response.json(CURRENCY_MISMATCH, { status: 409 }); }
        if (asset) {
          const prevValue = asset.value || 0;
          const newValue = roundForCurrency(prevValue + txEffect(tx), asset.currency);
          await base44.asServiceRole.entities.Asset.update(tx.linked_asset_id, { value: newValue });
          applied = { assetId: tx.linked_asset_id, prev: prevValue };
          try {
            await recordAssetMutation(base44, {
              asset_id: tx.linked_asset_id, previous_value: prevValue, new_value: newValue,
              change_type: "transaction", source_ref: tx.id,
              source_description: `Disetujui: ${tx.merchant || tx.category || "transaksi"}`,
              actor_id: me.id, actor_name: me.full_name || me.email, currency: asset.currency || "IDR",
            });
          } catch (e) { console.error("[approveTransaction] jejak mutasi gagal", e?.message); }
        }
      }
      // Status transaksi lebih dulu: begitu "approved", validasi menolak coba-ulang.
      await base44.asServiceRole.entities.Transaction.update(tx.id, { approval_status: "approved" });
    } catch (e) {
      // Belum ada keputusan tersimpan → batalkan efek saldo, lalu lepas klaim.
      let rolledBack = !applied;
      if (applied) {
        try { await base44.asServiceRole.entities.Asset.update(applied.assetId, { value: applied.prev }); rolledBack = true; }
        catch (rb) { console.error("[approveTransaction] rollback saldo gagal; klaim dibiarkan 'processing'", rb?.message); }
      }
      if (rolledBack) await releaseApproval(base44, approval_id);
      throw e;
    }

    // Keputusan sudah berlaku. Kegagalan di bawah tidak boleh membuka ulang klaim.
    try {
      await base44.asServiceRole.entities.TransactionApproval.update(approval_id, {
        status: "approved",
        decided_at: new Date().toISOString(),
        approver_name: me.full_name || me.email,
      });
    } catch (e) { console.error("[approveTransaction] status persetujuan gagal ditulis (transaksi sudah disetujui)", e?.message); }

    try {
      await notifyApprovalResult(base44, me.full_name || me.email || "Pasangan", approval, tx, true, null);
    } catch (e) { console.error("[approveTransaction] notifikasi gagal", e?.message); }

    return Response.json({ ok: true, approval_id, status: "approved" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}