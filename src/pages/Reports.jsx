import { useEffect, useMemo, useState, useCallback } from "react";
import { useTransactions, useAssets, useCategories, useMe, useRefresh } from "@/hooks/useFinance";
import { base44 } from "@/api/base44Client";
import { formatMoney, colorMap, formatDate, summarizeByCurrency, activeCurrencies, convertTo, hasRate, filterReportableTx } from "@/lib/finance";
import CurrencyTabs from "@/components/CurrencyTabs";
import MonthComparison from "@/components/MonthComparison";
import UserContributionChart from "@/components/UserContributionChart";
import AssetGrowthChart from "@/components/AssetGrowthChart";
import { fetchGoldPriceStandard } from "@/lib/goldPrice";
import { useScope } from "@/lib/ScopeContext";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Heart, Coins, Sparkles, Users, Lock, Loader2, Globe, RefreshCw, ArrowRight } from "lucide-react";
import ExpenseTrendAnalysis from "@/components/ExpenseTrendAnalysis";
import ProjectionPanel from "@/components/ProjectionPanel";
import { Link } from "react-router-dom";
import { downloadReportPdf } from "@/lib/exportReportPdf";
import { downloadReportXlsx } from "@/lib/exportReportXlsx";
import { downloadMonthlyReport } from "@/lib/exportReport";
import ExportMenu from "@/components/ExportMenu";
import { useRateMap } from "@/hooks/useFinance";
import { toast } from "sonner";

const chartColors = ["#f97316", "#3b82f6", "#ec4899", "#ef4444", "#14b8a6", "#6366f1", "#8b5cf6", "#64748b"];

