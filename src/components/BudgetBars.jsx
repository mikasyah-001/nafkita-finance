import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTransactions, useCategories, useBudgets } from "@/hooks/useFinance";
import { formatRupiah, colorMap } from "@/lib/finance";
import { Target, ArrowRight, AlertTriangle } from "lucide-react";

export default function BudgetBars({ scope = "shared" }) {
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets();

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const rows = useMemo(() => {
    const monthTx = transactions.filter((t) => {
      const d = new Date(t.date);
      const inScope = scope === "private" ? t.visibility === "private" : t.visibility !== "private";
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.type === "expense" && inScope;
    });
    const spent = {};
    monthTx.forEach((t) => {
      spent[t.category] = (spent[t.category] || 0) + t.amount;
    });
    const budgetMap = {};
    budgets.filter((b) => b.period === period && (b.visibility || "shared") === scope).forEach((b) => {
      budgetMap[b.category] = b.limit_amount;
    });
    return categories
      .filter((c) => c.type === "expense" && budgetMap[c.name] > 0)
      .map((c) => {
        const limit = budgetMap[c.name];
        const s = spent[c.name] || 0;
        const remaining = limit - s;
        const pct = Math.min(100, (s / limit) * 100);
        const over = s > limit;
        const near = !over && remaining < limit * 0.2;
        return { name: c.name, color: c.color, spent: s, limit, remaining, pct, over, near };
      })
      .sort((a, b) => b.pct - a.pct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, categories, budgets, period, scope]);

  if (rows.length === 0) {
    return (
      <Link to="/anggaran" className="block rounded-2xl border border-dashed border-border bg-card p-4 mb-6 active:scale-[0.98] transition-transform">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center">
            <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Atur anggaran bulanan</p>
            <p className="text-xs text-muted-foreground">Pantau sisa anggaran tiap kategori di sini.</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Target className="w-4 h-4 text-indigo-500" /> Sisa Anggaran
        </h2>
        <Link to="/anggaran" className="text-xs text-muted-foreground flex items-center gap-1">
          Kelola <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-3">
        {rows.map((r) => {
          const cm = colorMap[r.color] || colorMap.slate;
          const barColor = r.over ? "bg-red-500" : r.near ? "bg-amber-500" : cm.solid;
          return (
            <div key={r.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium flex items-center gap-1.5">
                  {r.over && <AlertTriangle className="w-3 h-3 text-red-500" />}
                  {r.name}
                </span>
                <span className={`text-xs font-medium ${r.over ? "text-red-500" : r.near ? "text-amber-600" : "text-muted-foreground"}`}>
                  {r.over ? `Lebih ${formatRupiah(Math.abs(r.remaining))}` : `Sisa ${formatRupiah(r.remaining)}`}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${r.pct}%` }} />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">{formatRupiah(r.spent)} terpakai</span>
                <span className="text-[10px] text-muted-foreground">dari {formatRupiah(r.limit)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}