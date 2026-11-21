import { useState } from "react";
import { Link } from "react-router-dom";
import { Sprout, TriangleAlert, Target, PencilLine, HelpCircle, ChevronRight } from "lucide-react";
import { useBudgets } from "@/hooks/useFinance";
import { isExpenseBudget } from "@/lib/finance";
import { AffordCheckSheet } from "@/components/AffordCheck";

// "Cek bulan ini" — satu kartu ringkas di Beranda (hanya bila sudah ada
// transaksi): saran paling relevan (aturan sederhana, bukan AI) + jalan pintas
// "Bisakah saya beli ini?". Menggantikan dua kartu besar terpisah.
function pickNudge({ scope, income, expense, sedekah, hasExpense, hasTodayTx, budgets }) {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const hasBudget = budgets.some((b) => isExpenseBudget(b) && b.period === period && (b.visibility || "shared") === scope && b.limit_amount > 0);
  if (income > 0 && expense + sedekah > income)
    return { tone: "warning", icon: TriangleAlert, to: "/laporan?tab=bulanan", title: "Pengeluaran melebihi pemasukan", body: "Cek kategori terbesar bulan ini" };
  if (hasExpense && !hasBudget)
    return { tone: "primary", icon: Sprout, to: "/anggaran", title: "Belum ada anggaran bulan ini", body: "Isi anggaran biar lebih tenang" };
  if (!hasExpense)
    return { tone: "primary", icon: Target, to: "/add", title: "Awali bulan dengan mencatat", body: "Ringkasan langsung terisi" };
  if (!hasTodayTx)
    return { tone: "primary", icon: PencilLine, to: "/add", title: "Belum ada catatan hari ini", body: "Satu menit agar ringkasan tetap akurat" };
  return null;
}

const TONE = {
  warning: "bg-warning/15 text-warning",
  primary: "bg-primary/10 text-primary",
  gold: "bg-gold/25 text-foreground",
};

function Row({ icon: Icon, tone, title, body, titleCls = "" }) {
  return (
    <>
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${TONE[tone]}`}><Icon className="w-4 h-4" /></span>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm font-semibold truncate ${titleCls}`}>{title}</span>
        <span className="block text-xs text-muted-foreground truncate">{body}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </>
  );
}

export default function HomeNudges(props) {
  const { data: budgets = [] } = useBudgets();
  const [afford, setAfford] = useState(false);
  const nudge = pickNudge({ ...props, budgets });
  const rowCls = "w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-muted/60 transition-colors";

  return (
    <section aria-label="Cek bulan ini" className="surface divide-y divide-border mb-5 overflow-hidden">
      {nudge && (
        <Link to={nudge.to} className={rowCls}>
          <Row icon={nudge.icon} tone={nudge.tone} title={nudge.title} body={nudge.body} titleCls={nudge.tone === "warning" ? "text-warning" : ""} />
        </Link>
      )}
      <button type="button" onClick={() => setAfford(true)} className={rowCls}>
        <Row icon={HelpCircle} tone="gold" title="Bisakah saya beli ini?" body="Cek dampaknya ke jatah harian" />
      </button>
      {afford && <AffordCheckSheet onClose={() => setAfford(false)} />}
    </section>
  );
}
