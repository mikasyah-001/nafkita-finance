// Test logika keuangan inti. Jalankan: npm test
// Memakai test runner bawaan Node (tanpa dependensi tambahan).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  convertTo, canConvert, hasRate, buildRateMap,
  summarizeConsolidated, summarizeByCurrency, monthlyExpenseBreakdown,
  filterReportableTx, computeSavingsRate,
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
  assert.match(formatUnconverted(r.unconverted), /\u20C1/, "simbol riyal resmi");
});

// ── Rasio menabung ───────────────────────────────────────────────
test("computeSavingsRate: normal, negatif, tanpa pemasukan", () => {
  assert.deepEqual(computeSavingsRate(10_000, 6_000, 1_000), { rate: 30, label: null });
  assert.deepEqual(computeSavingsRate(10_000, 12_000, 0), { rate: 0, label: "<0%" });
  assert.deepEqual(computeSavingsRate(0, 100, 0), { rate: 0, label: "n/a" });
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

// ── Pengeluaran luar biasa & aset uang ──────────────────────────
import { isExtraordinary, EXTRAORDINARY_TAG, isMoneyAsset } from "../finance.js";
test("Pengeluaran luar biasa: tetap di total, keluar dari total rutin", () => {
  const r = monthlyExpenseBreakdown([
    tx({ amount: 100_000 }),
    tx({ amount: 60_000_000, tags: [EXTRAORDINARY_TAG], category: "Kendaraan" }),
  ], { year: 2026, month: 10, currency: "IDR", rateMap: RATES });
  assert.equal(r.total, 60_100_000);
  assert.equal(r.extraordinary, 60_000_000);
  assert.equal(r.routineTotal, 100_000);
  assert.equal(isExtraordinary(tx({ tags: ["liburan"] })), false);
});
test("isMoneyAsset: rekening bank & dompet tunai saja", () => {
  assert.equal(isMoneyAsset({ type: "bank" }), true);
  assert.equal(isMoneyAsset({ type: "tunai" }), true);
  assert.equal(isMoneyAsset({ type: "emas" }), false);
});

// ── Rencana bulanan ──────────────────────────────────────────────
import { monthlyPlan, planProgress, isExpenseBudget } from "../finance.js";
test("monthlyPlan: ambil target sesuai periode, cakupan, mata uang", () => {
  const budgets = [
    { kind: "income_plan", period: "2026-11", visibility: "shared", currency: "IDR", limit_amount: 15_000_000 },
    { kind: "savings_plan", period: "2026-11", visibility: "shared", currency: "IDR", limit_amount: 5_000_000 },
    { kind: "savings_plan", period: "2026-11", visibility: "private", currency: "IDR", limit_amount: 999 },
    { category: "Makanan", period: "2026-11", limit_amount: 1_500_000 },
  ];
  const p = monthlyPlan(budgets, { period: "2026-11", scope: "shared", currency: "IDR" });
  assert.equal(p.income, 15_000_000);
  assert.equal(p.savings, 5_000_000);
  assert.equal(isExpenseBudget(budgets[3]), true, "anggaran lama tanpa kind = pengeluaran");
  assert.equal(isExpenseBudget(budgets[0]), false);
});
test("planProgress: persen dijepit, status tercapai, sisa", () => {
  assert.deepEqual(planProgress(2_500_000, 5_000_000), { pct: 50, reached: false, remaining: 2_500_000 });
  assert.equal(planProgress(6_000_000, 5_000_000).pct, 100);
  assert.equal(planProgress(-1_000, 5_000_000).pct, 0);
  assert.equal(planProgress(100, 0).reached, false);
});

// ── Alur input aset per jenis ────────────────────────────────────
import { buildAssetPayload, switchAssetType } from "../finance.js";
const F = (o) => ({ name: "Aset", type: "bank", value: "", quantity: "", purchase_price: "", currency: "IDR", visibility: "shared", ...o });
test("Aset bank/tunai: nilai saja, tanpa harga beli & jumlah", () => {
  const { payload } = buildAssetPayload(F({ type: "bank", value: "5000000", purchase_price: "999", quantity: "3" }));
  assert.equal(payload.value, 5_000_000);
  assert.equal(payload.purchase_price, 0);
  assert.equal(payload.quantity, 0);
  assert.equal(buildAssetPayload(F({ type: "tunai", value: "0" })).payload.value, 0, "dompet kosong boleh 0");
  assert.equal(buildAssetPayload(F({ type: "tunai", value: "" })).error, "Isi nilai aset");
});
test("Aset emas: wajib gram & harga/gram, nilai = gram × harga, mata uang IDR", () => {
  assert.equal(buildAssetPayload(F({ type: "emas", quantity: "10" })).error, "Isi harga beli per gram");
  const { payload } = buildAssetPayload(F({ type: "emas", quantity: "10", purchase_price: "1500000", currency: "SAR" }));
  assert.equal(payload.value, 15_000_000);
  assert.equal(payload.unit, "gram");
  assert.equal(payload.currency, "IDR");
});
test("Aset emas digital: boleh mata uang lain", () => {
  const { payload } = buildAssetPayload(F({ type: "emas_digital", quantity: "2", purchase_price: "300", currency: "SAR" }));
  assert.equal(payload.currency, "SAR");
  assert.equal(payload.value, 600);
});
test("Aset tanah: nilai sekarang opsional (default = luas × harga/m²), IDR", () => {
  const a = buildAssetPayload(F({ type: "tanah", quantity: "100", purchase_price: "2000000", currency: "SAR" })).payload;
  assert.equal(a.value, 200_000_000);
  assert.equal(a.unit, "m²");
  assert.equal(a.currency, "IDR");
  assert.equal(buildAssetPayload(F({ type: "tanah", quantity: "100", purchase_price: "2000000", value: "250000000" })).payload.value, 250_000_000);
});
test("Aset investasi/properti/lainnya: nilai + harga beli total, tanpa satuan", () => {
  const { payload } = buildAssetPayload(F({ type: "investasi", value: "43500000", purchase_price: "38000000", quantity: "7" }));
  assert.equal(payload.purchase_price, 38_000_000);
  assert.equal(payload.quantity, 0);
  assert.equal(payload.unit, "");
});
test("Aset: nama wajib, angka negatif ditolak", () => {
  assert.equal(buildAssetPayload(F({ name: "  ", value: "1" })).error, "Isi nama aset");
  assert.equal(buildAssetPayload(F({ value: "-5" })).error, "Nilai tidak boleh negatif");
});
test("Ganti jenis tidak membawa isian yang beda makna", () => {
  const emas = { ...F({ type: "emas", quantity: "40", purchase_price: "1250000", unit: "gram" }) };
  const bank = switchAssetType(emas, "bank");
  assert.equal(bank.quantity, "");
  assert.equal(bank.purchase_price, "");
  assert.equal(bank.unit, "");
  const digital = switchAssetType(emas, "emas_digital");
  assert.equal(digital.quantity, "40", "sesama gram tetap");
  assert.equal(switchAssetType(F({ currency: "SAR" }), "tanah").currency, "IDR");
});

// ── Simbol riyal resmi ───────────────────────────────────────────
import { formatMoney, formatMoneyPlain, currencySymbol, SAR_SIGN } from "../finance.js";
test("SAR memakai simbol resmi U+20C1 di tampilan, kode 'SAR' untuk ekspor", () => {
  assert.equal(SAR_SIGN, "⃁");
  assert.equal(currencySymbol("SAR"), "⃁");
  assert.equal(formatMoney(2400, "SAR"), "⃁ 2,400.00");
  assert.equal(formatMoneyPlain(2400, "SAR"), "SAR 2,400.00");
  assert.equal(formatMoneyPlain(150000, "IDR"), formatMoney(150000, "IDR"));
});

// ── Nilai pasar & untung/rugi aset ───────────────────────────────
import { goldPriceIn, assetCost, assetMarketValue, assetGain } from "../finance.js";
test("Emas: nilai pasar = gram × harga acuan; untung = nilai pasar − (gram × harga beli/gr)", () => {
  const emas = { type: "emas", quantity: 40, purchase_price: 1_250_000, value: 50_000_000, currency: "IDR" };
  assert.equal(assetCost(emas), 50_000_000);
  assert.equal(assetMarketValue(emas, 1_500_000), 60_000_000);
  const g = assetGain(emas, 1_500_000);
  assert.equal(g.gain, 10_000_000);
  assert.equal(g.pct, 20);
  assert.equal(g.available, true);
});
test("Emas tanpa harga acuan: untung/rugi tidak tersedia (bukan 0%)", () => {
  const g = assetGain({ type: "emas", quantity: 40, purchase_price: 1_250_000, value: 50_000_000 }, 0);
  assert.equal(g.available, false);
  assert.equal(g.needsGoldPrice, true);
  assert.equal(g.value, 50_000_000, "pakai nilai tersimpan");
});
test("Emas digital SAR: harga acuan IDR dikonversi ke SAR", () => {
  const rates = { IDR: 1, SAR: 4000 };
  assert.equal(goldPriceIn("SAR", 1_600_000, rates), 400);
  const d = { type: "emas_digital", quantity: 10, purchase_price: 350, currency: "SAR" };
  assert.equal(assetMarketValue(d, 1_600_000, rates), 4000);
  assert.equal(assetGain(d, 1_600_000, rates).gain, 500);
  assert.equal(assetGain(d, 1_600_000, { IDR: 1 }).available, false, "tanpa kurs SAR");
});
test("Non-emas: untung = nilai − harga beli; tanpa harga beli tidak tersedia", () => {
  assert.equal(assetGain({ type: "investasi", value: 43_500_000, purchase_price: 38_000_000 }).gain, 5_500_000);
  assert.equal(assetGain({ type: "bank", value: 1 }).available, false);
  assert.equal(assetCost({ type: "tanah", quantity: 100, purchase_price: 2_000_000 }), 200_000_000);
});
