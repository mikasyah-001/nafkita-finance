import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolvePartnerId, assetVisibleTo } from "../../shared/partnerResolve.ts";

// Menyesuaikan saldo aset bank yang ditautkan ke sebuah transaksi.
// Berjalan sebagai service role (bypass RLS) agar aset shared milik pasangan
// pun bisa disesuaikan, tetapi hanya jika pemanggil adalah pemilik atau pasangan
// aktif dari pemilik aset (divalidasi lewat relasi Partnership).
//
// Payload: { asset_id, delta }  — delta positif menambah, negatif mengurangi.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const assetId = String(body.asset_id || "").trim();
    const delta = Number(body.delta) || 0;
    if (!assetId || !delta) return Response.json({ ok: true, skipped: true });

    const asset = await base44.asServiceRole.entities.Asset.get(assetId);
    if (!asset) return Response.json({ error: 'asset_not_found' }, { status: 404 });

    const partnerId = await resolvePartnerId(base44, me.id);
    if (!assetVisibleTo(asset, me.id, partnerId)) {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    const newValue = Math.max(0, Math.round((asset.value || 0) + delta));
    await base44.asServiceRole.entities.Asset.update(assetId, { value: newValue });
    return Response.json({ ok: true, asset_id: assetId, value: newValue });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}