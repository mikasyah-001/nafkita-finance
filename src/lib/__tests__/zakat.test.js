// Test logika zakat mal. Jalankan: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeZakatMal, haulPeriod, hijriYear, paymentsForPeriod, NISAB_GOLD_GRAM } from "../zakat.js";

const GOLD = 1_500_000; // Rp/gram
const NISAB = NISAB_GOLD_GRAM * GOLD; // Rp127,5 jt
const RATES = { IDR: 1, SAR: 4200 };
const A = (o) => ({ id: Math.random().toString(36).slice(2), name: "Aset", currency: "IDR", ...o });

test("Nisab = 85 gr × harga emas; di bawah nisab tidak wajib", () => {
  const r = computeZakatMal({ assets: [A({ type: "bank", value: 100_000_000 })], goldPrice: GOLD, rateMap: RATES });
  assert.equal(r.nisab, NISAB);
  assert.equal(r.reachesNisab, false);
  assert.equal(r.zakat, 0);
  assert.equal(r.nisabGap, NISAB - 100_000_000);
});

test("Tabungan + emas DIGABUNG untuk nisab (dulu dihitung terpisah → tidak wajib)", () => {
  // 50 gr emas (Rp75 jt) + tabungan Rp60 jt = Rp135 jt ≥ nisab
  const r = computeZakatMal({ assets: [A({ type: "emas", quantity: 50, value: 1 }), A({ type: "bank", value: 60_000_000 })], goldPrice: GOLD, rateMap: RATES });
  assert.equal(r.gross, 135_000_000);
  assert.equal(r.reachesNisab, true);
  assert.equal(r.zakat, 3_375_000);
});

test("Mata uang berbeda digabung setelah konversi (dulu nisab per mata uang)", () => {
  // Rp70 jt + SAR 15.000 (= Rp63 jt) = Rp133 jt ≥ nisab
  const r = computeZakatMal({ assets: [A({ type: "bank", value: 70_000_000 }), A({ type: "tunai", value: 15_000, currency: "SAR" })], goldPrice: GOLD, rateMap: RATES });
  assert.equal(r.gross, 133_000_000);
  assert.equal(r.reachesNisab, true);
});

test("Rumah, tanah, kendaraan/lainnya TIDAK dihitung", () => {
  const r = computeZakatMal({ assets: [
    A({ type: "properti", value: 900_000_000 }), A({ type: "tanah", value: 500_000_000 }), A({ type: "lainnya", value: 250_000_000 }),
    A({ type: "bank", value: 10_000_000 }),
  ], goldPrice: GOLD, rateMap: RATES });
  assert.equal(r.gross, 10_000_000);
  assert.equal(r.excluded.length, 3);
  assert.equal(r.reachesNisab, false);
});

test("Emas dinilai harga pasar, bukan harga beli; tanpa harga emas → belum bisa dihitung", () => {
  const withPrice = computeZakatMal({ assets: [A({ type: "emas", quantity: 100, value: 50_000_000 })], goldPrice: GOLD, rateMap: RATES });
  assert.equal(withPrice.groups.emas, 150_000_000);
  const noPrice = computeZakatMal({ assets: [A({ type: "emas", quantity: 100, value: 50_000_000 })], goldPrice: 0, rateMap: RATES });
  assert.equal(noPrice.needsGoldPrice, true);
  assert.equal(noPrice.zakat, 0);
});

test("Utang jatuh tempo ≤12 bulan dikurangkan; utang jangka panjang tidak", () => {
  const now = new Date("2026-11-15");
  const r = computeZakatMal({
    assets: [A({ type: "bank", value: 200_000_000 })],
    debts: [
      { type: "utang", amount: 50_000_000, paid_amount: 10_000_000, currency: "IDR", due_date: "2027-03-01", status: "unpaid" },
      { type: "utang", amount: 300_000_000, currency: "IDR", due_date: "2035-01-01", status: "unpaid" },
      { type: "utang", amount: 9_000_000, currency: "IDR", status: "paid" },
    ],
    goldPrice: GOLD, rateMap: RATES, now,
  });
  assert.equal(r.groups.utang, 40_000_000);
  assert.equal(r.net, 160_000_000);
  assert.equal(r.zakat, 4_000_000);
});

