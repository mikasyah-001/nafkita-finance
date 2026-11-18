// Isian nominal dengan pemisah ribuan saat diketik — satu sumber logika
// untuk semua kotak nominal. Nilai yang disimpan tetap angka murni
// ("1008000", "237.18"); hanya tampilannya yang dikelompokkan.
//
// Konvensi mengikuti tampilan uang di aplikasi (formatMoney):
//   IDR  → titik ribuan, tanpa desimal: 1.008.000
//   lain → koma ribuan, titik desimal:  1,785.54 (SAR, USD, …)

const isIdr = (currency) => String(currency || "IDR").toUpperCase() === "IDR";

/**
 * Teks ketikan → angka murni (string). IDR: hanya digit. Mata uang lain:
 * koma = pemisah ribuan, satu titik desimal, maksimal `decimals` digit.
 */
export function parseAmountInput(text, currency = "IDR", decimals = 2) {
  const s = String(text ?? "");
  if (isIdr(currency)) return s.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  let t = s.replace(/,/g, "").replace(/[^\d.]/g, "");
  const dot = t.indexOf(".");
  if (dot >= 0) t = t.slice(0, dot + 1) + t.slice(dot + 1).replace(/\./g, "").slice(0, decimals);
  if (decimals === 0) t = t.replace(/\..*$/, "");
  t = t.replace(/^0+(?=\d)/, "");
  return t.startsWith(".") ? `0${t}` : t;
}

/** Angka murni → tampilan berpemisah ribuan (desimal yang sedang diketik dipertahankan). */
export function formatAmountInput(raw, currency = "IDR") {
  const s = raw == null ? "" : String(raw);
  if (s === "") return "";
  const [int, dec] = s.split(".");
  const sep = isIdr(currency) ? "." : ",";
  const grouped = (int || "0").replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  if (isIdr(currency)) return grouped;
  return dec !== undefined ? `${grouped}.${dec}` : grouped;
}

/** Karakter "bermakna" (bukan pemisah ribuan): digit, dan titik desimal untuk non-IDR. */
export const isSignificantChar = (ch, currency = "IDR") => /\d/.test(ch) || (!isIdr(currency) && ch === ".");

/** Jumlah karakter bermakna di kiri posisi `caret`. */
export function significantLeft(text, caret, currency = "IDR") {
  let n = 0;
  for (let i = 0; i < Math.min(caret, text.length); i++) if (isSignificantChar(text[i], currency)) n++;
  return n;
}

/**
 * Posisi kursor setelah diformat ulang: jumlah karakter bermakna di kiri
 * kursor dipertahankan, agar mengetik di tengah angka tidak melompat ke akhir.
 */
export function caretAfterFormat(formatted, sigLeft, currency = "IDR") {
  if (sigLeft <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (isSignificantChar(formatted[i], currency)) seen++;
    if (seen >= sigLeft) return i + 1;
  }
  return formatted.length;
}
