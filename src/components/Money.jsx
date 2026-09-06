import { usePrivacy } from "@/lib/PrivacyContext";
import { formatRupiah, formatMoney, formatMoneyShort } from "@/lib/finance";

export default function Money({ value, format = "full", currency = "IDR", className = "" }) {
  const { hidden } = usePrivacy();
  const text = (() => {
    if (hidden) return "••••••";
    if (format === "short") return formatMoneyShort(value, currency || "IDR");
    if (currency) return formatMoney(value, currency);
    return formatRupiah(value);
  })();
  return <span className={className}>{text}</span>;
}