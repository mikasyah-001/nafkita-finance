import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTransactions, useCategories } from "@/hooks/useFinance";
import { formatDate, formatMoney } from "@/lib/finance";
import TransactionItem from "@/components/TransactionItem";
import CalendarView from "@/components/CalendarView";
import EmptyState from "@/components/EmptyState";
import { ReceiptText, Search, Upload, SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { useScope } from "@/lib/ScopeContext";

const typeFilters = [
  { key: "all", label: "Semua" },
  { key: "income", label: "Masuk" },
  { key: "expense", label: "Keluar" },
  { key: "sedekah", label: "Sedekah" },
];

export default function Transactions() {
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const [active, setActive] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [view, setView] = useState("list");
  const { scope, setScope } = useScope();

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (scope === "private" && t.visibility !== "private") return false;
      if (scope === "shared" && t.visibility === "private") return false;
      if (active !== "all" && t.type !== active) return false;
      if (category !== "all" && t.category !== category) return false;
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
  }, [transactions, active, category, search, fromDate, toDate, scope]);

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
          nets[c] = (nets[c] || 0) + (t.type === "income" ? t.amount : t.type === "expense" ? -t.amount : 0);
        });
        return [date, items, nets];
      })
      .sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const hasActiveFilter = category !== "all" || fromDate || toDate;
  const resetFilter = () => {
    setCategory("all");
    setFromDate("");
    setToDate("");
  };

  return (
    <div className="px-5 pt-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Riwayat Transaksi</h1>
        <Link to="/impor" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform">
          <Upload className="w-4 h-4 text-muted-foreground" />
        </Link>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari merchant, catatan, kategori..."
          className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-muted text-sm outline-none focus:ring-2 ring-primary/30"
        />
        <button
          onClick={() => setShowFilter(!showFilter)}
          className={`absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${showFilter || hasActiveFilter ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        {typeFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setActive(f.key)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              active === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex gap-1.5">
          {[{ key: "shared", label: "Bersama" }, { key: "private", label: "Pribadi" }].map((s) => (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${scope === s.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setView("list")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Daftar</button>
          <button onClick={() => setView("calendar")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${view === "calendar" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Kalender</button>
        </div>
      </div>

      {showFilter && (
        <div className="rounded-2xl border border-border bg-card p-4 mb-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Filter Lanjutan</p>
            {hasActiveFilter && (
              <button onClick={resetFilter} className="text-xs text-muted-foreground flex items-center gap-1 active:scale-95">
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            )}
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Kategori</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setCategory("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${category === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                Semua
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.name)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${category === c.name ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Rentang Tanggal</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30"
              />
              <span className="text-muted-foreground text-xs">sampai</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30"
              />
            </div>
            <div className="flex gap-2 mt-2">
              <QuickDate label="Hari ini" onClick={() => { const d = new Date().toISOString().slice(0, 10); setFromDate(d); setToDate(d); }} />
              <QuickDate label="Bulan ini" onClick={() => { const n = new Date(); const s = new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10); setFromDate(s); setToDate(""); }} />
              <QuickDate label="Tahun ini" onClick={() => { const n = new Date(); const s = `${n.getFullYear()}-01-01`; setFromDate(s); setToDate(""); }} />
            </div>
          </div>
        </div>
      )}

      {hasActiveFilter && !showFilter && (
        <div className="flex items-center gap-2 mb-3 text-xs">
          <span className="text-muted-foreground">Filter aktif:</span>
          {category !== "all" && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{category}</span>}
          {fromDate && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">dari {formatDate(fromDate, "dd MMM")}</span>}
          {toDate && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">sampai {formatDate(toDate, "dd MMM")}</span>}
          <button onClick={resetFilter} className="text-red-500 flex items-center gap-0.5"><X className="w-3 h-3" /></button>
        </div>
      )}

      {view === "calendar" ? (
        <CalendarView transactions={filtered} categories={categories} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Tidak ada transaksi" subtitle="Belum ada catatan yang cocok dengan filter ini." />
      ) : (
        <div className="space-y-5">
          <p className="text-xs text-muted-foreground px-1">{filtered.length} transaksi</p>
          {grouped.map(([date, items, nets]) => (
            <div key={date}>
              <div className="flex items-center justify-between gap-2 mb-1 px-1">
                <p className="text-xs text-muted-foreground truncate">{formatDate(date, "EEEE, dd MMM")}</p>
                {Object.entries(nets).filter(([, v]) => v !== 0).map(([c, v]) => (
                  <span key={c} className={`text-[11px] font-medium tabular-nums shrink-0 ${v > 0 ? "text-emerald-600" : "text-red-500"}`}>{v > 0 ? "+" : ""}{formatMoney(v, c)}</span>
                ))}
              </div>
              <div className="rounded-2xl border border-border bg-card px-4">
                {items.map((t) => (
                  <TransactionItem key={t.id} tx={t} categories={categories} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickDate({ label, onClick }) {
  return (
    <button onClick={onClick} className="px-2.5 py-1 rounded-lg bg-muted text-xs font-medium text-muted-foreground active:scale-95 transition-transform">
      {label}
    </button>
  );
}