import { useEffect, useMemo, useState } from "react";
import { useTransactions, useAssets, useCategories } from "@/hooks/useFinance";
import { formatRupiah, formatRupiahShort, formatNumber, colorMap, formatDate } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import MonthComparison from "@/components/MonthComparison";
import UserContributionChart from "@/components/UserContributionChart";
import AssetGrowthChart from "@/components/AssetGrowthChart";
import { fetchGoldPriceStandard } from "@/lib/goldPrice";
import { useScope } from "@/lib/ScopeContext";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Heart, Coins, Sparkles, AlertCircle, CheckCircle2, Users, Lock, Loader2, Download } from "lucide-react";
import ExpenseTrendAnalysis from "@/components/ExpenseTrendAnalysis";
import { downloadReportPdf } from "@/lib/exportReportPdf";
import { toast } from "sonner";

const chartColors = ["#f97316", "#3b82f6", "#ec4899", "#ef4444", "#14b8a6", "#6366f1", "#8b5cf6", "#64748b"];

export default function Reports() {
  const { data: transactions = [] } = useTransactions();
  const { data: assets = [] } = useAssets();
  const { data: categories = [] } = useCategories();
  const [cursor, setCursor] = useState(new Date());
  const [emasPrice, setEmasPrice] = useState("");
  const { scope, setScope } = useScope();
  const [goldLoading, setGoldLoading] = useState(false);

  useEffect(() => {
    setGoldLoading(true);
    fetchGoldPriceStandard()
      .then((src) => { if (src) setEmasPrice(String(Math.round(src.price_per_gram))); })
      .catch(() => {})
      .finally(() => setGoldLoading(false));
  }, []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthName = formatDate(new Date(year, month, 1), "MMMM yyyy");

  const monthTx = useMemo(
    () => transactions.filter((t) => {
      if (scope === "private" ? t.visibility !== "private" : t.visibility === "private") return false;
      const d = new Date(t.date);
      return d.getMonth() === month && d.getFullYear() === year;
    }),
    [transactions, month, year, scope]
  );

  const scopedAssets = assets.filter((a) => (scope === "private" ? a.visibility === "private" : a.visibility !== "private"));
  const scopedTransactions = transactions.filter((t) => (scope === "private" ? t.visibility === "private" : t.visibility !== "private"));

  const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const sedekah = monthTx.filter((t) => t.type === "sedekah").reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  const byCategory = useMemo(() => {
    const map = {};
    monthTx.filter((t) => t.type === "expense").forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [monthTx]);

  const prevMonth = () => setCursor(new Date(year, month - 1, 1));
  const nextMonth = () => setCursor(new Date(year, month + 1, 1));

  const byCategoryPrev = useMemo(() => {
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    const map = {};
    scopedTransactions.filter((t) => t.type === "expense").forEach((t) => {
      const d = new Date(t.date);
      if (d.getMonth() === pm && d.getFullYear() === py) map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return map;
  }, [scopedTransactions, month, year]);

  const categoryRows = byCategory.map((c) => ({ name: c.name, value: c.value, prev: byCategoryPrev[c.name] || 0 }));

  const [exporting, setExporting] = useState(false);
  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await downloadReportPdf({
        monthName,
        scopeLabel: scope === "private" ? "Pribadi" : "Bersama",
        stats: [
          { label: "Pemasukan", value: formatRupiah(income) },
          { label: "Pengeluaran", value: formatRupiah(expense) },
          { label: "Sedekah", value: formatRupiah(sedekah) },
          { label: "Saldo", value: formatRupiah(balance) },
        ],
        categoryRows,
        transactions: monthTx,
      });
      toast.success("Laporan PDF diunduh");
    } catch {
      toast.error("Gagal membuat PDF");
    } finally {
      setExporting(false);
    }
  };

  // Zakat calculation
  const emasPriceNum = Number(emasPrice) || 0;
  const nisab = emasPriceNum * 85;
  const emasAssets = scopedAssets.filter((a) => a.type === "emas");
  const emasGrams = emasAssets.reduce((s, a) => s + (a.quantity || 0), 0);
  const emasValue = emasPriceNum > 0 ? emasGrams * emasPriceNum : emasAssets.reduce((s, a) => s + (a.value || 0), 0);
  const otherValue = scopedAssets.filter((a) => a.type !== "emas").reduce((s, a) => s + (a.value || 0), 0);
  const totalAset = emasValue + otherValue;
  const emasWajibZakat = emasGrams >= 85;
  const uangWajibZakat = emasPriceNum > 0 && totalAset >= nisab;
  const zakatEmas = emasWajibZakat ? emasValue * 0.025 : 0;
  const zakatUang = uangWajibZakat ? totalAset * 0.025 : 0;

  return (
    <div className="px-5 pt-8 space-y-5">
      <h1 className="text-xl font-semibold">Laporan Keuangan</h1>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
        <button onClick={prevMonth} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><ChevronLeft className="w-5 h-5" /></button>
        <p className="font-medium">{monthName}</p>
        <button onClick={nextMonth} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><ChevronRight className="w-5 h-5" /></button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setScope("shared")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "shared" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Users className="w-4 h-4" /> Bersama
        </button>
        <button onClick={() => setScope("private")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "private" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Lock className="w-4 h-4" /> Pribadi
        </button>
      </div>

      <button
        onClick={handleExportPdf}
        disabled={exporting || monthTx.length === 0}
        className="w-full rounded-2xl border border-border bg-card py-2.5 text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-50"
      >
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Unduh Laporan + Bukti (PDF)
      </button>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={TrendingUp} color="green" label="Pemasukan" value={formatRupiahShort(income)} />
        <StatCard icon={TrendingDown} color="red" label="Pengeluaran" value={formatRupiahShort(expense)} />
        <StatCard icon={Heart} color="teal" label="Sedekah" value={formatRupiahShort(sedekah)} />
        <StatCard icon={Sparkles} color="violet" label="Saldo" value={formatRupiahShort(balance)} />
      </div>

      {byCategory.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-semibold text-sm mb-3">Pengeluaran per Kategori</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatRupiah(v)} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-3">
            {byCategory.map((c, i) => (
              <div key={c.name} className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 rounded-full" style={{ background: chartColors[i % chartColors.length] }} />
                <span className="flex-1 text-muted-foreground">{c.name}</span>
                <span className="font-medium">{formatRupiah(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {scope === "shared" && <UserContributionChart transactions={monthTx} />}

      <MonthComparison transactions={scopedTransactions} categories={categories} year={year} month={month} />

      <ExpenseTrendAnalysis transactions={scopedTransactions} categories={categories} year={year} month={month} />

      <AssetGrowthChart assets={scopedAssets} goldPrice={emasPriceNum} />

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold text-sm mb-1 flex items-center gap-2"><Coins className="w-4 h-4 text-amber-500" /> Kalkulator Zakat</h2>
        <p className="text-xs text-muted-foreground mb-3">Zakat mal 2,5% untuk harta yang mencapai nisab (85 gram emas).</p>

        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-muted-foreground">Harga emas per gram (Rp)</label>
          {goldLoading ? (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> memuat real-time</span>
          ) : emasPriceNum > 0 ? (
            <span className="text-[10px] text-emerald-600 font-medium">real-time</span>
          ) : null}
        </div>
        <input
          type="number"
          value={emasPrice}
          onChange={(e) => setEmasPrice(e.target.value)}
          placeholder="Mis. 1.500.000"
          className="w-full rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary/30 mb-3"
        />

        {emasPriceNum > 0 && (
          <div className="space-y-2 text-sm">
            <Row label="Nisab (85 gr emas)" value={formatRupiah(nisab)} />
            <Row label="Total emas" value={`${formatNumber(emasGrams)} gr (${formatRupiah(emasValue)})`} />
            <Row label="Total aset lain" value={formatRupiah(otherValue)} />
            <div className="border-t border-border my-2" />
            <Row label="Total harta" value={formatRupiah(totalAset)} bold />

            <div className={`rounded-xl p-3 ${emasWajibZakat ? "bg-amber-50 dark:bg-amber-950/30" : "bg-muted"}`}>
              <div className="flex items-center gap-2 mb-1">
                {emasWajibZakat ? <AlertCircle className="w-4 h-4 text-amber-600" /> : <CheckCircle2 className="w-4 h-4 text-muted-foreground" />}
                <span className="text-xs font-medium">Zakat Emas</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {emasWajibZakat ? `Wajib zakat (≥85 gr). Zakat 2,5% = ${formatRupiah(zakatEmas)}` : `Belum wajib (${formatNumber(emasGrams)} gr < 85 gr)`}
              </p>
            </div>

            <div className={`rounded-xl p-3 ${uangWajibZakat ? "bg-amber-50 dark:bg-amber-950/30" : "bg-muted"}`}>
              <div className="flex items-center gap-2 mb-1">
                {uangWajibZakat ? <AlertCircle className="w-4 h-4 text-amber-600" /> : <CheckCircle2 className="w-4 h-4 text-muted-foreground" />}
                <span className="text-xs font-medium">Zakat Simpanan/Uang</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {uangWajibZakat ? `Wajib zakat (≥nisab). Zakat 2,5% = ${formatRupiah(zakatUang)}` : `Belum wajib (total < nisab)`}
              </p>
            </div>
          </div>
        )}
      </div>
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

function Row({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}