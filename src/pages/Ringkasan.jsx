import { useEffect, useMemo, useState } from "react";
import { useTransactions, useCategories, useMe } from "@/hooks/useFinance";
import { formatMoney, formatMoneyShort, formatDate, colorMap, summarizeByCurrency, activeCurrencies } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import CurrencyTabs from "@/components/CurrencyTabs";
import EmptyState from "@/components/EmptyState";
import { downloadMonthlyReport } from "@/lib/exportReport";
import { toast } from "sonner";
import { useScope } from "@/lib/ScopeContext";
import { Image } from "@/components/ui/image";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Users, Lock, ReceiptText, PieChart, Download, ChevronDown } from "lucide-react";

export default function Ringkasan() {
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: me } = useMe();
  const [cursor, setCursor] = useState(new Date());
  const [expanded, setExpanded] = useState(null);
  const { scope, setScope } = useScope();
  const [currency, setCurrency] = useState(me?.default_currency || "IDR");
  useEffect(() => { if (me?.default_currency) setCurrency(me.default_currency); }, [me?.default_currency]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthName = formatDate(new Date(year, month, 1), "MMMM yyyy");

  const { rows, total, prevTotal, count, txList, activeCurs, cur } = useMemo(() => {
    // Saring cakupan dulu (tanpa mata uang), lalu tentukan mata uang aktif bulan ini,
    // baru saring berdasarkan mata uang yang dipilih/aktif. Mencegah ketidaksesuaian
    // antara label mata uang dan angka yang sudah dihitung (bug state IDR vs data SAR).
    const scopedAll = transactions.filter((t) => (scope === "private" ? t.visibility === "private" : t.visibility !== "private"));
    const inMonth = (t, y, m) => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m; };
    const monthAll = scopedAll.filter((t) => inMonth(t, year, month));
    const activeCurs = activeCurrencies(summarizeByCurrency(monthAll));
    const cur = activeCurs.length ? (activeCurs.includes(currency) ? currency : activeCurs[0]) : currency;
    const scoped = scopedAll.filter((t) => (t.currency || "IDR") === cur);
    const py = month === 0 ? year - 1 : year;
    const pm = month === 0 ? 11 : month - 1;
    const curExp = scoped.filter((t) => t.type === "expense" && inMonth(t, year, month));
    const prev = scoped.filter((t) => t.type === "expense" && inMonth(t, py, pm));
    const map = {};
    curExp.forEach((t) => {
      if (!map[t.category]) map[t.category] = { value: 0, count: 0 };
      map[t.category].value += t.amount;
      map[t.category].count += 1;
    });
    const prevMap = {};
    prev.forEach((t) => { prevMap[t.category] = (prevMap[t.category] || 0) + t.amount; });
    const total = curExp.reduce((s, t) => s + t.amount, 0);
    const prevTotal = prev.reduce((s, t) => s + t.amount, 0);
    const rows = Object.entries(map)
      .map(([name, v]) => ({ name, value: v.value, count: v.count, prev: prevMap[name] || 0 }))
      .sort((a, b) => b.value - a.value);
    const txList = scoped
      .filter((t) => inMonth(t, year, month))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    return { rows, total, prevTotal, count: curExp.length, txList, activeCurs, cur };
  }, [transactions, scope, year, month, currency]);

  const max = rows.length ? rows[0].value : 0;
  const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const avgPerDay = total / daysInMonth;
  const top = rows[0] || null;
  const riser = rows.length ? rows.filter((r) => r.prev > 0).sort((a, b) => (b.value - b.prev) - (a.value - a.prev))[0] : null;

  const handleDownload = () => {
    downloadMonthlyReport({
      monthName,
      scopeLabel: scope === "private" ? "Pribadi" : "Bersama",
      currency: cur,
      rows, total, prevTotal, avgPerDay, count,
      transactions: txList,
    });
    toast.success("Laporan bulanan diunduh");
  };

  return (
    <div className="px-5 pt-8 pb-4">
      <h1 className="text-xl font-semibold mb-4">Ringkasan Bulanan</h1>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 mb-3">
        <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform"><ChevronLeft className="w-5 h-5" /></button>
        <p className="font-medium text-sm">{monthName}</p>
        <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform"><ChevronRight className="w-5 h-5" /></button>
      </div>

      <div className="flex gap-2 mb-3">
        <button onClick={() => setScope("shared")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "shared" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><Users className="w-4 h-4" /> Bersama</button>
        <button onClick={() => setScope("private")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "private" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><Lock className="w-4 h-4" /> Pribadi</button>
      </div>

      {activeCurs.length > 0 && (
        <div className="mb-4"><CurrencyTabs currencies={activeCurs} value={cur} onChange={setCurrency} /></div>
      )}

      <button
        onClick={handleDownload}
        disabled={txList.length === 0}
        className="w-full mb-4 rounded-2xl border border-border bg-card py-2.5 text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-50"
      >
        <Download className="w-4 h-4" /> Unduh Laporan (CSV)
      </button>

      <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-5 mb-4">
        <p className="text-xs opacity-80">Total pengeluaran ({cur})</p>
        <p className="text-2xl sm:text-3xl font-bold tabular-nums break-words">{formatMoney(total, cur)}</p>
        <div className="flex gap-4 mt-3 text-xs">
          <div className="min-w-0">
            <p className="opacity-80">Rata-rata/hari</p>
            <p className="font-semibold tabular-nums">{formatMoneyShort(avgPerDay, cur)}</p>
          </div>
          <div className="w-px bg-primary-foreground/20" />
          <div className="min-w-0">
            <p className="opacity-80">Transaksi</p>
            <p className="font-semibold tabular-nums">{count}</p>
          </div>
          {prevTotal > 0 && (
            <>
              <div className="w-px bg-primary-foreground/20" />
              <div className="min-w-0">
                <p className="opacity-80">vs bln lalu</p>
                <p className="font-semibold tabular-nums flex items-center gap-1">{delta <= 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}{Math.abs(delta).toFixed(0)}%</p>
              </div>
            </>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Belum ada pengeluaran" subtitle={`Tidak ada catatan pengeluaran ${scope === "private" ? "pribadi" : "bersama"} ${cur} di ${monthName}.`} />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground px-1 flex items-center gap-1.5"><PieChart className="w-3.5 h-3.5" /> {rows.length} kategori • diurut dari terbesar</p>
          {rows.map((r) => {
            const cat = categories.find((c) => c.name === r.name);
            const cm = colorMap[cat?.color] || colorMap.slate;
            const pct = max > 0 ? (r.value / max) * 100 : 0;
            const share = total > 0 ? (r.value / total) * 100 : 0;
            const diff = r.value - r.prev;
            const diffPct = r.prev > 0 ? (diff / r.prev) * 100 : 0;
            const isOpen = expanded === r.name;
            const txs = txList
              .filter((t) => t.category === r.name && t.type === "expense")
              .sort((a, b) => new Date(b.date) - new Date(a.date));
            return (
              <div key={r.name} className="rounded-2xl border border-border bg-card p-3.5">
                <button
                  onClick={() => setExpanded(isOpen ? null : r.name)}
                  className="flex items-center gap-2.5 mb-2 w-full text-left"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cm.bg}`}>
                    <CategoryIcon name={cat?.icon || "Wallet"} className={`w-4 h-4 ${cm.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums truncate">{formatMoney(r.value, cur)} • {share.toFixed(0)}% • {r.count} transaksi</p>
                  </div>
                  {r.prev > 0 && diff !== 0 && (
                    <span className={`text-[10px] font-medium flex items-center gap-0.5 shrink-0 ${diff < 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {diff < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}{Math.abs(diffPct).toFixed(0)}%
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${cm.solid}`} style={{ width: `${pct}%` }} />
                </div>
                {r.prev > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1.5 tabular-nums">Bulan lalu {formatMoneyShort(r.prev, cur)} {diff < 0 ? "(turun)" : diff > 0 ? "(naik)" : ""}</p>
                )}
                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    {txs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Tidak ada transaksi.</p>
                    ) : (
                      txs.map((t) => (
                        <div key={t.id} className="flex items-center gap-2.5">
                          {t.photo_url ? (
                            <Image src={t.photo_url} alt="bukti" className="w-9 h-9 rounded-lg shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-muted shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{t.merchant || t.notes || r.name}</p>
                            <p className="text-[10px] text-muted-foreground">{formatDate(t.date, "dd MMM, HH:mm")}</p>
                          </div>
                          <p className="text-xs font-semibold tabular-nums shrink-0">{formatMoney(t.amount, cur)}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {top && (
            <div className="rounded-2xl bg-muted/50 p-3.5 text-xs text-muted-foreground space-y-1">
              <p>📊 Pengeluaran terbesar: <span className="font-medium text-foreground">{top.name}</span> ({((top.value / total) * 100).toFixed(0)}% dari total).</p>
              {riser && (riser.value - riser.prev) > 0 && (
                <p>📈 Kenaikan terbesar: <span className="font-medium text-foreground">{riser.name}</span> naik {(((riser.value - riser.prev) / riser.prev) * 100).toFixed(0)}% dari bulan lalu.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}