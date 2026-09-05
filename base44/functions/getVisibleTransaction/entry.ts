import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePartnerId, txVisibleTo } from "../../shared/partnerResolve.ts";

// Mengembalikan satu transaksi bila terlihat oleh user yang login
// (milik sendiri, atau shared milik pasangan). Dipakai oleh halaman detail
// transaksi — termasuk saat membuka transaksi dari notifikasi pasangan.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = body.id;
    if (!id) return Response.json({ error: 'id required' }, { status: 400 });

    const tx = await base44.asServiceRole.entities.Transaction.get(id);
    if (!tx) return Response.json({ error: 'Not found' }, { status: 404 });

    const partnerId = await resolvePartnerId(base44, me.id);
    if (!txVisibleTo(tx, me.id, partnerId)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    return Response.json({ transaction: tx, partner_id: partnerId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}