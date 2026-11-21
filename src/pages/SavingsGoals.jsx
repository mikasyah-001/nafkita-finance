import { useMemo, useState } from "react";
import { useSavingsGoals, useAssets, useRefresh } from "@/hooks/useFinance";
import { base44 } from "@/api/base44Client";
import { Target, Plus } from "lucide-react";
import { formatMoneyShort } from "@/lib/finance";
import SavingsGoalCard from "@/components/SavingsGoalCard";
import SavingsGoalForm from "@/components/SavingsGoalForm";
import EmptyState from "@/components/EmptyState";
import { confirmAction } from "@/components/ConfirmHost";
import PageHeader from "@/components/PageHeader";
import { ListSkeleton, CardSkeleton } from "@/components/LoadingSkeleton";
import { useGoalProgress } from "@/hooks/useGoalProgress";

const filters = [
  { key: "active", label: "Aktif" },
  { key: "completed", label: "Selesai" },
  { key: "cancelled", label: "Dibatalkan" },
];

export default function SavingsGoals() {
  const { data: goals = [], isLoading } = useSavingsGoals();
  const { data: assets = [] } = useAssets();
  const progressOf = useGoalProgress();
  const refresh = useRefresh();
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [filter, setFilter] = useState("active");

  const filtered = goals.filter(g => filter === "all" ? true : (g.status || "active") === filter);
  // Label "Hampir tercapai" untuk satu target aktif dengan progres tertinggi (<100%).
  const closestId = useMemo(() => {
    let best = null;
    for (const g of goals) {
      if ((g.status || "active") !== "active") continue;
      const pct = progressOf(g).pct;
      if (pct > 0 && pct < 100 && (!best || pct > best.pct)) best = { id: g.id, pct };
    }
    return best?.id || null;
  }, [goals, progressOf]);

  // Ringkasan tampilan saja: total terkumpul vs target untuk target aktif, per mata uang.
  const summary = useMemo(() => {
    const active = goals.filter((g) => (g.status || "active") === "active");
    const byCur = {};
    active.forEach((g) => {
      const c = g.currency || "IDR";
      byCur[c] = byCur[c] || { current: 0, target: 0 };
      byCur[c].current += progressOf(g).current;
      byCur[c].target += Number(g.target_amount) || 0;
    });
    const completed = goals.filter((g) => g.status === "completed").length;
    return { activeCount: active.length, completed, byCur: Object.entries(byCur) };
  }, [goals, progressOf]);

  const handleDelete = async (id) => {
    if (!(await confirmAction({ title: "Hapus target tabungan ini?", description: "Progres yang sudah tercatat di target ini ikut terhapus." }))) return;
    await base44.entities.SavingsGoal.delete(id);
    refresh();
  };

  const handleEdit = (goal) => {
    setEditingGoal(goal);
    setShowForm(true);
  };

  const single = summary.byCur.length === 1 ? summary.byCur[0] : null;
  const singlePct = single && single[1].target > 0 ? Math.min(100, (single[1].current / single[1].target) * 100) : 0;

  return (
    <div className="px-5 pt-6 pb-6">
      <PageHeader
        title="Target tabungan"
        subtitle="Capai target finansial keluarga"
        back
        actions={<>
          <button onClick={() => { setEditingGoal(null); setShowForm(true); }} className="btn-primary btn-sm">
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </>}
      />

      {/* Ringkasan */}
      {isLoading ? <CardSkeleton className="h-32 mb-5" /> : (
        <section aria-label="Ringkasan target" className="card-gradient-primary rounded-[24px] p-5 mb-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white/10 border border-white/10 rounded-full px-2.5 py-1">
              <Target className="w-3 h-3" /> {summary.activeCount} aktif · {summary.completed} selesai
            </span>
          </div>
          <p className="text-xs opacity-75">Terkumpul dari target aktif</p>
          {summary.byCur.length === 0 ? (
            <p className="font-heading text-[28px] leading-tight font-extrabold tabular-nums">—</p>
          ) : (
            summary.byCur.map(([c, v]) => (
              <p key={c} className="font-heading text-[28px] leading-tight font-extrabold tabular-nums break-words">
                {formatMoneyShort(v.current, c)} <span className="text-sm font-semibold opacity-70">dari {formatMoneyShort(v.target, c)}</span>
              </p>
            ))
          )}
          {single && (
            <div className="mt-3 h-1.5 rounded-full bg-white/15 overflow-hidden" aria-hidden="true">
              <div className="h-full rounded-full bg-gold" style={{ width: `${singlePct}%` }} />
            </div>
          )}
        </section>
      )}

      <div className="flex items-end justify-between mb-2.5">
        <div>
          <h2 className="font-semibold text-[17px] leading-tight">Daftar target</h2>
          <p className="text-xs text-muted-foreground">Tambah progress setiap kali menabung</p>
        </div>
      </div>

      <div role="radiogroup" aria-label="Status target" className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
        {filters.map(t => (
          <button
            key={t.key}
            role="radio"
            aria-checked={filter === t.key}
            onClick={() => setFilter(t.key)}
            className={`h-8 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
              filter === t.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground/75 hover:bg-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Target} title="Belum ada target tabungan" subtitle="Buat target pertama Anda untuk mulai menabung" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(goal => (
            <SavingsGoalCard
              key={goal.id}
              closest={goal.id === closestId}
              goal={goal}
              assets={assets}
              onEdit={() => handleEdit(goal)}
              onDelete={() => handleDelete(goal.id)}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}

      {showForm && (
        <SavingsGoalForm
          goal={editingGoal}
          assets={assets}
          onClose={() => { setShowForm(false); setEditingGoal(null); }}
          onSaved={() => { setShowForm(false); setEditingGoal(null); refresh(); }}
        />
      )}
    </div>
  );
}
