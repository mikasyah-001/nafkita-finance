import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Check, Loader2, Tag, CalendarDays, Landmark, Palette, Users, Lock, ShieldCheck, GraduationCap, Home as HomeIcon, Plane, Target } from "lucide-react";
import { formatMoney, currencySymbol } from "@/lib/finance";
import { toast } from "sonner";
import FormSheet, { FieldGroup, FieldRow, fieldInput } from "@/components/FormSheet";

const goalTypes = [
  { value: "darurat", label: "Dana darurat", icon: ShieldCheck },
  { value: "pendidikan", label: "Pendidikan", icon: GraduationCap },
  { value: "rumah", label: "Rumah", icon: HomeIcon },
  { value: "perjalanan", label: "Perjalanan", icon: Plane },
  { value: "lainnya", label: "Lainnya", icon: Target },
];

const colors = ["green", "blue", "amber", "violet", "pink", "teal", "orange", "cyan"];
const colorLabels = { green: "Hijau", blue: "Biru", amber: "Kuning", violet: "Ungu", pink: "Merah muda", teal: "Toska", orange: "Oranye", cyan: "Sian" };

export default function SavingsGoalForm({ goal, assets, onClose, onSaved }) {
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
        toast.success("Target diperbarui");
      } else {
        await base44.entities.SavingsGoal.create(data);
        toast.success("Target dibuat");
      }
      onSaved();
    } catch (e) {
      toast.error("Gagal", { description: e?.message });
    }
    setSubmitting(false);
  };

  return (
    <FormSheet
      title={goal?.id ? "Edit target" : "Target tabungan baru"}
      subtitle="Tentukan tujuan, nominal, dan kapan ingin tercapai."
      onClose={onClose}
      footer={
        <button type="submit" form="savings-goal-form" disabled={submitting} className="w-full btn-primary">
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {submitting ? "Menyimpan..." : "Simpan"}
        </button>
      }
    >
      <form id="savings-goal-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Jenis */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Jenis target</p>
          <div id="savings-goal-type" role="radiogroup" aria-label="Jenis target" className="grid grid-cols-5 gap-2">
            {goalTypes.map((t) => {
              const on = form.type === t.value;
              const Icon = t.icon;
              return (
                <button key={t.value} type="button" role="radio" aria-checked={on} onClick={() => setForm({ ...form, type: t.value })}
                  className={`flex flex-col items-center gap-1.5 pt-2.5 pb-2 rounded-2xl border transition-all ${on ? "border-primary bg-primary/[0.07] ring-1 ring-primary" : "border-border bg-card"}`}>
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className={`text-[11px] leading-tight text-center px-0.5 ${on ? "font-semibold" : ""}`}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <FieldGroup label="Identitas">
          <FieldRow icon={Tag} label="Nama target" htmlFor="savings-goal-name">
            <input
              id="savings-goal-name"
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="mis. Dana darurat 6 bulan"
              className={fieldInput}
              required
            />
          </FieldRow>
        </FieldGroup>

        {/* Nominal */}
        <section className="card-gradient-primary rounded-[24px] p-4">
          <label htmlFor="savings-goal-target-amount" className="block text-xs opacity-80">Nominal target</label>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-lg font-semibold opacity-70">{currencySymbol(form.currency)}</span>
            <input
              id="savings-goal-target-amount"
              type="number"
              inputMode="decimal"
              value={form.target_amount}
              onChange={e => setForm({ ...form, target_amount: e.target.value })}
              placeholder="0"
              required
              className="flex-1 min-w-0 bg-transparent outline-none font-heading text-[32px] leading-none font-extrabold tabular-nums placeholder:text-white/30 text-[hsl(var(--hero-foreground))]"
            />
          </div>
        </section>

        <FieldGroup label="Rencana">
          <FieldRow icon={CalendarDays} label="Tanggal target" htmlFor="savings-goal-target-date">
            <input
              id="savings-goal-target-date"
              type="date"
              value={form.target_date}
              onChange={e => setForm({ ...form, target_date: e.target.value })}
              className={fieldInput}
            />
          </FieldRow>
          <FieldRow icon={Landmark} label="Aset sumber (opsional)" htmlFor="savings-goal-linked-asset">
            <select
              id="savings-goal-linked-asset"
              value={form.linked_asset_id}
              onChange={e => setForm({ ...form, linked_asset_id: e.target.value })}
              className={`${fieldInput} bg-background`}
            >
              <option value="">Tidak ada</option>
              {assets.filter(a => a.type === "bank").map(a => (
                <option key={a.id} value={a.id}>{a.name} ({formatMoney(a.value || 0, a.currency)})</option>
              ))}
            </select>
          </FieldRow>
        </FieldGroup>

        <FieldGroup label="Tampilan">
          <FieldRow icon={Palette} label="Warna">
            <div role="radiogroup" aria-label="Warna" className="flex gap-2 flex-wrap mt-1.5">
              {colors.map(c => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={form.color === c}
                  aria-label={colorLabels[c]}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-8 h-8 rounded-full transition-transform ${form.color === c ? "ring-2 ring-offset-2 ring-offset-card ring-foreground scale-105" : ""}`}
                  style={{ backgroundColor: `hsl(var(--chart-${colors.indexOf(c) + 1}))` }}
                />
              ))}
            </div>
          </FieldRow>
          <FieldRow icon={form.visibility === "private" ? Lock : Users} label="Visibilitas"
            trailing={
              <div id="savings-goal-visibility" role="radiogroup" aria-label="Visibilitas" className="flex gap-1 p-0.5 rounded-full bg-muted shrink-0 self-center">
                {[["shared", "Bersama"], ["private", "Pribadi"]].map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={form.visibility === v} onClick={() => setForm({ ...form, visibility: v })}
                    className={`h-7 px-3 rounded-full text-xs font-semibold transition-colors ${form.visibility === v ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>{l}</button>
                ))}
              </div>
            }>
            <p className="text-sm">{form.visibility === "private" ? "Pribadi" : "Bersama pasangan"}</p>
          </FieldRow>
        </FieldGroup>
      </form>
    </FormSheet>
  );
}
