import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTransactions, useCategories } from "@/hooks/useFinance";
import { formatRupiah, formatRupiahShort, formatDate, colorMap } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import { PieChart, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

export default function MonthlySummary({ scope = "shared" }) {
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();

  const now = new Date();
  const { rows, total, prevTotal } = useMemo(() => {
    const scoped = transactions.filter((t) => (scope === "private" ? t.visibility === "private" : t.visibility !== "private"));
    const inMonth = (t, y, m) => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m; };
    const py = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const pm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const cur = scoped.filter((t) => t.type === "expense" && inMonth(t, now.getFullYear(), now.getMonth()));
    const prev = scoped.filter((t) => t.type === "expense" && inMonth(t, py, pm));
    const map = {};
    cur.forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    const prevMap = {};
    prev.forEach((t) => { prevMap[t.category] = (prevMap[t.category] || 0) + t.amount; });
    const total = cur.reduce((s, t) => s + t.amount, 0);
    const prevTotal = prev.reduce((s, t) => s + t.amount, 0);
    const rows = Object.entries(map)
      .map(([name, value]) => ({ name, value, prev: prevMap[name] || 0 }))
      .sort((a, b) => b.value - a.value);
    return { rows, total, prevTotal };
  }, [transactions, scope]);

  if (total === 0) return null;

  const monthLabel = formatDate(now, "MMMM yyyy");
  const max = rows.length ? rows[0].value : 0;
  const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
  const top = rows[0] || null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-sm flex items-center gap-2"><PieChart className="w-4 h-4 text-muted-foreground" /> Ringkasan Belanja</h2>
          <p className="text-xs text-muted-foreground">{monthLabel}</p>
        </div>
        <Link to="/ringkasan" className="text-xs text-muted-foreground flex items-center gap-1 active:scale-95 transition-transform">Detail <ArrowRight className="w-3 h-3" /></Link>
      </div>

      <div className="flex items-end justify-between mb-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Total pengeluaran</p>
          <p className="text-xl font-bold tabular-nums break-words">{formatRupiah(total)}</p>
        </div>
        {prevTotal > 0 && (
          <span className={`text-xs font-medium flex items-center gap-1 shrink-0 ${total <= prevTotal ? "text-emerald-600" : "text-red-500"}`}>
            {total <= prevTotal ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
            {total > prevTotal ? "+" : ""}{delta.toFixed(0)}% vs bln lalu
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        {rows.slice(0, 4).map((r) => {
          const cat = categories.find((c) => c.name === r.name);
          const cm = colorMap[cat?.color] || colorMap.slate;
          const pct = max > 0 ? (r.value / max) * 100 : 0;
          const share = total > 0 ? (r.value / total) * 100 : 0;
          return (
            <div key={r.name}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${cm.bg}`}>
                  <CategoryIcon name={cat?.icon || "Wallet"} className={`w-3.5 h-3.5 ${cm.text}`} />
                </div>
                <span className="text-xs font-medium flex-1 truncate">{r.name}</span>
                <span className="text-xs font-semibold tabular-nums shrink-0">{formatRupiahShort(r.value)}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums w-9 text-right shrink-0">{share.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${cm.solid}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {top && (
        <p className="text-[11px] text-muted-foreground mt-3">
          Pengeluaran terbesar <span className="font-medium text-foreground">{top.name}</span> ({((top.value / total) * 100).toFixed(0)}% dari total).
        </p>
      )}
    </div>
  );
}