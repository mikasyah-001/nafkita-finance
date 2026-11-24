// Sel CSV aman untuk Excel/Sheets.
// - Teks yang diawali = + - @ TAB CR diberi awalan ' (cegah formula injection:
//   mis. merchant "=HYPERLINK(...)" dari struk/SMS).
// - Angka (typeof number) dibiarkan apa adanya, termasuk negatif, agar tetap
//   bisa dijumlahkan — dulu "-5000" ikut diberi ' dan berubah menjadi teks.
export function csvCell(v) {
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const rowToCsv = (cells) => cells.map(csvCell).join(",");
