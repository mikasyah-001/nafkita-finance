import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { canViewProof, canViewAssetProof, signFile, PROOF_TTL_SEC } from "../../shared/proof.ts";
import { isPrivateFileUri, safeUrl } from "../../shared/txInput.js";

// Signed URL singkat untuk bukti transaksi privat.
//   { transaction_id }: bukti transaksi yang boleh dilihat pemanggil.
//   { asset_id }: bukti pembelian aset yang boleh dilihat pemanggil.
//   { file_uri }: berkas yang BARU diunggah pemanggil (pratinjau & scan AI
//     sebelum transaksi disimpan). Ditolak bila berkas sudah menjadi bukti
//     transaksi milik orang lain.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch { /* tanpa sesi */ }
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));

    if (body.transaction_id) {
      const tx = await base44.asServiceRole.entities.Transaction.get(String(body.transaction_id)).catch(() => null);
      if (!tx) return Response.json({ error: "not_found" }, { status: 404 });
      if (!(await canViewProof(base44, me, tx))) return Response.json({ error: "forbidden" }, { status: 403 });
      if (tx.photo_uri) {
        const url = await signFile(base44, tx.photo_uri);
        if (!url) return Response.json({ error: "sign_failed" }, { status: 502 });
        return Response.json({ url, expires_in: PROOF_TTL_SEC, private: true });
      }
      const legacy = safeUrl(tx.photo_url);
      return legacy ? Response.json({ url: legacy, private: false }) : Response.json({ error: "no_proof" }, { status: 404 });
    }

    if (body.asset_id) {
      const a = await base44.asServiceRole.entities.Asset.get(String(body.asset_id)).catch(() => null);
      if (!a) return Response.json({ error: "not_found" }, { status: 404 });
      if (!(await canViewAssetProof(base44, me, a))) return Response.json({ error: "forbidden" }, { status: 403 });
      if (a.purchase_proof_uri) {
        const url = await signFile(base44, a.purchase_proof_uri);
        if (!url) return Response.json({ error: "sign_failed" }, { status: 502 });
        return Response.json({ url, expires_in: PROOF_TTL_SEC, private: true });
      }
      const legacy = safeUrl(a.purchase_proof_url);
      return legacy ? Response.json({ url: legacy, private: false }) : Response.json({ error: "no_proof" }, { status: 404 });
    }

    const uri = body.file_uri;
    if (uri) {
      if (!isPrivateFileUri(uri)) return Response.json({ error: "invalid_file_uri" }, { status: 400 });
      const used = await base44.asServiceRole.entities.Transaction.filter({ photo_uri: uri }, "-created_date", 5).catch(() => []);
      const usedA = await base44.asServiceRole.entities.Asset.filter({ purchase_proof_uri: uri }, "-created_date", 5).catch(() => []);
      if ([...(used || []), ...(usedA || [])].some((t) => t.created_by_id !== me.id)) return Response.json({ error: "forbidden" }, { status: 403 });
      const url = await signFile(base44, uri, 600);
      if (!url) return Response.json({ error: "sign_failed" }, { status: 502 });
      return Response.json({ url, expires_in: 600, private: true });
    }

    return Response.json({ error: "missing_target" }, { status: 400 });
  } catch (error) {
    console.error("[getProofUrl]", error?.message);
    return Response.json({ error: "proof_failed" }, { status: 500 });
  }
}
