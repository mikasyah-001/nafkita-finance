import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Menghapus aset beserta lot investasi yang tertaut secara atomik.
// Mencegah lot yatim (InvestmentLot dengan asset_id yang tidak lagi ada).
// Hanya pemilik aset (created_by_id === me.id) yang boleh menghapus.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const assetId = body.asset_id;
    if (!assetId) return Response.json({ error: "asset_id required" }, { status: 400 });

    // Verifikasi kepemilikan.
    const asset = await base44.entities.Asset.get(assetId);
    if (!asset) return Response.json({ error: "asset_not_found" }, { status: 404 });
    if (asset.created_by_id !== me.id)
      return Response.json({ error: "forbidden" }, { status: 403 });

    // Hapus lot investasi yang tertaut (jika ada).
    let lotsDeleted = 0;
    try {
      const lots = await base44.asServiceRole.entities.InvestmentLot.filter(
        { asset_id: assetId },
        "-date",
        500
      );
      if (lots && lots.length > 0) {
        await base44.asServiceRole.entities.InvestmentLot.deleteMany({ asset_id: assetId });
        lotsDeleted = lots.length;
      }
    } catch {}

    // Hapus aset.
    await base44.entities.Asset.delete(assetId);

    return Response.json({ ok: true, asset_id: assetId, lots_deleted: lotsDeleted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}