import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useTransactions, useCategories, useMe, useRefresh, useUserCurrencies, useRateMap, usePendingApprovals, useRecurringBills, useBudgets, useIncomingTransactions } from "@/hooks/useFinance";
import { formatDate, summarizeConsolidated, computeSavingsRate, hasRate, monthlyPlan, planProgress, spendingPace } from "@/lib/finance";
import { toast } from "sonner";
import TransactionItem from "@/components/TransactionItem";
import EmptyState from "@/components/EmptyState";
import CurrencyTabs from "@/components/CurrencyTabs";
import Money from "@/components/Money";
import NotificationBell from "@/components/NotificationBell";
import { usePrivacy } from "@/lib/PrivacyContext";
import { useScope } from "@/lib/ScopeContext";
import { CalendarClock, CheckCheck, TrendingUp, Heart, ArrowRight, Wallet, Lock, Banknote, Eye, EyeOff, Check, Globe, AlertTriangle, Zap } from "lucide-react";
import ScopeToggle from "@/components/ScopeToggle";
import BrandLogo from "@/components/BrandLogo";
import AccountWallet from "@/components/AccountWallet";
import MonthlySummary from "@/components/MonthlySummary";
import { usePartnership } from "@/hooks/usePartnership";
import { ListSkeleton, CardSkeleton } from "@/components/LoadingSkeleton";
import { usePullToRefresh, PullToRefreshIndicator } from "@/hooks/usePullToRefresh";


