import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePartnerId, assetVisibleTo } from "../../shared/partnerResolve.ts";
import { fetchAll } from "../../shared/fetchAll.ts";

// Riwayat DCA (InvestmentLot) yang terlihat oleh user — aturan SAMA dengan
// listVisibleAssets: lot pada aset milik sendiri, dan lot pada aset
// BERSAMA milik pasangan. Lot aset pribadi pasangan tidak ikut.
// Dulu lot dibaca langsung (RLS: hanya pembuat), sehingga pasangan melihat
// aset bersama tetapi Riwayat DCA-nya kosong.
// Body opsional: { asset_id } → hanya lot untuk aset itu (bila terlihat).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));

    const partnerId = await resolvePartnerId(base44, me.id);
    const Asset = base44.asServiceRole.entities.Asset;
    const Lot = base44.asServiceRole.entities.InvestmentLot;

    // Aset yang boleh dilihat → kumpulan asset_id.
    const own = await fetchAll(Asset, { created_by_id: me.id });
    let partnerAssets = [];
    if (partnerId) {
      const raw = await fetchAll(Asset, { created_by_id: partnerId, visibility: "shared" });
      partnerAssets = (raw || []).filter((a) => assetVisibleTo(a, me.id, partnerId));
    }
    const visible = new Set([...(own || []), ...partnerAssets].map((a) => a.id));

    if (body?.asset_id) {
      if (!visible.has(body.asset_id)) return Response.json({ lots: [] });
      const lots = await fetchAll(Lot, { asset_id: body.asset_id });
      return Response.json({ lots: lots || [] });
    }

    const mine = await fetchAll(Lot, { created_by_id: me.id });
    const theirs = partnerId ? await fetchAll(Lot, { created_by_id: partnerId }) : [];
    const lots = [...(mine || []), ...(theirs || [])].filter((l) => visible.has(l.asset_id));
    return Response.json({ lots });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
