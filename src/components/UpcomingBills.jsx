import { Link } from "react-router-dom";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useRecurringBills, useMe } from "@/hooks/useFinance";
import { billDue, sortByDue } from "@/lib/recurring";
import { formatDate } from "@/lib/finance";
import Money from "@/components/Money";

export const DUE_TONE = {
  overdue: "bg-destructive/10 text-destructive",
  today: "bg-destructive/10 text-destructive",
  soon: "bg-warning/15 text-warning",
  upcoming: "bg-primary/10 text-primary",
  paused: "bg-muted text-muted-foreground",
  none: "bg-muted text-muted-foreground",
};

// 3 tagihan berulang terdekat di Beranda (sama dengan halaman Tagihan:
// hanya tagihan milik pengguna ini).
export default function UpcomingBills({ limit = 3 }) {
  const { data: bills = [] } = useRecurringBills();
  const { data: me } = useMe();
  const list = sortByDue(bills.filter((b) => b.created_by_id === me?.id)).slice(0, limit);
  if (!list.length) return null;

  return (
    <section className="surface rounded-3xl p-4 mb-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="font-semibold text-[17px] leading-tight">Tagihan terdekat</h2>
          <p className="text-xs text-muted-foreground">Dicatat otomatis saat jatuh tempo</p>
        </div>
        <Link to="/tagihan-berulang" className="text-xs font-medium text-primary flex items-center gap-1">Semua <ArrowRight className="w-3 h-3" /></Link>
      </div>
      <div className="divide-y divide-border">
        {list.map((b) => {
          const due = billDue(b);
          const urgent = due.kind === "overdue" || due.kind === "today";
          return (
            <Link key={b.id} to="/tagihan-berulang" className="flex items-center gap-3 py-2.5 active:opacity-70">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${DUE_TONE[due.kind]}`}><RefreshCw className="w-4 h-4" /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">{b.category}</span>
                <span className="block text-xs text-muted-foreground">{formatDate(b.next_date, "d MMM")}</span>
              </span>
              <span className="text-right shrink-0">
                <span className="block text-sm font-semibold tabular-nums"><Money value={b.amount} currency={b.currency} /></span>
                <span className={`block text-[11px] font-medium ${urgent ? "text-destructive" : due.kind === "soon" ? "text-warning" : "text-muted-foreground"}`}>{due.label}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
