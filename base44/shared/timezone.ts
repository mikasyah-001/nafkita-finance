// Helper timezone untuk workflow & backend function.
// Default Asia/Riyadh (sesuai pengguna utama); dapat di-override per user.

export const DEFAULT_TZ = "Asia/Riyadh";

// Membaca timezone user dari record user (field timezone), fallback ke default.
export function userTz(u) {
  return (u && u.timezone) || DEFAULT_TZ;
}

// Mengembalikan tanggal "hari ini" (YYYY-MM-DD) dalam timezone tertentu.
export function todayInTz(tz = DEFAULT_TZ) {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

// Mengembalikan periode (YYYY-MM) dalam timezone tertentu.
export function periodInTz(tz = DEFAULT_TZ) {
  const parts = new Date().toLocaleString("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).split("-");
  return `${parts[0]}-${parts[1]}`;
}

// Mengembalikan Date (UTC) yang merupakan awal hari ini 00:00 dalam timezone tertentu.
export function startOfTodayInTz(tz = DEFAULT_TZ) {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = {};
  for (const p of fmt.formatToParts(now)) parts[p.type] = p.value;
  const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
  const tzAsUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    hour, Number(parts.minute), Number(parts.second)
  );
  const offset = tzAsUTC - now.getTime();
  const midnightTz = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day), 0, 0, 0
  );
  return new Date(midnightTz - offset);
}

// Konversi wall-clock (tahun, bulan 0-index, hari, jam, menit, detik) dalam
// timezone tertentu menjadi instant UTC. Offset tz dihitung pada instant tsb.
export function tzWallToUtc(year, monthIndex, day, hour, minute, second, tz = DEFAULT_TZ) {
  const guess = new Date(Date.UTC(year, monthIndex, day, hour, minute, second));
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const p = {};
  for (const part of fmt.formatToParts(guess)) p[part.type] = part.value;
  const h = Number(p.hour) === 24 ? 0 : Number(p.hour);
  const tzAsUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), h, Number(p.minute), Number(p.second));
  const offset = tzAsUTC - guess.getTime();
  return new Date(Date.UTC(year, monthIndex, day, hour, minute, second) - offset);
}

// Batas awal (inklusif) & akhir (eksklusif) "bulan sebelumnya" relatif terhadap
// 'now' dalam timezone tertentu, sebagai instant UTC. Serta tahun & bulan (1-12).
export function prevMonthBoundsInTz(tz = DEFAULT_TZ) {
  const parts = new Date().toLocaleString("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).split("-");
  const curYear = Number(parts[0]);
  const curMonth = Number(parts[1]); // 1-12
  const prevYear = curMonth === 1 ? curYear - 1 : curYear;
  const prevMonth = curMonth === 1 ? 12 : curMonth - 1; // 1-12
  const start = tzWallToUtc(prevYear, prevMonth - 1, 1, 0, 0, 0, tz);
  const end = tzWallToUtc(curYear, curMonth - 1, 1, 0, 0, 0, tz);
  return { start, end, year: prevYear, month: prevMonth };
}