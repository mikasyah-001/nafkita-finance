// Tampilan hubungan pasangan — fungsi murni agar bisa dites.

// "1 tahun 2 bulan", "8 bulan 3 hari", "12 hari", "hari ini".
export function connectionDuration(fromISO, now = new Date()) {
  if (!fromISO) return "";
  const from = new Date(fromISO);
  if (isNaN(from)) return "";
  let months = (now.getFullYear() - from.getFullYear()) * 12 + (now.getMonth() - from.getMonth());
  let anchor = new Date(from.getFullYear(), from.getMonth() + months, from.getDate());
  if (anchor > now) { months -= 1; anchor = new Date(from.getFullYear(), from.getMonth() + months, from.getDate()); }
  const days = Math.max(0, Math.floor((now - anchor) / 864e5));
  const years = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (years) parts.push(`${years} tahun`);
  if (m) parts.push(`${m} bulan`);
  if (!years && days) parts.push(`${days} hari`);
  return parts.length ? parts.join(" ") : "hari ini";
}

// "baru saja", "5 menit lalu", "3 jam lalu", "kemarin", "4 hari lalu", lalu tanggal.
export function lastActiveLabel(iso, now = new Date(), formatDate = (d) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short" })) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const min = Math.floor((now - d) / 60000);
  if (min < 2) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} jam lalu`;
  const days = Math.floor(h / 24);
  if (days === 1) return "kemarin";
  if (days < 7) return `${days} hari lalu`;
  return formatDate(d);
}

export const ROLE_LABEL = { suami: "Suami", istri: "Istri" };
