// Test logika keuangan inti. Jalankan: npm test
// Memakai test runner bawaan Node (tanpa dependensi tambahan).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  convertTo, canConvert, hasRate, buildRateMap,
  summarizeConsolidated, summarizeByCurrency, monthlyExpenseBreakdown,
  filterReportableTx, computeSavingsRate, computeZakat, NISAB_GRAM,
  computeRecurringNextDate, formatUnconverted,
} from "../finance.js";

const RATES = { IDR: 1, SAR: 4200, USD: 16000 };
const tx = (o) => ({ type: "expense", amount: 0, currency: "IDR", category: "Makanan", date: "2026-11-10", visibility: "shared", ...o });

// ── Konversi kurs ────────────────────────────────────────────────
test("convertTo: mata uang sama tidak berubah", () => {
  assert.equal(convertTo(500, "SAR", "SAR", {}), 500);
});
test("convertTo: SAR → IDR dan sebaliknya", () => {
  assert.equal(convertTo(10, "SAR", "IDR", RATES), 42000);
  assert.equal(convertTo(42000, "IDR", "SAR", RATES), 10);
});
test("convertTo: lintas via IDR (USD → SAR)", () => {
  assert.equal(Math.round(convertTo(1, "USD", "SAR", RATES) * 1000) / 1000, 3.81);
});
test("convertTo: kurs tidak ada → 0, bukan nominal mentah", () => {
  assert.equal(convertTo(500, "SAR", "IDR", { IDR: 1 }), 0);
  assert.equal(canConvert("SAR", "IDR", { IDR: 1 }), false);
  assert.equal(canConvert("IDR", "IDR", {}), true);
});
test("hasRate: IDR selalu ada", () => {
  assert.equal(hasRate("IDR", {}), true);
  assert.equal(hasRate("SAR", {}), false);
});
test("buildRateMap: kurs langsung, terbalik, dan jembatan USD", () => {
  const m = buildRateMap([
    { base_currency: "SAR", quote_currency: "IDR", rate: 4200 },
    { base_currency: "IDR", quote_currency: "MYR", rate: 0.0003 },
    { base_currency: "USD", quote_currency: "IDR", rate: 16000 },
    { base_currency: "USD", quote_currency: "EUR", rate: 0.8 },
  ]);
  assert.equal(m.SAR, 4200);
  assert.equal(Math.round(m.MYR), 3333);
  assert.equal(m.EUR, 20000);
});

// ── Transaksi yang dihitung ──────────────────────────────────────
test("filterReportableTx: transfer & pending/ditolak dikecualikan", () => {
  assert.equal(filterReportableTx(tx({})), true);
  assert.equal(filterReportableTx(tx({ approval_status: "approved" })), true);
  assert.equal(filterReportableTx(tx({ transfer_pair_id: "p" })), false);
  assert.equal(filterReportableTx(tx({ approval_status: "pending" })), false);
  assert.equal(filterReportableTx(tx({ approval_status: "rejected" })), false);
});

// ── Ringkasan saldo ──────────────────────────────────────────────
test("summarizeConsolidated: saldo = pemasukan − pengeluaran − sedekah, transfer diabaikan", () => {
  const s = summarizeConsolidated([
    tx({ type: "income", amount: 10_000_000 }),
    tx({ amount: 2_000_000 }),
    tx({ type: "sedekah", amount: 500_000 }),
    tx({ amount: 5_000_000, transfer_pair_id: "p1" }),
    tx({ type: "income", amount: 5_000_000, transfer_pair_id: "p1" }),
    tx({ amount: 999, approval_status: "pending" }),
  ], "IDR", RATES);
  assert.equal(s.income, 10_000_000);
  assert.equal(s.expense, 2_000_000);
  assert.equal(s.sedekah, 500_000);
  assert.equal(s.balance, 7_500_000);
});
test("summarizeConsolidated: konversi multi mata uang", () => {
  const s = summarizeConsolidated([tx({ amount: 100_000 }), tx({ amount: 10, currency: "SAR" })], "IDR", RATES);
  assert.equal(s.expense, 142_000);
});
test("summarizeConsolidated: tanpa kurs → dikecualikan & dicatat", () => {
  const s = summarizeConsolidated([tx({ amount: 100_000 }), tx({ amount: 500, currency: "SAR" })], "IDR", { IDR: 1 });
  assert.equal(s.expense, 100_000);
  assert.deepEqual(s.unconverted, { SAR: -500 });
});
test("summarizeByCurrency: dipisah per mata uang", () => {
  const s = summarizeByCurrency([tx({ amount: 100 }), tx({ amount: 5, currency: "SAR" })]);
  assert.equal(s.IDR.expense, 100);
  assert.equal(s.SAR.expense, 5);
});

