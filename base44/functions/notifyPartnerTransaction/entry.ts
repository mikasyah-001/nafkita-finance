import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isAuthorizedCall } from "../../shared/workflowAuth.ts";

const formatRupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    if (!await isAuthorizedCall(req, base44)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const txId = body.transaction_id;
    const eventType = body.event_type || 'create';
    if (!txId) return Response.json({ error: 'transaction_id required' }, { status: 400 });

    let tx;
    try {
      tx = await base44.asServiceRole.entities.Transaction.get(txId);
    } catch {
      return Response.json({ skipped: 'transaction_not_found' });
    }
    if (!tx) return Response.json({ skipped: 'transaction_not_found' });
    if (tx.visibility !== 'shared') return Response.json({ skipped: 'not_shared' });

    const actorId = tx.created_by_id;
    if (!actorId) return Response.json({ skipped: 'no_actor' });

    // Cari partnership aktif yang melibatkan pembuat transaksi
    const partnerships = await base44.asServiceRole.entities.Partnership.list('-created_date', 200);
    const active = (partnerships || []).find(
      (p) => p.status === 'active' && (p.inviter_id === actorId || p.invitee_id === actorId)
    );
    if (!active) return Response.json({ skipped: 'no_partner' });

    const partnerId = active.inviter_id === actorId ? active.invitee_id : active.inviter_id;
    if (!partnerId) return Response.json({ skipped: 'partner_not_resolved' });

    // Nama pasangan (aktor)
    let actorName = 'Pasangan';
    try {
      const actor = await base44.asServiceRole.entities.User.get(actorId);
      actorName = (actor && (actor.full_name || actor.email)) || 'Pasangan';
    } catch {}

    const sign = tx.type === 'income' ? '+' : '-';
    const label = tx.merchant || tx.notes || (tx.type === 'sedekah' ? 'Sedekah & Infaq' : tx.category) || 'Transaksi';
    const title = eventType === 'update' ? 'Pasangan memperbarui transaksi' : 'Transaksi baru dari pasangan';
    const bodyText = `${sign}${formatRupiah(tx.amount)} • ${label}`;

    await base44.asServiceRole.entities.Notification.create({
      target_user_id: partnerId,
      actor_name: actorName,
      action: eventType === 'update' ? 'updated' : 'created',
      title,
      body: bodyText,
      ref_id: txId,
      amount: tx.amount,
      tx_type: tx.type,
      read: false,
    });

    return Response.json({ status: 'success', partner_id: partnerId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}