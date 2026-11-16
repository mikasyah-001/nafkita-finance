import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useMe } from "@/hooks/useFinance";
import { fetchGoldPricesMulti, pickAntamSource } from "@/lib/goldPrice";

// Harga emas acuan (Rp/gram) — SATU sumber untuk Aset, Dashboard, Laporan, Zakat.
// Prioritas: isian pengguna (tersimpan di profil) → otomatis (pencarian AI, dicache 6 jam).
// Harga di luar rentang wajar ditolak agar nilai aset & nisab tidak kacau.
import { GOLD_PRICE_MIN_IDR, GOLD_PRICE_MAX_IDR } from "@/lib/finance";
export const GOLD_PRICE_MIN = GOLD_PRICE_MIN_IDR;
export const GOLD_PRICE_MAX = GOLD_PRICE_MAX_IDR;
export const isPlausibleGoldPrice = (v) => Number(v) >= GOLD_PRICE_MIN && Number(v) <= GOLD_PRICE_MAX;

export function useGoldSources(enabled = true) {
  return useQuery({
    queryKey: ["goldPriceSources"],
    enabled,
    staleTime: 6 * 60 * 60 * 1000,
    queryFn: async () => (await fetchGoldPricesMulti()).filter((s) => isPlausibleGoldPrice(s.price_per_gram)),
  });
}

export function useGoldPrice() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const manual = Number(me?.zakat_gold_price) || 0; // field profil dipakai sebagai harga acuan global
  const hasManual = isPlausibleGoldPrice(manual);
  // Pencarian otomatis (AI) hanya bila belum ada harga isian; "Bandingkan sumber"
  // tetap bisa memicunya lewat refresh(). Hemat kuota & tidak menahan tampilan.
  const { data: sources = [], isLoading, refetch, isFetching } = useGoldSources(!!me && !hasManual);
  const auto = pickAntamSource(sources);
  const price = hasManual ? manual : auto ? Math.round(auto.price_per_gram) : 0;
  const source = hasManual
    ? { kind: "manual", label: "Isian Anda", date: me?.zakat_gold_price_date }
    : auto ? { kind: "auto", label: auto.source, date: auto.date, url: auto.url } : null;

  const save = async (value) => {
    await base44.auth.updateMe(value == null
      ? { zakat_gold_price: null, zakat_gold_price_date: null }
      : { zakat_gold_price: Number(value), zakat_gold_price_date: new Date().toISOString().slice(0, 10) });
    qc.invalidateQueries({ queryKey: ["me"] });
  };

  return { price, source, sources, loading: !hasManual && isLoading, refreshing: isFetching, refresh: refetch, hasManual, save };
}
