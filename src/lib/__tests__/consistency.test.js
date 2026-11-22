import { test } from "node:test";
import assert from "node:assert/strict";
import { isReportable } from "../../../base44/shared/reportable.js";
import { filterReportableTx, summarizeConsolidated } from "../finance.js";
import { goalsInScope, allocationOwners, goalsSummary } from "../savingsGoal.js";

test("satu aturan laporan: transfer, pending, penyesuaian & setoran target tidak dihitung", () => {
  assert.equal(isReportable({ type: "expense", amount: 1 }), true);
  assert.equal(isReportable({ transfer_pair_id: "p" }), false);
  assert.equal(isReportable({ approval_status: "pending" }), false);
  assert.equal(isReportable({ is_adjustment: true }), false);
  assert.equal(isReportable({ is_savings_deposit: true }), false);
  assert.equal(filterReportableTx, isReportable);
  const s = summarizeConsolidated([
    { type: "income", amount: 100, currency: "IDR" },
    { type: "income", amount: 50, currency: "IDR", is_adjustment: true },
    { type: "expense", amount: 30, currency: "IDR", is_savings_deposit: true },
    { type: "expense", amount: 20, currency: "IDR" },
  ], "IDR", {});
  assert.equal(s.income, 100);
  assert.equal(s.expense, 20);
});

test("target: cakupan, satu aset satu target, ringkasan tanpa dobel", () => {
  const goals = [
    { id: "g1", name: "Umrah", status: "active", visibility: "shared", created_by_id: "me", currency: "IDR", target_amount: 100, allocated_asset_ids: ["a1"] },
    { id: "g2", name: "Darurat", status: "active", visibility: "shared", created_by_id: "me", currency: "IDR", target_amount: 100, allocated_asset_ids: ["a1", "a2"] },
    { id: "g3", name: "Pribadi", status: "active", visibility: "private", created_by_id: "me", currency: "IDR", target_amount: 10, current_amount: 5 },
  ];
  assert.deepEqual(goalsInScope(goals, { scope: "shared", meId: "me" }).map((g) => g.id), ["g1", "g2"]);
  assert.deepEqual(goalsInScope(goals, { scope: "private", meId: "me" }).map((g) => g.id), ["g3"]);
  assert.equal(allocationOwners(goals, "g2").a1.id, "g1");
  assert.equal(allocationOwners(goals, "g1").a2.id, "g2");
  const values = { a1: 40, a2: 10 };
  const progressOf = (g) => ({ current: g.allocated_asset_ids ? g.allocated_asset_ids.reduce((s, id) => s + values[id], 0) : g.current_amount });
  const byCur = goalsSummary(goals.slice(0, 2), progressOf);
  assert.equal(byCur.IDR.current, 50); // a1 dihitung sekali (bukan 90)
  assert.equal(byCur.IDR.target, 200);
});
