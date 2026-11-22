import { base44 } from "@/api/base44Client";
import { useMe, useRefresh } from "@/hooks/useFinance";
import { PLAN_KINDS, PLAN_CATEGORY } from "@/lib/finance";

// Simpan rencana bulanan (target pemasukan / menabung) — satu logika untuk
// kartu "Rencana bulan ini" di Anggaran dan sheet "Ubah" di Lainnya.
// Rencana disimpan sebagai Budget per (periode, cakupan, mata uang).
// Record rencana yang tidak boleh diubah pengguna ini (dibuat pasangan).
export function planLockedFor(rec, meId) {
  return !!(rec && meId && rec.created_by_id && rec.created_by_id !== meId);
}

export function useSavePlan() {
  const { data: me } = useMe();
  const refresh = useRefresh();
  return async ({ key, amount, plan, period, scope, currency, silent = false }) => {
    const num = amount === "" || amount == null ? 0 : Number(amount);
    if (!Number.isFinite(num) || num < 0) throw new Error("Nominal rencana tidak valid");
    const kind = key === "income" ? PLAN_KINDS.income : PLAN_KINDS.savings;
    const rec = key === "income" ? plan.incomeRecord : plan.savingsRecord;
    // Budget hanya bisa diubah pembuatnya (RLS). Gagal lebih awal dengan pesan jelas.
    if (rec && me?.id && rec.created_by_id && rec.created_by_id !== me.id) {
      const err = new Error("Rencana ini dibuat pasangan; hanya ia yang bisa mengubahnya");
      err.code = "not_owner";
      throw err;
    }
    if (rec) await base44.entities.Budget.update(rec.id, { limit_amount: num });
    else if (num > 0) {
      await base44.entities.Budget.create({
        kind, category: PLAN_CATEGORY[kind], limit_amount: num, currency, period, period_type: "monthly",
        visibility: scope,
        assignee_id: scope === "private" ? me?.id : null,
        assignee_name: scope === "private" ? (me?.full_name || me?.email) : null,
      });
    }
    if (!silent) refresh();
  };
}
