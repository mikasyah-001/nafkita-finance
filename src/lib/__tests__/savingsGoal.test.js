import { test } from "node:test";
import assert from "node:assert/strict";
import { goalProgress, allocatedIds } from "../savingsGoal.js";
import { buildRateMap } from "../finance.js";
import { goalCurrentAmount, buildRateMapFromRates } from "../../../base44/shared/goalProgress.ts";

const rates = [{ base_currency: "SAR", quote_currency: "IDR", rate: 4400 }];
const rateMap = buildRateMap(rates);
const assets = [
  { id: "mpu", type: "investasi", currency: "IDR", value: 22315881 },
  { id: "sal", type: "investasi", currency: "SAR", value: 1785.54 },
  { id: "bsi", type: "bank", currency: "IDR", value: 5000000 },
];

test("Dana darurat tersebar di beberapa aset: progres = nilai aset (dikonversi)", () => {
  const goal = { currency: "IDR", target_amount: 60000000, allocated_asset_ids: ["mpu", "sal", "bsi"] };
  const p = goalProgress(goal, assets, { rateMap });
  assert.equal(p.mode, "assets");
  assert.equal(p.current, 22315881 + Math.round(1785.54 * 4400) + 5000000);
  assert.equal(p.assets.length, 3);
  assert.equal(Math.round(p.pct), 59);
  assert.equal(p.remaining, 60000000 - p.current);
});

test("tanpa aset dialokasikan → setoran manual (perilaku lama)", () => {
  const p = goalProgress({ currency: "IDR", target_amount: 1000, current_amount: 250 }, assets, { rateMap });
  assert.deepEqual([p.mode, p.current, p.pct], ["manual", 250, 25]);
});

test("aset terhapus & kurs tidak ada dilaporkan, bukan dihitung diam-diam", () => {
  const p = goalProgress({ currency: "IDR", target_amount: 1, allocated_asset_ids: ["mpu", "hilang", "usd"] }, [...assets, { id: "usd", type: "bank", currency: "USD", value: 10 }], { rateMap });
  assert.equal(p.missing, 1);
  assert.deepEqual(p.unconverted.map((a) => a.id), ["usd"]);
  assert.deepEqual(allocatedIds({ allocated_asset_ids: ["a", "a", "", null] }), ["a"]);
});

test("paritas frontend ↔ backend (pengingat memakai angka yang sama)", () => {
  const backendMap = buildRateMapFromRates(rates);
  for (const goal of [
    { currency: "IDR", allocated_asset_ids: ["mpu", "sal", "bsi"] },
    { currency: "SAR", allocated_asset_ids: ["mpu", "sal"] },
    { currency: "IDR", current_amount: 777 },
  ]) {
    assert.equal(goalCurrentAmount(goal, assets, backendMap), goalProgress(goal, assets, { rateMap }).current, JSON.stringify(goal));
  }
});

import { goalProjection, quickDepositAmounts } from "../savingsGoal.js";

test("goalProjection: laju 90 hari → perkiraan tercapai & status tepat waktu", () => {
  const now = new Date(2026, 10, 21);
  const goal = {
    target_amount: 12_000_000, target_date: "2027-06-01",
    contribution_history: [
      { date: "2026-09-21", amount: 1_000_000 },
      { date: "2026-10-21", amount: 1_000_000 },
      { date: "2026-11-20", amount: 1_000_000 },
      { date: "2026-01-01", amount: 9_000_000 }, // di luar 90 hari
    ],
  };
  const p = goalProjection(goal, 6_000_000, { now });
  assert.equal(p.remaining, 6_000_000);
  assert.ok(Math.abs(p.perMonth - 1_000_000) < 20_000, `perMonth ${p.perMonth}`);
  assert.equal(p.eta.getFullYear(), 2027);
  assert.equal(p.eta.getMonth(), 4); // ±Mei 2027
  assert.equal(p.onTrack, true);
  assert.ok(p.neededPerMonth > 0);
});

test("goalProjection: tanpa setoran → tanpa ETA; tercapai → done", () => {
  assert.equal(goalProjection({ target_amount: 100 }, 0).eta, null);
  assert.equal(goalProjection({ target_amount: 100 }, 100).done, true);
  assert.deepEqual(quickDepositAmounts("SAR"), [50, 100, 500]);
});
