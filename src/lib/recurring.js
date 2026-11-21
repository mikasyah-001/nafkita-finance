// Logika tampilan tagihan berulang — sumber tunggal untuk Beranda & halaman
// Tagihan. Tanggal dibandingkan sebagai YYYY-MM-DD (tanpa jam) agar tidak
// bergeser karena zona waktu.
import { computeRecurringNextDate, convertTo, canConvert } from "./finance.js";

const DAY = 864e5;
const ymd = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const toUTC = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));

export const DUE_SOON_DAYS = 3;

// Status satu tagihan relatif terhadap hari ini.
// kind: overdue | today | soon (≤3 hari) | upcoming | paused | none
export function billDue(bill, today = new Date()) {
  if (!bill) return { kind: "none", days: null, label: "" };
  if (bill.status !== "active") return { kind: "paused", days: null, label: "Dijeda" };
  if (!bill.next_date) return { kind: "none", days: null, label: "" };
  const days = Math.round((toUTC(String(bill.next_date).slice(0, 10)) - toUTC(ymd(today))) / DAY);
  if (days < 0) return { kind: "overdue", days, label: `Terlambat ${-days} hari` };
  if (days === 0) return { kind: "today", days, label: "Hari ini" };
  if (days === 1) return { kind: "soon", days, label: "Besok" };
  if (days <= DUE_SOON_DAYS) return { kind: "soon", days, label: `${days} hari lagi` };
  return { kind: "upcoming", days, label: `${days} hari lagi` };
}

// Tagihan aktif diurutkan dari jatuh tempo terdekat.
export function sortByDue(bills = []) {
  return [...bills]
    .filter((b) => b.status === "active" && b.next_date)
    .sort((a, b) => String(a.next_date).localeCompare(String(b.next_date)));
}

// Total tagihan yang akan jatuh tempo dalam `days` hari ke depan (termasuk
// yang terlambat), menghitung setiap kemunculan (tagihan mingguan = ±4×).
// Dikonversi ke `currency`; yang belum ada kursnya dikumpulkan terpisah.
export function upcomingTotal(bills = [], { days = 30, today = new Date(), currency = "IDR", rateMap = {} } = {}) {
  const horizon = ymd(new Date(today.getTime() + days * DAY));
  const todayStr = ymd(today);
  let total = 0, count = 0, dueThisWeek = 0;
  const unconverted = {};
  const week = ymd(new Date(today.getTime() + 7 * DAY));
  for (const b of bills) {
    if (b.status !== "active" || !b.next_date) continue;
    let d = String(b.next_date).slice(0, 10);
    for (let i = 0; i < 400 && d <= horizon; i++) {
      const from = (b.currency || "IDR").toUpperCase();
      const amt = Number(b.amount) || 0;
      if (canConvert(from, currency, rateMap)) total += convertTo(amt, from, currency, rateMap);
      else unconverted[from] = (unconverted[from] || 0) + amt;
      count += 1;
      if (d <= week || d < todayStr) dueThisWeek += 1;
      const next = computeRecurringNextDate(d, b.frequency);
      if (!next || next <= d) break;
      d = next;
    }
  }
  return { total, count, dueThisWeek, unconverted };
}
