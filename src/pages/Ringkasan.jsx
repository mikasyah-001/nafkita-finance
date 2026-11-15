import { useEffect, useMemo, useState } from "react";
import { useTransactions, useCategories, useMe, useRateMap } from "@/hooks/useFinance";
import { formatMoney, formatMoneyShort, formatDate, colorMap, monthlyExpenseBreakdown, inScope, isInMonth, filterReportableTx, formatUnconverted, summarizeConsolidated, convertTo } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import CurrencyTabs from "@/components/CurrencyTabs";
import EmptyState from "@/components/EmptyState";
import { downloadMonthlyReport } from "@/lib/exportReport";
import { toast } from "sonner";
import { useScope } from "@/lib/ScopeContext";
import { Image } from "@/components/ui/image";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, ReceiptText, PieChart, Download, ChevronDown, Share2 } from "lucide-react";
import ScopeToggle from "@/components/ScopeToggle";
import { ListSkeleton } from "@/components/LoadingSkeleton";
import PageHeader from "@/components/PageHeader";
import ShareReportSheet from "@/components/ShareReportSheet";

export default function Ringkasan({ embedded = false }) {
  const { data: transactions = [], isLoading } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: me } = useMe();
  const { map: rateMap } = useRateMap();
  const [cursor, setCursor] = useState(new Date());
  const [expanded, setExpanded] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const { scope, setScope } = useScope();
  const [currency, setCurrency] = useState(me?.default_currency || "IDR");
  useEffect(() => { if (me?.default_currency) setCurrency(me.default_currency); }, [me?.default_currency]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthName = formatDate(new Date(year, month, 1), "MMMM yyyy");

  const { rows, total, prevTotal, count, txList, activeCurs, cur, unconverted } = useMemo(() => {
    // Logika sama persis dengan kartu "Ringkasan Belanja" di Beranda
    // (monthlyExpenseBreakdown): tanpa transfer & transaksi pending/ditolak,
    // semua mata uang dikonversi ke mata uang tampilan.
    const monthCurs = monthlyExpenseBreakdown(transactions, { year, month, scope, currency: "IDR", rateMap }).currencies;
    const activeCurs = [...new Set([...monthCurs, (me?.default_currency || "IDR").toUpperCase()])];
    const cur = activeCurs.includes(currency) ? currency : activeCurs[0];
    const r = monthlyExpenseBreakdown(transactions, { year, month, scope, currency: cur, rateMap });
    const txList = transactions
      .filter((t) => inScope(t, scope) && isInMonth(t, year, month) && filterReportableTx(t))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    return { rows: r.rows, total: r.total, prevTotal: r.prevTotal, count: r.count, txList, activeCurs, cur, unconverted: r.unconverted };
  }, [transactions, scope, year, month, currency, rateMap, me?.default_currency]);

  // Ringkasan & kontribusi per orang untuk gambar laporan (logika sama: transaksi
  // reportable bulan ini, dikonversi ke mata uang tampilan).
  const shareSummary = useMemo(() => summarizeConsolidated(txList, cur, rateMap), [txList, cur, rateMap]);
  const contributors = useMemo(() => {
    const m = {};
    txList.forEach((t) => {
      if (t.transfer_pair_id) return;
      const name = (t.input_by_name || "Keluarga").split(/\s+/)[0];
      const v = convertTo(Number(t.amount) || 0, t.currency || "IDR", cur, rateMap);
      m[name] ||= { name, income: 0, expense: 0 };
      if (t.type === "income") m[name].income += v; else if (t.type === "expense") m[name].expense += v;
    });
    return Object.values(m).sort((a, b) => b.income + b.expense - (a.income + a.expense));
  }, [txList, cur, rateMap]);
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
    <div className={embedded ? "" : "px-5 pt-6"}>
      {!embedded && <PageHeader title="Ringkasan Bulanan" back />}

      <div className="flex items-center justify-between surface p-3 mb-3">
        <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="btn-icon btn-icon-sm"><ChevronLeft className="w-5 h-5" /></button>
        <p className="font-medium text-sm">{monthName}</p>
        <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="btn-icon btn-icon-sm"><ChevronRight className="w-5 h-5" /></button>
      </div>

      <ScopeToggle className="mb-3" />

      {activeCurs.length > 0 && (
        <div className="mb-4"><CurrencyTabs currencies={activeCurs} value={cur} onChange={setCurrency} /></div>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-2 mb-4">
        <button onClick={() => setShareOpen(true)} disabled={txList.length === 0} className="btn-gold !h-11 !rounded-2xl !text-sm">
          <Share2 className="w-4 h-4" /> Bagikan sebagai gambar
        </button>
        <button onClick={handleDownload} disabled={txList.length === 0} aria-label="Unduh laporan CSV" className="btn-secondary !h-11 !px-4 !rounded-2xl !text-sm">
          <Download className="w-4 h-4" /> CSV
        </button>
      </div>

      <ShareReportSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        monthName={monthName}
        scopeLabel={scope === "private" ? "Pribadi" : "Bersama"}
        cur={cur}
        summary={shareSummary}
        rows={rows}
        contributors={contributors}
        extraordinary={0}
      />

      <div className="card-gradient-primary rounded-3xl p-5 mb-4">
        <p className="text-xs opacity-80">Total pengeluaran{activeCurs.length > 1 ? ` (semua mata uang → ${cur})` : ` (${cur})`}</p>
        {formatUnconverted(unconverted) && <p className="text-[11px] mt-1 inline-flex items-center bg-white/15 rounded-full px-2 py-0.5">⚠ Belum termasuk {formatUnconverted(unconverted)} — kurs belum tersedia</p>}
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

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
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
              <div key={r.name} className="surface p-3.5">
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
                    <span className={`text-[11px] font-medium flex items-center gap-0.5 shrink-0 ${diff < 0 ? "text-success" : "text-destructive"}`}>
                      {diff < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}{Math.abs(diffPct).toFixed(0)}%
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${cm.solid}`} style={{ width: `${pct}%` }} />
                </div>
                {r.prev > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 tabular-nums">Bulan lalu {formatMoneyShort(r.prev, cur)} {diff < 0 ? "(turun)" : diff > 0 ? "(naik)" : ""}</p>
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
                            <p className="text-[11px] text-muted-foreground">{formatDate(t.date, "dd MMM, HH:mm")}</p>
                          </div>
                          <p className="text-xs font-semibold tabular-nums shrink-0">{formatMoney(t.amount, t.currency || "IDR")}</p>
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