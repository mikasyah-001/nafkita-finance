import { useMemo } from "react";
import { useAssets, useDebts, useMe, useRateMap, useZakatPayments } from "@/hooks/useFinance";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import { computeZakatMal, haulPeriod, paymentsForPeriod, paymentInZakatCurrency } from "@/lib/zakat";

export { isPlausibleGoldPrice, GOLD_PRICE_MIN, GOLD_PRICE_MAX } from "@/hooks/useGoldPrice";

// Sumber tunggal status zakat untuk halaman Zakat, Dashboard Aset, dll.
export function useZakat() {
  const { data: me } = useMe();
  const { data: assets = [], isLoading: assetsLoading } = useAssets();
  const { data: debts = [] } = useDebts();
  const { map: rateMap } = useRateMap();
  const { data: payments = [] } = useZakatPayments();
  const { price: goldPrice, source: goldSource, loading: goldLoading } = useGoldPrice();

  const includeReceivables = me?.zakat_include_receivables !== false;
  const result = useMemo(
    () => computeZakatMal({ assets, debts, goldPrice, rateMap, includeReceivables }),
    [assets, debts, goldPrice, rateMap, includeReceivables]
  );
  const period = haulPeriod(me?.zakat_haul_date || null);
  const myPayments = payments.filter((p) => !me?.id || p.created_by_id === me.id || !p.created_by_id);
  const paid = paymentsForPeriod(myPayments, period);
  // Pembayaran SAR dsb. dinilai setara IDR (kurs saat bayar bila tersimpan).
  const paidTotal = paid.reduce((s, p) => s + paymentInZakatCurrency(p, rateMap), 0);
  const remaining = Math.max(0, result.zakat - paidTotal);

  return {
    ...result, me, goldSource, goldLoading, includeReceivables, period,
    payments: myPayments, paid, paidTotal, remaining, rateMap,
    isPaidOff: result.zakat > 0 && remaining <= 0,
    loading: assetsLoading,
  };
}
