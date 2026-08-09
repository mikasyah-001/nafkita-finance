import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Block direct non-admin invocation; allow workflow (no user context)
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch {
      // no user context — invoked by scheduled workflow
    }

    const users = await base44.asServiceRole.entities.User.list();

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const transactions = await base44.asServiceRole.entities.Transaction.filter({
      date: { $gte: start.toISOString() }
    });

    const recordedIds = new Set(transactions.map((t) => t.created_by_id).filter(Boolean));
    const toRemind = users.filter((u) => u.email && !recordedIds.has(u.id));

    let sent = 0;
    for (const u of toRemind) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: u.email,
          subject: "Pengingat: Catat transaksi hari ini 📝",
          body:
            "Halo " + (u.full_name || u.email) + ",\n\n" +
            "Sepertinya kamu belum mencatat transaksi hari ini di KeluargaKu Finance. " +
            "Jangan lupa catat pengeluaran, pemasukan, atau sedekah. Jika ada bon/struk, cukup foto dan AI akan membantu mencatatnya otomatis.\n\n" +
            "Salam,\nKeluargaKu Finance"
        });
        sent++;
      } catch (e) {
        // skip individual send errors
      }
    }

    return Response.json({ sent, total_users: users.length, reminded: toRemind.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}