test("Piutang lancar ikut dihitung (bisa dimatikan)", () => {
  const args = { assets: [A({ type: "bank", value: 100_000_000 })], debts: [{ type: "piutang", amount: 40_000_000, currency: "IDR", status: "unpaid" }], goldPrice: GOLD, rateMap: RATES };
  assert.equal(computeZakatMal(args).reachesNisab, true);
  assert.equal(computeZakatMal({ ...args, includeReceivables: false }).reachesNisab, false);
});

test("Aset tanpa kurs tidak dijumlahkan & dilaporkan", () => {
  const r = computeZakatMal({ assets: [A({ type: "bank", value: 1000, currency: "MYR" })], goldPrice: GOLD, rateMap: RATES });
  assert.equal(r.gross, 0);
  assert.deepEqual(r.unconverted, ["MYR"]);
});

test("Haul: 354 hari dari tanggal mulai; periode & jatuh tempo bergeser per haul", () => {
  const p = haulPeriod("2026-01-01", new Date("2026-11-15"));
  assert.equal(p.due.toISOString().slice(0, 10), "2026-12-21");
  assert.equal(p.daysLeft, 36);
  const p2 = haulPeriod("2026-01-01", new Date("2027-01-10"));
  assert.equal(p2.start.toISOString().slice(0, 10), "2026-12-21");
  assert.equal(hijriYear(new Date("2026-11-15")), 1448);
});

test("Pembayaran dihitung per periode haul", () => {
  const period = haulPeriod("2026-01-01", new Date("2026-11-15"));
  const pays = [
    { status: "paid", period_key: period.key, amount: 1_000_000 },
    { status: "paid", period_key: "haul-2025-01-12", amount: 9 },
  ];
  assert.equal(paymentsForPeriod(pays, period).length, 1);
});

import { goldHaul } from "../zakat.js";
test("Haul emas per aset dari tanggal beli: belum 354 hari → belum dihitung", () => {
  const now = new Date("2026-11-15");
  const r = computeZakatMal({
    assets: [
      A({ type: "emas", quantity: 60, purchase_date: "2025-06-01" }), // sudah haul
      A({ type: "emas", quantity: 40, purchase_date: "2026-08-01" }), // belum haul
      A({ type: "bank", value: 50_000_000 }),
    ],
    goldPrice: GOLD, rateMap: RATES, now,
  });
  assert.equal(r.goldGrams, 60);
  assert.equal(r.goldGramsPending, 40);
  assert.equal(r.groups.emas, 90_000_000);
  assert.equal(r.goldPending[0].due.toISOString().slice(0, 10), "2027-07-21");
  assert.equal(r.zakat, Math.round(140_000_000 * 0.025));
});
test("Haul emas: tanpa tanggal beli pakai tanggal dicatat; tanpa keduanya dianggap sudah haul", () => {
  const now = new Date("2026-11-15");
  assert.equal(goldHaul({ created_date: "2026-10-01" }, now).complete, false);
  assert.equal(goldHaul({ created_date: "2026-10-01" }, now).dateSource, "recorded");
  assert.equal(goldHaul({}, now).complete, true);
  assert.equal(goldHaul({ purchase_date: "2025-01-01", created_date: "2026-10-01" }, now).complete, true, "tanggal beli diutamakan");
});

import { paymentInZakatCurrency } from "../zakat.js";
test("Pembayaran zakat SAR dinilai setara IDR", () => {
  assert.equal(paymentInZakatCurrency({ amount: 500_000, currency: "IDR" }), 500_000);
  assert.equal(paymentInZakatCurrency({ amount: 100, currency: "SAR", amount_idr: 430_000 }, {}), 430_000);
  assert.equal(paymentInZakatCurrency({ amount: 100, currency: "SAR" }, { IDR: 1, SAR: 4300 }), 430_000);
  assert.equal(paymentInZakatCurrency({ amount: 100, currency: "SAR" }, { IDR: 1 }), 0);
});
