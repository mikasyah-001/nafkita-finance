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
test("Aset emas: wajib gram & harga/gram, nilai = gram × harga, mata uang disimpan apa adanya", () => {
  assert.equal(buildAssetPayload(F({ type: "emas", quantity: "10" })).error, "Isi harga beli per gram");
  const { payload } = buildAssetPayload(F({ type: "emas", quantity: "10", purchase_price: "1500000", currency: "IDR" }));
  assert.equal(payload.value, 15_000_000);
  assert.equal(payload.unit, "gram");
  assert.equal(payload.currency, "IDR");
  // Emas fisik dibeli di Makkah: SAR tetap SAR (dulu dipaksa IDR → salah tafsir).
  assert.equal(buildAssetPayload(F({ type: "emas", quantity: "1", purchase_price: "502.38", currency: "SAR" })).payload.currency, "SAR");
});
test("Aset emas digital: boleh mata uang lain", () => {
  const { payload } = buildAssetPayload(F({ type: "emas_digital", quantity: "2", purchase_price: "300", currency: "SAR" }));
  assert.equal(payload.currency, "SAR");
  assert.equal(payload.value, 600);
});
test("Aset tanah: nilai sekarang opsional (default = luas × harga/m²)", () => {
  const a = buildAssetPayload(F({ type: "tanah", quantity: "100", purchase_price: "2000000", currency: "IDR" })).payload;
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
  assert.equal(switchAssetType(F({ currency: "SAR" }), "tanah").currency, "SAR", "mata uang tidak diganti diam-diam");
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

// ── Salah tafsir mata uang (Rupiah diketik saat mata uang SAR) ─────
import { goldPriceCurrencyHint, assetCurrencyIssue, conversionPreview, idrPerUnit } from "../finance.js";
test("Harga emas Rupiah dengan mata uang SAR terdeteksi → sarankan IDR", () => {
  const h = goldPriceCurrencyHint(1_250_000, "SAR", ["IDR", "SAR"]);
  assert.equal(h.suggest, "IDR");
  assert.match(h.message, /SAR 1,250,000\.00\/gr tidak wajar/);
});
test("Harga emas Riyal dengan mata uang IDR terdeteksi → sarankan SAR", () => {
  assert.equal(goldPriceCurrencyHint(502.38, "IDR", ["IDR", "SAR"]).suggest, "SAR");
});
test("Harga emas wajar tidak memicu peringatan", () => {
  assert.equal(goldPriceCurrencyHint(1_250_000, "IDR", ["SAR"]), null);
  assert.equal(goldPriceCurrencyHint(502.38, "SAR", ["IDR"]), null);
  assert.equal(goldPriceCurrencyHint(0, "SAR", ["IDR"]), null);
});
test("Kurs asli dipakai bila ada, kurs kasar hanya cadangan", () => {
  assert.equal(idrPerUnit("SAR", { SAR: 4200 }), 4200);
  assert.equal(idrPerUnit("SAR", {}), 4300);
  assert.equal(idrPerUnit("XYZ", {}), null);
});
test("assetCurrencyIssue hanya untuk emas", () => {
  assert.equal(assetCurrencyIssue({ type: "bank", value: 1_000_000, currency: "SAR" }, ["IDR"]), null);
  assert.equal(assetCurrencyIssue({ type: "emas", quantity: 1, purchase_price: 1_400_000, currency: "SAR" }, ["IDR"]).suggest, "IDR");
});
test("Pratinjau konversi hanya bila kurs tersedia", () => {
  assert.match(conversionPreview(100, "SAR", "IDR", { IDR: 1, SAR: 4300 }), /^≈ Rp\s430\.000$/);
  assert.equal(conversionPreview(100, "SAR", "IDR", { IDR: 1 }), "");
  assert.equal(conversionPreview(100, "IDR", "IDR", {}), "");
});
import { amountCurrencyHint, goldPriceLooksWrong, assetGain as assetGain2 } from "../finance.js";
test("Nominal SAR yang tampak Rupiah diberi peringatan lunak", () => {
  assert.equal(amountCurrencyHint(150_000, "SAR").suggest, "IDR");
  assert.equal(amountCurrencyHint(2_400, "SAR"), null);
  assert.equal(amountCurrencyHint(150_000, "IDR"), null);
});
test("Untung emas tidak dihitung bila harga beli/gr salah mata uang", () => {
  const bad = { type: "emas", quantity: 1, purchase_price: 1_400_000, currency: "SAR", value: 1_400_000 };
  assert.equal(goldPriceLooksWrong(bad), true);
  const g = assetGain2(bad, 2_517_000, { IDR: 1, SAR: 4300 });
  assert.equal(g.available, false);
  assert.equal(g.currencySuspect, true);
  const ok = { type: "emas", quantity: 1, purchase_price: 502.38, currency: "SAR", value: 502.38 };
  const g2 = assetGain2(ok, 2_517_000, { IDR: 1, SAR: 4300 });
  assert.equal(g2.available, true);
  assert.ok(g2.pct > 10 && g2.pct < 30, `pct wajar, dapat ${g2.pct}`);
});

test("assetDisplayName memisah ticker di akhir nama & merapikan spasi", async () => {
  const { assetDisplayName } = await import("../finance.js");
  assert.deepEqual(assetDisplayName({ name: "SP FUNDS S&P 500 SHARIA (SPUS)", ticker: "SPUS" }), { name: "SP FUNDS S&P 500 SHARIA", ticker: "SPUS" });
  assert.deepEqual(assetDisplayName({ name: "SABIC  (2010)" }), { name: "SABIC", ticker: "2010" });
  // Kurung yang bukan ticker aset ini tetap bagian nama.
  assert.deepEqual(assetDisplayName({ name: "Reksa Dana (Syariah Plus)", ticker: "RDX" }), { name: "Reksa Dana (Syariah Plus)", ticker: "RDX" });
  assert.deepEqual(assetDisplayName({ name: "Mandiri Pasar Uang Syariah Ekstra" }), { name: "Mandiri Pasar Uang Syariah Ekstra", ticker: "" });
  assert.deepEqual(assetDisplayName({ name: "SPUS", ticker: "spus" }), { name: "SPUS", ticker: "" });
  assert.deepEqual(assetDisplayName({ name: "Reksa Dana (Syariah)" }), { name: "Reksa Dana (Syariah)", ticker: "" });
});

test("knownBrokers & canonicalBroker: broker tersimpan, tanpa ejaan ganda", async () => {
  const { knownBrokers, canonicalBroker } = await import("../finance.js");
  const assets = [
    { type: "investasi", broker: "Al Rajhi Capital" },
    { type: "investasi", broker: "al rajhi  capital" },
    { type: "investasi", broker: "Al Rajhi Capital" },
    { type: "investasi", broker: "Bibit" },
    { type: "bank", broker: "BCA" },
    { type: "investasi", broker: "  " },
  ];
  assert.deepEqual(knownBrokers(assets, { type: "investasi" }), ["Al Rajhi Capital", "Bibit"]);
  assert.deepEqual(knownBrokers(assets, { type: "investasi", includeOtherTypes: true }), ["Al Rajhi Capital", "Bibit", "BCA"]);
  const known = knownBrokers(assets);
  assert.equal(canonicalBroker("AL RAJHI CAPITAL", known), "Al Rajhi Capital");
  assert.equal(canonicalBroker("Al-Rajhi Capital ", known), "Al Rajhi Capital");
  assert.equal(canonicalBroker("Al Rajhi", known), "Al Rajhi Capital");
  assert.equal(canonicalBroker("bibit", known), "Bibit");
  assert.equal(canonicalBroker("Bi", known), "Bi"); // terlalu pendek untuk ditebak
  assert.equal(canonicalBroker("Stockbit  ", known), "Stockbit");
  assert.equal(canonicalBroker("", known), "");
});

test("canonicalBrokerFor: tebakan awalan hanya dalam jenis aset yang sama", async () => {
  const { canonicalBrokerFor } = await import("../finance.js");
  const assets = [{ type: "investasi", broker: "Mandiri Sekuritas" }, { type: "bank", broker: "BCA" }];
  assert.equal(canonicalBrokerFor("Mandiri", assets, "bank"), "Mandiri");
  assert.equal(canonicalBrokerFor("Mandiri", assets, "investasi"), "Mandiri Sekuritas");
  assert.equal(canonicalBrokerFor("bca", assets, "emas_digital"), "BCA"); // persis lintas jenis tetap diseragamkan
});

test("convertAmounts & roundMoney: ganti mata uang mengonversi, bukan mengganti label", async () => {
  const { convertAmounts, roundMoney, buildRateMap } = await import("../finance.js");
  const rateMap = buildRateMap([{ base_currency: "USD", quote_currency: "IDR", rate: 16500 }, { base_currency: "SAR", quote_currency: "IDR", rate: 4400 }]);
  assert.deepEqual(convertAmounts({ value: "1008000", purchase_price: "1872000" }, "IDR", "USD", rateMap), { value: "61.09", purchase_price: "113.45" });
  assert.deepEqual(convertAmounts({ amount: "100" }, "SAR", "IDR", rateMap), { amount: "440000" });
  assert.deepEqual(convertAmounts({ amount: "", other: "0" }, "IDR", "SAR", rateMap), { amount: "", other: "0" });
  assert.equal(convertAmounts({ amount: "5" }, "IDR", "EUR", rateMap), null); // kurs tidak ada
  assert.equal(roundMoney(1234.567, "IDR"), 1235);
  assert.equal(roundMoney(1234.567, "SAR"), 1234.57);
});

test("assetCurrencyIssue: Rupiah berlabel mata uang asing pada aset non-emas", async () => {
  const { assetCurrencyIssue, buildRateMap } = await import("../finance.js");
  const rateMap = buildRateMap([{ base_currency: "USD", quote_currency: "IDR", rate: 16500 }, { base_currency: "SAR", quote_currency: "IDR", rate: 4400 }]);
  const wrong = assetCurrencyIssue({ type: "investasi", currency: "USD", value: 1008000 }, ["IDR", "USD"], rateMap);
  assert.equal(wrong?.suggest, "IDR");
  // Aset asing yang memang besar tetapi wajar tidak ditandai.
  assert.equal(assetCurrencyIssue({ type: "investasi", currency: "SAR", value: 250000 }, ["IDR", "SAR"], rateMap), null);
  assert.equal(assetCurrencyIssue({ type: "bank", currency: "USD", value: 40000 }, ["IDR", "USD"], rateMap), null);
  assert.equal(assetCurrencyIssue({ type: "bank", currency: "IDR", value: 9e9 }, ["IDR"], rateMap), null);
});

test("switchCurrencyAmounts: konversi langsung, berpatokan pada angka asli", async () => {
  const { switchCurrencyAmounts, buildRateMap } = await import("../finance.js");
  const rateMap = buildRateMap([{ base_currency: "USD", quote_currency: "IDR", rate: 16500 }, { base_currency: "SAR", quote_currency: "IDR", rate: 4400 }]);
  const start = { value: "1008000", purchase_price: "1872000" };
  const toSar = switchCurrencyAmounts({ currency: "IDR", amounts: start, to: "SAR", rateMap });
  assert.deepEqual(toSar.amounts, { value: "229.09", purchase_price: "425.45" });
  // SAR → USD dihitung dari angka asli IDR, bukan dari hasil bulat SAR
  const toUsd = switchCurrencyAmounts({ origin: toSar.origin, currency: "SAR", amounts: toSar.amounts, to: "USD", rateMap });
  assert.deepEqual(toUsd.amounts, { value: "61.09", purchase_price: "113.45" });
  // Kembali ke IDR → tepat angka semula
  const back = switchCurrencyAmounts({ origin: toUsd.origin, currency: "USD", amounts: toUsd.amounts, to: "IDR", rateMap });
  assert.deepEqual(back.amounts, start); assert.equal(back.origin, null);
  // Angka diketik ulang setelah konversi → patokan baru
  const typed = switchCurrencyAmounts({ origin: toSar.origin, currency: "SAR", amounts: { value: "100", purchase_price: "425.45" }, to: "IDR", rateMap });
  assert.deepEqual(typed.amounts, { value: "440000", purchase_price: "1871980" });
  // Kosong → hanya ganti mata uang; kurs tidak ada → ditolak
  assert.deepEqual(switchCurrencyAmounts({ currency: "IDR", amounts: { amount: "" }, to: "SAR", rateMap }).amounts, { amount: "" });
  assert.equal(switchCurrencyAmounts({ currency: "IDR", amounts: { amount: "5" }, to: "EUR", rateMap }).ok, false);
});

test("errorMessage: pesan asli dari backend, bukan 'status code 500'", async () => {
  const { errorMessage, partialErrorText } = await import("../errorMessage.js");
  const e = Object.assign(new Error("Request failed with status code 500"), { response: { status: 500, data: { error: "limit too large" } } });
  assert.equal(errorMessage(e), "limit too large (kode 500)");
  assert.equal(errorMessage(new Error("Network Error")), "Network Error");
  assert.equal(errorMessage(null, "x"), "x");
  assert.equal(partialErrorText([{ source: "transaksi", message: "timeout" }]), "transaksi: timeout");
  assert.equal(partialErrorText([]), "");
});

test("knownBrokers: 'Bank BSI' dan 'BSI' tidak muncul ganda", async () => {
  const { knownBrokers, canonicalBroker } = await import("../finance.js");
  const list = knownBrokers([{ type: "bank", broker: "Bank BSI" }, { type: "bank", broker: "Bank BSI" }, { type: "bank", broker: "BSI" }], { type: "bank" });
  assert.deepEqual(list, ["Bank BSI"]);
  assert.equal(canonicalBroker("BSI", list), "Bank BSI");
});

test("placeSuggestions & withSavedBank: bank baru ditetapkan & tinggal klik di semua jenis bank", async () => {
  const { placeSuggestions, withSavedBank, DEFAULT_BANKS } = await import("../finance.js");
  const assets = [{ type: "bank", broker: "Bank Ar-Rajhi" }, { type: "emas_digital", broker: "Bank Aljazira" }, { type: "investasi", broker: "Al Rajhi Capital" }];
  // Tabungan/Bank: dipakai sendiri → profil → jenis bank lain → saran umum; tanpa broker investasi
  assert.deepEqual(placeSuggestions({ assets, type: "bank", savedBanks: ["Riyad Bank"], defaults: DEFAULT_BANKS.SAR }),
    ["Bank Ar-Rajhi", "Riyad Bank", "Bank Aljazira", "Al Rajhi Bank", "SNB", "Alinma Bank", "Bank Albilad"]);
  // Emas Digital ikut menawarkan bank dari Tabungan/Bank
  assert.ok(placeSuggestions({ assets, type: "emas_digital" }).includes("Bank Ar-Rajhi"));
  // Investasi tidak dicampur bank
  assert.deepEqual(placeSuggestions({ assets, type: "investasi", savedBanks: ["Riyad Bank"] }), ["Al Rajhi Capital"]);
  // Bank yang sudah dihapus asetnya tetap ada bila ditetapkan di profil
  assert.ok(placeSuggestions({ assets: [], type: "bank", savedBanks: ["Bank Ar-Rajhi"] }).includes("Bank Ar-Rajhi"));
  assert.deepEqual(withSavedBank(["BCA"], "  Bank Ar-Rajhi "), ["BCA", "Bank Ar-Rajhi"]);
  assert.equal(withSavedBank(["Bank BSI"], "BSI"), null, "ejaan lain bank yang sama tidak ditambah");
  assert.equal(withSavedBank([], ""), null);
});

test("brokerSpellingGroups: ejaan ganda dikelompokkan, ejaan terbanyak jadi baku", async () => {
  const { brokerSpellingGroups } = await import("../finance.js");
  const g = brokerSpellingGroups([
    { id: "1", broker: "Al Rajhi Capital" }, { id: "2", broker: "Al Rajhi Capital" }, { id: "3", broker: "al rajhi capital" },
    { id: "4", broker: "Bank BSI" }, { id: "5", broker: "BSI" },
    { id: "6", broker: "Bibit" }, { id: "7", broker: "" },
  ]);
  assert.deepEqual(g.map((x) => [x.canonical, x.total, x.variants.map((v) => v.name)]), [
    ["Al Rajhi Capital", 3, ["Al Rajhi Capital", "al rajhi capital"]],
    ["Bank BSI", 2, ["Bank BSI", "BSI"]],
  ]);
});

test("savedBankUsage: bank tersimpan & jumlah aset pemakainya", async () => {
  const { savedBankUsage } = await import("../finance.js");
  assert.deepEqual(savedBankUsage(["Bank Ar-Rajhi", "Salah Ketik"], [{ type: "bank", broker: "bank ar-rajhi" }, { type: "investasi", broker: "Bank Ar-Rajhi" }]),
    [{ name: "Bank Ar-Rajhi", usedBy: 1 }, { name: "Salah Ketik", usedBy: 0 }]);
});

test("ejaan seri: yang rapi (berhuruf besar) dipilih sebagai baku", async () => {
  const { brokerSpellingGroups, knownBrokers } = await import("../finance.js");
  const assets = [{ id: "1", type: "investasi", broker: "al rajhi capital" }, { id: "2", type: "investasi", broker: "Al Rajhi Capital" }];
  assert.equal(brokerSpellingGroups(assets)[0].canonical, "Al Rajhi Capital");
  assert.deepEqual(knownBrokers(assets, { type: "investasi" }), ["Al Rajhi Capital"]);
});

// ── Jatah belanja harian ─────────────────────────────────────────
import { spendingPace } from "../finance.js";

test("spendingPace: rencana pemasukan dikurangi rencana menabung, dibagi hari tersisa", () => {
  const p = spendingPace({ planIncome: 10_000_000, planSavings: 2_000_000, expense: 3_000_000, sedekah: 500_000, now: new Date(2026, 10, 21) });
  assert.equal(p.source, "plan");
  assert.equal(p.budget, 8_000_000);
  assert.equal(p.remaining, 4_500_000);
  assert.equal(p.daysLeft, 10); // 21–30 November
  assert.equal(p.perDay, 450_000);
  assert.equal(p.over, false);
});

test("spendingPace: tanpa rencana memakai pemasukan nyata; lewat anggaran → jatah 0", () => {
  const p = spendingPace({ income: 5_000_000, expense: 6_000_000, now: new Date(2026, 1, 28) });
  assert.equal(p.source, "income");
  assert.equal(p.daysLeft, 1);
  assert.equal(p.over, true);
  assert.equal(p.perDay, 0);
  assert.equal(p.pct, 100);
});

test("spendingPace: extraSpend mensimulasikan pembelian; tanpa data → null", () => {
  const base = { planIncome: 3_000_000, now: new Date(2026, 10, 1) };
  assert.equal(spendingPace(base).perDay, 100_000);
  assert.equal(spendingPace({ ...base, extraSpend: 1_500_000 }).perDay, 50_000);
  assert.equal(spendingPace({ now: new Date() }), null);
});

test("untung/rugi gabungan: per aset, lalu dikonversi dengan kurs masing-masing", async () => {
  const { portfolioGain } = await import("../finance.js");
  const rateMap = { SAR: 4250 }; // 1 SAR = 4.250 IDR
  const assets = [
    { type: "investasi", currency: "IDR", value: 12_000_000, purchase_price: 10_000_000 },  // +2 jt
    { type: "investasi", currency: "SAR", value: 1_100, purchase_price: 1_000 },             // +100 SAR
    { type: "bank", currency: "IDR", value: 5_000_000 },                                     // tanpa harga beli → tidak ikut
  ];
  const r = portfolioGain(assets, "IDR", { rateMap });
  assert.equal(r.count, 2);
  assert.equal(Math.round(r.cost), 10_000_000 + 1_000 * 4250);
  assert.equal(Math.round(r.gain), 2_000_000 + 100 * 4250);
  // Persentase SAR sendiri tetap 10% (tidak tercampur nilai IDR)
  const sar = portfolioGain([assets[1]], "SAR", { rateMap });
  assert.equal(Math.round(sar.pct), 10);
});
