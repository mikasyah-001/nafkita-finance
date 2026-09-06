import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { fetchAll } from "../../shared/fetchAll.ts";
import { resolvePartnerId } from "../../shared/partnerResolve.ts";

// Mengambil semua target tabungan yang terlihat oleh user:
// - Goals milik sendiri (semua)
// - Goals shared milik pasangan
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const partnerId = await resolvePartnerId(base44, me.id);

    // Goals milik sendiri.
    const ownGoals = await fetchAll(base44.entities.SavingsGoal, { created_by_id: me.id });

    // Goals shared milik pasangan.
    let partnerGoals = [];
    if (partnerId) {
      const allPartnerGoals = await fetchAll(
        base44.asServiceRole.entities.SavingsGoal,
        { created_by_id: partnerId }
      );
      partnerGoals = (allPartnerGoals || []).filter((g) => g.visibility === "shared");
    }

    return Response.json({ goals: [...(ownGoals || []), ...partnerGoals] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}