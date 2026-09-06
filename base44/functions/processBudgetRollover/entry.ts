import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { fetchAll } from "../../shared/fetchAll.ts";

// Dipanggil workflow terjadwal (cron awal bulan).
// Memproses semua anggaran dengan rollover_enabled:
// 1. Hitung pengeluaran aktual untuk periode sebelumnya.
// 2. Hitung sisa/overspend: effective_limit - spent.
// 3. Bila sisa > 0: rollover positif.
//    Bila overspend dan policy=carry_negative: rollover negatif.
//    Bila overspend dan policy=reset_on_overspend: rollover = 0.
// 4. Update rollover_amount dan period ke periode berikutnya.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();

    // Hitung periode sebelumnya (asumsikan monthly: "YYYY-MM").
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevPeriod = prevDate.toISOString().slice(0, 7);
    const nextPeriod = now.toISOString().slice(0, 7);

    // Rentang tanggal periode sebelumnya.
    const periodStart = new Date(prevDate.getFullYear(), prevDate.getMonth(), 1);
    const periodEnd = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0, 23, 59, 59, 999);

    // Ambil semua anggaran dengan rollover_enabled.
    const budgets = await fetchAll(base44.asServiceRole.entities.Budget, {
      rollover_enabled: true,
    });

    let processed = 0;
    const results = [];

    for (const budget of budgets || []) {
      try {
        // Hanya proses anggaran monthly yang period-nya = periode sebelumnya.
        const pt = budget.period_type || "monthly";
        if (pt !== "monthly") continue;
        if (budget.period !== prevPeriod) continue;

        // Ambil transaksi expense untuk kategori ini.
        const txFilter = { category: budget.category, type: "expense" };
        if (budget.assignee_id) {
          txFilter.created_by_id = budget.assignee_id;
        }
        const txs = await fetchAll(base44.asServiceRole.entities.Transaction, txFilter);

        // Filter transaksi dalam rentang periode dan approved.
        const periodTxs = (txs || []).filter((t) => {
          if (t.approval_status && t.approval_status !== "approved") return false;
          if (t.transfer_pair_id) return false;
          const d = new Date(t.date);
          return d >= periodStart && d <= periodEnd;
        });

        const spent = periodTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const effectiveLimit = (budget.limit_amount || 0) + (budget.rollover_amount || 0);
        const remaining = effectiveLimit - spent;

        let newRollover = 0;
        if (remaining > 0) {
          newRollover = remaining;
        } else if (remaining < 0 && budget.rollover_policy === "carry_negative") {
          newRollover = remaining;
        }
        // reset_on_overspend: newRollover stays 0.

        await base44.asServiceRole.entities.Budget.update(budget.id, {
          rollover_amount: newRollover,
          period: nextPeriod,
        });

        processed++;
        results.push({
          budget_id: budget.id,
          category: budget.category,
          spent,
          effective_limit: effectiveLimit,
          remaining,
          new_rollover: newRollover,
        });
      } catch (e) {
        console.error("[processBudgetRollover] failed for budget", budget.id, e);
        results.push({ budget_id: budget.id, error: e?.message || "failed" });
      }
    }

    return Response.json({ ok: true, processed, period: prevPeriod, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}