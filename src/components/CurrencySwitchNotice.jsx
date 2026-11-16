import { formatMoneyPlain } from "@/lib/finance";

/** Teks "Dikonversi dari Rp1.008.000" bila nominal hasil ganti mata uang, selain itu "". */
export function convertedFromLabel(guard, field) {
  const o = guard?.origin;
  if (!o) return "";
  const key = field || Object.keys(o.amounts).find((k) => Number(o.amounts[k]) > 0);
  return key ? `Dikonversi dari ${formatMoneyPlain(Number(o.amounts[key]), o.currency)}` : "";
}

/** Satu baris kecil setelah mata uang diganti. */
export default function CurrencySwitchNotice({ guard, field, tone = "hero" }) {
  const label = convertedFromLabel(guard, field);
  if (!label) return null;
  return <p className={`text-[11px] mt-1 tabular-nums ${tone === "hero" ? "opacity-70" : "text-muted-foreground"}`}>{label}</p>;
}
