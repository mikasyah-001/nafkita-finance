import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { uploadPrivateFile } from "@/lib/upload";
import { safeUrl } from "../../base44/shared/txInput.js";

// Bukti transaksi privat. Berkas baru diunggah sebagai file PRIVAT
// (Transaction.photo_uri) dan hanya dibuka lewat signed URL singkat dari
// getProofUrl. photo_url = URL publik lama (data sebelum perubahan ini).

export const hasProof = (tx) => !!(tx && (tx.photo_uri || tx.has_proof || tx.photo_url));

/** Unggah bukti privat → { file_uri, preview_url } (preview berlaku ±10 menit). */
export async function uploadProof(file, kind = "imageOrPdf") {
  const up = await uploadPrivateFile(file, kind);
  const file_uri = up?.file_uri;
  if (!file_uri) throw new Error("Gagal mengunggah bukti");
  const res = await base44.functions.invoke("getProofUrl", { file_uri });
  return { file_uri, preview_url: res?.data?.url || "" };
}

/** URL tampilan untuk bukti sebuah transaksi (signed URL atau URL lama). */
export async function proofUrlFor(tx) {
  if (!tx) return "";
  if (tx.photo_uri || tx.has_proof) {
    const res = await base44.functions.invoke("getProofUrl", { transaction_id: tx.id });
    return res?.data?.url || "";
  }
  return safeUrl(tx.photo_url);
}

/** Hook: URL bukti siap tampil; diperbarui sebelum signed URL kedaluwarsa. */
export function useProofUrl(tx) {
  const key = tx ? [tx.id, tx.photo_uri || "", tx.has_proof ? 1 : 0, tx.photo_url || ""] : [];
  return useQuery({
    queryKey: ["proofUrl", ...key],
    enabled: hasProof(tx),
    queryFn: () => proofUrlFor(tx),
    staleTime: 4 * 60 * 1000,
    gcTime: 4 * 60 * 1000,
    retry: 1,
  });
}

// ---- Bukti pembelian aset (sama: privat + signed URL) ----
export const hasAssetProof = (a) => !!(a && (a.purchase_proof_uri || a.has_purchase_proof || a.purchase_proof_url));

export async function assetProofUrlFor(a) {
  if (!a) return "";
  if (a.purchase_proof_uri || a.has_purchase_proof) {
    const res = await base44.functions.invoke("getProofUrl", { asset_id: a.id });
    return res?.data?.url || "";
  }
  return safeUrl(a.purchase_proof_url);
}

export function useAssetProofUrl(a) {
  const key = a ? [a.id, a.purchase_proof_uri || "", a.has_purchase_proof ? 1 : 0, a.purchase_proof_url || ""] : [];
  return useQuery({
    queryKey: ["assetProofUrl", ...key],
    enabled: hasAssetProof(a),
    queryFn: () => assetProofUrlFor(a),
    staleTime: 4 * 60 * 1000,
    gcTime: 4 * 60 * 1000,
    retry: 1,
  });
}