// ── Ringkasan pengeluaran bulanan (Beranda & Laporan) ───────────
test("monthlyExpenseBreakdown: hanya bulan & cakupan terpilih, transfer/pending/pribadi keluar", () => {
  const r = monthlyExpenseBreakdown([
    tx({ amount: 100_000 }),
    tx({ amount: 10, currency: "SAR" }),
    tx({ amount: 999_999, transfer_pair_id: "p" }),
    tx({ amount: 777, approval_status: "pending" }),
    tx({ amount: 5_000, visibility: "private" }),
    tx({ amount: 20_000, date: "2026-10-05" }),
    tx({ type: "income", amount: 1_000_000 }),
  ], { year: 2026, month: 10, scope: "shared", currency: "IDR", rateMap: RATES });
  assert.equal(r.total, 142_000);
  assert.equal(r.prevTotal, 20_000);
  assert.equal(r.count, 2);
  assert.deepEqual(r.rows.map((x) => x.name), ["Makanan"]);
});
test("monthlyExpenseBreakdown: cakupan pribadi", () => {
  const r = monthlyExpenseBreakdown([tx({ amount: 1 }), tx({ amount: 5_000, visibility: "private" })],
    { year: 2026, month: 10, scope: "private", currency: "IDR", rateMap: RATES });
  assert.equal(r.total, 5_000);
});
test("monthlyExpenseBreakdown: Januari membandingkan dengan Desember tahun lalu", () => {
  const r = monthlyExpenseBreakdown([tx({ amount: 3, date: "2026-01-10" }), tx({ amount: 7, date: "2025-12-20" })],
    { year: 2026, month: 0, currency: "IDR", rateMap: RATES });
  assert.equal(r.total, 3);
  assert.equal(r.prevTotal, 7);
});
test("monthlyExpenseBreakdown: tanpa kurs → dikecualikan, dicatat untuk UI", () => {
  const r = monthlyExpenseBreakdown([tx({ amount: 100_000 }), tx({ amount: 500, currency: "SAR" })],
    { year: 2026, month: 10, currency: "IDR", rateMap: { IDR: 1 } });
  assert.equal(r.total, 100_000);
  assert.deepEqual(r.unconverted, { SAR: 500 });
  assert.match(formatUnconverted(r.unconverted), /SAR/);
});

// ── Rasio menabung ───────────────────────────────────────────────
test("computeSavingsRate: normal, negatif, tanpa pemasukan", () => {
  assert.deepEqual(computeSavingsRate(10_000, 6_000, 1_000), { rate: 30, label: null });
  assert.deepEqual(computeSavingsRate(10_000, 12_000, 0), { rate: 0, label: "<0%" });
  assert.deepEqual(computeSavingsRate(0, 100, 0), { rate: 0, label: "n/a" });
});

// ── Zakat mal ────────────────────────────────────────────────────
test("computeZakat: nisab 85 gr emas, tarif 2,5%", () => {
  const goldPrice = 1_500_000;
  const nisab = goldPrice * NISAB_GRAM;
  const below = computeZakat({ emasGrams: 50, emasValue: 75_000_000, nonEmasValue: nisab - 1, goldPrice });
  assert.equal(below.emasReached, false);
  assert.equal(below.simpananReached, false);
  assert.equal(below.zakatEmas + below.zakatSimpanan, 0);
  const above = computeZakat({ emasGrams: 100, emasValue: 150_000_000, nonEmasValue: nisab, goldPrice });
  assert.equal(above.zakatEmas, 3_750_000);
  assert.equal(above.zakatSimpanan, nisab * 0.025);
});
test("computeZakat: tanpa harga emas, simpanan tidak dianggap mencapai nisab", () => {
  assert.equal(computeZakat({ nonEmasValue: 1e12, goldPrice: 0 }).simpananReached, false);
});

// ── Tagihan berulang ─────────────────────────────────────────────
test("computeRecurringNextDate: harian, mingguan, tahunan", () => {
  assert.equal(computeRecurringNextDate("2026-11-15", "daily"), "2026-11-16");
  assert.equal(computeRecurringNextDate("2026-11-15", "weekly"), "2026-11-22");
  assert.equal(computeRecurringNextDate("2026-11-15", "yearly"), "2027-11-15");
});
test("computeRecurringNextDate: bulanan dari akhir bulan tidak melompat 2 bulan", () => {
  assert.equal(computeRecurringNextDate("2026-11-15", "monthly"), "2026-12-15");
  assert.equal(computeRecurringNextDate("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(computeRecurringNextDate("2028-01-31", "monthly"), "2028-02-29");
  assert.equal(computeRecurringNextDate("2026-03-31", "monthly"), "2026-04-30");
});
