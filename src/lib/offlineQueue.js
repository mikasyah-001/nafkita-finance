// Antrean transaksi offline dicakup per akun (user id) agar transaksi tertunda
// akun A tidak ikut tersinkron saat akun B login di perangkat yang sama.
const keyFor = (userId) => `nafkita_pending_tx_${userId || "anon"}`;

export function getPending(userId) {
  try {
    return JSON.parse(localStorage.getItem(keyFor(userId)) || "[]");
  } catch {
    return [];
  }
}

export function addPending(tx, userId) {
  const list = getPending(userId);
  const item = { ...tx, _localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  list.push(item);
  localStorage.setItem(keyFor(userId), JSON.stringify(list));
  return list;
}

export function removePending(localId, userId) {
  const list = getPending(userId).filter((t) => t._localId !== localId);
  localStorage.setItem(keyFor(userId), JSON.stringify(list));
  return list;
}

// Menghapus field internal antrean lokal sebelum dikirim ke backend,
// agar tidak ikut tersimpan di entitas transaksi.
export function toBackendTx(tx) {
  if (!tx) return tx;
  const { _localId, ...rest } = tx;
  return rest;
}