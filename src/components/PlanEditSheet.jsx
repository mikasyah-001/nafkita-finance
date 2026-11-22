import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Check, TrendingUp, Vault, Users, Lock } from "lucide-react";
import FormSheet, { FieldGroup, FieldRow } from "@/components/FormSheet";
import MoneyInput from "@/components/MoneyInput";
import Money from "@/components/Money";
import { useSavePlan, planLockedFor } from "@/hooks/useSavePlan";
import { useMe } from "@/hooks/useFinance";
import { currencySymbol, formatDate, spendingPace } from "@/lib/finance";

// Ubah rencana bulan ini langsung (tanpa pindah ke halaman Anggaran).
// Hanya isian yang DIUBAH yang disimpan (isian tak tersentuh tidak pernah
// menimpa target yang ada), dan target buatan pasangan dikunci karena
// Budget hanya bisa diubah pembuatnya.
export default function PlanEditSheet({ plan, period, scope, currency, actualIncome = 0, onClose }) {
  const savePlan = useSavePlan();
  const { data: me } = useMe();
  const initial = { income: plan.income ? String(plan.income) : "", savings: plan.savings ? String(plan.savings) : "" };
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  // Data rencana datang belakangan → isi ulang isian yang belum disentuh.
  useEffect(() => {
    setValues((v) => ({ income: touched.income ? v.income : initial.income, savings: touched.savings ? v.savings : initial.savings }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.income, plan.savings]);

  const locked = { income: planLockedFor(plan.incomeRecord, me?.id), savings: planLockedFor(plan.savingsRecord, me?.id) };
  const set = (key) => (v) => { setValues((s) => ({ ...s, [key]: v })); setTouched((t) => ({ ...t, [key]: true })); };
  // Pratinjau memakai rumus yang sama dengan kartu (spendingPace): tanpa
  // rencana pemasukan → pemasukan nyata bulan ini.
  const preview = spendingPace({ income: actualIncome, planIncome: Number(values.income) || 0, planSavings: Number(values.savings) || 0 });
  const spend = preview ? preview.budget : 0;
  const month = formatDate(`${period}-01T00:00:00`, "MMMM yyyy");
  const changed = ["income", "savings"].filter((k) => touched[k] && !locked[k] && values[k] !== initial[k]);

  const submit = async () => {
    if (!changed.length) return onClose();
    setSaving(true);
    try {
      for (let i = 0; i < changed.length; i++) {
        await savePlan({ key: changed[i], amount: values[changed[i]], plan, period, scope, currency, silent: i < changed.length - 1 });
      }
      toast.success("Rencana disimpan");
      onClose();
    } catch (e) {
      toast.error("Gagal menyimpan rencana", { description: e?.message });
    }
    setSaving(false);
  };

  const field = "w-full bg-transparent outline-none text-lg font-bold tabular-nums py-1 disabled:opacity-60";
  const lockHint = "Dibuat pasangan — hanya ia yang bisa mengubah.";
  return (
    <FormSheet title="Rencana belanja" subtitle={`${month} · ${currency}`} onClose={onClose}
      footer={<button onClick={submit} disabled={saving} className="w-full btn-primary">{saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Simpan rencana</button>}>
      <p className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full bg-muted px-2.5 py-1">
        {scope === "private" ? <Lock className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
        {scope === "private" ? "Rencana pribadi" : "Rencana bersama pasangan"}
      </p>
      <FieldGroup>
        <FieldRow icon={TrendingUp} label="Rencana pemasukan" htmlFor="plan-edit-income" hint={locked.income ? lockHint : `Kosongkan untuk memakai pemasukan nyata${actualIncome > 0 ? " bulan ini" : ""}.`}>
          <div className="flex items-baseline gap-1.5"><span className="text-sm text-muted-foreground">{currencySymbol(currency)}</span>
            <MoneyInput id="plan-edit-income" currency={currency} value={values.income} onChange={set("income")} placeholder="0" className={field} disabled={locked.income} autoFocus={!locked.income} />
          </div>
        </FieldRow>
        <FieldRow icon={Vault} label="Rencana menabung" htmlFor="plan-edit-savings" hint={locked.savings ? lockHint : "Disisihkan dulu sebelum belanja."}>
          <div className="flex items-baseline gap-1.5"><span className="text-sm text-muted-foreground">{currencySymbol(currency)}</span>
            <MoneyInput id="plan-edit-savings" currency={currency} value={values.savings} onChange={set("savings")} placeholder="0" className={field} disabled={locked.savings} />
          </div>
        </FieldRow>
      </FieldGroup>
      <section className="card-gradient-primary rounded-[24px] p-4" aria-live="polite">
        <p className="text-xs opacity-80">Rencana belanja</p>
        <p className="font-heading text-[28px] font-extrabold tabular-nums leading-tight"><Money value={spend} currency={currency} /></p>
        <p className="text-[11px] opacity-75 mt-0.5">= {preview?.source === "income" ? "pemasukan nyata" : "pemasukan"} − menabung. Dipakai untuk jatah harian & "Bisakah saya beli ini?".</p>
      </section>
    </FormSheet>
  );
}
