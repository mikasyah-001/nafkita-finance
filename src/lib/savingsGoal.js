// Progres target tabungan — SATU sumber hitung untuk kartu target, carousel
// Beranda, ringkasan halaman Target (cermin backend: base44/shared/goalProgress.ts).
//
// Dua cara:
// - "assets": target dialokasikan ke beberapa aset ("Disimpan di") → progres =
//   nilai aset-aset itu saat ini, dikonversi ke mata uang target. Otomatis
//   ikut naik-turun; tidak perlu mencatat setoran.
// - "manual": tanpa aset dialokasikan → progres = setoran yang dicatat
//   (current_amount), seperti sebelumnya.
import { convertTo, canConvert, assetMarketValue, roundMoney } from "./finance.js";

export const allocatedIds = (goal) =>
  Array.isArray(goal?.allocated_asset_ids) ? [...new Set(goal.allocated_asset_ids.filter(Boolean))] : [];

/** Jenis aset yang masuk akal sebagai tempat dana target (bukan rumah/tanah). */
export const ALLOCATABLE_TYPES = ["bank", "tunai", "investasi", "emas", "emas_digital", "lainnya"];

export function goalProgress(goal = {}, assets = [], { rateMap = {}, goldPrice = 0 } = {}) {
  const cur = (goal.currency || "IDR").toUpperCase();
  const target = Number(goal.target_amount) || 0;
  const ids = allocatedIds(goal);
  let current = 0;
  let linked = [];
  const unconverted = [];
  const mode = ids.length ? "assets" : "manual";
  if (mode === "assets") {
    linked = ids.map((id) => assets.find((a) => a.id === id)).filter(Boolean);
    for (const a of linked) {
      const v = Number(assetMarketValue(a, goldPrice, rateMap)) || 0;
      const c = (a.currency || "IDR").toUpperCase();
      if (c === cur) current += v;
      else if (canConvert(c, cur, rateMap)) current += convertTo(v, c, cur, rateMap);
      else unconverted.push(a);
    }
    current = roundMoney(current, cur);
  } else {
    current = Number(goal.current_amount) || 0;
  }
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  return {
    mode, current, target, pct,
    remaining: Math.max(0, target - current),
    assets: linked,
    missing: ids.length - linked.length, // aset terhapus / tak terlihat
    unconverted,
  };
}

// ── Proyeksi: kapan target tercapai dengan laju setoran saat ini ─────────
// Laju = rata-rata setoran per bulan dari contribution_history dalam 90 hari
// terakhir (rentang sejak setoran pertama di jendela itu + 1 periode).
// neededPerMonth = setoran per bulan yang dibutuhkan agar tepat waktu.
const MONTH_MS = 30.44 * 864e5;
export function goalProjection(goal = {}, current = 0, { now = new Date() } = {}) {
  const target = Number(goal.target_amount) || 0;
  const remaining = Math.max(0, target - (Number(current) || 0));
  const targetDate = goal.target_date ? new Date(`${String(goal.target_date).slice(0, 10)}T00:00:00`) : null;
  const monthsLeft = targetDate ? (targetDate - now) / MONTH_MS : null;
  const neededPerMonth = targetDate && remaining > 0 ? remaining / Math.max(1, monthsLeft) : null;
  if (remaining <= 0) return { done: true, remaining: 0, perMonth: 0, eta: null, onTrack: true, neededPerMonth: null };

  const since = now.getTime() - 90 * 864e5;
  const recent = (goal.contribution_history || [])
    .filter((c) => c && Number(c.amount) > 0 && c.date && new Date(c.date).getTime() >= since && new Date(c.date) <= now);
  let perMonth = 0;
  if (recent.length) {
    const first = Math.min(...recent.map((c) => new Date(c.date).getTime()));
    // n setoran bulanan = n periode, jadi rentang + 1 bulan; dibatasi jendela 90 hari.
    const spanMonths = Math.min(90 * 864e5 / MONTH_MS, (now.getTime() - first) / MONTH_MS + 1);
    perMonth = recent.reduce((s, c) => s + Number(c.amount), 0) / spanMonths;
  }
  const eta = perMonth > 0 ? new Date(now.getTime() + (remaining / perMonth) * MONTH_MS) : null;
  const onTrack = targetDate && eta ? eta <= targetDate : null;
  return { done: false, remaining, perMonth, eta, onTrack, neededPerMonth, targetDate };
}

// Nominal setoran cepat yang wajar per mata uang.
export function quickDepositAmounts(currency = "IDR") {
  const c = String(currency).toUpperCase();
  if (c === "IDR") return [100_000, 500_000, 1_000_000];
  return [50, 100, 500];
}

// Target sesuai cakupan Bersama/Pribadi (aturan sama dengan rekening di Dompet).
export function goalsInScope(goals = [], { scope = "shared", meId } = {}) {
  return goals.filter((g) => (scope === "private"
    ? g.visibility === "private" && g.created_by_id === meId
    : g.visibility !== "private"));
}

// Peta aset → target aktif lain yang sudah memakainya ("Disimpan di").
// Satu aset hanya boleh menopang satu target aktif agar tidak terhitung dobel.
export function allocationOwners(goals = [], exceptGoalId = null) {
  const owners = {};
  for (const g of goals) {
    if (g.id === exceptGoalId || (g.status || "active") !== "active") continue;
    for (const id of allocatedIds(g)) if (!owners[id]) owners[id] = g;
  }
  return owners;
}

// Total terkumpul per mata uang untuk ringkasan: aset yang (data lama) dipakai
// beberapa target hanya dihitung sekali. progressOf = useGoalProgress().
export function goalsSummary(goals = [], progressOf) {
  const counted = new Set();
  const byCur = {};
  for (const g of goals) {
    const c = g.currency || "IDR";
    byCur[c] ||= { current: 0, target: 0 };
    const ids = allocatedIds(g);
    let current;
    if (ids.length) {
      const fresh = ids.filter((id) => !counted.has(id));
      fresh.forEach((id) => counted.add(id));
      current = fresh.length ? progressOf({ ...g, allocated_asset_ids: fresh }).current : 0;
    } else {
      current = progressOf(g).current;
    }
    byCur[c].current += current;
    byCur[c].target += Number(g.target_amount) || 0;
  }
  return byCur;
}
