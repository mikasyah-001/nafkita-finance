import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTransactions, useCategories, useMe, useUserCurrencies, useRateMap } from "@/hooks/useFinance";
import { formatDate, colorMap, hasRate, monthlyExpenseBreakdown, formatUnconverted } from "@/lib/finance";
import Money from "@/components/Money";
import CurrencyTabs from "@/components/CurrencyTabs";
import CategoryIcon from "@/components/CategoryIcon";
import { PieChart, TrendingUp, TrendingDown, ArrowRight, AlertTriangle } from "lucide-react";

export default function MonthlySummary({ scope = "shared" }) {
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: me } = useMe();
  const userCurrencies = useUserCurrencies();
  const { map: rateMap } = useRateMap();
  const [currency, setCurrency] = useState(me?.default_currency || "IDR");
  useEffect(() => { if (me?.default_currency) setCurrency(me.default_currency); }, [me?.default_currency]);

  const now = new Date();
  const { rows, total, prevTotal, activeCurs, cur, unconverted } = useMemo(() => {
    const y = now.getFullYear(), m = now.getMonth();
    // Mata uang aktif = mata uang pengeluaran bulan ini + default user.
    const monthCurs = monthlyExpenseBreakdown(transactions, { year: y, month: m, scope, currency: "IDR", rateMap }).currencies;
    const activeCurs = [...new Set([...monthCurs, (me?.default_currency || "IDR").toUpperCase()])];
    const cur = activeCurs.length && !activeCurs.includes(currency) ? activeCurs[0] : currency;
    const r = monthlyExpenseBreakdown(transactions, { year: y, month: m, scope, currency: cur, rateMap });
    return { rows: r.rows, total: r.total, prevTotal: r.prevTotal, activeCurs, cur, unconverted: r.unconverted };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, scope, currency, rateMap, me?.default_currency]);

  if (total === 0 && activeCurs.length === 0) return null;

  const excludedText = formatUnconverted(unconverted);
  const rateMissing = !!excludedText || !hasRate(cur, rateMap);
  const monthLabel = formatDate(now, "MMMM yyyy");
  const max = rows.length ? rows[0].value : 0;
  const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
  const top = rows[0] || null;

  return (
    <div className="surface p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-sm flex items-center gap-2"><PieChart className="w-4 h-4 text-muted-foreground" /> Ringkasan Belanja</h2>
          <p className="text-xs text-muted-foreground">{monthLabel}</p>
        </div>
        <Link to="/laporan?tab=bulanan" className="text-xs text-muted-foreground flex items-center gap-1 active:scale-95 transition-transform">Detail <ArrowRight className="w-3 h-3" /></Link>
      </div>

      {activeCurs.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <CurrencyTabs currencies={activeCurs} value={cur} onChange={setCurrency} />
          {rateMissing && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 rounded-full px-2 py-0.5 shrink-0">
              <AlertTriangle className="w-3 h-3" /> Kurs belum tersedia
            </span>
          )}
        </div>
      )}

      <div className="flex items-end justify-between mb-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Total pengeluaran</p>
          <p className="text-xl font-bold tabular-nums break-words"><Money value={total} currency={cur} /></p>
          {excludedText && <p className="text-[11px] text-warning mt-0.5">Belum termasuk {excludedText} (kurs belum tersedia)</p>}
        </div>
        {prevTotal > 0 && (
          <span className={`text-xs font-medium flex items-center gap-1 shrink-0 ${total <= prevTotal ? "text-success" : "text-destructive"}`}>
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
                <span className="text-xs font-semibold tabular-nums shrink-0"><Money value={r.value} format="short" currency={cur} /></span>
                <span className="text-[11px] text-muted-foreground tabular-nums w-9 text-right shrink-0">{share.toFixed(0)}%</span>
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