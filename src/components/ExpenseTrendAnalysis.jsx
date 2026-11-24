import { useMemo } from "react";
import { formatMoney, formatMoneyShort, colorMap, formatAxis } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, TrendingDown, Sparkles, AlertTriangle } from "lucide-react";

const chartColors = ["#5C64D6", "#2E9E98", "#E08A5C", "#D46A86", "#4F8FD1", "#8B67C7", "#C9A545", "#7C869A"];

export default function ExpenseTrendAnalysis({ transactions, categories, year, month, currency = "IDR" }) {
  const prevName = useMemo(() => new Date(year, month - 1, 1).toLocaleDateString("id-ID", { month: "long" }), [year, month]);

  const rows = useMemo(() => {
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    const inMonth = (t, y, m) => {
      const d = new Date(t.date);
      return d.getMonth() === m && d.getFullYear() === y && t.type === "expense";
    };
    const curMap = {};
    const prevMap = {};
    transactions.filter((t) => inMonth(t, year, month)).forEach((t) => { curMap[t.category] = (curMap[t.category] || 0) + t.amount; });
    transactions.filter((t) => inMonth(t, py, pm)).forEach((t) => { prevMap[t.category] = (prevMap[t.category] || 0) + t.amount; });
    const names = Array.from(new Set([...Object.keys(curMap), ...Object.keys(prevMap)]));
    return names
      .map((name) => {
        const value = curMap[name] || 0;
        const prev = prevMap[name] || 0;
        const diff = value - prev;
        const pct = prev > 0 ? (diff / prev) * 100 : value > 0 ? 100 : 0;
        return { name, value, prev, diff, pct };
      })
      .sort((a, b) => b.value - a.value);
  }, [transactions, year, month]);

  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + r.value, 0);
  const prevTotal = rows.reduce((s, r) => s + r.prev, 0);
  const totalDiff = total - prevTotal;
  const totalPct = prevTotal > 0 ? (totalDiff / prevTotal) * 100 : 0;

  const top = rows[0];
  const risers = rows.filter((r) => r.prev > 0 && r.diff > 0).sort((a, b) => b.diff - a.diff);
  const savers = rows.filter((r) => r.prev > 0 && r.diff < 0).sort((a, b) => a.diff - b.diff);
  const newCats = rows.filter((r) => r.prev === 0 && r.value > 0);
  const biggestRiser = risers[0] || null;
  const biggestSaver = savers[0] || null;

  const chartData = rows.slice(0, 8).map((r) => ({ name: r.name.length > 10 ? r.name.slice(0, 9) + "…" : r.name, current: r.value, prev: r.prev }));

  return (
    <div className="surface p-4">
      <h2 className="font-semibold text-sm mb-1 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" /> Analisis Tren Pengeluaran
      </h2>
      <p className="text-xs text-muted-foreground mb-3">Perbandingan kategori bulan ini vs {prevName}.</p>

      <div className="rounded-xl bg-muted/50 p-3 mb-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] text-muted-foreground">Bulan ini</p>
          <p className="text-sm font-semibold tabular-nums"><span className="amount">{formatMoney(total, currency)}</span></p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">{prevName}</p>
          <p className="text-sm font-semibold tabular-nums"><span className="amount">{formatMoney(prevTotal, currency)}</span></p>
        </div>
        <div className="col-span-2 flex items-center gap-1.5 pt-2 border-t border-border">
          {totalDiff > 0 ? <TrendingUp className="w-3.5 h-3.5 text-destructive" /> : totalDiff < 0 ? <TrendingDown className="w-3.5 h-3.5 text-success" /> : null}
          <span className={`text-xs font-medium ${totalDiff > 0 ? "text-destructive" : totalDiff < 0 ? "text-success" : "text-muted-foreground"}`}>
            {totalDiff > 0 ? "Naik" : totalDiff < 0 ? "Turun" : "Stabil"} {prevTotal > 0 ? `${Math.abs(totalPct).toFixed(0)}%` : ""} ({totalDiff >= 0 ? "+" : ""}<span className="amount">{formatMoney(totalDiff, currency)}</span>)
          </span>
        </div>
      </div>

      <div className="h-52 mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-25} textAnchor="end" height={50} />
            <YAxis width={44} tick={{ fontSize: 10 }} tickFormatter={formatAxis} />
            <Tooltip formatter={(v) => formatMoney(v, currency)} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 12 }} />
            <Bar dataKey="prev" name={prevName} radius={[4, 4, 0, 0]} fill="#cbd5e1" />
            <Bar dataKey="current" name="Bulan ini" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 mb-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-muted" /> {prevName}</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: chartColors[0] }} /> Bulan ini</span>
      </div>

      <div className="space-y-3">
        {rows.map((r, i) => {
          const cat = categories.find((c) => c.name === r.name);
          const cm = colorMap[cat?.color] || colorMap.slate;
          const up = r.diff > 0;
          const down = r.diff < 0;
          const isNew = r.prev === 0 && r.value > 0;
          const share = total > 0 ? (r.value / total) * 100 : 0;
          return (
            <div key={r.name} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cm.bg}`}>
                <CategoryIcon name={cat?.icon || "Wallet"} className={`w-3.5 h-3.5 ${cm.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{r.name}</p>
                <p className="text-[11px] text-muted-foreground tabular-nums truncate">
                  <span className="amount">{formatMoney(r.value, currency)}</span> • {share.toFixed(0)}% {r.prev > 0 && <>• dari <span className="amount">{formatMoneyShort(r.prev, currency)}</span></>}
                </p>
              </div>
              <div className="text-right shrink-0">
                {isNew ? (
                  <span className="text-[11px] font-medium text-destructive flex items-center gap-0.5 justify-end"><AlertTriangle className="w-3 h-3" /> Baru</span>
                ) : r.prev === 0 ? null : up ? (
                  <span className="text-[11px] font-medium text-destructive flex items-center gap-0.5 justify-end"><TrendingUp className="w-3 h-3" /> +{Math.abs(r.pct).toFixed(0)}%</span>
                ) : down ? (
                  <span className="text-[11px] font-medium text-success flex items-center gap-0.5 justify-end"><TrendingDown className="w-3 h-3" /> -{Math.abs(r.pct).toFixed(0)}%</span>
                ) : (
                  <span className="text-[11px] font-medium text-muted-foreground">0%</span>
                )}
                {r.prev > 0 && (
                  <p className={`text-[11px] tabular-nums ${up ? "text-destructive" : down ? "text-success" : "text-muted-foreground"}`}>
                    {up ? "+" : down ? "-" : ""}<span className="amount">{formatMoney(Math.abs(r.diff), currency)}</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground space-y-1.5">
        <p>📊 Pengeluaran terbesar: <span className="font-medium text-foreground">{top.name}</span> ({((top.value / total) * 100).toFixed(0)}% dari total).</p>
        {biggestRiser && (
          <p>📈 Kenaikan tertinggi: <span className="font-medium text-foreground">{biggestRiser.name}</span> naik {((biggestRiser.diff / biggestRiser.prev) * 100).toFixed(0)}% (+<span className="amount">{formatMoneyShort(biggestRiser.diff, currency)}</span>).</p>
        )}
        {biggestSaver && (
          <p>📉 Penurunan terbesar: <span className="font-medium text-foreground">{biggestSaver.name}</span> turun {Math.abs((biggestSaver.diff / biggestSaver.prev) * 100).toFixed(0)}% (<span className="amount">{formatMoneyShort(biggestSaver.diff, currency)}</span>).</p>
        )}
        {newCats.length > 0 && (
          <p>🆕 Kategori baru bulan ini: <span className="font-medium text-foreground">{newCats.map((c) => c.name).join(", ")}</span>.</p>
        )}
      </div>
    </div>
  );
}