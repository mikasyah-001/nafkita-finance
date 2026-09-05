import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePartnerId } from "../../shared/partnerResolve.ts";

// Mengembalikan anggaran yang terlihat oleh user yang login:
//   - anggaran milik sendiri (semua), dan
//   - anggaran shared milik pasangan (via Partnership aktif).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const partnerId = await resolvePartnerId(base44, me.id);

    const own = await base44.asServiceRole.entities.Budget.filter({ created_by_id: me.id }, '-created_date', 5000);
    let partnerBudgets = [];
    if (partnerId) {
      const raw = await base44.asServiceRole.entities.Budget.filter({ created_by_id: partnerId, visibility: 'shared' }, '-created_date', 5000);
      partnerBudgets = (raw || []).filter((b) => b.visibility === 'shared' && b.created_by_id === partnerId);
    }

    return Response.json({ budgets: [...(own || []), ...partnerBudgets], partner_id: partnerId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}