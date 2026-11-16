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
    let batch;
    try {
      batch = await filterWithFallback(entityColl, q, sort, pageSize);
    } catch (e) {
      // Halaman pertama gagal = benar-benar gagal; halaman lanjutan gagal →
      // kembalikan yang sudah ada daripada membuang semuanya.
      if (!out.length) throw e;
      console.error("fetchAllByDate: halaman lanjutan gagal, hasil parsial", e?.message);
      break;
    }
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
//
// Tahan gagal: bila server menolak kueri berkursor (mis. entitas bawaan User
// tidak menerima operator $lte atau limit besar), dipakai cara cadangan
// (limit lebih kecil → list biasa) agar fitur tidak mati total.
export async function fetchAll(entityColl, filter, pageSize = 5000) {
  const out = [];
  let lastDate = null;
  const seen = new Set();
  while (true) {
    const q = { ...(filter || {}) };
    if (lastDate) q.created_date = { ...(q.created_date || {}), $lte: lastDate };
    let batch;
    try {
      batch = await filterWithFallback(entityColl, q, "-created_date", pageSize);
    } catch (e) {
      if (!lastDate) {
        // Kueri awal ditolak → coba tanpa kursor sama sekali.
        const plain = await plainList(entityColl, filter);
        if (plain) return plain;
        throw e;
      }
      console.error("fetchAll: halaman lanjutan gagal, hasil parsial", e?.message);
      break;
    }
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

// filter() dengan limit besar; bila ditolak, ulangi dengan limit 500.
async function filterWithFallback(entityColl, q, sort, pageSize) {
  try {
    return await entityColl.filter(q, sort, pageSize);
  } catch (e) {
    if (pageSize <= 500) throw e;
    console.error(`filter(limit ${pageSize}) ditolak, ulangi limit 500:`, e?.message);
    return await entityColl.filter(q, sort, 500);
  }
}

// Cadangan terakhir: satu permintaan tanpa kursor.
async function plainList(entityColl, filter) {
  const hasFilter = filter && Object.keys(filter).length > 0;
  for (const attempt of [
    () => (hasFilter ? entityColl.filter(filter) : entityColl.list("-created_date", 5000)),
    () => (hasFilter ? entityColl.filter(filter, undefined, 500) : entityColl.list()),
  ]) {
    try {
      const r = await attempt();
      if (Array.isArray(r)) return r;
    } catch (e) {
      console.error("fetchAll cadangan gagal:", e?.message);
    }
  }
  return null;
}
