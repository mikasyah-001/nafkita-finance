// Bukti transaksi (foto/PDF struk) disimpan sebagai file PRIVAT: Transaction.photo_uri
// berisi referensi file (UploadPrivateFile), bukan URL publik. File hanya bisa
// dibuka lewat signed URL berumur pendek dari getProofUrl, setelah hak lihat dicek.
// Kolom lama photo_url (URL publik) tetap didukung untuk data lama.
//
// Referensi file TIDAK pernah dikirim ke selain pemilik transaksi: tanpa
// referensi, pihak lain tidak bisa meminta signed URL sendiri.
import { resolvePartnerId, txVisibleTo, assetVisibleTo } from "./partnerResolve.ts";

export const PROOF_TTL_SEC = 300;

/** Sembunyikan photo_uri bila yang melihat bukan pemilik; tandai has_proof. */
export function redactProof(tx, viewerId) {
  if (!tx || !tx.photo_uri || tx.created_by_id === viewerId) return tx;
  const { photo_uri: _hidden, ...rest } = tx;
  return { ...rest, has_proof: true };
}

/** Aset: sembunyikan purchase_proof_uri dari selain pemilik. */
export function redactAssetProof(a, viewerId) {
  if (!a || !a.purchase_proof_uri || a.created_by_id === viewerId) return a;
  const { purchase_proof_uri: _hidden, ...rest } = a;
  return { ...rest, has_purchase_proof: true };
}

export async function canViewAssetProof(base44, me, a) {
  if (!me || !a) return false;
  if (a.created_by_id === me.id) return true;
  if (me.role === "admin" && a.visibility !== "private") return true;
  const partnerId = await resolvePartnerId(base44, me.id);
  return !!partnerId && assetVisibleTo(a, me.id, partnerId);
}

/** Boleh melihat bukti: pemilik; pasangan aktif untuk transaksi bersama; admin untuk non-pribadi. */
export async function canViewProof(base44, me, tx) {
  if (!me || !tx) return false;
  if (tx.created_by_id === me.id) return true;
  if (me.role === "admin" && tx.visibility !== "private") return true;
  const partnerId = await resolvePartnerId(base44, me.id);
  return !!partnerId && txVisibleTo(tx, me.id, partnerId);
}

export async function signFile(base44, fileUri, ttl = PROOF_TTL_SEC) {
  const res = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: ttl });
  return res?.signed_url || null;
}