export default function Reports() {
  const { data: transactions = [] } = useTransactions();
  const { data: assets = [] } = useAssets();
  const { data: categories = [] } = useCategories();
  const { data: me } = useMe();
  const [cursor, setCursor] = useState(new Date());
  const [periodType, setPeriodType] = useState("monthly");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [emasPrice, setEmasPrice] = useState("");
  const { scope, setScope } = useScope();
  const [goldLoading, setGoldLoading] = useState(false);
  const [currency, setCurrency] = useState(me?.default_currency || "IDR");
  const [consolidated, setConsolidated] = useState(false);
  useEffect(() => { if (me?.default_currency) setCurrency(me.default_currency); }, [me?.default_currency]);
  const { map: rateMap } = useRateMap();

  useEffect(() => {
    setGoldLoading(true);
    fetchGoldPriceStandard()
      .then((src) => { if (src) setEmasPrice(String(Math.round(src.price_per_gram))); })
      .catch(() => {})
      .finally(() => setGoldLoading(false));
  }, []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const periodRange = useMemo(() => {
    if (periodType === "custom") {
      return {
        start: customStart ? new Date(customStart + "T00:00:00.000Z") : null,
        end: customEnd ? new Date(customEnd + "T23:59:59.999Z") : null,
      };
    }
    if (periodType === "yearly") {
      return { start: new Date(year, 0, 1), end: new Date(year, 11, 31, 23, 59, 59, 999) };
    }
    if (periodType === "weekly") {
      const d = new Date(cursor);
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      return { start: monday, end: sunday };
    }
    return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0, 23, 59, 59, 999) };
  }, [periodType, customStart, customEnd, year, month, cursor]);

  const periodLabel = useMemo(() => {
    if (periodType === "custom") {
      const s = customStart ? formatDate(customStart, "dd MMM yyyy") : "?";
      const e = customEnd ? formatDate(customEnd, "dd MMM yyyy") : "?";
      return `${s} — ${e}`;
    }
    if (periodType === "yearly") return String(year);
    if (periodType === "weekly") {
      return `${formatDate(periodRange.start, "dd MMM")} — ${formatDate(periodRange.end, "dd MMM yyyy")}`;
    }
    return formatDate(new Date(year, month, 1), "MMMM yyyy");
  }, [periodType, customStart, customEnd, year, month, periodRange]);

  const periodTxAll = useMemo(
    () => transactions.filter((t) => {
      if (scope === "private" ? t.visibility !== "private" : t.visibility === "private") return false;
      const d = new Date(t.date);
      if (periodRange.start && d < periodRange.start) return false;
      if (periodRange.end && d > periodRange.end) return false;
      return true;
    }),
    [transactions, periodRange, scope]
  );

  const summary = summarizeByCurrency(periodTxAll);
  const activeCurs = activeCurrencies(summary);
  const missingRates = activeCurs.filter((c) => c !== "IDR" && !hasRate(c, rateMap));
  // Saat ada lebih dari satu mata uang aktif, otomatis aktifkan konsolidasi
  // agar tab mata uang menampilkan nilai terkonversi (bukan filter per mata uang).
  useEffect(() => {
    if (activeCurs.length > 1) setConsolidated(true);
  }, [activeCurs.length]);
  const cur = activeCurs.length ? (activeCurs.includes(currency) ? currency : activeCurs[0]) : currency;
  const s = summary[cur] || { income: 0, expense: 0, sedekah: 0, balance: 0, count: 0 };

  const monthTx = periodTxAll.filter((t) => (t.currency || "IDR") === cur);

  const scopedAssets = assets.filter((a) => (scope === "private" ? a.visibility === "private" : a.visibility !== "private"));
  const scopedTransactions = transactions.filter((t) => (scope === "private" ? t.visibility === "private" : t.visibility !== "private"));

  const byCategory = useMemo(() => {
    const map = {};
    monthTx.filter((t) => t.type === "expense" && filterReportableTx(t)).forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [monthTx]);

  const prevPeriod = () => {
    if (periodType === "weekly") { const d = new Date(cursor); d.setDate(d.getDate() - 7); setCursor(d); }
    else if (periodType === "yearly") setCursor(new Date(year - 1, month, 1));
    else setCursor(new Date(year, month - 1, 1));
  };
  const nextPeriod = () => {
    if (periodType === "weekly") { const d = new Date(cursor); d.setDate(d.getDate() + 7); setCursor(d); }
    else if (periodType === "yearly") setCursor(new Date(year + 1, month, 1));
    else setCursor(new Date(year, month + 1, 1));
  };

  const byCategoryPrev = useMemo(() => {
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    const map = {};
    scopedTransactions.filter((t) => t.type === "expense" && filterReportableTx(t) && (t.currency || "IDR") === cur).forEach((t) => {
      const d = new Date(t.date);
      if (d.getMonth() === pm && d.getFullYear() === py) map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return map;
  }, [scopedTransactions, month, year, cur]);

  const categoryRows = byCategory.map((c) => ({ name: c.name, value: c.value, prev: byCategoryPrev[c.name] || 0 }));

  // Konsolidasi multi-mata uang: konversi semua transaksi ke cur menggunakan kurs historis.
  const convertAmount = useCallback((amount, fromCur) => convertTo(amount, fromCur, cur, rateMap), [rateMap, cur]);

  const consolidatedSummary = useMemo(() => {
    if (!consolidated) return null;
    let income = 0, expense = 0, sedekah = 0, count = 0;
    periodTxAll.forEach((t) => {
      if (t.transfer_pair_id) return;
      if (t.approval_status && t.approval_status !== "approved") return;
      const amt = convertAmount(Number(t.amount) || 0, (t.currency || "IDR").toUpperCase());
      if (t.type === "income") income += amt;
      else if (t.type === "expense") expense += amt;
      else if (t.type === "sedekah") sedekah += amt;
      count += 1;
    });
    return { income, expense, sedekah, balance: income - expense - sedekah, count };
  }, [consolidated, periodTxAll, convertAmount]);

  const consolidatedByCategory = useMemo(() => {
    if (!consolidated) return [];
    const map = {};
    periodTxAll.filter((t) => t.type === "expense" && filterReportableTx(t)).forEach((t) => {
      const amt = convertAmount(Number(t.amount) || 0, (t.currency || "IDR").toUpperCase());
      map[t.category] = (map[t.category] || 0) + amt;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [consolidated, periodTxAll, convertAmount]);

  // Transaksi terkonversi ke cur untuk komponen grafik saat konsolidasi aktif.
  // Saat tidak konsolidasi, kembalikan data terfilter per mata uang (perilaku lama).
  const displayMonthTx = useMemo(() => {
    if (!consolidated) return monthTx;
    return periodTxAll.map((t) => ({
      ...t,
      amount: convertAmount(Number(t.amount) || 0, (t.currency || "IDR").toUpperCase()),
      currency: cur,
    }));
  }, [consolidated, monthTx, periodTxAll, convertAmount, cur]);

  const displayScopedTx = useMemo(() => {
    if (!consolidated) return scopedTransactions.filter((t) => (t.currency || "IDR") === cur);
    return scopedTransactions.map((t) => ({
      ...t,
      amount: convertAmount(Number(t.amount) || 0, (t.currency || "IDR").toUpperCase()),
      currency: cur,
    }));
  }, [consolidated, scopedTransactions, convertAmount, cur]);

  const [exporting, setExporting] = useState(false);
  const [fetchingRates, setFetchingRates] = useState(false);
  const refresh = useRefresh();

  const handleFetchRates = async () => {
    setFetchingRates(true);
    try {
      await base44.functions.invoke("fetchExchangeRates", { target_currencies: activeCurs });
      toast.success("Kurs berhasil dimuat");
      refresh();
    } catch {
      toast.error("Gagal mengambil kurs");
    } finally {
      setFetchingRates(false);
    }
  };

  // Otomatis ambil kurs saat konsolidasi aktif tapi belum ada kurs tersimpan.
  useEffect(() => {
    if (consolidated && missingRates.length > 0 && activeCurs.length > 1 && !fetchingRates) {
      handleFetchRates();
    }
  }, [consolidated, missingRates.length, activeCurs.length, currency]);

  const exportStats = consolidated && consolidatedSummary
    ? [
        { label: "Pemasukan", value: formatMoney(consolidatedSummary.income, cur) },
        { label: "Pengeluaran", value: formatMoney(consolidatedSummary.expense, cur) },
        { label: "Sedekah", value: formatMoney(consolidatedSummary.sedekah, cur) },
        { label: "Saldo", value: formatMoney(consolidatedSummary.balance, cur) },
      ]
    : [
        { label: "Pemasukan", value: formatMoney(s.income, cur) },
        { label: "Pengeluaran", value: formatMoney(s.expense, cur) },
        { label: "Sedekah", value: formatMoney(s.sedekah, cur) },
        { label: "Saldo", value: formatMoney(s.balance, cur) },
      ];
  const exportCategoryRows = consolidated ? consolidatedByCategory.map((c) => ({ ...c, prev: 0 })) : categoryRows;
  const exportTransactions = consolidated ? displayMonthTx : monthTx;

  const handleExportPdf = async (withProof = true) => {
    setExporting(true);
    try {
      await downloadReportPdf({
        monthName: periodLabel,
        scopeLabel: scope === "private" ? "Pribadi" : "Bersama",
        currency: cur,
        stats: exportStats,
        categoryRows: exportCategoryRows,
        transactions: exportTransactions,
        withProof,
      });
      toast.success(`Laporan PDF diunduh${withProof ? " (dengan bukti)" : " (ringkas)"}`);
    } catch {
      toast.error("Gagal membuat PDF");
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = () => {
    try {
      downloadMonthlyReport({
        monthName: periodLabel,
        scopeLabel: scope === "private" ? "Pribadi" : "Bersama",
        currency: cur,
        rows: exportCategoryRows,
        total: consolidated ? consolidatedSummary?.expense || 0 : s.expense,
        prevTotal: 0,
        avgPerDay: 0,
        count: consolidated ? consolidatedSummary?.count || 0 : monthTx.length,
        transactions: exportTransactions,
      });
      toast.success("Laporan CSV diunduh");
    } catch {
      toast.error("Gagal membuat CSV");
    }
  };

  const handleExportXlsx = () => {
    try {
      downloadReportXlsx({
        monthName: periodLabel,
        scopeLabel: scope === "private" ? "Pribadi" : "Bersama",
        currency: cur,
        stats: exportStats,
        categoryRows: exportCategoryRows,
        transactions: exportTransactions,
      });
      toast.success("Laporan Excel diunduh");
    } catch {
      toast.error("Gagal membuat Excel");
    }
  };

  // Harga emas dipakai AssetGrowthChart; kalkulator zakat pindah ke halaman /zakat.
  const emasPriceNum = Number(emasPrice) || 0;

  return (
    <div className="px-5 pt-8 space-y-5">
      <h1 className="text-xl font-semibold">Laporan Keuangan</h1>

      <div className="flex gap-1.5 bg-muted p-1 rounded-2xl">
        {[["weekly","Mingguan"],["monthly","Bulanan"],["yearly","Tahunan"],["custom","Rentang"]].map(([val, label]) => (
          <button key={val} onClick={() => setPeriodType(val)} className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-colors ${periodType === val ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>{label}</button>
        ))}
      </div>

      {periodType === "custom" ? (
        <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Dari</label>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Sampai</label>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30" />
            </div>
          </div>
          {!customStart && !customEnd && <p className="text-[10px] text-muted-foreground text-center">Pilih rentang tanggal untuk melihat laporan</p>}
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
          <button onClick={prevPeriod} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><ChevronLeft className="w-5 h-5" /></button>
          <p className="font-medium">{periodLabel}</p>
          <button onClick={nextPeriod} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><ChevronRight className="w-5 h-5" /></button>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => setScope("shared")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "shared" ? "bg-scope-shared text-scope-shared-foreground" : "bg-muted text-muted-foreground"}`}>
          <Users className="w-4 h-4" /> Bersama
        </button>
        <button onClick={() => setScope("private")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "private" ? "bg-scope-private text-scope-private-foreground" : "bg-muted text-muted-foreground"}`}>
          <Lock className="w-4 h-4" /> Pribadi
        </button>
      </div>

      {activeCurs.length > 0 && (
        <div><CurrencyTabs currencies={activeCurs} value={cur} onChange={(c) => { setCurrency(c); setConsolidated(true); }} /></div>
      )}

      {activeCurs.length > 1 && (
        <button
          onClick={() => setConsolidated(!consolidated)}
          className={`w-full rounded-2xl border py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${consolidated ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"}`}
        >
          <Globe className="w-4 h-4" /> Konsolidasi ke {cur} {consolidated ? "✓" : ""}
        </button>
      )}

      {consolidated && missingRates.length > 0 && (
        <button
          onClick={handleFetchRates}
          disabled={fetchingRates}
          className="w-full rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center justify-center gap-2"
        >
          {fetchingRates ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {fetchingRates ? "Mengambil kurs..." : `Muat Kurs (${missingRates.join(", ")})`}
        </button>
      )}

      <ExportMenu
        onPdfNoProof={() => handleExportPdf(false)}
        onPdfWithProof={() => handleExportPdf(true)}
        onCsv={handleExportCsv}
        onXlsx={handleExportXlsx}
        disabled={consolidated ? !consolidatedSummary || consolidatedSummary.count === 0 : monthTx.length === 0}
        busy={exporting}
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={TrendingUp} color="green" label="Pemasukan" value={formatMoney((consolidated ? consolidatedSummary?.income : s.income) || 0, cur)} />
        <StatCard icon={TrendingDown} color="red" label="Pengeluaran" value={formatMoney((consolidated ? consolidatedSummary?.expense : s.expense) || 0, cur)} />
        <StatCard icon={Heart} color="teal" label="Sedekah" value={formatMoney((consolidated ? consolidatedSummary?.sedekah : s.sedekah) || 0, cur)} />
        <StatCard icon={Sparkles} color="violet" label="Saldo" value={formatMoney((consolidated ? consolidatedSummary?.balance : s.balance) || 0, cur)} />
      </div>

      <ProjectionPanel scope={scope} />

      {(consolidated ? consolidatedByCategory : byCategory).length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-semibold text-sm mb-3">Pengeluaran per Kategori ({cur}){consolidated ? " • Konsolidasi" : ""}</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={consolidated ? consolidatedByCategory : byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {(consolidated ? consolidatedByCategory : byCategory).map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatMoney(v, cur)} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-3">
            {(consolidated ? consolidatedByCategory : byCategory).map((c, i) => (
              <div key={c.name} className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 rounded-full" style={{ background: chartColors[i % chartColors.length] }} />
                <span className="flex-1 text-muted-foreground">{c.name}</span>
                <span className="font-medium">{formatMoney(c.value, cur)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {scope === "shared" && <UserContributionChart transactions={displayMonthTx} currency={cur} />}

      <MonthComparison transactions={displayScopedTx} categories={categories} year={year} month={month} currency={cur} />

      <ExpenseTrendAnalysis transactions={displayScopedTx} categories={categories} year={year} month={month} currency={cur} />

      <AssetGrowthChart assets={scopedAssets} goldPrice={emasPriceNum} currency={cur} rateMap={rateMap} />

      <Link to="/zakat" className="flex items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 p-4 active:scale-[0.99] transition-transform">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
          <Coins className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Kelola Zakat</p>
          <p className="text-xs text-muted-foreground">Kalkulator nisab, pengingat & pembayaran zakat mal</p>
        </div>
        <ArrowRight className="w-4 h-4 text-emerald-600 shrink-0" />
      </Link>
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value }) {
  const cm = colorMap[color] || colorMap.slate;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${cm.bg}`}>
        <Icon className={`w-4 h-4 ${cm.text}`} />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-sm mt-0.5 tabular-nums truncate">{value}</p>
    </div>
  );
}