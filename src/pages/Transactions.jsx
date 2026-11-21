import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTransactions, useCategories, useMe, useRateMap, useRefresh } from "@/hooks/useFinance";
import { usePullToRefresh, PullToRefreshIndicator } from "@/hooks/usePullToRefresh";
import { formatDate, formatMoney, formatMoneyShort, summarizeConsolidated, filterReportableTx } from "@/lib/finance";
import TransactionItem from "@/components/TransactionItem";
import CalendarView from "@/components/CalendarView";
import EmptyState from "@/components/EmptyState";
import { ChevronLeft, ChevronRight, ReceiptText, Search, Upload, SlidersHorizontal, X, RotateCcw, TrendingUp, TrendingDown, Scale, List, CalendarDays } from "lucide-react";
import ScopeToggle from "@/components/ScopeToggle";
import { useScope } from "@/lib/ScopeContext";
import { ListSkeleton } from "@/components/LoadingSkeleton";
import PageHeader from "@/components/PageHeader";

const toMonthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const typeFilters = [
  { key: "all", label: "Semua" },
  { key: "income", label: "Masuk" },
  { key: "expense", label: "Keluar" },
  { key: "sedekah", label: "Sedekah" },
];

export default function Transactions() {
  const { data: transactions = [], isLoading } = useTransactions();
  const { data: categories = [] } = useCategories();
  const refresh = useRefresh();
  const ptr = usePullToRefresh(refresh);
  const [active, setActive] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [view, setView] = useState("list");
  // Navigator bulan: default bulan berjalan; null = semua waktu. Filter
  // tanggal manual (dari/sampai) mengambil alih dan mengosongkan bulan.
  const [monthKey, setMonthKey] = useState(() => toMonthKey(new Date()));
  const { scope } = useScope();

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (scope === "private" && t.visibility !== "private") return false;
      if (scope === "shared" && t.visibility === "private") return false;
      if (active !== "all" && t.type !== active) return false;
      if (category !== "all" && t.category !== category) return false;
      if (monthKey && formatDate(t.date, "yyyy-MM") !== monthKey) return false;
      if (fromDate && new Date(t.date) < new Date(fromDate + "T00:00:00")) return false;
      if (toDate && new Date(t.date) > new Date(toDate + "T23:59:59")) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !(t.merchant || "").toLowerCase().includes(q) &&
          !(t.notes || "").toLowerCase().includes(q) &&
          !(t.category || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [transactions, active, category, search, fromDate, toDate, scope, monthKey]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((t) => {
      const key = formatDate(t.date, "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return Object.entries(map)
      .map(([date, items]) => {
        const nets = {};
        items.forEach((t) => {
          const c = t.currency || "IDR";
          // Neto harian hanya dari transaksi yang dihitung (tanpa transfer & pending);
          // sedekah termasuk uang keluar.
          if (!filterReportableTx(t)) return;
          nets[c] = (nets[c] || 0) + (t.type === "income" ? t.amount : -t.amount);
        });
        return [date, items, nets];
      })
      .sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const hasActiveFilter = category !== "all" || fromDate || toDate;
  const { data: me } = useMe();
  const { map: rateMap } = useRateMap();
  const viewCur = me?.default_currency || "IDR";
  const summary = useMemo(() => summarizeConsolidated(filtered, viewCur, rateMap), [filtered, viewCur, rateMap]);
  const periodLabel = fromDate || toDate
    ? `${fromDate ? formatDate(fromDate, "d MMM") : "awal"} – ${toDate ? formatDate(toDate, "d MMM yyyy") : "sekarang"}`
    : monthKey ? formatDate(`${monthKey}-01T00:00:00`, "MMMM yyyy") : "Semua waktu";
  const shiftMonth = (delta) => {
    const base = monthKey ? new Date(`${monthKey}-01T00:00:00`) : new Date();
    base.setMonth(base.getMonth() + (monthKey ? delta : 0));
    setMonthKey(toMonthKey(base));
    setFromDate(""); setToDate("");
  };
  const isCurrentMonth = monthKey === toMonthKey(new Date());
  const resetFilter = () => {
    setCategory("all");
    setFromDate("");
    setToDate("");
    setMonthKey(toMonthKey(new Date()));
  };

  const pill = (on) => `h-8 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground/75 hover:bg-muted"}`;

  return (
    <div className="px-5 pt-6">
      <PullToRefreshIndicator pull={ptr.pull} refreshing={ptr.refreshing} threshold={ptr.threshold} />
      <PageHeader
        title="Riwayat transaksi"
        subtitle={`${filtered.length} catatan`}
        actions={<Link to="/impor" aria-label="Impor data" className="btn-icon btn-icon-sm"><Upload className="w-4 h-4" /></Link>}
      />

      {/* Navigator bulan */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <button onClick={() => shiftMonth(-1)} aria-label="Bulan sebelumnya" className="btn-icon btn-icon-sm"><ChevronLeft className="w-4 h-4" /></button>
        <div className="text-center min-w-0">
          <p className="font-heading font-bold text-[17px] leading-tight truncate">{periodLabel}</p>
          <button
            onClick={() => { if (monthKey || fromDate || toDate) { setMonthKey(null); setFromDate(""); setToDate(""); } else shiftMonth(0); }}
            className="text-[11px] font-semibold text-primary"
          >
            {monthKey || fromDate || toDate ? "Lihat semua waktu" : "Kembali ke bulan ini"}
          </button>
        </div>
        <button onClick={() => shiftMonth(1)} disabled={isCurrentMonth} aria-label="Bulan berikutnya" className="btn-icon btn-icon-sm disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
      </div>

      {/* Ringkasan tampilan saat ini */}
      <div className="card-gradient-primary rounded-[24px] p-4 mb-4 grid grid-cols-3 gap-2">
        {[
          { icon: TrendingUp, label: "Masuk", value: summary.income },
          { icon: TrendingDown, label: "Keluar", value: summary.expense + summary.sedekah },
          { icon: Scale, label: "Selisih", value: summary.balance },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="min-w-0">
            <p className="text-[11px] opacity-75 flex items-center gap-1"><Icon className="w-3 h-3" /> {label}</p>
            <p className="font-heading font-bold text-[15px] tabular-nums truncate">{formatMoneyShort(value, viewCur)}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            aria-label="Cari transaksi"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari tempat, catatan, kategori…"
            className="w-full h-11 pl-10 pr-9 rounded-2xl border border-border bg-card text-sm outline-none focus:ring-2 ring-primary/30"
          />
          {search && <button onClick={() => setSearch("")} aria-label="Hapus pencarian" className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-muted flex items-center justify-center"><X className="w-3 h-3" /></button>}
        </div>
        <button
          onClick={() => setShowFilter(!showFilter)}
          aria-label="Filter lanjutan"
          aria-expanded={showFilter}
          className={`relative w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 transition-colors ${showFilter || hasActiveFilter ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"}`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {hasActiveFilter && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gold border-2 border-background" />}
        </button>
      </div>

      <div className="-mx-5 px-5 flex gap-2 mb-3 overflow-x-auto no-scrollbar">
        {typeFilters.map((f) => (
          <button key={f.key} onClick={() => setActive(f.key)} className={pill(active === f.key)}>{f.label}</button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <ScopeToggle className="flex-1" />
        <div role="radiogroup" aria-label="Tampilan" className="flex gap-1 p-1 rounded-2xl bg-muted shrink-0">
          {[["list", List, "Daftar"], ["calendar", CalendarDays, "Kalender"]].map(([v, Icon, l]) => (
            <button key={v} role="radio" aria-checked={view === v} aria-label={l} onClick={() => setView(v)}
              className={`w-10 h-9 rounded-xl flex items-center justify-center transition-colors ${view === v ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      {showFilter && (
        <div className="surface rounded-3xl p-4 mb-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Filter lanjutan</p>
            {hasActiveFilter && (
              <button onClick={resetFilter} className="text-xs font-semibold text-primary flex items-center gap-1 active:scale-95">
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            )}
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground mb-2">Kategori</p>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button onClick={() => setCategory("all")} className={pill(category === "all")}>Semua</button>
              {categories.map((c) => (
                <button key={c.id} onClick={() => setCategory(c.name)} className={pill(category === c.name)}>{c.name}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground mb-2">Rentang tanggal</p>
            <div className="flex items-center gap-2">
              <input aria-label="Dari tanggal" type="date" value={fromDate} onChange={(e) => { setMonthKey(null); setFromDate(e.target.value); }} className="flex-1 h-10 rounded-xl border border-border px-3 text-sm outline-none focus:ring-2 ring-primary/30" />
              <span className="text-muted-foreground text-xs">s.d.</span>
              <input aria-label="Sampai tanggal" type="date" value={toDate} onChange={(e) => { setMonthKey(null); setToDate(e.target.value); }} className="flex-1 h-10 rounded-xl border border-border px-3 text-sm outline-none focus:ring-2 ring-primary/30" />
            </div>
            <div className="flex gap-1.5 mt-2">
              <QuickDate label="Hari ini" onClick={() => { setMonthKey(null); const d = new Date().toISOString().slice(0, 10); setFromDate(d); setToDate(d); }} />
              <QuickDate label="Bulan ini" onClick={() => { setFromDate(""); setToDate(""); setMonthKey(toMonthKey(new Date())); }} />
              <QuickDate label="Tahun ini" onClick={() => { setMonthKey(null); const n = new Date(); setFromDate(`${n.getFullYear()}-01-01`); setToDate(""); }} />
            </div>
          </div>
        </div>
      )}

      {hasActiveFilter && !showFilter && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3 text-xs">
          {category !== "all" && <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">{category}</span>}
          {fromDate && <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">dari {formatDate(fromDate, "dd MMM")}</span>}
          {toDate && <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">s.d. {formatDate(toDate, "dd MMM")}</span>}
          <button onClick={resetFilter} aria-label="Hapus filter" className="w-6 h-6 rounded-full bg-muted flex items-center justify-center"><X className="w-3 h-3" /></button>
        </div>
      )}

      {view === "calendar" ? (
        <CalendarView transactions={filtered} categories={categories} />
      ) : isLoading ? (
        <ListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Tidak ada transaksi" subtitle={search || hasActiveFilter ? "Tidak ada catatan yang cocok. Coba ubah kata kunci atau filter." : "Catatan transaksi keluarga akan muncul di sini."} />
      ) : (
        <div className="space-y-5">
          {grouped.map(([date, items, nets]) => (
            <section key={date} aria-label={formatDate(date, "EEEE, d MMMM yyyy")}>
              <div className="flex items-end justify-between gap-2 mb-2 px-1">
                <div>
                  <p className="font-heading font-bold text-[15px] leading-tight">{formatDate(date, "EEEE")}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDate(date, "d MMMM yyyy")} · {items.length} catatan</p>
                </div>
                <div className="flex flex-col items-end">
                  {Object.entries(nets).filter(([, v]) => v !== 0).map(([c, v]) => (
                    <span key={c} className={`text-xs font-semibold tabular-nums ${v > 0 ? "text-income" : "text-expense"}`}>{v > 0 ? "+" : "−"}{formatMoney(Math.abs(v), c)}</span>
                  ))}
                </div>
              </div>
              <div className="surface rounded-3xl px-4">
                {items.map((t) => <TransactionItem key={t.id} tx={t} categories={categories} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickDate({ label, onClick }) {
  return (
    <button onClick={onClick} className="h-7 px-3 rounded-full border border-border bg-card text-xs font-semibold text-foreground/75 active:scale-95 transition-transform">
      {label}
    </button>
  );
}