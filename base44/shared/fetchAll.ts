// Paginasi penuh untuk entitas yang memiliki field `date` (transaksi).
// Menghindari batas 500 default dengan menavigasi kursor tanggal.
export async function fetchAllByDate(entityColl, filter, sort = "-date", pageSize = 5000) {
  const out = [];
  let lastDate = null;
  for (let i = 0; i < 30; i++) {
    const q = { ...(filter || {}) };
    if (lastDate) q.date = { $lt: lastDate };
    const batch = await entityColl.filter(q, sort, pageSize);
    if (!batch || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < pageSize) break;
    lastDate = batch[batch.length - 1].date;
  }
  return out;
}

// Paginasi penuh generik berbasis created_date (built-in semua entitas).
// Menghindari batas 500 default dengan menavigasi kursor created_date.
export async function fetchAll(entityColl, filter, pageSize = 5000) {
  const out = [];
  let lastDate = null;
  for (let i = 0; i < 50; i++) {
    const q = { ...(filter || {}) };
    if (lastDate) q.created_date = { $lt: lastDate };
    const batch = await entityColl.filter(q, "-created_date", pageSize);
    if (!batch || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < pageSize) break;
    lastDate = batch[batch.length - 1].created_date;
  }
  return out;
}