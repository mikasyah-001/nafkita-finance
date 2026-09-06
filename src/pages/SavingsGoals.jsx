import { useState } from "react";
import { useSavingsGoals, useAssets, useRefresh } from "@/hooks/useFinance";
import { base44 } from "@/api/base44Client";
import { Target, Plus } from "lucide-react";
import SavingsGoalCard from "@/components/SavingsGoalCard";
import SavingsGoalForm from "@/components/SavingsGoalForm";
import EmptyState from "@/components/EmptyState";

export default function SavingsGoals() {
  const { data: goals = [], isLoading } = useSavingsGoals();
  const { data: assets = [] } = useAssets();
  const refresh = useRefresh();
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [filter, setFilter] = useState("active");

  const filtered = goals.filter(g => filter === "all" ? true : (g.status || "active") === filter);

  const handleDelete = async (id) => {
    if (!confirm("Hapus target tabungan ini?")) return;
    await base44.entities.SavingsGoal.delete(id);
    refresh();
  };

  const handleEdit = (goal) => {
    setEditingGoal(goal);
    setShowForm(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">Target Tabungan</h1>
          <p className="text-sm text-muted-foreground mt-1">Capai target finansial keluarga</p>
        </div>
        <button onClick={() => { setEditingGoal(null); setShowForm(true); }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
          <Plus className="w-4 h-4" /> Tambah
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {[
          { key: "active", label: "Aktif" },
          { key: "completed", label: "Selesai" },
          { key: "cancelled", label: "Dibatalkan" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Memuat...</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Target} title="Belum ada target tabungan" subtitle="Buat target pertama Anda untuk mulai menabung" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(goal => (
            <SavingsGoalCard
              key={goal.id}
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