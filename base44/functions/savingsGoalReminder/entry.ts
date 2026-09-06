import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { fetchAll } from "../../shared/fetchAll.ts";
import { createNotificationIdempotent } from "../../shared/notifyCommon.ts";
import { formatMoney } from "../../shared/notifyCommon.ts";

// Dipanggil workflow terjadwal mingguan.
// Memeriksa semua target tabungan aktif dengan target_date:
// - Menghitung progress yang diharapkan vs aktual.
// - Bila behind schedule (current < 80% expected), kirim notifikasi ke pemilik.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();

    const goals = await fetchAll(base44.asServiceRole.entities.SavingsGoal, {
      status: "active",
    });

    const results = [];
    for (const goal of goals || []) {
      if (!goal.target_date) continue;
      if (!goal.target_amount || goal.target_amount <= 0) continue;

      const targetDate = new Date(goal.target_date);
      if (targetDate <= now) continue;

      // Hitung progress yang diharapkan berdasarkan waktu berlalu.
      const createdDate = new Date(goal.created_date);
      const totalDuration = targetDate - createdDate;
      const elapsedDuration = now - createdDate;
      if (totalDuration <= 0) continue;

      const expectedProgress = Math.min(1, elapsedDuration / totalDuration);
      const expectedAmount = (goal.target_amount || 0) * expectedProgress;

      // Bila current_amount < 80% expected, kirim pengingat.
      if ((goal.current_amount || 0) < expectedAmount * 0.8) {
        const shortfall = expectedAmount - (goal.current_amount || 0);
        const cur = goal.currency || "IDR";

        await createNotificationIdempotent(base44, {
          target_user_id: goal.created_by_id,
          actor_name: "NAFKITA",
          action: "created",
          entity_kind: "bulk",
          event_key: `goal_reminder:${goal.id}:${now.toISOString().slice(0, 10)}`,
          title: `Target tabungan tertinggal: ${goal.name}`,
          body: `Progress ${formatMoney(goal.current_amount || 0, cur)} di bawah target. Perlu ${formatMoney(shortfall, cur)} lagi untuk sesuai jadwal.`,
          ref_id: goal.id,
        });

        results.push({ goal_id: goal.id, behind: true, shortfall });
      }
    }

    return Response.json({ ok: true, checked: goals?.length || 0, reminders: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}