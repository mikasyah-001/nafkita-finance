import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useTransactions, useCategories, useBudgets, useRefresh, useMe } from "@/hooks/useFinance";
import { formatMoney, formatDate, colorMap, currencySymbol, CURRENCY_CODES } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import CurrencyTabs from "@/components/CurrencyTabs";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Target, AlertTriangle, CheckCircle2, Users, Lock } from "lucide-react";

export default function Budget() {
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets();
  const { data: me } = useMe();
  const refresh = useRefresh();
  const [cursor, setCursor] = useState(new Date());
  const [limits, setLimits] = useState({});
  const [scope, setScope] = useState("shared");
  const [currency, setCurrency] = useState(me?.default_currency || "IDR");
  useEffect(() => { if (me?.default_currency) setCurrency(me.default_currency); }, [me?.default_currency]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const period = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthName = formatDate(new Date(year, month, 1), "MMMM yyyy");

  // Reset nilai ketik saat konteks (bulan/jangkauan/mata uang) berubah agar tidak terbawa.
  useEffect(() => { setLimits({}); }, [period, scope, currency]);

  const expenseCategories = categories.filter((c) => c.type === "expense");

  const monthTx = useMemo(
    () =>
      transactions.filter((t) => {
        const d = new Date(t.date);
        const inScope = scope === "private" ? t.visibility === "private" : t.visibility !== "private";
        return d.getMonth() === month && d.getFullYear() === year && t.type === "expense" && inScope && (t.currency || "IDR") === currency;
      }),
    [transactions, month, year, scope, currency]
  );

  const spentByCategory = useMemo(() => {
    const map = {};
    monthTx.forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return map;
  }, [monthTx]);

  const periodBudgets = budgets.filter(
    (b) => b.period === period && (b.visibility || "shared") === scope && (b.currency || "IDR") === currency
  );
  const budgetMap = useMemo(() => {
    const map = {};
    periodBudgets.forEach((b) => { map[b.category] = b; });
    return map;
  }, [periodBudgets]);

  const totalLimit = expenseCategories.reduce((s, c) => {
    const b = budgetMap[c.name];
    return s + (b?.limit_amount || 0);
  }, 0);
  const totalSpent = Object.values(spentByCategory).reduce((s, v) => s + v, 0);

  const getLimit = (catName) => {
    if (limits[catName] !== undefined) return limits[catName];
    const b = budgetMap[catName];
    return b?.limit_amount || "";
  };

  const saveLimit = async (catName) => {
    const val = limits[catName];
    if (val === undefined) return;
    const num = Number(val);
    if (val !== "" && (!Number.isFinite(num) || num <= 0)) {
      toast.error("Nominal anggaran harus positif", { description: `${catName}: masukkan angka lebih dari 0.` });
      return;
    }
    const existing = budgetMap[catName];
    try {
      if (existing) {
        await base44.entities.Budget.update(existing.id, { limit_amount: num });
      } else {
        await base44.entities.Budget.create({ category: catName, limit_amount: num, currency, period, visibility: scope });
      }
      refresh();
      toast.success("Anggaran disimpan");
    } catch {
      toast.error("Gagal menyimpan anggaran");
    }
  };

  const prevMonth = () => setCursor(new Date(year, month - 1, 1));
  const nextMonth = () => setCursor(new Date(year, month + 1, 1));

  return (
    <div className="px-5 pt-8">
      <h1 className="text-xl font-semibold mb-4">Anggaran Bulanan</h1>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 mb-4">
        <button onClick={prevMonth} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><ChevronLeft className="w-5 h-5" /></button>
        <p className="font-medium">{monthName}</p>
        <button onClick={nextMonth} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><ChevronRight className="w-5 h-5" /></button>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setScope("shared")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "shared" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Users className="w-4 h-4" /> Bersama
        </button>
        <button onClick={() => setScope("private")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "private" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Lock className="w-4 h-4" /> Pribadi
        </button>
      </div>

      <div className="mb-4"><CurrencyTabs currencies={CURRENCY_CODES} value={currency} onChange={setCurrency} /></div>

      <div className="rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white p-5 mb-5 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-4 h-4 opacity-80" />
          <span className="text-xs opacity-80">{scope === "private" ? "Anggaran Pribadi" : "Anggaran Bersama Keluarga"} • {currency}</span>
        </div>
        <p className="text-2xl font-bold">{formatMoney(totalSpent, currency)} <span className="text-sm font-normal opacity-70">/ {formatMoney(totalLimit, currency)}</span></p>
        {totalLimit > 0 && (
          <div className="mt-3 h-2 rounded-full bg-white/20 overflow-hidden">
            <div
              className={`h-full rounded-full ${totalSpent > totalLimit ? "bg-red-300" : "bg-white"}`}
              style={{ width: `${Math.min(100, (totalSpent / totalLimit) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {expenseCategories.length === 0 ? (
        <EmptyState icon={Target} title="Belum ada kategori" subtitle="Tambahkan kategori pengeluaran di pengaturan." />
      ) : (
        <div className="space-y-3">
          {expenseCategories.map((c) => {
            const cm = colorMap[c.color] || colorMap.slate;
            const spent = spentByCategory[c.name] || 0;
            const limit = Number(getLimit(c.name)) || 0;
            const pct = limit > 0 ? (spent / limit) * 100 : 0;
            const over = limit > 0 && spent > limit;
            const remaining = limit - spent;

            return (
              <div key={c.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${cm.bg}`}>
                    <CategoryIcon name={c.icon} className={`w-5 h-5 ${cm.text}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">Terpakai {formatMoney(spent, currency)}</p>
                  </div>
                  <div className="flex items-center rounded-xl border border-border px-2 focus-within:ring-2 ring-primary/30">
                    <span className="text-xs text-muted-foreground">{currencySymbol(currency)}</span>
                    <input
                      type="number"
                      value={getLimit(c.name)}
                      onChange={(e) => setLimits({ ...limits, [c.name]: e.target.value })}
                      onBlur={() => saveLimit(c.name)}
                      placeholder="0"
                      className="w-24 px-1 py-2 text-sm outline-none bg-transparent"
                    />
                  </div>
                </div>

                {limit > 0 && (
                  <>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${over ? "bg-red-500" : pct > 80 ? "bg-amber-500" : cm.solid}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-muted-foreground">{Math.round(pct)}% terpakai</span>
                      {over ? (
                        <span className="text-red-500 flex items-center gap-1 font-medium">
                          <AlertTriangle className="w-3 h-3" /> Lebih {formatMoney(Math.abs(remaining), currency)}
                        </span>
                      ) : remaining < limit * 0.2 ? (
                        <span className="text-amber-600 flex items-center gap-1 font-medium">
                          <AlertTriangle className="w-3 h-3" /> Sisa {formatMoney(remaining, currency)}
                        </span>
                      ) : (
                        <span className="text-emerald-600 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Sisa {formatMoney(remaining, currency)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-4 text-center">
        Anggaran {scope === "private" ? "pribadi" : "bersama"} {currency} untuk {monthName}. Hanya transaksi {scope === "private" ? "pribadi" : "bersama"} bermata uang {currency} yang dihitung.
      </p>
    </div>
  );
}