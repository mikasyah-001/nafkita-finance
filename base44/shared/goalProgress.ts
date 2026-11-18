// Cermin backend dari src/lib/savingsGoal.js (paritas diuji di
// src/lib/__tests__/savingsGoal.test.js). Dipakai pengingat target tabungan.
// Backend memakai nilai aset tersimpan (asset.value); untuk emas nilai itu
// diperbarui setiap aset disimpan / harga emas dihitung ulang.

export function buildRateMapFromRates(rates) {
  const map = { IDR: 1 };
  (rates || []).forEach((r) => {
    const base = String(r.base_currency || "").toUpperCase();
    const quote = String(r.quote_currency || "").toUpperCase();
    const rate = Number(r.rate) || 0;
    if (!base || rate <= 0) return;
    if (quote === "IDR" && base !== "IDR") map[base] = rate;
    else if (base === "IDR" && quote !== "IDR") map[quote] = 1 / rate;
  });
  return map;
}

export const allocatedIds = (goal) =>
  Array.isArray(goal?.allocated_asset_ids) ? [...new Set(goal.allocated_asset_ids.filter(Boolean))] : [];

/** Nilai terkini target: jumlah nilai aset dialokasikan (dikonversi), atau setoran manual. */
export function goalCurrentAmount(goal, assets, rateMap) {
  const cur = String(goal?.currency || "IDR").toUpperCase();
  const ids = allocatedIds(goal);
  if (!ids.length) return Number(goal?.current_amount) || 0;
  let total = 0;
  for (const id of ids) {
    const a = (assets || []).find((x) => x.id === id);
    if (!a) continue;
    const v = Number(a.value) || 0;
    const c = String(a.currency || "IDR").toUpperCase();
    if (c === cur) { total += v; continue; }
    const from = (rateMap || {})[c], to = (rateMap || {})[cur];
    if (from && to) total += (v * from) / to;
  }
  return cur === "IDR" ? Math.round(total) : Math.round(total * 100) / 100;
}
