import { Link } from "react-router-dom";
import { Sprout, TriangleAlert, Target, PencilLine } from "lucide-react";
import { useBudgets } from "@/hooks/useFinance";

// Pengingat kontekstual berbasis aturan sederhana (bukan AI): satu pesan
// paling relevan saja, agar Beranda tidak ramai.
export default function HomeNudges({ scope, income, expense, sedekah, hasExpense, hasTodayTx }) {
  const { data: budgets = [] } = useBudgets();
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const hasBudget = budgets.some((b) => b.period === period && (b.visibility || "shared") === scope && b.limit_amount > 0);

  let nudge = null;
  if (income > 0 && expense + sedekah > income) {
    nudge = { tone: "warning", icon: TriangleAlert, to: "/laporan?tab=bulanan", title: "Pengeluaran melebihi pemasukan", body: "Bulan ini uang keluar lebih besar dari yang masuk. Cek kategori terbesar, yuk." };
  } else if (hasExpense && !hasBudget) {
    nudge = { tone: "primary", icon: Sprout, to: "/anggaran", title: "Belum ada anggaran bulan ini", body: "Pengeluaran sudah tercatat, tapi rencananya belum. Isi anggaran biar lebih tenang." };
  } else if (!hasExpense) {
    nudge = { tone: "primary", icon: Target, to: "/add", title: "Awali bulan dengan mencatat", body: "Catatan pertama bulan ini membuat ringkasan langsung terisi." };
  } else if (!hasTodayTx) {
    nudge = { tone: "primary", icon: PencilLine, to: "/add", title: "Belum ada catatan hari ini", body: "Satu menit mencatat hari ini, ringkasan bulanan tetap akurat." };
  }
  if (!nudge) return null;
  const Icon = nudge.icon;
  const toneCls = nudge.tone === "warning" ? "bg-warning/10 border-warning/30 text-warning" : "bg-primary/[0.07] border-primary/20 text-primary";
  return (
    <Link to={nudge.to} className={`flex items-start gap-3 rounded-2xl border p-3.5 mb-5 active:scale-[0.99] transition-transform ${toneCls}`}>
      <span className="w-8 h-8 rounded-xl bg-card/70 flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{nudge.title}</span>
        <span className="block text-xs text-foreground/70 leading-snug mt-0.5">{nudge.body}</span>
      </span>
    </Link>
  );
}
