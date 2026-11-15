import { Link } from "react-router-dom";
import { Coins, ArrowRight, CheckCircle2 } from "lucide-react";
import { useZakat } from "@/hooks/useZakat";
import { formatMoney, formatMoneyShort } from "@/lib/finance";

// Ringkasan zakat untuk halaman lain (Dashboard Aset). Angka dari useZakat()
// — sama persis dengan halaman Zakat.
export default function ZakatSummaryCard({ className = "mb-5" }) {
  const z = useZakat();
  if (z.loading) return null;
  const text = z.needsGoldPrice
    ? "Isi harga emas untuk menghitung nisab"
    : z.isPaidOff ? `Zakat ${z.period.label.toLowerCase()} sudah ditunaikan`
    : z.reachesNisab ? `Wajib zakat ${formatMoney(z.remaining, z.currency)}`
    : `Belum mencapai nisab (kurang ${formatMoneyShort(z.nisabGap, z.currency)})`;
  return (
    <Link to="/zakat" className={`card-pastel ${z.reachesNisab && !z.isPaidOff ? "card-pastel-butter" : "card-pastel-mint"} rounded-3xl p-4 flex items-center gap-3 active:scale-[0.99] transition-transform ${className}`}>
      <span className="w-10 h-10 rounded-2xl bg-white/60 dark:bg-white/10 flex items-center justify-center shrink-0">
        {z.isPaidOff ? <CheckCircle2 className="w-5 h-5" /> : <Coins className="w-5 h-5" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold">Zakat mal</span>
        <span className="block text-xs opacity-80">{text}</span>
      </span>
      <ArrowRight className="w-4 h-4 opacity-70" />
    </Link>
  );
}
