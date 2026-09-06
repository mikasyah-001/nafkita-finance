import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useTransactions, useCategories, useMe, useRefresh, useUserCurrencies } from "@/hooks/useFinance";
import { formatMoneyShort, formatDate, summarizeByCurrency, computeSavingsRate, activeCurrencies } from "@/lib/finance";
import { toast } from "sonner";
import TransactionItem from "@/components/TransactionItem";
import EmptyState from "@/components/EmptyState";
import BudgetBars from "@/components/BudgetBars";
import MonthlySummary from "@/components/MonthlySummary";
import CurrencyTabs from "@/components/CurrencyTabs";
import Money from "@/components/Money";
import NotificationBell from "@/components/NotificationBell";
import { usePrivacy } from "@/lib/PrivacyContext";
import { useScope } from "@/lib/ScopeContext";
import { Settings, TrendingUp, TrendingDown, Heart, ArrowRight, Wallet, Sparkles, Bell, Target, Lock, Users, Landmark, Banknote, Eye, EyeOff, Check } from "lucide-react";

const linkColors = {
  violet: "bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400",
  indigo: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400",
  amber: "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
  teal: "bg-teal-100 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400",
};

export default function Home() {
  const { data: me } = useMe();
  const user = me;
  const { scope, setScope } = useScope();
  const { hidden, toggle } = usePrivacy();
  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions();
  const { data: categories = [] } = useCategories();
  const refresh = useRefresh();
  const userCurrencies = useUserCurrencies();

  const defaultCur = user?.default_currency || "IDR";
  const [currency, setCurrency] = useState(defaultCur);
  useEffect(() => { setCurrency(defaultCur); }, [defaultCur]);

  const now = new Date();
  const monthLabel = formatDate(now, "MMMM yyyy");
  const monthTx = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const sharedMonth = monthTx.filter((t) => t.visibility !== "private");
  const privateMonth = monthTx.filter((t) => t.visibility === "private");
  const scopeMonth = scope === "private" ? privateMonth : sharedMonth;

  const configuredCodes = userCurrencies.map((c) => c.code);
  const summary = summarizeByCurrency(scopeMonth, configuredCodes);
  // Selalu tampilkan mata uang aktif akun; tambahkan mata uang historis yang
  // masih punya transaksi agar data lama tetap dapat dibaca.
  const activeCurs = [...new Set([...configuredCodes, ...activeCurrencies(summary)])];
  const cur = activeCurs.length ? (activeCurs.includes(currency) ? currency : activeCurs[0]) : currency;
  const s = summary[cur] || { income: 0, expense: 0, sedekah: 0, balance: 0, count: 0 };
  const savings = computeSavingsRate(s.income, s.expense, s.sedekah);

  const scopeRecent = transactions.filter((t) => (scope === "private" ? t.visibility === "private" : t.visibility !== "private")).slice(0, 5);

  const hasTodayTx = transactions.some((t) => {
    const inScope = scope === "private" ? t.visibility === "private" : t.visibility !== "private";
    const d = new Date(t.date);
    return inScope && d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const noTransactionsAtAll = !transactionsLoading && transactions.length === 0;

  const loadSampleData = async () => {
    try {
      const cur = defaultCur;
      const amt = (idr, sar, usd) => (cur === "SAR" ? sar : cur === "USD" ? usd : idr);
      const now = new Date();
      const d = (offset) => { const x = new Date(now); x.setDate(x.getDate() - offset); x.setHours(10, 0, 0, 0); return x.toISOString(); };
      const name = user?.full_name || "Saya";
      const batchId = "sample-" + Date.now();
      await base44.entities.Transaction.bulkCreate([
        { type: "income", amount: amt(8000000, 8000, 2000), currency: cur, category: "Gaji", date: d(3), merchant: "", notes: "Data contoh", visibility: "shared", input_by_name: name, tags: [], notif_batch_id: batchId },
        { type: "expense", amount: amt(50000, 50, 15), currency: cur, category: "Makanan", date: d(2), merchant: "Restoran", notes: "Data contoh", visibility: "shared", input_by_name: name, tags: [], notif_batch_id: batchId },
        { type: "expense", amount: amt(120000, 120, 35), currency: cur, category: "Belanja", date: d(1), merchant: "Pasar", notes: "Data contoh", visibility: "shared", input_by_name: name, tags: [], notif_batch_id: batchId },
        { type: "sedekah", amount: amt(100000, 100, 25), currency: cur, category: "Sedekah & Infaq", date: d(0), merchant: "", notes: "Data contoh", visibility: "shared", input_by_name: name, tags: [], notif_batch_id: batchId },
      ]);
      refresh();
      toast.success("Data contoh dimuat", { description: "4 transaksi contoh ditambahkan." });
    } catch {
      toast.error("Gagal memuat data contoh");
    }
  };

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
    { to: "/add?type=sedekah", icon: Heart, color: "teal", label: "Sedekah", sub: `${formatMoneyShort(s.sedekah, cur)} bulan ini` },
  ];

  return (
    <div className="px-5 pt-8 pb-6">
      <header className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm text-muted-foreground">{greeting},</p>
          <h1 className="text-lg font-semibold">{user?.full_name || user?.email || "Keluarga"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button onClick={toggle} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform" aria-label="Sembunyikan angka">
            {hidden ? <EyeOff className="w-5 h-5 text-muted-foreground" /> : <Eye className="w-5 h-5 text-muted-foreground" />}
          </button>
          <Link to="/pengaturan" className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <Settings className="w-5 h-5 text-muted-foreground" />
          </Link>
        </div>
      </header>

      {!transactionsLoading && !hasTodayTx && !noTransactionsAtAll && (
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

      {noTransactionsAtAll && (
        <div className="rounded-2xl border border-border bg-card p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-sm">Selamat datang di NAFKITA!</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Mulai kelola keuangan keluarga dalam 3 langkah singkat.</p>
          <div className="space-y-2.5">
            <OnboardingStep to="/pengaturan" icon={Wallet} title="Pilih mata uang utama" desc="Aktifkan mata uang yang Anda gunakan di Pengaturan." />
            <OnboardingStep to="/add" icon={Check} title="Catat transaksi pertama" desc="Pengeluaran, pemasukan, atau sedekah." />
            <OnboardingStep to="/sambungkan-pasangan" icon={Heart} title="Hubungkan pasangan" desc="Catat bersama suami/istri." />
          </div>
          <button onClick={loadSampleData} className="w-full mt-3 py-2.5 rounded-xl bg-muted text-xs font-medium text-muted-foreground active:scale-[0.99] transition-transform">
            Muat data contoh untuk eksplorasi
          </button>
        </div>
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
        <p className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums break-words"><Money value={s.balance} currency={cur} /></p>
        {activeCurs.length > 1 && (
          <div className="mt-3">
            <p className="text-[10px] font-medium text-white/65 mb-1.5">Mata uang yang ditampilkan</p>
            <CurrencyTabs currencies={activeCurs} value={cur} onChange={setCurrency} variant="inverse" />
          </div>
        )}
        <div className="flex gap-3 mt-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs opacity-80">
              <TrendingUp className="w-3.5 h-3.5" /> Pemasukan
            </div>
            <p className="font-semibold text-sm mt-0.5 tabular-nums truncate"><Money value={s.income} format="short" currency={cur} /></p>
          </div>
          <div className="w-px bg-primary-foreground/20" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs opacity-80">
              <TrendingDown className="w-3.5 h-3.5" /> Pengeluaran
            </div>
            <p className="font-semibold text-sm mt-0.5 tabular-nums truncate"><Money value={s.expense} format="short" currency={cur} /></p>
          </div>
          <div className="w-px bg-primary-foreground/20" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs opacity-80">
              <Banknote className="w-3.5 h-3.5" /> Menabung
            </div>
            <p className="font-semibold text-sm mt-0.5 tabular-nums">{savings.label ? savings.label : `${savings.rate}%`}</p>
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

      <MonthlySummary scope={scope} />

      <BudgetBars scope={scope} />

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
    </div>
  );
}

function OnboardingStep({ to, icon: Icon, title, desc }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl border border-border p-3 active:scale-[0.99] transition-transform">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground" />
    </Link>
  );
}