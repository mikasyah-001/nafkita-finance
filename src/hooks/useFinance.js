import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { setCustomCurrencies, findCurrency } from "@/lib/finance";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    // Selalu batasi ke kategori milik akun aktif. Admin tetap dapat melihat
    // seluruh kategori hanya dari Admin Panel, bukan dari halaman pengguna.
    queryFn: async () => {
      const me = await base44.auth.me();
      if (!me?.id) return [];
      return base44.entities.Category.filter({ created_by_id: me.id }, "type", 5000);
    },
  });
}

// Transaksi/aset/anggaran diambil lewat backend function yang memperhitungkan
// relasi Partnership — sehingga pasangan (role "user") ikut melihat data bersama,
// tanpa perlu hak admin. Paginasi penuh dilakukan di sisi function.
export function useTransactions() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const res = await base44.functions.invoke("listVisibleTransactions", {});
      return res.data.transactions || [];
    },
  });
}

export function useAssets() {
  return useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const res = await base44.functions.invoke("listVisibleAssets", {});
      return res.data.assets || [];
    },
  });
}

export function useBudgets() {
  return useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const res = await base44.functions.invoke("listVisibleBudgets", {});
      return res.data.budgets || [];
    },
  });
}

export function useAssetSnapshots() {
  return useQuery({
    queryKey: ["assetSnapshots"],
    queryFn: () => base44.entities.AssetSnapshot.list("period", 500),
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: () => base44.entities.TransactionTemplate.list(),
  });
}

export function useZakatPayments() {
  return useQuery({
    queryKey: ["zakatPayments"],
    queryFn: () => base44.entities.ZakatPayment.list(),
  });
}

export function useInvestmentLots(assetId) {
  return useQuery({
    queryKey: ["investmentLots", assetId],
    queryFn: () => base44.entities.InvestmentLot.filter({ asset_id: assetId }, "date", 500),
    enabled: !!assetId,
  });
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });
}

// Daftar mata uang aktif pengguna (bawaan + kustom). Sekaligus mendaftarkan
// mata uang kustom ke registry agar formatMoney/currencySymbol memakai simbolnya.
export function useUserCurrencies() {
  const { data: me } = useMe();
  const custom = me?.custom_currencies || [];
  useEffect(() => { setCustomCurrencies(custom); }, [custom]);
  return useMemo(() => {
    const fallback = [me?.default_currency || "IDR"];
    const codes = me?.active_currencies?.length ? me.active_currencies : fallback;
    return codes
      .map((code) => findCurrency(code) || { code, label: code, symbol: code })
      .filter(Boolean);
  }, [me?.active_currencies, me?.default_currency]);
}

export function useDebts() {
  return useQuery({
    queryKey: ["debts"],
    queryFn: async () => {
      const res = await base44.functions.invoke("listVisibleDebts", {});
      return res.data.debts || [];
    },
  });
}

export function useRecurringBills() {
  return useQuery({
    queryKey: ["recurringBills"],
    queryFn: async () => {
      const res = await base44.functions.invoke("listVisibleRecurringBills", {});
      return res.data.bills || [];
    },
  });
}

export function useReconciliations(assetId) {
  return useQuery({
    queryKey: ["reconciliations", assetId],
    queryFn: () => base44.entities.Reconciliation.filter({ asset_id: assetId }, "-as_of_date", 500),
    enabled: !!assetId,
  });
}

export function useSavingsGoals() {
  return useQuery({
    queryKey: ["savingsGoals"],
    queryFn: async () => {
      const res = await base44.functions.invoke("listSavingsGoals", {});
      return res.data.goals || [];
    },
  });
}

export function usePendingApprovals() {
  return useQuery({
    queryKey: ["pendingApprovals"],
    queryFn: async () => {
      const res = await base44.functions.invoke("listPendingApprovals", {});
      return res.data || { pending_approvals: [], my_requests: [] };
    },
  });
}

export function useAssetMutations(assetId) {
  return useQuery({
    queryKey: ["assetMutations", assetId],
    queryFn: async () => {
      const res = await base44.functions.invoke("listAssetMutations", { asset_id: assetId });
      return res.data.mutations || [];
    },
    enabled: !!assetId,
  });
}

export function useNotificationRules() {
  return useQuery({
    queryKey: ["notificationRules"],
    queryFn: async () => {
      const res = await base44.functions.invoke("listNotificationRules", {});
      return res.data.rules || [];
    },
  });
}

export function useExchangeRates(baseCurrency) {
  return useQuery({
    queryKey: ["exchangeRates", baseCurrency],
    queryFn: async () => {
      const res = await base44.functions.invoke("listExchangeRates", { base_currency: baseCurrency });
      return res.data.rates || [];
    },
    enabled: !!baseCurrency,
  });
}

export function useRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["assets"] });
    qc.invalidateQueries({ queryKey: ["budgets"] });
    qc.invalidateQueries({ queryKey: ["templates"] });
    qc.invalidateQueries({ queryKey: ["assetSnapshots"] });
    qc.invalidateQueries({ queryKey: ["zakatPayments"] });
    qc.invalidateQueries({ queryKey: ["investmentLots"] });
    qc.invalidateQueries({ queryKey: ["me"] });
    qc.invalidateQueries({ queryKey: ["debts"] });
    qc.invalidateQueries({ queryKey: ["recurringBills"] });
    qc.invalidateQueries({ queryKey: ["reconciliations"] });
    qc.invalidateQueries({ queryKey: ["savingsGoals"] });
    qc.invalidateQueries({ queryKey: ["pendingApprovals"] });
    qc.invalidateQueries({ queryKey: ["assetMutations"] });
    qc.invalidateQueries({ queryKey: ["notificationRules"] });
    qc.invalidateQueries({ queryKey: ["exchangeRates"] });
  };
}