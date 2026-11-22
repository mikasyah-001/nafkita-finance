import { useMemo } from "react";
import { useTransactions, useBudgets, useMe, useRateMap, useUserCurrencies } from "@/hooks/useFinance";
import { summarizeConsolidated, monthlyPlan, spendingPace } from "@/lib/finance";

// Ringkasan bulan berjalan + jatah belanja harian untuk satu cakupan
// (bersama/pribadi) dalam satu mata uang. Dipakai halaman Lainnya dan
// "Bisakah saya beli ini?" — Beranda menghitung dengan fungsi yang sama
// (spendingPace) dari ringkasan yang sudah ia punya.
export function useMonthPace({ scope = "shared", currency } = {}) {
  const { data: transactions = [] } = useTransactions();
  const { data: budgets = [], isSuccess: budgetsReady } = useBudgets();
  const { data: me } = useMe();
  const { map: rateMap } = useRateMap();
  const userCurrencies = useUserCurrencies();
  const cur = (currency || me?.default_currency || "IDR").toUpperCase();

  return useMemo(() => {
    const now = new Date();
    const month = transactions.filter((t) => {
      const d = new Date(t.date);
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
      return scope === "private" ? t.visibility === "private" : t.visibility !== "private";
    });
    const summary = summarizeConsolidated(month, cur, rateMap, userCurrencies.map((c) => c.code));
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const plan = monthlyPlan(budgets, { period, scope, currency: cur });
    const pace = spendingPace({
      income: summary.income, expense: summary.expense, sedekah: summary.sedekah,
      planIncome: plan.income, planSavings: plan.savings, now,
    });
    return { currency: cur, summary, plan, pace, now, ready: budgetsReady };
  }, [transactions, budgets, budgetsReady, rateMap, userCurrencies, scope, cur]);
}
