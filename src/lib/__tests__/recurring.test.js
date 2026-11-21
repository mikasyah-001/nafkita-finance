import { test } from "node:test";
import assert from "node:assert/strict";
import { billDue, sortByDue, upcomingTotal } from "../recurring.js";

const T = new Date(2026, 10, 21); // 21 Nov 2026
const bill = (o) => ({ status: "active", amount: 100_000, currency: "IDR", frequency: "monthly", next_date: "2026-11-25", ...o });

test("billDue: label & jenis sesuai jarak hari", () => {
  assert.deepEqual(billDue(bill({ next_date: "2026-11-19" }), T), { kind: "overdue", days: -2, label: "Terlambat 2 hari" });
  assert.equal(billDue(bill({ next_date: "2026-11-21" }), T).kind, "today");
  assert.equal(billDue(bill({ next_date: "2026-11-22" }), T).label, "Besok");
  assert.equal(billDue(bill({ next_date: "2026-11-24" }), T).kind, "soon");
  assert.equal(billDue(bill({ next_date: "2026-11-25" }), T).kind, "upcoming");
  assert.equal(billDue(bill({ status: "paused" }), T).kind, "paused");
});

test("sortByDue: hanya aktif, terdekat dulu", () => {
  const r = sortByDue([bill({ id: "a", next_date: "2026-12-01" }), bill({ id: "b", status: "paused" }), bill({ id: "c", next_date: "2026-11-22" })]);
  assert.deepEqual(r.map((b) => b.id), ["c", "a"]);
});

test("upcomingTotal: hitung setiap kemunculan dalam 30 hari & konversi kurs", () => {
  const r = upcomingTotal([
    bill({ next_date: "2026-11-25" }),                              // bulanan → 1×
    bill({ frequency: "weekly", amount: 50_000, next_date: "2026-11-22" }), // 22,29,6,13,20 → 5×
    bill({ currency: "SAR", amount: 10, next_date: "2026-11-30" }),  // 10 × 4200
    bill({ status: "paused" }),
  ], { today: T, rateMap: { IDR: 1, SAR: 4200 } });
  assert.equal(r.count, 7);
  assert.equal(r.total, 100_000 + 5 * 50_000 + 42_000);
});
