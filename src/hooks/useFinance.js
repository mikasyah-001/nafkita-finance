import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => base44.entities.Category.list(),
  });
}

export function useTransactions() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: () => base44.entities.Transaction.list("-date", 500),
  });
}

export function useAssets() {
  return useQuery({
    queryKey: ["assets"],
    queryFn: () => base44.entities.Asset.list(),
  });
}

export function useRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["assets"] });
  };
}