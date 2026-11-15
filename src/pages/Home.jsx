import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useTransactions, useCategories, useMe, useRefresh, useUserCurrencies, useRateMap, usePendingApprovals, useRecurringBills } from "@/hooks/useFinance";
import { formatDate, summarizeConsolidated, computeSavingsRate, hasRate } from "@/lib/finance";
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
import { ScanLine, ArrowLeftRight, CalendarClock, CheckCheck, TrendingUp, TrendingDown, Heart, ArrowRight, Wallet, Lock, Banknote, Eye, EyeOff, Check, Globe, AlertTriangle } from "lucide-react";
import ScopeToggle from "@/components/ScopeToggle";
import BrandLogo from "@/components/BrandLogo";
import GoalsCarousel from "@/components/GoalsCarousel";
import HomeNudges from "@/components/HomeNudges";
import { usePartnership } from "@/hooks/usePartnership";
import { ListSkeleton, CardSkeleton } from "@/components/LoadingSkeleton";


export default function Home() {
  const { data: me } = useMe();
  const user = me;
  const { scope, setScope } = useScope();
  const { hidden, toggle } = usePrivacy();
  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions();
  const { data: categories = [] } = useCategories();
  const refresh = useRefresh();
  const userCurrencies = useUserCurrencies();
  const { map: rateMap } = useRateMap();
  const { data: approvals } = usePendingApprovals();
  const { data: bills = [] } = useRecurringBills();
  const pendingApprovals = approvals?.pending_approvals?.length || 0;
  const { partners } = usePartnership();

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
  // Mata uang unik dari transaksi bulan berjalan + default user (agar toggle
  // hanya menampilkan mata uang yang relevan, namun default selalu tersedia).
  const monthCurrencies = [...new Set(scopeMonth.map((t) => (t.currency || "IDR").toUpperCase()))];
  const activeCurs = [...new Set([...monthCurrencies, defaultCur])];
  const cur = activeCurs.length ? (activeCurs.includes(currency) ? currency : activeCurs[0]) : currency;
  // Ringkasan konsolidasi: konversi seluruh transaksi scope ke mata uang tampilan.
  const s = useMemo(
    () => summarizeConsolidated(scopeMonth, cur, rateMap, configuredCodes),
    [scopeMonth, cur, rateMap, configuredCodes]
  );
  const savings = computeSavingsRate(s.income, s.expense, s.sedekah);
  // Mata uang yang transaksinya tidak ikut dijumlahkan karena kurs belum ada.
  const excludedCurs = Object.keys(s.unconverted || {});
  const rateMissing = excludedCurs.length > 0 || !hasRate(cur, rateMap);

  // Total konsolidasi: semua mata uang dikonversi ke mata uang utama.
  const consolidatedBalance = useMemo(
    () => summarizeConsolidated(scopeMonth, defaultCur, rateMap, configuredCodes).balance,
    [scopeMonth, defaultCur, rateMap, configuredCodes]
  );
  const hasMultiCurrency = monthCurrencies.length > 1;

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

  // Aksi cepat: hal yang sering DILAKUKAN, bukan pintasan menu (menu sudah ada di nav).
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  // Sama dengan halaman Tagihan: hanya tagihan milik user ini.
  const dueBills = bills.filter((b) => b.created_by_id === user?.id && b.status === "active" && b.next_date && b.next_date <= soon);
  const overdueBills = dueBills.filter((b) => b.next_date < today);

  const firstName = (n) => (n || "").trim().split(/\s+/)[0];
  const myName = firstName(user?.full_name) || "Keluarga";
  const partnerName = firstName(partners?.[0]?.full_name);
  const hello = partnerName ? `Hai, ${myName} & ${partnerName}` : `Hai, ${myName}`;
  const initials = [myName, partnerName].filter(Boolean).map((n) => n[0].toUpperCase());
  const quickChips = [
    { to: "/add?scan=1", icon: ScanLine, label: "Scan struk" },
    { to: "/add?type=income", icon: TrendingUp, label: "Pemasukan" },
    { to: "/add?type=sedekah", icon: Heart, label: "Sedekah" },
    { to: "/transfer", icon: ArrowLeftRight, label: "Transfer" },
    { to: "/tagihan-berulang", icon: CalendarClock, label: overdueBills.length ? `Tagihan · ${overdueBills.length} terlambat` : dueBills.length ? `Tagihan · ${dueBills.length} segera` : "Tagihan", alert: overdueBills.length > 0 },
  ];

  return (
    <div className="px-5 pt-6 pb-6">
      <header className="flex items-center justify-between gap-3 mb-1">
        <BrandLogo variant="mark" markClassName="h-11 w-11 -ml-1" />
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button onClick={toggle} className="btn-icon" aria-label={hidden ? "Tampilkan angka" : "Sembunyikan angka"}>
            {hidden ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
          <Link to="/profil" aria-label="Profil keluarga" className="flex -space-x-2">
            {initials.map((ch, i) => (
              <span key={i} className={`w-9 h-9 rounded-full border-2 border-background flex items-center justify-center text-sm font-bold ${i === 0 ? "bg-gold text-gold-foreground" : "bg-[hsl(var(--pastel-lime))] text-[hsl(var(--pastel-ink))]"}`}>{ch}</span>
            ))}
          </Link>
        </div>
      </header>

      <div className="mb-4">
        <p className="text-xs font-medium text-muted-foreground">{greeting} · {formatDate(now, "EEEE, d MMMM")}</p>
        <h1 className="font-heading text-[26px] leading-tight font-extrabold tracking-tight">{hello} <span aria-hidden="true">👋</span></h1>
        <p className="text-sm text-muted-foreground">Nafkah kita, berkah bersama. Ini cerita {monthLabel}.</p>
      </div>

      <nav aria-label="Aksi cepat" className="-mx-5 px-5 flex gap-2 overflow-x-auto no-scrollbar mb-4">
        {quickChips.map((q) => {
          const Icon = q.icon;
          return (
            <Link key={q.to} to={q.to} className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-[13px] font-semibold transition-colors ${q.alert ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border bg-card text-foreground/85 hover:bg-muted"}`}>
              <Icon className="w-4 h-4" /> {q.label}
            </Link>
          );
        })}
      </nav>

      {pendingApprovals > 0 && (
        <Link to="/persetujuan" className="flex items-center gap-3 surface p-3.5 mb-4 active:scale-[0.98] transition-transform">
          <div className="w-9 h-9 rounded-xl bg-gold/20 flex items-center justify-center shrink-0">
            <CheckCheck className="w-4 h-4 text-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{pendingApprovals} transaksi menunggu persetujuan Anda</p>
            <p className="text-xs text-muted-foreground">Belum dihitung di saldo sampai Anda setujui.</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </Link>
      )}

      {noTransactionsAtAll && (
        <div className="surface p-5 mb-4">
          <h2 className="font-semibold text-base">Selamat datang di NAFKITA</h2>
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

      <ScopeToggle className="mb-3" />

      {hasMultiCurrency && cur !== defaultCur && (
        <div className="surface p-4 mb-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Saldo bulan ini dalam {defaultCur} (semua mata uang)</p>
            <p className="text-xl font-bold tabular-nums break-words"><Money value={consolidatedBalance} currency={defaultCur} /></p>
          </div>
        </div>
      )}

      {transactionsLoading ? <CardSkeleton className="h-48 mb-6" /> : <div className="card-gradient-primary rounded-[28px] p-5 mb-6 relative overflow-hidden">
        <img src="/brand/mark.png" alt="" aria-hidden="true" className="absolute -right-5 -top-3 w-28 opacity-[0.16] rotate-[-8deg] pointer-events-none select-none" />
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white/10 border border-white/10 rounded-full px-2.5 py-1">
            {scope === "private" ? <Lock className="w-3 h-3" /> : <Wallet className="w-3 h-3" />} {scope === "private" ? "Saldo pribadi" : "Saldo bersama"}
          </span>
          <span className="text-[11px] opacity-70">{monthLabel}</span>
        </div>
        <p className="text-xs opacity-75">Sisa uang bulan ini</p>
        <p className="font-heading text-[34px] leading-[1.1] font-extrabold tracking-tight tabular-nums break-words"><Money value={s.balance} currency={cur} /></p>
        {excludedCurs.length > 0 && (
          <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium bg-white/15 rounded-full px-2 py-0.5">
            <AlertTriangle className="w-3 h-3" /> Belum termasuk transaksi {excludedCurs.join(", ")} (kurs belum tersedia)
          </p>
        )}
        {activeCurs.length > 1 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-medium opacity-65">Mata uang yang ditampilkan</p>
              {rateMissing && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gold bg-gold/15 border border-gold/30 rounded-full px-2 py-0.5">
                  <AlertTriangle className="w-3 h-3" /> Kurs belum tersedia
                </span>
              )}
            </div>
            <CurrencyTabs currencies={activeCurs} value={cur} onChange={setCurrency} variant="inverse" />
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { icon: TrendingUp, label: "Pemasukan", value: <Money value={s.income} format="short" currency={cur} /> },
            { icon: TrendingDown, label: "Pengeluaran", value: <Money value={s.expense} format="short" currency={cur} /> },
            { icon: Banknote, label: "Menabung", value: savings.label ? savings.label : `${savings.rate}%` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-2xl bg-white/[0.07] border border-white/10 px-2.5 py-2 min-w-0">
              <div className="flex items-center gap-1 text-[11px] opacity-75"><Icon className="w-3 h-3" /> {label}</div>
              <p className="font-semibold text-sm mt-0.5 tabular-nums truncate">{value}</p>
            </div>
          ))}
        </div>
      </div>}

      <GoalsCarousel />

      {!transactionsLoading && !noTransactionsAtAll && (
        <HomeNudges scope={scope} income={s.income} expense={s.expense} sedekah={s.sedekah} hasExpense={s.expense > 0} hasTodayTx={hasTodayTx} />
      )}

      <MonthlySummary scope={scope} />

      <BudgetBars scope={scope} />

      <div className="flex items-end justify-between mb-2.5 mt-2">
        <div>
          <h2 className="font-semibold text-[17px] leading-tight">Jejak terakhir</h2>
          <p className="text-xs text-muted-foreground">Catatan terbaru keluarga</p>
        </div>
        <Link to="/riwayat" className="text-xs font-medium text-primary flex items-center gap-1">
          Semua <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {transactionsLoading ? <ListSkeleton rows={4} className="mb-4" /> : <div className="surface px-4 mb-4">
        {scopeRecent.length === 0 ? (
          <EmptyState icon={scope === "private" ? Lock : Wallet} title={scope === "private" ? "Belum ada transaksi pribadi" : "Belum ada transaksi"} subtitle="Tekan tombol Catat untuk mencatat pengeluaran atau pemasukan." />
        ) : (
          scopeRecent.map((t) => <TransactionItem key={t.id} tx={t} categories={categories} />)
        )}
      </div>}
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