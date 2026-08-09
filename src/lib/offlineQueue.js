const KEY = "keluargafin_pending_tx";

export function getPending() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function addPending(tx) {
  const list = getPending();
  const item = { ...tx, _localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  list.push(item);
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export function removePending(localId) {
  const list = getPending().filter((t) => t._localId !== localId);
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}