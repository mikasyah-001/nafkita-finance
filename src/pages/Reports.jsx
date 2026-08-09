import { useMemo, useState } from "react";
import { useTransactions, useAssets, useCategories } from "@/hooks/useFinance";
import { formatRupiah, formatNumber, colorMap, formatDate } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import MonthComparison from "@/components/MonthComparison";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Heart, Coins, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";

const chartColors = ["#f97316", "#3b82f6", "#ec4899", "#ef4444", "#14b8a6", "#6366f1", "#8b5cf6", "#64748b"];

export default function Reports() {
  const { data: transactions = [] } = useTransactions();
  const { data: assets = [] } = useAssets();
  const { data: categories = [] } = useCategories();
  const [cursor, setCursor] = useState(new Date());
  const [emasPrice, setEmasPrice] = useState("");

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthName = formatDate(new Date(year, month, 1), "MMMM yyyy");

  const monthTx = useMemo(
    () => transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === month && d.getFullYear() === year;
    }),
    [transactions, month, year]
  );

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

  // Zakat calculation
  const emasPriceNum = Number(emasPrice) || 0;
  const nisab = emasPriceNum * 85;
  const emasAssets = assets.filter((a) => a.type === "emas");
  const emasGrams = emasAssets.reduce((s, a) => s + (a.quantity || 0), 0);
  const emasValue = emasAssets.reduce((s, a) => s + (a.value || 0), 0);
  const otherValue = assets.filter((a) => a.type !== "emas").reduce((s, a) => s + (a.value || 0), 0);
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

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={TrendingUp} color="green" label="Pemasukan" value={formatRupiah(income)} />
        <StatCard icon={TrendingDown} color="red" label="Pengeluaran" value={formatRupiah(expense)} />
        <StatCard icon={Heart} color="teal" label="Sedekah" value={formatRupiah(sedekah)} />
        <StatCard icon={Sparkles} color="violet" label="Saldo" value={formatRupiah(balance)} />
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

      <MonthComparison transactions={transactions} categories={categories} year={year} month={month} />

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold text-sm mb-1 flex items-center gap-2"><Coins className="w-4 h-4 text-amber-500" /> Kalkulator Zakat</h2>
        <p className="text-xs text-muted-foreground mb-3">Zakat mal 2,5% untuk harta yang mencapai nisab (85 gram emas).</p>

        <label className="text-xs text-muted-foreground block mb-1.5">Harga emas per gram (Rp)</label>
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
      <p className="font-semibold text-sm mt-0.5">{value}</p>
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