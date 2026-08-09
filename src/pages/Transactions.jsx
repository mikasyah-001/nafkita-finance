import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTransactions, useCategories } from "@/hooks/useFinance";
import { formatDate } from "@/lib/finance";
import TransactionItem from "@/components/TransactionItem";
import EmptyState from "@/components/EmptyState";
import { ReceiptText, Search, Upload } from "lucide-react";

const filters = [
  { key: "all", label: "Semua" },
  { key: "income", label: "Masuk" },
  { key: "expense", label: "Keluar" },
  { key: "sedekah", label: "Sedekah" },
];

export default function Transactions() {
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const [active, setActive] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (active !== "all" && t.type !== active) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (t.merchant || "").toLowerCase().includes(q) ||
          (t.notes || "").toLowerCase().includes(q) ||
          (t.category || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, active, search]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((t) => {
      const key = formatDate(t.date, "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

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
          placeholder="Cari transaksi..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-muted text-sm outline-none focus:ring-2 ring-primary/30"
        />
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        {filters.map((f) => (
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

      {filtered.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Tidak ada transaksi" subtitle="Belum ada catatan yang cocok dengan filter ini." />
      ) : (
        <div className="space-y-5">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <p className="text-xs text-muted-foreground mb-1 px-1">{formatDate(date, "EEEE, dd MMMM yyyy")}</p>
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