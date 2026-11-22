import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Check, TrendingUp, Vault, Users, Lock } from "lucide-react";
import FormSheet, { FieldGroup, FieldRow } from "@/components/FormSheet";
import MoneyInput from "@/components/MoneyInput";
import Money from "@/components/Money";
import { useSavePlan } from "@/hooks/useSavePlan";
import { currencySymbol, formatDate } from "@/lib/finance";

// Ubah rencana bulan ini langsung (tanpa pindah ke halaman Anggaran).
// Rencana belanja = rencana pemasukan − rencana menabung.
export default function PlanEditSheet({ plan, period, scope, currency, onClose }) {
  const savePlan = useSavePlan();
  const [income, setIncome] = useState(plan.income ? String(plan.income) : "");
  const [savings, setSavings] = useState(plan.savings ? String(plan.savings) : "");
  const [saving, setSaving] = useState(false);
  const spend = Math.max(0, (Number(income) || 0) - (Number(savings) || 0));
  const month = formatDate(`${period}-01T00:00:00`, "MMMM yyyy");

  const submit = async () => {
    if ((Number(savings) || 0) > (Number(income) || 0) && Number(income) > 0) {
      return toast.error("Rencana menabung melebihi rencana pemasukan");
    }
    setSaving(true);
    try {
      await savePlan({ key: "income", amount: income, plan, period, scope, currency, silent: true });
      await savePlan({ key: "savings", amount: savings, plan, period, scope, currency });
      toast.success("Rencana disimpan");
      onClose();
    } catch (e) {
      toast.error("Gagal menyimpan rencana", { description: e?.message });
    }
    setSaving(false);
  };

  const field = "w-full bg-transparent outline-none text-lg font-bold tabular-nums py-1";
  return (
    <FormSheet title="Rencana belanja" subtitle={`${month} · ${currency}`} onClose={onClose}
      footer={<button onClick={submit} disabled={saving} className="w-full btn-primary">{saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Simpan rencana</button>}>
      <p className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full bg-muted px-2.5 py-1">
        {scope === "private" ? <Lock className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
        {scope === "private" ? "Rencana pribadi" : "Rencana bersama pasangan"}
      </p>
      <FieldGroup>
        <FieldRow icon={TrendingUp} label="Rencana pemasukan" htmlFor="plan-edit-income" hint="Gaji, usaha, dan pemasukan lain bulan ini.">
          <div className="flex items-baseline gap-1.5"><span className="text-sm text-muted-foreground">{currencySymbol(currency)}</span>
            <MoneyInput id="plan-edit-income" currency={currency} value={income} onChange={setIncome} placeholder="0" className={field} autoFocus />
          </div>
        </FieldRow>
        <FieldRow icon={Vault} label="Rencana menabung" htmlFor="plan-edit-savings" hint="Disisihkan dulu sebelum belanja.">
          <div className="flex items-baseline gap-1.5"><span className="text-sm text-muted-foreground">{currencySymbol(currency)}</span>
            <MoneyInput id="plan-edit-savings" currency={currency} value={savings} onChange={setSavings} placeholder="0" className={field} />
          </div>
        </FieldRow>
      </FieldGroup>
      <section className="card-gradient-primary rounded-[24px] p-4" aria-live="polite">
        <p className="text-xs opacity-80">Rencana belanja</p>
        <p className="font-heading text-[28px] font-extrabold tabular-nums leading-tight"><Money value={spend} currency={currency} /></p>
        <p className="text-[11px] opacity-75 mt-0.5">= pemasukan − menabung. Dipakai untuk jatah harian & "Bisakah saya beli ini?".</p>
      </section>
    </FormSheet>
  );
}
