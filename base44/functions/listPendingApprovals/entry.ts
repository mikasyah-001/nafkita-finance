import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { fetchAll } from "../../shared/fetchAll.ts";

// Mengambil daftar persetujuan untuk user:
// - pending_approvals: approval di mana user adalah approver dan status = pending.
// - my_requests: approval di mana user adalah requester (semua status).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Approval di mana user adalah approver dan status pending.
    const pending = await fetchAll(base44.entities.TransactionApproval, {
      approver_id: me.id,
      status: "pending",
    });

    // Approval di mana user adalah requester (semua status, terbaru dulu).
    const myRequests = await fetchAll(base44.entities.TransactionApproval, {
      requester_id: me.id,
    });

    return Response.json({
      pending_approvals: pending || [],
      my_requests: (myRequests || []).slice(0, 50),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}