import { test } from "node:test";
import assert from "node:assert/strict";
import { walletAccounts, accountActivity, wrapIndex } from "../wallet.js";

const assets = [
  { id: "a", type: "bank", value: 100, created_by_id: "me", visibility: "shared" },
  { id: "b", type: "bank", value: 900, created_by_id: "partner", visibility: "shared" },
  { id: "c", type: "tunai", value: 500, created_by_id: "me", visibility: "shared" },
  { id: "d", type: "bank", value: 50, created_by_id: "me", visibility: "private" },
  { id: "e", type: "emas", value: 9999, created_by_id: "me", visibility: "shared" },
];

test("kartu dompet sesuai cakupan & urutan", () => {
  assert.deepEqual(walletAccounts(assets, { scope: "shared", meId: "me" }).map((a) => a.id), ["c", "a", "b"]);
  assert.deepEqual(walletAccounts(assets, { scope: "private", meId: "me" }).map((a) => a.id), ["d"]);
  assert.deepEqual(walletAccounts([], { meId: "me" }), []);
  assert.deepEqual(walletAccounts(assets, { scope: "shared", meId: "me", hiddenIds: ["c", "b"] }).map((a) => a.id), ["a"]);
  assert.deepEqual(walletAccounts(assets, { scope: "shared", meId: "me", hiddenIds: null }).map((a) => a.id), ["c", "a", "b"]);
});

test("aktivitas rekening bulan berjalan", () => {
  const now = new Date("2026-11-21T10:00:00Z");
  const tx = [
    { id: 1, linked_asset_id: "a", type: "income", amount: 1000, date: "2026-11-02T08:00:00Z" },
    { id: 2, linked_asset_id: "a", type: "expense", amount: 200, date: "2026-11-20T08:00:00Z" },
    { id: 3, linked_asset_id: "a", type: "sedekah", amount: 50, date: "2026-11-10T08:00:00Z" },
    { id: 4, linked_asset_id: "a", type: "expense", amount: 999, date: "2026-10-30T08:00:00Z" },
    { id: 5, linked_asset_id: "a", type: "expense", amount: 777, date: "2026-11-15T08:00:00Z", approval_status: "pending" },
    { id: 6, linked_asset_id: "b", type: "expense", amount: 5, date: "2026-11-15T08:00:00Z" },
  ];
  const r = accountActivity(tx, "a", { now });
  assert.equal(r.masuk, 1000);
  assert.equal(r.keluar, 250);
  assert.deepEqual(r.recent.map((t) => t.id), [2, 3, 1]);
  assert.equal(r.count, 4);
});

test("putaran indeks kartu", () => {
  assert.equal(wrapIndex(3, 3), 0);
  assert.equal(wrapIndex(-1, 3), 2);
  assert.equal(wrapIndex(5, 0), 0);
});
