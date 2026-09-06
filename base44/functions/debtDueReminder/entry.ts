import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { fetchAll } from "../../shared/fetchAll.ts";

// Dipanggil workflow terjadwal harian.
// Membuat notifikasi untuk utang/piutang yang jatuh tempo dalam 3 hari
// dan belum lunas (status != paid).
//
// Menggunakan asServiceRole karena workflow tidak memiliki konteks user.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const today = new Date().toISOString().slice(0, 10);
    const todayTime = new Date(today + "T00:00:00.000Z").getTime();
    const threeDaysLater = new Date(todayTime + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const debts = await fetchAll(base44.asServiceRole.entities.Debt, {});
    const due = (debts || []).filter((d) => {
      if (d.status === "paid") return false;
      if (!d.due_date) return false;
      return d.due_date >= today && d.due_date <= threeDaysLater;
    });

    const results = [];
    for (const debt of due) {
      try {
        const daysLeft = Math.ceil((new Date(debt.due_date + "T00:00:00.000Z").getTime() - todayTime) / (24 * 60 * 60 * 1000));
        const typeLabel = debt.type === "utang" ? "utang" : "piutang";
        const title = daysLeft <= 0
          ? `${typeLabel.charAt(0).toUpperCase()}${typeLabel.slice(1)} jatuh tempo hari ini`
          : `${typeLabel.charAt(0).toUpperCase()}${typeLabel.slice(1)} jatuh tempo dalam ${daysLeft} hari`;
        const body = `${debt.counterparty_name || ""} — ${debt.currency || "IDR"} ${Number(debt.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

        const eventKey = `debt-due:${debt.id}:${debt.due_date}`;
        // Cek apakah notifikasi sudah ada (idempotensi).
        const existing = await base44.asServiceRole.entities.Notification.filter({ event_key: eventKey });
        if (existing && existing.length > 0) {
          results.push({ debt_id: debt.id, skipped: "already_notified" });
          continue;
        }

        const notif = await base44.asServiceRole.entities.Notification.create({
          target_user_id: debt.created_by_id,
          actor_name: "Sistem",
          action: "created",
          entity_kind: "bulk",
          event_key: eventKey,
          title,
          body,
          ref_id: debt.id,
          read: false,
        });
        results.push({ debt_id: debt.id, notif_id: notif.id });
      } catch (e) {
        console.error("[debtDueReminder] failed for debt", debt.id, e);
        results.push({ debt_id: debt.id, error: e?.message || "failed" });
      }
    }

    return Response.json({ ok: true, reminders: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}