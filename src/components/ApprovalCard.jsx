import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Check, X } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/finance";
import { toast } from "sonner";

export default function ApprovalCard({ approval, mode, onRefresh }) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isPending = approval.status === "pending";

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("approveTransaction", { approval_id: approval.id });
      if (res.data?.ok) {
        toast.success("Transaksi disetujui");
        onRefresh();
      }
    } catch (e) {
      toast.error("Gagal", { description: e?.message });
    }
    setSubmitting(false);
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("rejectTransaction", { approval_id: approval.id, reason });
      if (res.data?.ok) {
        toast.success("Transaksi ditolak");
        setShowReject(false);
        setReason("");
        onRefresh();
      }
    } catch (e) {
      toast.error("Gagal", { description: e?.message });
    }
    setSubmitting(false);
  };

  const handleCancel = async () => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("cancelApproval", { approval_id: approval.id });
      if (res.data?.ok) {
        toast.success("Permintaan dibatalkan");
        onRefresh();
      }
    } catch (e) {
      toast.error("Gagal", { description: e?.message });
    }
    setSubmitting(false);
  };

  const statusColors = {
    pending: "bg-warning/15 text-warning",
    approved: "bg-success/15 text-success",
    rejected: "bg-destructive/15 text-destructive",
    cancelled: "bg-muted text-muted-foreground",
  };

  const statusLabel = {
    pending: "Menunggu",
    approved: "Disetujui",
    rejected: "Ditolak",
    cancelled: "Dibatalkan",
  };

  return (
    <article className="surface rounded-3xl p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusColors[approval.status]}`}>
          {statusLabel[approval.status]}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDate(approval.requested_at, "dd MMM, HH:mm")}
        </span>
      </div>
      <p className="text-sm text-muted-foreground truncate">{approval.merchant || approval.category || "Transaksi"}</p>
      <p className="font-heading text-[28px] leading-tight font-extrabold tracking-tight tabular-nums">{formatMoney(approval.amount, approval.currency)}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {mode === "approver" ? `Dari: ${approval.requester_name}` : `Ke: ${approval.approver_name}`}
      </p>

      {/* Actions */}
      {isPending && mode === "approver" && (
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            onClick={handleApprove}
            disabled={submitting}
            className="btn-primary btn-sm"
          >
            <Check className="w-4 h-4" /> Setujui
          </button>
          <button
            onClick={() => setShowReject(!showReject)}
            disabled={submitting}
            aria-expanded={showReject}
            className={`btn-secondary btn-sm text-destructive ${showReject ? "border-destructive/40 bg-destructive/5" : ""}`}
          >
            <X className="w-4 h-4" /> Tolak
          </button>
        </div>
      )}

      {isPending && mode === "requester" && (
        <button
          onClick={handleCancel}
          disabled={submitting}
          className="w-full mt-4 btn-secondary btn-sm text-muted-foreground"
        >
          Batalkan Permintaan
        </button>
      )}

      {/* Reject reason */}
      {showReject && isPending && (
        <div className="mt-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-3 space-y-2">
          <textarea
            aria-label="Alasan penolakan"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Alasan penolakan (opsional)"
            className="input text-sm bg-card resize-none"
            rows={2}
          />
          <button
            onClick={handleReject}
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold transition active:scale-[0.99] disabled:opacity-60"
          >
            {submitting ? "Memproses..." : "Konfirmasi Tolak"}
          </button>
        </div>
      )}

      {/* Rejection reason */}
      {approval.status === "rejected" && approval.rejection_reason && (
        <p className="mt-3 rounded-2xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Alasan: {approval.rejection_reason}
        </p>
      )}
    </article>
  );
}
