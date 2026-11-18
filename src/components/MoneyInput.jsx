import { forwardRef, useLayoutEffect, useRef } from "react";
import { formatAmountInput, parseAmountInput, significantLeft, caretAfterFormat } from "@/lib/moneyInput";

/**
 * Kotak isian nominal dengan pemisah ribuan saat diketik (1.008.000 /
 * 1,785.54). `value` & `onChange` memakai angka murni sebagai string, sama
 * seperti <input type="number"> sebelumnya — pemanggil tidak perlu berubah.
 */
const MoneyInput = forwardRef(function MoneyInput(
  { value, onChange, currency = "IDR", decimals = 2, className = "", ...rest },
  ref,
) {
  const inner = useRef(null);
  const caret = useRef(null);
  const isIdr = String(currency || "IDR").toUpperCase() === "IDR";
  const shown = formatAmountInput(value == null ? "" : String(value), currency);

  const setRefs = (el) => {
    inner.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  // Pulihkan posisi kursor setelah teks diformat ulang.
  useLayoutEffect(() => {
    const el = inner.current;
    if (caret.current == null || !el || document.activeElement !== el) return;
    const pos = caretAfterFormat(el.value, caret.current, currency);
    caret.current = null;
    try { el.setSelectionRange(pos, pos); } catch { /* jenis input tanpa seleksi */ }
  });

  const handleChange = (e) => {
    const text = e.target.value;
    caret.current = significantLeft(text, e.target.selectionStart ?? text.length, currency);
    onChange?.(parseAmountInput(text, currency, isIdr ? 0 : decimals));
  };

  return (
    <input
      ref={setRefs}
      type="text"
      inputMode={isIdr || decimals === 0 ? "numeric" : "decimal"}
      autoComplete="off"
      value={shown}
      onChange={handleChange}
      className={`tabular-nums ${className}`}
      {...rest}
    />
  );
});

export default MoneyInput;
