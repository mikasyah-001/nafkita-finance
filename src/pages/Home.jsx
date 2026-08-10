import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useTransactions, useCategories } from "@/hooks/useFinance";
import { formatRupiah, formatRupiahShort, formatDate } from "@/lib/finance";
import TransactionItem from "@/components/TransactionItem";
import EmptyState from "@/components/EmptyState";
import BudgetBars from "@/components/BudgetBars";
import ZakatNotifier from "@/components/ZakatNotifier";
import AssetGrowthTrend from "@/components/AssetGrowthTrend";
import { Settings, TrendingUp, TrendingDown, Heart, ArrowRight, Wallet, Sparkles, Bell, Target, Lock, Users, Landmark, PiggyBank } from "lucide-react";

const linkColors = {
  violet: "bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400",
  indigo: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400",
  amber: "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
  teal: "bg-teal-100 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400",
};

export default function Home() {
  const [user, setUser] = useState(null);
  const [scope, setScope] = useState("shared");
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const now = new Date();
  const monthLabel = formatDate(now, "MMMM yyyy");
  const monthTx = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const sharedMonth = monthTx.filter((t) => t.visibility !== "private");
  const privateMonth = monthTx.filter((t) => t.visibility === "private");
  const scopeMonth = scope === "private" ? privateMonth : sharedMonth;
  const income = scopeMonth.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = scopeMonth.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const sedekah = scopeMonth.filter((t) => t.type === "sedekah").reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const savingsRate = income > 0 ? Math.round((balance / income) * 100) : 0;
  const scopeRecent = transactions.filter((t) => (scope === "private" ? t.visibility === "private" : t.visibility !== "private")).slice(0, 5);

  const hasTodayTx = transactions.some((t) => {
    const d = new Date(t.date);
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const greeting = (() => {
    const h = now.getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 19) return "Selamat sore";
    return "Selamat malam";
  })();

  const quickLinks = [
    { to: "/laporan", icon: Sparkles, color: "violet", label: "Laporan", sub: "Bulanan & zakat" },
    { to: "/anggaran", icon: Target, color: "indigo", label: "Anggaran", sub: "Target per kategori" },
    { to: "/aset", icon: Landmark, color: "amber", label: "Aset", sub: "Kekayaan keluarga" },
    { to: "/add", icon: Heart, color: "teal", label: "Sedekah", sub: `${formatRupiahShort(sedekah)} bulan ini` },
  ];

  return (
    <div className="px-5 pt-8 pb-6">
      <header className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm text-muted-foreground">{greeting},</p>
          <h1 className="text-lg font-semibold">{user?.full_name || user?.email || "Keluarga"}</h1>
        </div>
        <Link to="/pengaturan" className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </Link>
      </header>

      {!hasTodayTx && (
        <Link to="/add" className="flex items-center gap-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 p-3.5 mb-4 active:scale-[0.98] transition-transform">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Pengingat harian</p>
            <p className="text-xs text-amber-700/80 dark:text-amber-300/70">Belum ada transaksi dicatat hari ini. Yuk catat sekarang!</p>
          </div>
          <ArrowRight className="w-4 h-4 text-amber-600" />
        </Link>
      )}

      <div className="flex gap-2 mb-4">
        <button onClick={() => setScope("shared")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "shared" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Users className="w-4 h-4" /> Bersama
        </button>
        <button onClick={() => setScope("private")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "private" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Lock className="w-4 h-4" /> Pribadi
        </button>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-5 shadow-lg mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs opacity-80">{scope === "private" ? "Saldo pribadi •" : "Saldo bersama •"} {monthLabel}</span>
          {scope === "private" ? <Lock className="w-4 h-4 opacity-80" /> : <Wallet className="w-4 h-4 opacity-80" />}
        </div>
        <p className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums break-words">{formatRupiah(balance)}</p>
        <div className="flex gap-3 mt-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs opacity-80">
              <TrendingUp className="w-3.5 h-3.5" /> Pemasukan
            </div>
            <p className="font-semibold text-sm mt-0.5 tabular-nums truncate">{formatRupiahShort(income)}</p>
          </div>
          <div className="w-px bg-primary-foreground/20" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs opacity-80">
              <TrendingDown className="w-3.5 h-3.5" /> Pengeluaran
            </div>
            <p className="font-semibold text-sm mt-0.5 tabular-nums truncate">{formatRupiahShort(expense)}</p>
          </div>
          <div className="w-px bg-primary-foreground/20" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs opacity-80">
              <PiggyBank className="w-3.5 h-3.5" /> Menabung
            </div>
            <p className="font-semibold text-sm mt-0.5 tabular-nums">{savingsRate}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {quickLinks.map((q) => {
          const Icon = q.icon;
          return (
            <Link key={q.to} to={q.to} className="rounded-2xl border border-border bg-card p-4 active:scale-[0.98] transition-transform flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${linkColors[q.color]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{q.label}</p>
                <p className="text-xs text-muted-foreground truncate">{q.sub}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <BudgetBars scope={scope} />

      <AssetGrowthTrend />

      <div className="flex items-center justify-between mb-2 mt-2">
        <h2 className="font-semibold">Transaksi terbaru</h2>
        <Link to="/riwayat" className="text-xs text-muted-foreground flex items-center gap-1">
          Semua <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card px-4 mb-4">
        {scopeRecent.length === 0 ? (
          <EmptyState icon={scope === "private" ? Lock : Wallet} title={scope === "private" ? "Belum ada transaksi pribadi" : "Belum ada transaksi"} subtitle="Tekan tombol + untuk mencatat pengeluaran atau pemasukan." />
        ) : (
          scopeRecent.map((t) => <TransactionItem key={t.id} tx={t} categories={categories} />)
        )}
      </div>

      <ZakatNotifier />
    </div>
  );
}