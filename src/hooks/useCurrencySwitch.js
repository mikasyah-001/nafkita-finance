import { useCallback, useEffect, useRef, useState } from "react";
import { convertAmounts } from "@/lib/finance";

/**
 * Penjaga ganti mata uang untuk form nominal.
 *
 * Masalah yang dicegah: mengetuk chip mata uang hanya mengganti label,
 * sehingga Rp1.008.000 diam-diam menjadi $1.008.000.
 *
 * Bila sudah ada angka saat mata uang diganti, `pending` terisi dan form
 * menampilkan <CurrencySwitchNotice/> dengan tiga pilihan:
 *   - convert(): angka dikonversi dengan kurs,
 *   - keep():    angka memang dalam mata uang baru,
 *   - revert():  kembali ke mata uang semula.
 * `strict` (dipakai saat mengubah data lama) → guardSave() menahan simpan
 * sampai pengguna memilih. Mengetik ulang angka = keputusan sendiri → selesai.
 */
export function useCurrencySwitch({ currency, amounts, setCurrency, setAmounts, rateMap, strict = false }) {
  const [pending, setPending] = useState(null); // { from, to, snapshot }
  const sig = JSON.stringify(amounts || {});
  const noticeRef = useRef(null);

  useEffect(() => {
    if (pending && sig !== pending.snapshot) setPending(null);
  }, [sig, pending]);
  // Mata uang diubah dari luar (mis. tombol saran) kembali ke asal → selesai.
  useEffect(() => {
    if (pending && currency === pending.from) setPending(null);
  }, [currency, pending]);

  const change = useCallback((to) => {
    if (!to || to === currency) return;
    const from = pending?.from ?? currency;
    const has = Object.values(amounts || {}).some((v) => Number(v) > 0);
    setCurrency(to);
    setPending(has && to !== from ? { from, to, snapshot: sig } : null);
  }, [currency, pending, amounts, setCurrency, sig]);

  const converted = pending ? convertAmounts(amounts, pending.from, pending.to, rateMap) : null;

  const convert = () => {
    if (!pending || !converted) return;
    setAmounts(converted);
    setPending(null);
  };
  const keep = () => setPending(null);
  const revert = () => {
    if (!pending) return;
    setCurrency(pending.from);
    setPending(null);
  };

  /** true = simpan harus ditahan (mode strict dan belum dipilih). */
  const guardSave = () => {
    if (!pending || !strict) return false;
    noticeRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    noticeRef.current?.focus?.();
    return true;
  };

  return { pending, change, convert, keep, revert, converted, guardSave, noticeRef, strict, rateMap };
}
