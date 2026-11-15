import { usePendingApprovals, useRefresh } from "@/hooks/useFinance";
import { CheckCheck, Clock } from "lucide-react";
import ApprovalCard from "@/components/ApprovalCard";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { ListSkeleton } from "@/components/LoadingSkeleton";

export default function Approvals() {
  const { data, isLoading } = usePendingApprovals();
  const refresh = useRefresh();
  const pending = data?.pending_approvals || [];
  const myRequests = data?.my_requests || [];

  return (
    <div className="px-5 pt-6">
      <PageHeader title="Persetujuan" subtitle="Kelola persetujuan transaksi besar" back />

      {/* Ringkasan */}
      <section aria-label="Ringkasan persetujuan" className="card-gradient-primary rounded-[24px] p-5 mb-6 flex items-center gap-4">
        <span className="w-12 h-12 rounded-full bg-gold text-gold-foreground flex items-center justify-center shrink-0"><Clock className="w-5 h-5" /></span>
        <div className="min-w-0">
          <p className="text-xs opacity-75">Menunggu keputusan Anda</p>
          <p className="font-heading text-[30px] leading-[1.1] font-extrabold tabular-nums">{isLoading ? "…" : pending.length}</p>
          <p className="text-[11px] opacity-70">{myRequests.length} permintaan Anda tercatat</p>
        </div>
      </section>

      {/* Pending approvals (user is approver) */}
      <section className="mb-8" aria-labelledby="approval-pending">
        <div className="mb-2.5 flex items-end justify-between gap-2">
          <div>
            <h2 id="approval-pending" className="font-semibold text-[17px] leading-tight">Perlu persetujuan Anda</h2>
            <p className="text-xs text-muted-foreground">Transaksi pasangan di atas batas nominal</p>
          </div>
          {pending.length > 0 && <span className="px-2.5 py-0.5 rounded-full bg-warning/15 text-warning text-xs font-semibold tabular-nums">{pending.length}</span>}
        </div>
        {isLoading ? (
          <ListSkeleton rows={2} />
        ) : pending.length === 0 ? (
          <div className="surface rounded-3xl p-5 text-sm text-muted-foreground text-center">Tidak ada permintaan pending</div>
        ) : (
          <div className="space-y-3">
            {pending.map(a => <ApprovalCard key={a.id} approval={a} mode="approver" onRefresh={refresh} />)}
          </div>
        )}
      </section>

      {/* My requests (user is requester) */}
      <section aria-labelledby="approval-mine" className="mb-4">
        <div className="mb-2.5">
          <h2 id="approval-mine" className="font-semibold text-[17px] leading-tight">Permintaan saya</h2>
          <p className="text-xs text-muted-foreground">Status transaksi yang Anda ajukan</p>
        </div>
        {myRequests.length === 0 ? (
          <div className="surface rounded-3xl px-4">
            <EmptyState icon={CheckCheck} title="Belum ada permintaan" subtitle="Transaksi besar yang memerlukan persetujuan akan muncul di sini" />
          </div>
        ) : (
          <div className="space-y-3">
            {myRequests.map(a => <ApprovalCard key={a.id} approval={a} mode="requester" onRefresh={refresh} />)}
          </div>
        )}
      </section>
    </div>
  );
}