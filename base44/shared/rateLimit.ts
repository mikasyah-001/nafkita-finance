// Pembatas frekuensi sederhana per kunci (jendela tetap), disimpan di entity
// RateLimit yang hanya bisa ditulis server. Setiap panggilan dihitung — berhasil
// maupun gagal — sehingga menebak berulang tetap terbatas.
// Mengembalikan true bila masih boleh. Bila penyimpanan gagal: tetap izinkan
// (fail-open) agar fitur tidak mati, tetapi dicatat di log.
export async function hitRateLimit(base44, key, max, windowMs) {
  const svc = base44.asServiceRole.entities.RateLimit;
  try {
    const now = Date.now();
    const rows = await svc.filter({ key }, "-created_date", 1);
    const r = rows?.[0];
    const start = r?.window_start ? new Date(r.window_start).getTime() : 0;
    if (!r) {
      await svc.create({ key, count: 1, window_start: new Date(now).toISOString() });
      return true;
    }
    if (!start || now - start >= windowMs) {
      await svc.update(r.id, { count: 1, window_start: new Date(now).toISOString() });
      return true;
    }
    const count = Number(r.count) || 0;
    if (count >= max) return false;
    await svc.update(r.id, { count: count + 1 });
    return true;
  } catch (e) {
    console.error("[rateLimit]", key, e?.message);
    return true;
  }
}
