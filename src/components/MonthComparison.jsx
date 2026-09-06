import { useMemo } from "react";
import { formatMoney, colorMap } from "@/lib/finance";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";

export default function MonthComparison({ transactions, categories, year, month, currency = "IDR" }) {
  const prevName = useMemo(() => {
    return new Date(year, month - 1, 1).toLocaleDateString("id-ID", { month: "long" });
  }, [year, month]);

  const rows = useMemo(() => {
    const prevDate = new Date(year, month - 1, 1);
    const pY = prevDate.getFullYear();
    const pM = prevDate.getMonth();
    const inMonth = (t, y, m) => {
      const d = new Date(t.date);
      return d.getMonth() === m && d.getFullYear() === y && t.type === "expense";
    };
    const thisMap = {};
    const prevMap = {};
    transactions.filter((t) => inMonth(t, year, month)).forEach((t) => {
      thisMap[t.category] = (thisMap[t.category] || 0) + t.amount;
    });
    transactions.filter((t) => inMonth(t, pY, pM)).forEach((t) => {
      prevMap[t.category] = (prevMap[t.category] || 0) + t.amount;
    });
    const names = Array.from(new Set([...Object.keys(thisMap), ...Object.keys(prevMap)]));
    return names
      .map((name) => {
        const tv = thisMap[name] || 0;
        const pv = prevMap[name] || 0;
        const diff = tv - pv;
        const pct = pv > 0 ? (diff / pv) * 100 : tv > 0 ? 100 : 0;
        return { name, tv, pv, diff, pct };
      })
      .sort((a, b) => b.diff - a.diff);
  }, [transactions, year, month]);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="font-semibold text-sm mb-1 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-indigo-500" /> Perbandingan vs {prevName}
      </h2>
      <p className="text-xs text-muted-foreground mb-3">Tren kenaikan/penurunan pengeluaran per kategori.</p>
      <div className="space-y-3">
        {rows.map((r) => {
          const cat = categories.find((c) => c.name === r.name);
          const cm = colorMap[cat?.color] || colorMap.slate;
          const up = r.diff > 0;
          const down = r.diff < 0;
          const same = r.diff === 0;
          const isNew = r.pv === 0 && r.tv > 0;
          const gone = r.tv === 0 && r.pv > 0;
          return (
            <div key={r.name} className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cm.solid}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{r.name}</p>
                <p className="text-[10px] text-muted-foreground">{formatMoney(r.pv, currency)} → {formatMoney(r.tv, currency)}</p>
              </div>
              <div className="text-right">
                {isNew ? (
                  <span className="text-[10px] font-medium text-red-500">Baru</span>
                ) : gone ? (
                  <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-0.5 justify-end"><TrendingDown className="w-3 h-3" /> 100%</span>
                ) : same ? (
                  <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-0.5 justify-end"><Minus className="w-3 h-3" /> 0%</span>
                ) : up ? (
                  <span className="text-[10px] font-medium text-red-500 flex items-center gap-0.5 justify-end"><TrendingUp className="w-3 h-3" /> {Math.round(Math.abs(r.pct))}%</span>
                ) : (
                  <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-0.5 justify-end"><TrendingDown className="w-3 h-3" /> {Math.round(Math.abs(r.pct))}%</span>
                )}
                <p className={`text-[10px] ${up ? "text-red-500" : down ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {up ? "+" : down ? "-" : ""}{formatMoney(Math.abs(r.diff), currency)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}