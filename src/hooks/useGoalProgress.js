import { useCallback } from "react";
import { useAssets, useRateMap } from "@/hooks/useFinance";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import { goalProgress } from "@/lib/savingsGoal";

/** progressOf(goal) → goalProgress dengan aset, kurs & harga emas terkini (satu sumber). */
export function useGoalProgress() {
  const { data: assets = [] } = useAssets();
  const { map: rateMap } = useRateMap();
  const { price: goldPrice } = useGoldPrice();
  return useCallback((goal) => goalProgress(goal, assets, { rateMap, goldPrice }), [assets, rateMap, goldPrice]);
}
