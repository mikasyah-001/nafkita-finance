// Resolusi pasangan (partner) berbasis entitas Partnership.
// Dipakai oleh backend function yang membaca data bersama pasangan.
// Mengembalikan ID pasangan aktif dari user, atau null bila belum terhubung.
import { fetchAll } from "./fetchAll.ts";

export async function resolvePartnerId(base44, userId) {
  if (!userId) return null;
  const partnerships = await fetchAll(base44.asServiceRole.entities.Partnership);
  const active = (partnerships || []).find(
    (p) => p.status === "active" && (p.inviter_id === userId || p.invitee_id === userId)
  );
  if (!active) return null;
  const partnerId = active.inviter_id === userId ? active.invitee_id : active.inviter_id;
  return partnerId || null;
}

// Cek apakah user sudah memiliki koneksi aktif (mencegah pasangan ganda).
export async function hasActivePartnership(base44, userId) {
  if (!userId) return false;
  const partnerships = await fetchAll(base44.asServiceRole.entities.Partnership);
  return (partnerships || []).some(
    (p) => p.status === "active" && (p.inviter_id === userId || p.invitee_id === userId)
  );
}

// Cek apakah user sudah memiliki undangan/permintaan pending (keluar atau masuk).
export async function hasPendingPartnership(base44, userId, email) {
  if (!userId) return false;
  const partnerships = await fetchAll(base44.asServiceRole.entities.Partnership);
  const e = (email || "").toLowerCase();
  return (partnerships || []).some(
    (p) =>
      p.status === "pending" &&
      (p.inviter_id === userId || (e && (p.invitee_email || "").toLowerCase() === e))
  );
}

// Aset yang terlihat oleh user: milik sendiri, atau aset shared milik pasangan.
export function assetVisibleTo(a, userId, partnerId) {
  if (!a) return false;
  if (a.created_by_id === userId) return true;
  if (a.visibility === "shared" && a.created_by_id === partnerId) return true;
  return false;
}

// Transaksi yang terlihat oleh user: milik sendiri, atau transaksi shared milik pasangan.
export function txVisibleTo(t, userId, partnerId) {
  if (!t) return false;
  if (t.created_by_id === userId) return true;
  if (t.visibility === "shared" && t.created_by_id === partnerId) return true;
  return false;
}