import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTransactions, useCategories, useMe, useUserCurrencies, useRateMap } from "@/hooks/useFinance";
import { formatDate, hasRate, monthlyExpenseBreakdown, formatUnconverted } from "@/lib/finance";
import Money from "@/components/Money";
import CurrencyTabs from "@/components/CurrencyTabs";
import { TrendingUp, TrendingDown, ArrowRight, AlertTriangle } from "lucide-react";

// Warna SVG (stroke) per warna kategori — padanan tailwind *-500.
const HEX = { rose: "#f43f5e", orange: "#f97316", amber: "#f59e0b", green: "#10b981", emerald: "#10b981", teal: "#14b8a6", blue: "#3b82f6", indigo: "#6366f1", violet: "#8b5cf6", pink: "#ec4899", cyan: "#06b6d4", red: "#ef4444", slate: "#94a3b8" };
const FALLBACK = ["#157A5A", "#E8B23A", "#3b82f6", "#f97316", "#8b5cf6", "#94a3b8"];

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
  const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
  const top = rows[0] || null;

  return (
    <div className="surface rounded-3xl p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-[17px] leading-tight">Ke mana perginya?</h2>
          <p className="text-xs text-muted-foreground">Pengeluaran {monthLabel}</p>
        </div>
        <Link to="/laporan?tab=bulanan" className="text-xs font-medium text-primary flex items-center gap-1 active:scale-95 transition-transform">Detail <ArrowRight className="w-3 h-3" /></Link>
      </div>

      {activeCurs.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <CurrencyTabs currencies={activeCurs} value={cur} onChange={setCurrency} />
          {rateMissing && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning bg-warning/15 border border-warning/30 rounded-full px-2 py-0.5 shrink-0">
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

      <CategoryDonut rows={rows} total={total} cur={cur} categories={categories} />

      {top && (
        <p className="text-[11px] text-muted-foreground mt-3">
          Pengeluaran terbesar <span className="font-medium text-foreground">{top.name}</span> ({((top.value / total) * 100).toFixed(0)}% dari total).
        </p>
      )}
    </div>
  );
}

// Donut 5 kategori terbesar + "Lainnya". Warna mengikuti warna kategori;
// bila dua kategori berwarna sama, warna cadangan dipakai agar tetap terbedakan.
function CategoryDonut({ rows, total, cur, categories }) {
  if (!rows.length || total <= 0) return null;
  const top = rows.slice(0, 5);
  const rest = rows.slice(5).reduce((sum, r) => sum + r.value, 0);
  const used = new Set();
  const slices = [...top.map((r, i) => {
    const cat = categories.find((c) => c.name === r.name);
    let color = HEX[cat?.color] || FALLBACK[i % FALLBACK.length];
    if (used.has(color)) color = FALLBACK.find((c) => !used.has(c)) || color;
    used.add(color);
    return { name: r.name, value: r.value, color, cat };
  }), ...(rest > 0 ? [{ name: "Lainnya", value: rest, color: "#cbd5e1" }] : [])];

  const R = 42, C = 2 * Math.PI * R, GAP = slices.length > 1 ? 2 : 0;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-[116px] h-[116px] shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" role="img" aria-label="Komposisi pengeluaran per kategori">
          <circle cx="50" cy="50" r={R} fill="none" className="stroke-muted" strokeWidth="12" />
          {slices.map((sl) => {
            const len = (sl.value / total) * C;
            const el = (
              <circle key={sl.name} cx="50" cy="50" r={R} fill="none" stroke={sl.color} strokeWidth="12"
                strokeDasharray={`${Math.max(0, len - GAP)} ${C}`} strokeDashoffset={-offset} strokeLinecap="butt" />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[13px] font-bold tabular-nums leading-tight"><Money value={total} currency={cur} format="short" /></span>
          <span className="text-[10px] text-muted-foreground">terpakai</span>
        </div>
      </div>
      <ul className="flex-1 min-w-0 space-y-1.5">
        {slices.map((sl) => (
          <li key={sl.name} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: sl.color }} />
            <span className="flex-1 truncate">{sl.name}</span>
            <span className="tabular-nums text-muted-foreground shrink-0">{((sl.value / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