export default function Home() {
  const { data: me } = useMe();
  const user = me;
  const { scope } = useScope();
  const { hidden, toggle } = usePrivacy();
  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions();
  const { data: categories = [] } = useCategories();
  const refresh = useRefresh();
  const ptr = usePullToRefresh(refresh);
  const userCurrencies = useUserCurrencies();
  const { map: rateMap } = useRateMap();
  const { data: approvals } = usePendingApprovals();
  const { data: bills = [] } = useRecurringBills();
  const { data: budgets = [] } = useBudgets();
  const pendingApprovals = approvals?.pending_approvals?.length || 0;
  const { data: incoming = [] } = useIncomingTransactions();
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
  const plan = monthlyPlan(budgets, { period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, scope, currency: cur });
  const savingsPlan = planProgress(s.balance, plan.savings);
  // Jatah belanja per hari: sisa anggaran ÷ hari tersisa (lihat spendingPace).
  const pace = spendingPace({ income: s.income, expense: s.expense, sedekah: s.sedekah, planIncome: plan.income, planSavings: plan.savings, now });
  // Mata uang yang transaksinya tidak ikut dijumlahkan karena kurs belum ada.
  const excludedCurs = Object.keys(s.unconverted || {});
  const rateMissing = excludedCurs.length > 0 || !hasRate(cur, rateMap);

  // Total konsolidasi: semua mata uang dikonversi ke mata uang utama.
  const consolidatedBalance = useMemo(
    () => summarizeConsolidated(scopeMonth, defaultCur, rateMap, configuredCodes).balance,
    [scopeMonth, defaultCur, rateMap, configuredCodes]
  );
  const hasMultiCurrency = monthCurrencies.length > 1;

  const scopeRecent = transactions.filter((t) => (scope === "private" ? t.visibility === "private" : t.visibility !== "private")).slice(0, 3);

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
  // Hal yang menunggu tindakan — menggantikan banner terpisah & chip aksi cepat.
  const attention = [
    pendingApprovals > 0 && { to: "/persetujuan", icon: CheckCheck, tone: "bg-gold/20 text-foreground", label: `${pendingApprovals} menunggu persetujuan Anda` },
    incoming.length > 0 && { to: "/catat-otomatis", icon: Zap, tone: "bg-primary/10 text-primary", label: `${incoming.length} transaksi Apple Pay baru` },
    dueBills.length > 0 && { to: "/tagihan-berulang", icon: CalendarClock, tone: overdueBills.length ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-warning", label: overdueBills.length ? `${overdueBills.length} tagihan terlambat` : `${dueBills.length} tagihan segera jatuh tempo` },
  ].filter(Boolean);

  return (
    <div className="px-5 pt-6 pb-6">
      <PullToRefreshIndicator pull={ptr.pull} refreshing={ptr.refreshing} threshold={ptr.threshold} />
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
      </div>

      {/* Perlu tindakan: satu daftar ringkas, hanya muncul bila ada */}
      {attention.length > 0 && (
        <div className="surface divide-y divide-border mb-4" role="list" aria-label="Perlu tindakan">
          {attention.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.to} to={a.to} role="listitem" className="flex items-center gap-3 px-3.5 py-3 active:bg-muted/60 transition-colors">
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${a.tone}`}><Icon className="w-4 h-4" /></span>
                <span className="flex-1 min-w-0 text-sm font-semibold truncate">{a.label}</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </Link>
            );
          })}
        </div>
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

      <ScopeToggle className="mb-4" />

      <AccountWallet scope={scope} />

      {/* Bulan ini — ringkas; rincian ada di Laporan & Anggaran */}
      {transactionsLoading ? <CardSkeleton className="h-36 mb-6" /> : (
        <section className="surface rounded-3xl p-4 mb-6" aria-labelledby="bulan-ini-title">
          <div className="flex items-center justify-between mb-1">
            <h2 id="bulan-ini-title" className="text-xs font-semibold text-muted-foreground inline-flex items-center gap-1.5">
              {scope === "private" ? <Lock className="w-3 h-3" /> : <Wallet className="w-3 h-3" />} Sisa uang {monthLabel}
            </h2>
            <Link to="/laporan" className="text-xs font-medium text-primary inline-flex items-center gap-1">Laporan <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <p className="font-heading text-[26px] leading-tight font-extrabold tracking-tight tabular-nums break-words"><Money value={s.balance} currency={cur} /></p>
          {hasMultiCurrency && cur !== defaultCur && (
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Globe className="w-3 h-3" /> Semua mata uang: <Money value={consolidatedBalance} currency={defaultCur} format="short" /></p>
          )}
          {excludedCurs.length > 0 && (
            <p className="mt-1 text-[11px] font-medium text-warning inline-flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Belum termasuk {excludedCurs.join(", ")} (kurs belum tersedia)
            </p>
          )}
          {pace && (
            <div className="mt-2.5">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden="true">
                <div className={`h-full rounded-full ${pace.over ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pace.pct}%` }} />
              </div>
              <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px]">
                <span className={pace.over ? "text-destructive font-semibold" : "text-muted-foreground"}>
                  {pace.over
                    ? <>Lewat <Money value={-pace.remaining} currency={cur} format="short" /></>
                    : <>Jatah <b className="text-foreground"><Money value={pace.perDay} currency={cur} format="short" /></b>/hari</>}
                </span>
                <span className="text-muted-foreground">{pace.daysLeft} hari lagi</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[
              { key: "income", raw: s.income, icon: TrendingUp, label: "Masuk", value: <Money value={s.income} format="short" currency={cur} /> },
              // Ada rencana menabung (diatur di Anggaran) → tampilkan progresnya; bila tidak, rasio menabung.
              plan.savings > 0
                ? { key: "savings", to: "/anggaran", icon: Banknote, label: "Rencana menabung", value: savingsPlan.reached ? "Tercapai ✓" : `${Math.round(savingsPlan.pct)}%` }
                : { key: "savings", icon: Banknote, label: "Menabung", value: savings.label ? savings.label : `${savings.rate}%` },
            ].map(({ key, raw, to, icon: Icon, label, value }) => {
              const Tile = to ? Link : "div";
              return (
                <Tile key={key} {...(to ? { to } : {})} data-stat={key} data-value={raw} className="rounded-2xl bg-muted/60 px-2.5 py-2 min-w-0">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0"><Icon className="w-3 h-3 shrink-0" /> <span className="truncate">{label}</span></div>
                  <p className="font-semibold text-sm mt-0.5 tabular-nums truncate">{value}</p>
                </Tile>
              );
            })}
          </div>
          {activeCurs.length > 1 && (
            <div className="mt-3 flex items-center gap-2">
              <CurrencyTabs currencies={activeCurs} value={cur} onChange={setCurrency} />
              {rateMissing && <span className="text-[11px] text-warning inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Kurs belum ada</span>}
            </div>
          )}
        </section>
      )}

      {/* Total pengeluaran + komposisi per kategori (donat) */}
      <MonthlySummary scope={scope} currency={cur} />

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