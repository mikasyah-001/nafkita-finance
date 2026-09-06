import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { resolvePartnerId } from "../../shared/partnerResolve.ts";
import { fetchAll } from "../../shared/fetchAll.ts";

// Mengembalikan tagihan berulang yang terlihat oleh user yang login:
//   - milik sendiri (semua, termasuk private), dan
//   - shared milik pasangan yang terhubung via Partnership aktif.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const partnerId = await resolvePartnerId(base44, me.id);

    const own = await fetchAll(base44.asServiceRole.entities.RecurringBill, { created_by_id: me.id });
    let partnerBills = [];
    if (partnerId) {
      partnerBills = await fetchAll(
        base44.asServiceRole.entities.RecurringBill,
        { created_by_id: partnerId, visibility: "shared" }
      );
    }

    const all = [...own, ...partnerBills];
    all.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
    return Response.json({ bills: all, partner_id: partnerId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}