import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePartnerId, txVisibleTo } from "../../shared/partnerResolve.ts";
import { fetchAllByDate } from "../../shared/fetchAll.ts";

// Mengembalikan transaksi yang terlihat oleh user yang login:
//   - transaksi milik sendiri (semua, termasuk private), dan
//   - transaksi shared milik pasangan yang terhubung via Partnership aktif.
// Akses dihitung server-side lewat asServiceRole + relasi Partnership,
// sehingga pasangan (role "user") dapat melihat transaksi bersama tanpa
// memerlukan hak admin, dan tidak ada field user-settable yang bisa dipalsukan.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const partnerId = await resolvePartnerId(base44, me.id);

    // Ambil transaksi sendiri + (bila ada pasangan) transaksi shared pasangan.
    const own = await fetchAllByDate(base44.asServiceRole.entities.Transaction, { created_by_id: me.id });
    let partnerTx = [];
    if (partnerId) {
      const raw = await fetchAllByDate(
        base44.asServiceRole.entities.Transaction,
        { created_by_id: partnerId, visibility: 'shared' }
      );
      partnerTx = (raw || []).filter((t) => txVisibleTo(t, me.id, partnerId));
    }

    const all = [...own, ...partnerTx];
    // Urutkan terbaru di depan
    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return Response.json({ transactions: all, partner_id: partnerId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}