// Logika persetujuan transaksi besar (threshold-based approval).
// Dipakai oleh saveTransactionWithAsset untuk menentukan apakah transaksi
// memerlukan persetujuan pasangan sebelum aset disesuaikan.
import { resolvePartnerId } from "./partnerResolve.ts";
import { getActorName, createNotificationIdempotent } from "./notifyCommon.ts";

// Ambang default untuk persetujuan transaksi (dalam SAR).
export const DEFAULT_APPROVAL_THRESHOLD = 10000;

// Cek apakah transaksi memerlukan persetujuan pasangan.
// Syarat: user memiliki pasangan aktif DAN nominal >= ambang.
export async function needsApproval(base44, user, transaction) {
  if (!user || !transaction) return false;
  const amt = Number(transaction.amount) || 0;
  if (amt < DEFAULT_APPROVAL_THRESHOLD) return false;

  // Hanya transaksi shared yang memerlukan persetujuan.
  if (transaction.visibility && transaction.visibility !== "shared") return false;

  // Hanya expense/sedekah yang memerlukan persetujuan (income tidak).
  if (transaction.type === "income") return false;

  // Cek apakah user memiliki pasangan aktif.
  const partnerId = await resolvePartnerId(base44, user.id);
  if (!partnerId) return false;

  return true;
}

// Buat record TransactionApproval dan set transaksi ke pending.
export async function createApprovalRequest(base44, user, transaction, partnerId) {
  const amt = Number(transaction.amount) || 0;
  const approval = await base44.asServiceRole.entities.TransactionApproval.create({
    transaction_id: transaction.id,
    requester_id: user.id,
    requester_name: user.full_name || user.email,
    approver_id: partnerId,
    approver_name: await getActorName(base44, partnerId),
    amount: amt,
    currency: transaction.currency || "IDR",
    category: transaction.category || "",
    merchant: transaction.merchant || "",
    status: "pending",
    threshold_at_request: DEFAULT_APPROVAL_THRESHOLD,
    requested_at: new Date().toISOString(),
  });

  // Set transaksi ke pending.
  await base44.asServiceRole.entities.Transaction.update(transaction.id, {
    approval_status: "pending",
    approval_id: approval.id,
  });

  return approval;
}

// Kirim notifikasi permintaan persetujuan ke pasangan.
export async function notifyApprovalRequest(base44, user, transaction, approval, partnerId) {
  const amt = Number(transaction.amount) || 0;
  const cur = String(transaction.currency || "IDR").toUpperCase();
  const fmt = cur === "IDR" ? "Rp" + amt.toLocaleString("id-ID")
    : cur === "SAR" ? "SAR " + amt.toLocaleString("en-US", { minimumFractionDigits: 2 })
    : cur + " " + amt.toLocaleString("en-US", { minimumFractionDigits: 2 });
  const label = transaction.merchant || transaction.notes || transaction.category || "Transaksi";

  const actorName = user.full_name || user.email || "Pasangan";
  const title = `${actorName} meminta persetujuan transaksi`;
  const bodyText = `${fmt} • ${label}`;

  const eventKey = `approval_request:${approval.id}`;
  return createNotificationIdempotent(base44, {
    target_user_id: partnerId,
    actor_name: actorName,
    action: "created",
    entity_kind: "transaction",
    event_key: eventKey,
    title,
    body: bodyText,
    ref_id: transaction.id,
    amount: amt,
    currency: cur,
    tx_type: transaction.type,
  });
}

// Kirim notifikasi hasil persetujuan ke pembuat transaksi.
export async function notifyApprovalResult(base44, approverName, approval, transaction, approved, reason) {
  const amt = Number(transaction.amount) || 0;
  const cur = String(transaction.currency || "IDR").toUpperCase();
  const label = transaction.merchant || transaction.notes || transaction.category || "Transaksi";

  const title = approved
    ? `${approverName} menyetujui transaksi Anda`
    : `${approverName} menolak transaksi Anda`;
  let bodyText = approved
    ? `Transaksi ${label} telah disetujui.`
    : `Transaksi ${label} ditolak.${reason ? " Alasan: " + reason : ""}`;

  const eventKey = `approval_result:${approval.id}:${approved ? "approved" : "rejected"}`;
  return createNotificationIdempotent(base44, {
    target_user_id: approval.requester_id,
    actor_name: approverName,
    action: approved ? "accepted" : "declined",
    entity_kind: "transaction",
    event_key: eventKey,
    title,
    body: bodyText,
    ref_id: transaction.id,
    amount: amt,
    currency: cur,
    tx_type: transaction.type,
  });
}