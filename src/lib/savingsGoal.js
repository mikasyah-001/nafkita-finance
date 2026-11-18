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
