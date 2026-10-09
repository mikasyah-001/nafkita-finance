import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { needsApproval, createApprovalRequest, notifyApprovalRequest } from "../../shared/transactionApproval.ts";
import { resolvePartnerId } from "../../shared/partnerResolve.ts";

// Satu pintu tulis untuk impor massal & scan multi-struk.
// Menerapkan ambang persetujuan pasangan per transaksi: yang melewati ambang
// dibuat sebagai pending + permintaan persetujuan; sisanya dibuat normal.
// Tidak menautkan aset (jalur massal tidak mengubah saldo).
const ALLOWED = ["type", "amount", "currency", "category", "date", "merchant", "notes", "photo_url", "tags", "visibility", "input_by_name", "notif_batch_id"];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const list = Array.isArray(body.transactions) ? body.transactions : [];
    if (!list.length) return Response.json({ error: "missing_transactions" }, { status: 400 });
    if (list.length > 500) return Response.json({ error: "too_many" }, { status: 400 });

    const clean = list.map((t) => {
      const o = {};
      for (const k of ALLOWED) if (t[k] !== undefined) o[k] = t[k];
      o.amount = Number(o.amount) || 0;
      o.input_by_name = o.input_by_name || me.full_name || me.email;
      return o;
    }).filter((t) => t.amount > 0 && t.type && t.date);

    const normal = [];
    const pending = [];
    for (const t of clean) {
      if (await needsApproval(base44, me, t)) pending.push(t);
      else normal.push(t);
    }

    if (normal.length) {
      await base44.entities.Transaction.bulkCreate(normal.map((t) => ({ ...t, approval_status: "approved" })));
    }

    let partnerId = null;
    if (pending.length) partnerId = await resolvePartnerId(base44, me.id);
    for (const t of pending) {
      const tx = await base44.entities.Transaction.create({ ...t, approval_status: "pending" });
      const approval = await createApprovalRequest(base44, me, tx, partnerId);
      await notifyApprovalRequest(base44, me, tx, approval, partnerId);
    }

    return Response.json({ ok: true, saved: normal.length, pending: pending.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}