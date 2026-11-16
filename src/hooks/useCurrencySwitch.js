import { useCallback, useState } from "react";
import { toast } from "sonner";
import { switchCurrencyAmounts } from "@/lib/finance";

/**
 * Ganti mata uang di form nominal = konversi langsung dengan kurs.
 * Patokan: angka asli saat diketik (lihat switchCurrencyAmounts). Bila kurs
 * belum ada, mata uang tidak diganti — tidak pernah sekadar ganti label.
 */
export function useCurrencySwitch({ currency, amounts, setCurrency, setAmounts, rateMap }) {
  const [origin, setOrigin] = useState(null); // { currency, amounts, sig }

  const change = useCallback((to) => {
    if (!to || to === currency) return;
    const r = switchCurrencyAmounts({ origin, currency, amounts: amounts || {}, to, rateMap });
    if (!r.ok) {
      toast.error(`Kurs ${currency} → ${to} belum tersedia`, { description: "Mata uang tidak diganti agar nominal tidak salah tafsir." });
      return;
    }
    if (JSON.stringify(r.amounts) !== JSON.stringify(amounts || {})) setAmounts(r.amounts);
    setCurrency(to);
    setOrigin(r.origin);
  }, [currency, amounts, origin, rateMap, setAmounts, setCurrency]);

  // Asal konversi masih berlaku selama angka belum diketik ulang.
  const active = origin && origin.sig === JSON.stringify(amounts || {}) ? origin : null;
  return { change, origin: active };
}
