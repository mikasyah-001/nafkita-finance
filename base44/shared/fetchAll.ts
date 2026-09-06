// Paginasi penuh untuk entitas yang memiliki field `date` (transaksi).
// Menghindari batas 500 default dengan menavigasi kursor tanggal.
// Loop berhenti hanya saat batch kosong — tidak ada batas iterasi,
// dan tidak bergantung pada pageSize agar tetap berjalan walau server
// membatas jumlah record per permintaan di bawah pageSize.
export async function fetchAllByDate(entityColl, filter, sort = "-date", pageSize = 5000) {
  const out = [];
  let lastDate = null;
  const seen = new Set();
  while (true) {
    const q = { ...(filter || {}) };
    if (lastDate) q.date = { ...(q.date || {}), $lte: lastDate };
    const batch = await entityColl.filter(q, sort, pageSize);
    if (!batch || batch.length === 0) break;
    let newCount = 0;
    for (const r of batch) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
      newCount++;
    }
    if (newCount === 0) break;
    lastDate = batch[batch.length - 1].date;
  }
  return out;
}

// Paginasi penuh generik berbasis created_date (built-in semua entitas).
// Menghindari batas 500 default dengan menavigasi kursor created_date.
// Loop berhenti hanya saat tidak ada record baru — tidak ada batas iterasi.
export async function fetchAll(entityColl, filter, pageSize = 5000) {
  const out = [];
  let lastDate = null;
  const seen = new Set();
  while (true) {
    const q = { ...(filter || {}) };
    if (lastDate) q.created_date = { ...(q.created_date || {}), $lte: lastDate };
    const batch = await entityColl.filter(q, "-created_date", pageSize);
    if (!batch || batch.length === 0) break;
    let newCount = 0;
    for (const r of batch) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
      newCount++;
    }
    if (newCount === 0) break;
    lastDate = batch[batch.length - 1].created_date;
  }
  return out;
}