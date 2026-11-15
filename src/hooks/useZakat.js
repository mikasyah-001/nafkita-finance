import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAssets, useDebts, useMe, useRateMap, useZakatPayments } from "@/hooks/useFinance";
import { fetchGoldPricesMulti, pickAntamSource } from "@/lib/goldPrice";
import { computeZakatMal, haulPeriod, paymentsForPeriod } from "@/lib/zakat";

// Batas kewajaran harga emas (Rp/gram). Harga dari pencarian AI di luar
// rentang ini ditolak agar tidak menghasilkan nisab yang keliru.
export const GOLD_PRICE_MIN = 500_000;
export const GOLD_PRICE_MAX = 10_000_000;
export const isPlausibleGoldPrice = (v) => Number(v) >= GOLD_PRICE_MIN && Number(v) <= GOLD_PRICE_MAX;

export function useGoldPriceAuto() {
  return useQuery({
    queryKey: ["goldPriceAuto"],
    staleTime: 6 * 60 * 60 * 1000,
    queryFn: async () => {
      const src = pickAntamSource(await fetchGoldPricesMulti());
      return src && isPlausibleGoldPrice(src.price_per_gram) ? src : null;
    },
  });
}

// Sumber tunggal status zakat untuk halaman Zakat, Dashboard Aset, dll.
export function useZakat() {
  const { data: me } = useMe();
  const { data: assets = [], isLoading: assetsLoading } = useAssets();
  const { data: debts = [] } = useDebts();
  const { map: rateMap } = useRateMap();
  const { data: payments = [] } = useZakatPayments();
  const { data: auto, isLoading: goldLoading } = useGoldPriceAuto();

  // Prioritas harga: isian manual pengguna (tersimpan di profil) → otomatis.
  const manual = Number(me?.zakat_gold_price) || 0;
  const goldPrice = isPlausibleGoldPrice(manual) ? manual : auto ? Math.round(auto.price_per_gram) : 0;
  const goldSource = isPlausibleGoldPrice(manual)
    ? { kind: "manual", label: "Isian Anda", date: me?.zakat_gold_price_date }
    : auto ? { kind: "auto", label: auto.source, date: auto.date, url: auto.url } : null;

  const includeReceivables = me?.zakat_include_receivables !== false;
  const result = useMemo(
    () => computeZakatMal({ assets, debts, goldPrice, rateMap, includeReceivables }),
    [assets, debts, goldPrice, rateMap, includeReceivables]
  );
  const period = haulPeriod(me?.zakat_haul_date || null);
  const myPayments = payments.filter((p) => !me?.id || p.created_by_id === me.id || !p.created_by_id);
  const paid = paymentsForPeriod(myPayments, period);
  const paidTotal = paid.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = Math.max(0, result.zakat - paidTotal);

  return {
    ...result, me, goldSource, goldLoading, includeReceivables, period,
    payments: myPayments, paid, paidTotal, remaining,
    isPaidOff: result.zakat > 0 && remaining <= 0,
    loading: assetsLoading,
  };
}
