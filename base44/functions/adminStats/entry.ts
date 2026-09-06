import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { fetchAll, fetchAllByDate } from "../../shared/fetchAll.ts";
import { logAdminAction } from "../../shared/auditLog.ts";

// Endpoint admin: agregasi statistik seluruh aplikasi.
// Menghitung user aktif (online <5 menit, 24 jam, 30 hari),
// total transaksi (count + nominal income/expense/sedekah),
// total aset (count + nilai), dan breakdown per-user.
// Hanya admin yang dapat mengakses.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (me.role !== "admin")
      return Response.json({ error: "forbidden" }, { status: 403 });

    const [users, transactions, assets] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.User),
      fetchAllByDate(base44.asServiceRole.entities.Transaction, {}),
      fetchAll(base44.asServiceRole.entities.Asset),
    ]);

    const now = Date.now();
    const FIVE_MIN = 5 * 60 * 1000;
    const DAY = 24 * 60 * 60 * 1000;
    const THIRTY_DAYS = 30 * DAY;

    let activeNow = 0, active24h = 0, active30d = 0;
    for (const u of users) {
      if (!u.last_active_at) continue;
      const t = new Date(u.last_active_at).getTime();
      if (isNaN(t)) continue;
      if (now - t <= FIVE_MIN) activeNow++;
      if (now - t <= DAY) active24h++;
      if (now - t <= THIRTY_DAYS) active30d++;
    }

    // Agregasi transaksi
    let txCount = 0, txIncome = 0, txExpense = 0, txSedekah = 0;
    for (const t of transactions) {
      txCount++;
      const amt = Number(t.amount) || 0;
      if (t.type === "income") txIncome += amt;
      else if (t.type === "expense") txExpense += amt;
      else if (t.type === "sedekah") txSedekah += amt;
    }

    // Agregasi aset
    let assetCount = 0, assetValue = 0;
    for (const a of assets) {
      assetCount++;
      assetValue += Number(a.value) || 0;
    }

    // Breakdown per-user
    const byUser = {};
    for (const u of users) {
      byUser[u.id] = {
        id: u.id,
        name: u.full_name || u.email,
        email: u.email,
        role: u.role,
        last_active_at: u.last_active_at || null,
        tx_count: 0,
        tx_total: 0,
        asset_count: 0,
        asset_value: 0,
      };
    }
    for (const t of transactions) {
      const entry = byUser[t.created_by_id];
      if (!entry) continue;
      entry.tx_count++;
      entry.tx_total += Number(t.amount) || 0;
    }
    for (const a of assets) {
      const entry = byUser[a.created_by_id];
      if (!entry) continue;
      entry.asset_count++;
      entry.asset_value += Number(a.value) || 0;
    }
    const userBreakdown = Object.values(byUser).sort(
      (a, b) => b.tx_count + b.asset_count - (a.tx_count + a.asset_count)
    );

    await logAdminAction(base44, {
      actor_id: me.id,
      actor_name: me.full_name || me.email,
      actor_email: me.email,
      action: "view_admin_stats",
      target_type: "system",
      details: `Statistik: ${users.length} user, ${txCount} transaksi, ${assetCount} aset`,
    });

    return Response.json({
      users: {
        total: users.length,
        active_now: activeNow,
        active_24h: active24h,
        active_30d: active30d,
      },
      transactions: {
        count: txCount,
        income: txIncome,
        expense: txExpense,
        sedekah: txSedekah,
      },
      assets: {
        count: assetCount,
        total_value: assetValue,
      },
      user_breakdown: userBreakdown,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}