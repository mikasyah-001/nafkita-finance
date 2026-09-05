// Resolusi pasangan (partner) berbasis entitas Partnership.
// Dipakai oleh backend function yang membaca data bersama pasangan.
// Mengembalikan ID pasangan aktif dari user, atau null bila belum terhubung.
export async function resolvePartnerId(base44, userId) {
  if (!userId) return null;
  const partnerships = await base44.asServiceRole.entities.Partnership.list('-created_date', 200);
  const active = (partnerships || []).find(
    (p) => p.status === 'active' && (p.inviter_id === userId || p.invitee_id === userId)
  );
  if (!active) return null;
  const partnerId = active.inviter_id === userId ? active.invitee_id : active.inviter_id;
  return partnerId || null;
}

// Aset yang terlihat oleh user: milik sendiri, atau aset shared milik pasangan.
export function assetVisibleTo(a, userId, partnerId) {
  if (!a) return false;
  if (a.created_by_id === userId) return true;
  if (a.visibility === 'shared' && a.created_by_id === partnerId) return true;
  return false;
}

// Transaksi yang terlihat oleh user: milik sendiri, atau transaksi shared milik pasangan.
export function txVisibleTo(t, userId, partnerId) {
  if (!t) return false;
  if (t.created_by_id === userId) return true;
  if (t.visibility === 'shared' && t.created_by_id === partnerId) return true;
  return false;
}