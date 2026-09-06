import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X } from "lucide-react";
import { formatMoney } from "@/lib/finance";
import { useToast } from "@/components/ui/use-toast";

const goalTypes = [
  { value: "darurat", label: "Dana Darurat" },
  { value: "pendidikan", label: "Pendidikan" },
  { value: "rumah", label: "Rumah" },
  { value: "perjalanan", label: "Perjalanan" },
  { value: "lainnya", label: "Lainnya" },
];

const colors = ["green", "blue", "amber", "violet", "pink", "teal", "orange", "cyan"];

export default function SavingsGoalForm({ goal, assets, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: goal?.name || "",
    type: goal?.type || "darurat",
    target_amount: goal?.target_amount || "",
    currency: goal?.currency || "IDR",
    target_date: goal?.target_date || "",
    linked_asset_id: goal?.linked_asset_id || "",
    color: goal?.color || "green",
    visibility: goal?.visibility || "shared",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.target_amount) return;
    setSubmitting(true);
    try {
      const data = {
        ...form,
        target_amount: Number(form.target_amount),
        linked_asset_id: form.linked_asset_id || undefined,
      };
      if (goal?.id) {
        await base44.entities.SavingsGoal.update(goal.id, data);
        toast({ title: "Target diperbarui" });
      } else {
        await base44.entities.SavingsGoal.create(data);
        toast({ title: "Target dibuat" });
      }
      onSaved();
    } catch (e) {
      toast({ title: "Gagal", description: e?.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-border p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{goal?.id ? "Edit Target" : "Target Tabungan Baru"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nama Target</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="mis. Dana Darurat 6 Bulan"
              className="input"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Jenis Target</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="input">
              {goalTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Nominal Target</label>
            <input
              type="number"
              value={form.target_amount}
              onChange={e => setForm({ ...form, target_amount: e.target.value })}
              placeholder="0"
              className="input"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Tanggal Target</label>
            <input
              type="date"
              value={form.target_date}
              onChange={e => setForm({ ...form, target_date: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Aset Sumber (opsional)</label>
            <select
              value={form.linked_asset_id}
              onChange={e => setForm({ ...form, linked_asset_id: e.target.value })}
              className="input"
            >
              <option value="">Tidak ada</option>
              {assets.filter(a => a.type === "bank").map(a => (
                <option key={a.id} value={a.id}>{a.name} ({formatMoney(a.value || 0, a.currency)})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Warna</label>
            <div className="flex gap-2 flex-wrap">
              {colors.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-8 h-8 rounded-full border-2 ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: `hsl(var(--chart-${colors.indexOf(c) + 1}))` }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Visibilitas</label>
            <select value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })} className="input">
              <option value="shared">Bersama Pasangan</option>
              <option value="private">Pribadi</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50"
          >
            {submitting ? "Menyimpan..." : "Simpan"}
          </button>
        </form>
      </div>
    </div>
  );
}