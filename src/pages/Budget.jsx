import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useTransactions, useCategories, useBudgets, useRefresh, useMe, useUserCurrencies } from "@/hooks/useFinance";
import { formatMoney, formatDate, colorMap, currencySymbol, isExpenseBudget, filterReportableTx } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import CurrencyTabs from "@/components/CurrencyTabs";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Target, AlertTriangle, CheckCircle2, Repeat } from "lucide-react";
import ScopeToggle from "@/components/ScopeToggle";
import { useScope } from "@/lib/ScopeContext";
import MonthlyPlanCard from "@/components/MonthlyPlanCard";
import { ListSkeleton } from "@/components/LoadingSkeleton";
import PageHeader from "@/components/PageHeader";
import MoneyInput from "@/components/MoneyInput";

export default function Budget() {
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [], isLoading } = useCategories();
  const { data: budgets = [] } = useBudgets();
  const { data: me } = useMe();
  const refresh = useRefresh();
  const [cursor, setCursor] = useState(new Date());
  const [limits, setLimits] = useState({});
  // Cakupan global (sama dengan ScopeToggle & halaman lain). Sebelumnya state
  // lokal sehingga tombol Bersama/Pribadi di halaman ini tidak berpengaruh.
  const { scope } = useScope();
  const [currency, setCurrency] = useState(me?.default_currency || "IDR");
  const userCurrencies = useUserCurrencies();
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
        return d.getMonth() === month && d.getFullYear() === year && t.type === "expense" && inScope && (t.currency || "IDR") === currency && filterReportableTx(t);
      }),
    [transactions, month, year, scope, currency]
  );

  const spentByCategory = useMemo(() => {
    const map = {};
    monthTx.forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return map;
  }, [monthTx]);

  const periodBudgets = budgets.filter(
    (b) => isExpenseBudget(b) && b.period === period && (b.visibility || "shared") === scope && (b.currency || "IDR") === currency
  );
  const budgetMap = useMemo(() => {
    const map = {};
    periodBudgets.forEach((b) => { map[b.category] = b; });
    return map;
  }, [periodBudgets]);

  const totalLimit = expenseCategories.reduce((s, c) => {
    const b = budgetMap[c.name];
    return s + (b?.limit_amount || 0) + (b?.rollover_amount || 0);
  }, 0);
  // Bandingkan apel dengan apel: "terpakai" hanya dari kategori yang punya
  // anggaran. Pengeluaran kategori tanpa anggaran ditampilkan terpisah, agar
  // kartu tidak terlihat "jebol" padahal semua kategori beranggaran masih aman.
  const budgetedNames = expenseCategories
    .filter((c) => (budgetMap[c.name]?.limit_amount || 0) + (budgetMap[c.name]?.rollover_amount || 0) > 0)
    .map((c) => c.name);
  const totalSpent = budgetedNames.reduce((s, n) => s + (spentByCategory[n] || 0), 0);
  const unbudgetedSpent = Object.entries(spentByCategory)
    .filter(([n]) => !budgetedNames.includes(n))
    .reduce((s, [, v]) => s + v, 0);

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
        await base44.entities.Budget.create({ 
          category: catName, limit_amount: num, currency, period, 
          visibility: scope, 
          assignee_id: scope === "private" ? me?.id : null,
          assignee_name: scope === "private" ? (me?.full_name || me?.email) : null,
          period_type: "monthly",
        });
      }
      refresh();
      toast.success("Anggaran disimpan");
    } catch {
      toast.error("Gagal menyimpan anggaran");
    }
  };

  const toggleRollover = async (catName) => {
    const b = budgetMap[catName];
    if (!b) return;
    const newEnabled = !b.rollover_enabled;
    try {
      await base44.entities.Budget.update(b.id, { 
        rollover_enabled: newEnabled,
        rollover_policy: newEnabled ? (b.rollover_policy || "carry_negative") : b.rollover_policy,
      });
      refresh();
      toast.success(newEnabled ? "Rollover diaktifkan" : "Rollover dinonaktifkan");
    } catch {
      toast.error("Gagal mengubah rollover");
    }
  };

  const prevMonth = () => setCursor(new Date(year, month - 1, 1));
  const nextMonth = () => setCursor(new Date(year, month + 1, 1));

  return (
    <div className="px-5 pt-6">
      <PageHeader title="Anggaran Bulanan" back />

      <div className="flex items-center justify-between surface p-3 mb-4">
        <button onClick={prevMonth} aria-label="Bulan sebelumnya" className="btn-icon btn-icon-sm"><ChevronLeft className="w-5 h-5" /></button>
        <p className="font-medium">{monthName}</p>
        <button onClick={nextMonth} aria-label="Bulan berikutnya" className="btn-icon btn-icon-sm"><ChevronRight className="w-5 h-5" /></button>
      </div>

      <ScopeToggle className="mb-4" />

      <MonthlyPlanCard period={period} year={year} month={month} scope={scope} currency={currency} />

      <div className="mb-4"><CurrencyTabs currencies={userCurrencies.map((c) => c.code)} value={currency} onChange={setCurrency} /></div>

      <div className="rounded-3xl card-gradient-primary p-5 mb-5 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-4 h-4 opacity-80" />
          <span className="text-xs opacity-80">{scope === "private" ? "Anggaran Pribadi" : "Anggaran Bersama Keluarga"} • {currency}</span>
        </div>
        <p className="text-2xl font-bold">{formatMoney(totalSpent, currency)} <span className="text-sm font-normal opacity-70">/ {formatMoney(totalLimit, currency)}</span></p>
        {totalLimit > 0 && (
          <div className="mt-3 h-2 rounded-full bg-white/20 overflow-hidden">
            <div
              className={`h-full rounded-full ${totalSpent > totalLimit ? "bg-[hsl(354_80%_75%)]" : "bg-white"}`}
              style={{ width: `${Math.min(100, (totalSpent / totalLimit) * 100)}%` }}
            />
          </div>
        )}
        {unbudgetedSpent > 0 && (
          <p className="text-xs opacity-80 mt-2">+ {formatMoney(unbudgetedSpent, currency)} di kategori tanpa anggaran</p>
        )}
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : expenseCategories.length === 0 ? (
        <EmptyState icon={Target} title="Belum ada kategori" subtitle="Tambahkan kategori pengeluaran di pengaturan." />
      ) : (
        <div className="space-y-3">
          {expenseCategories.map((c) => {
            const cm = colorMap[c.color] || colorMap.slate;
            const spent = spentByCategory[c.name] || 0;
            const budget = budgetMap[c.name];
            const rolloverAmount = budget?.rollover_amount || 0;
            const limit = Number(getLimit(c.name)) || 0;
            const effectiveLimit = limit + rolloverAmount;
            const pct = effectiveLimit > 0 ? (spent / effectiveLimit) * 100 : 0;
            const over = effectiveLimit > 0 && spent > effectiveLimit;
            const remaining = effectiveLimit - spent;

            return (
              <div key={c.id} className="surface p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${cm.bg}`}>
                    <CategoryIcon name={c.icon} className={`w-5 h-5 ${cm.text}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.name}</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-muted-foreground">Terpakai {formatMoney(spent, currency)}</p>
                      {rolloverAmount !== 0 && (
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${rolloverAmount > 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                          Rollover {rolloverAmount > 0 ? "+" : ""}{formatMoney(rolloverAmount, currency)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center rounded-xl border border-border px-2 focus-within:ring-2 ring-primary/30">
                      <span className="text-xs text-muted-foreground">{currencySymbol(currency)}</span>
                      <MoneyInput currency={currency}
                        aria-label={`Batas anggaran ${c.name}`}
                        value={getLimit(c.name)}
                        onChange={(v) => setLimits({ ...limits, [c.name]: v })}
                        onBlur={() => saveLimit(c.name)}
                        placeholder="0"
                        className="w-20 px-1 py-2 text-sm outline-none bg-transparent"
                      />
                    </div>
                    {budgetMap[c.name] && (
                      <button
                        onClick={() => toggleRollover(c.name)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${budgetMap[c.name].rollover_enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                        title={budgetMap[c.name].rollover_enabled ? "Rollover aktif (klik untuk nonaktifkan)" : "Aktifkan rollover"}
                      >
                        <Repeat className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {limit > 0 && (
                  <>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${over ? "bg-destructive" : pct > 80 ? "bg-warning" : cm.solid}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-muted-foreground">{Math.round(pct)}% terpakai</span>
                      {over ? (
                        <span className="text-destructive flex items-center gap-1 font-medium">
                          <AlertTriangle className="w-3 h-3" /> Lebih {formatMoney(Math.abs(remaining), currency)}
                        </span>
                      ) : remaining < effectiveLimit * 0.2 ? (
                        <span className="text-warning flex items-center gap-1 font-medium">
                          <AlertTriangle className="w-3 h-3" /> Sisa {formatMoney(remaining, currency)}
                        </span>
                      ) : (
                        <span className="text-success flex items-center gap-1 font-medium">
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