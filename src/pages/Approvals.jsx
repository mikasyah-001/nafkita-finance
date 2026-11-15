import { usePendingApprovals, useRefresh } from "@/hooks/useFinance";
import { CheckCheck, Clock } from "lucide-react";
import ApprovalCard from "@/components/ApprovalCard";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";

export default function Approvals() {
  const { data, isLoading } = usePendingApprovals();
  const refresh = useRefresh();
  const pending = data?.pending_approvals || [];
  const myRequests = data?.my_requests || [];

  return (
    <div className="px-5 pt-6">
      <PageHeader title="Persetujuan" subtitle="Kelola persetujuan transaksi besar" back />

      {/* Pending approvals (user is approver) */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Perlu Persetujuan Anda
          {pending.length > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs">{pending.length}</span>}
        </h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Memuat...</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Tidak ada permintaan pending</p>
        ) : (
          <div className="space-y-3">
            {pending.map(a => <ApprovalCard key={a.id} approval={a} mode="approver" onRefresh={refresh} />)}
          </div>
        )}
      </div>

      {/* My requests (user is requester) */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <CheckCheck className="w-4 h-4" /> Permintaan Saya
        </h2>
        {myRequests.length === 0 ? (
          <EmptyState icon={CheckCheck} title="Belum ada permintaan" subtitle="Transaksi besar yang memerlukan persetujuan akan muncul di sini" />
        ) : (
          <div className="space-y-3">
            {myRequests.map(a => <ApprovalCard key={a.id} approval={a} mode="requester" onRefresh={refresh} />)}
          </div>
        )}
      </div>
    </div>
  );
}