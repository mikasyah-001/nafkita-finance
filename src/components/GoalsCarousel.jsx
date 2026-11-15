import { Link } from "react-router-dom";
import { useSavingsGoals } from "@/hooks/useFinance";
import { formatMoneyShort, formatDate } from "@/lib/finance";
import { ShieldCheck, GraduationCap, Home as HomeIcon, Plane, Target, Plus, CalendarDays } from "lucide-react";

// "Rencana kita": target tabungan aktif sebagai kartu pastel yang bisa digeser.
// Memakai data yang sama dengan halaman Target Tabungan (satu sumber data).
const TYPE_ICON = { darurat: ShieldCheck, pendidikan: GraduationCap, rumah: HomeIcon, perjalanan: Plane, lainnya: Target };
const TONES = ["card-pastel-mint", "card-pastel-butter", "card-pastel-lime", "card-pastel-peach", "card-pastel-sage"];

export default function GoalsCarousel() {
  const { data: goals = [], isLoading } = useSavingsGoals();
  const active = goals.filter((g) => (g.status || "active") === "active");
  if (isLoading) return null;

  return (
    <section className="mb-6" aria-labelledby="rencana-title">
      <div className="flex items-end justify-between mb-2.5">
        <div>
          <h2 id="rencana-title" className="font-semibold text-[17px] leading-tight">Rencana kita</h2>
          <p className="text-xs text-muted-foreground">Langkah kecil menuju mimpi keluarga</p>
        </div>
        <Link to="/target-tabungan" className="text-xs font-medium text-primary">Kelola</Link>
      </div>

      <div className="-mx-5 px-5 flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1">
        {active.map((g, i) => {
          const Icon = TYPE_ICON[g.type] || Target;
          const target = Number(g.target_amount) || 0;
          const current = Number(g.current_amount) || 0;
          const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
          const remaining = Math.max(0, target - current);
          return (
            <Link
              key={g.id}
              to="/target-tabungan"
              className={`card-pastel ${TONES[i % TONES.length]} snap-start shrink-0 w-[78%] max-w-[300px] rounded-3xl p-4 relative overflow-hidden active:scale-[0.99] transition-transform`}
            >
              <div className="absolute -right-6 -bottom-8 w-28 h-28 rounded-full bg-white/25 dark:bg-white/5" aria-hidden="true" />
              <div className="flex items-start justify-between gap-2">
                <span className="w-10 h-10 rounded-2xl bg-white/60 dark:bg-white/10 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </span>
                {g.target_date && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white/60 dark:bg-white/10 rounded-full px-2 py-1">
                    <CalendarDays className="w-3 h-3" /> {formatDate(g.target_date, "MMM yyyy")}
                  </span>
                )}
              </div>
              <p className="font-heading font-bold text-lg leading-tight mt-3 line-clamp-1">{g.name}</p>
              <p className="text-xs opacity-75 tabular-nums">{formatMoneyShort(current, g.currency || "IDR")} dari {formatMoneyShort(target, g.currency || "IDR")}</p>
              <div className="flex items-end justify-between mt-3">
                <p className="font-heading font-extrabold text-3xl tabular-nums leading-none">{Math.round(pct)}<span className="text-base font-bold">%</span></p>
                <p className="text-[11px] opacity-75 tabular-nums">Sisa {formatMoneyShort(remaining, g.currency || "IDR")}</p>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-[hsl(var(--pastel-ink))]" style={{ width: `${pct}%` }} />
              </div>
            </Link>
          );
        })}
        <Link
          to="/target-tabungan"
          className="snap-start shrink-0 w-[42%] max-w-[160px] rounded-3xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground p-4 text-center"
        >
          <span className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><Plus className="w-5 h-5" /></span>
          <span className="text-xs font-semibold">{active.length ? "Tambah rencana" : "Buat rencana pertama, mis. Umrah keluarga"}</span>
        </Link>
      </div>
    </section>
  );
}
