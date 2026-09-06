import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Check, X, Clock, ArrowRight } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/finance";
import { useToast } from "@/components/ui/use-toast";

export default function ApprovalCard({ approval, mode, onRefresh }) {
  const { toast } = useToast();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isPending = approval.status === "pending";

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("approveTransaction", { approval_id: approval.id });
      if (res.data?.ok) {
        toast({ title: "Transaksi disetujui" });
        onRefresh();
      }
    } catch (e) {
      toast({ title: "Gagal", description: e?.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("rejectTransaction", { approval_id: approval.id, reason });
      if (res.data?.ok) {
        toast({ title: "Transaksi ditolak" });
        setShowReject(false);
        setReason("");
        onRefresh();
      }
    } catch (e) {
      toast({ title: "Gagal", description: e?.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  const handleCancel = async () => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("cancelApproval", { approval_id: approval.id });
      if (res.data?.ok) {
        toast({ title: "Permintaan dibatalkan" });
        onRefresh();
      }
    } catch (e) {
      toast({ title: "Gagal", description: e?.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  const statusColors = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    rejected: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
    cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400",
  };

  const statusLabel = {
    pending: "Menunggu",
    approved: "Disetujui",
    rejected: "Ditolak",
    cancelled: "Dibatalkan",
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColors[approval.status]}`}>
              {statusLabel[approval.status]}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDate(approval.requested_at, "dd MMM, HH:mm")}
            </span>
          </div>
          <p className="font-semibold truncate">{approval.merchant || approval.category || "Transaksi"}</p>
          <p className="text-lg font-bold">{formatMoney(approval.amount, approval.currency)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {mode === "approver" ? `Dari: ${approval.requester_name}` : `Ke: ${approval.approver_name}`}
          </p>
        </div>
      </div>

      {/* Actions */}
      {isPending && mode === "approver" && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleApprove}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
          >
            <Check className="w-4 h-4" /> Setujui
          </button>
          <button
            onClick={() => setShowReject(!showReject)}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500 text-white text-sm font-medium hover:bg-rose-600 disabled:opacity-50"
          >
            <X className="w-4 h-4" /> Tolak
          </button>
        </div>
      )}

      {isPending && mode === "requester" && (
        <button
          onClick={handleCancel}
          disabled={submitting}
          className="w-full mt-3 px-3 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          Batalkan Permintaan
        </button>
      )}

      {/* Reject reason */}
      {showReject && isPending && (
        <div className="mt-3 space-y-2">
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Alasan penolakan (opsional)"
            className="input text-sm"
            rows={2}
          />
          <button
            onClick={handleReject}
            disabled={submitting}
            className="w-full px-3 py-2 rounded-xl bg-rose-500 text-white text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Memproses..." : "Konfirmasi Tolak"}
          </button>
        </div>
      )}

      {/* Rejection reason */}
      {approval.status === "rejected" && approval.rejection_reason && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
          Alasan: {approval.rejection_reason}
        </p>
      )}
    </div>
  );
}