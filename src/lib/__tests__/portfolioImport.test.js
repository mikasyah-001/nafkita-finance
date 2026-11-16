// Tes impor portofolio — angka diambil dari contoh screenshot pengguna.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeHolding, mergeHoldings, matchExistingAsset, holdingToAsset, normalizeCurrency, summarize } from "../portfolioImport.js";
import { assetCost, assetGain } from "../finance.js";

test("Mata uang: simbol riyal/Rp/$ dikenali", () => {
  assert.equal(normalizeCurrency("⃁"), "SAR");
  assert.equal(normalizeCurrency("SAR / g"), "SAR");
  assert.equal(normalizeCurrency("$"), "USD");
  assert.equal(normalizeCurrency("Rp"), "IDR");
  assert.equal(normalizeCurrency("", "SAR"), "SAR");
});

test("Angka berformat lokal dibaca benar", () => {
  const h = normalizeHolding({ name: "Mandiri Pasar Uang Syariah Kelas A", instrument: "reksa dana", currency: "Rp", market_value: "22.287.562,64", gain: "537.562,64" });
  assert.equal(h.market_value, 22287562.64);
  assert.equal(h.total_cost, 21750000); // nilai − untung
  assert.equal(h.instrument, "reksadana");
});

test("Saham Al Rajhi: modal & untung terlengkapi dari jumlah × rata-rata", () => {
  const h = normalizeHolding({ name: "ALRAJHI", ticker: "1120", exchange: "TASI", currency: "SAR", quantity: 88, avg_cost: 65.14, last_price: 61.5, market_value: 5412 });
  assert.equal(h.instrument, "saham");
  assert.equal(h.total_cost, 5732.32);
  assert.equal(h.gain, -320.32);
  assert.deepEqual(h.warnings, []);
});

test("Daftar (nama terpotong) + detail digabung jadi satu, angka presisi menang", () => {
  const list = [
    normalizeHolding({ name: "SAUDI AR...", ticker: "2222", currency: "SAR", quantity: 179, avg_cost: 26.19, last_price: 26.24, market_value: 4696.96, gain: 8.86 }),
    normalizeHolding({ name: "ALRAJHI", ticker: "1120", currency: "SAR", quantity: 88, avg_cost: 65.14, market_value: 5412 }),
    normalizeHolding({ name: "SAUDI ARAMCO", ticker: "2222", exchange: "TASI", currency: "SAR", quantity: 179, avg_cost: 26, total_cost: 4688.1, market_value: 4696.96, gain: 8.86 }),
  ];
  const m = mergeHoldings(list);
  assert.equal(m.length, 2);
  const aramco = m.find((h) => h.ticker === "2222");
  assert.equal(aramco.name, "SAUDI ARAMCO");
  assert.equal(aramco.exchange, "TASI");
  assert.equal(aramco.avg_cost, 26.19, "26.19 lebih presisi dari 26");
});

test("Reksa dana tanpa ticker digabung lewat nama", () => {
  const m = mergeHoldings([
    normalizeHolding({ name: "Saving and Liquidity SAR", instrument: "fund", currency: "SAR", quantity: 9.087, market_value: 1782.99, avg_cost: 193.14 }),
    normalizeHolding({ name: "Saving and Liquidity SAR", instrument: "fund", currency: "SAR", quantity: 9.0866, avg_cost: 193.1415, total_cost: 1755, market_value: 1782.99 }),
  ]);
  assert.equal(m.length, 1);
  assert.equal(m[0].quantity, 9.0866);
  assert.equal(m[0].total_cost, 1755);
});

test("Mata uang beda = instrumen beda (SPUS USD tidak bercampur SAR)", () => {
  const m = mergeHoldings([
    normalizeHolding({ name: "SP FUNDS S&P 500 SHARIA", ticker: "SPUS", currency: "$", quantity: 65, market_value: 3808.87, total_cost: 3627 }),
    normalizeHolding({ name: "ALRAJHI", ticker: "1120", currency: "SAR", quantity: 88, market_value: 5412 }),
  ]);
  assert.equal(m.length, 2);
  assert.deepEqual(summarize(m).map((s) => s.currency).sort(), ["SAR", "USD"]);
});

test("Emas dompet: emas_digital, harga beli per gram, nilai pasar pakai harga jual", () => {
  const h = normalizeHolding({ name: "Gold", instrument: "Gold Wallet", currency: "SAR", quantity: 1, avg_cost: 502.38, last_price: 493.27, market_value: 493.27 });
  const a = holdingToAsset(h);
  assert.equal(a.type, "emas_digital");
  assert.equal(a.unit, "gram");
  assert.equal(a.purchase_price, 502.38);
  assert.equal(assetCost(a), 502.38);
});

test("Saham → aset investasi: purchase_price = modal total, untung sesuai aplikasi", () => {
  const h = normalizeHolding({ name: "ALRAJHI", ticker: "1120", currency: "SAR", quantity: 88, total_cost: 5731.91, market_value: 5412 });
  const a = holdingToAsset(h, { today: "2026-11-16" });
  assert.equal(a.type, "investasi");
  assert.equal(a.instrument, "saham");
  assert.equal(a.unit, "lembar");
  assert.equal(a.purchase_price, 5731.91);
  assert.equal(a.name, "ALRAJHI (1120)");
  const g = assetGain(a);
  assert.equal(Math.round(g.gain * 100) / 100, -319.91);
});

test("Impor ulang mencocokkan aset lama (ticker / nama), bukan duplikat", () => {
  const assets = [
    { id: "x1", type: "investasi", currency: "SAR", name: "ALRAJHI (1120)", ticker: "1120" },
    { id: "x2", type: "investasi", currency: "SAR", name: "Saving and Liquidity SAR" },
    { id: "x3", type: "investasi", currency: "IDR", name: "ALRAJHI (1120)" },
  ];
  assert.equal(matchExistingAsset(normalizeHolding({ ticker: "1120", name: "ALRAJHI", currency: "SAR", market_value: 1 }), assets)?.id, "x1");
  assert.equal(matchExistingAsset(normalizeHolding({ name: "Saving and Liquidity SAR", instrument: "fund", currency: "SAR", market_value: 1 }), assets)?.id, "x2");
  assert.equal(matchExistingAsset(normalizeHolding({ ticker: "9999", name: "Lain", currency: "SAR", market_value: 1 }), assets), null);
  // Pembaruan mempertahankan nama & tidak menimpa visibilitas
  const upd = holdingToAsset(normalizeHolding({ ticker: "1120", name: "ALRAJHI", currency: "SAR", market_value: 5500 }), { existing: assets[0] });
  assert.equal(upd.name, "ALRAJHI (1120)");
  assert.equal(upd.visibility, undefined);
});

test("Peringatan bila nilai pasar ≠ jumlah × harga", () => {
  const h = normalizeHolding({ name: "X", ticker: "X", currency: "SAR", quantity: 10, last_price: 5, market_value: 80 });
  assert.ok(h.warnings.some((w) => /Periksa angka/.test(w)));
});

test("Untung dari aplikasi lebih presisi daripada rata-rata yang dibulatkan", () => {
  const h = normalizeHolding({ name: "ALRAJHI", ticker: "1120", currency: "SAR", quantity: 88, avg_cost: 65.14, market_value: 5412, gain: -319.91 });
  assert.equal(h.total_cost, 5731.91);
});

// ── Lot / tanggal pembelian (contoh: Lots Breakdown ALRAJHI, 2 screenshot tumpang tindih) ──
import { normalizeLotDate, mergeLots, lotSummary, lotsToCreate, normalizeLot } from "../portfolioImport.js";
const SHOT1 = [ // gulir bawah
  { date: "13 May 2026", side: "Buy", quantity: 11, price: 65.95 },
  { date: "21 Apr 2026", side: "Buy", quantity: 3, price: 71.75 },
  { date: "04 Apr 2026", side: "Buy", quantity: 2, price: 106.4 },
  { date: "05 Mar 2026", side: "Buy", quantity: 7, price: 101 },
  { date: "04 Feb 2026", side: "Buy", quantity: 5, price: 107.8 },
];
const SHOT2 = [ // gulir atas
  { date: "07 Oct 2026", side: "Buy", quantity: 4, price: 63.75 },
  { date: "06 Aug 2026", side: "Buy", quantity: 10, price: 65 },
  { date: "08 Jul 2026", side: "Buy", quantity: 17, price: 65.55 },
  { date: "05 Jun 2026", side: "Buy", quantity: 13, price: 66.5 },
  { date: "13 May 2026", side: "Buy", quantity: 11, price: 65.95 },
];

test("Tanggal lot dari berbagai format", () => {
  assert.equal(normalizeLotDate("13 May 2026"), "2026-05-13");
  assert.equal(normalizeLotDate("04 Agt 2026"), "2026-08-04");
  assert.equal(normalizeLotDate("2026-10-06"), "2026-10-06");
  assert.equal(normalizeLotDate("06/10/2026"), "2026-10-06");
  assert.equal(normalizeLotDate("kemarin"), "");
});

test("Dua screenshot lot yang tumpang tindih digabung tanpa duplikat", () => {
  const lots = mergeLots(SHOT1.map(normalizeLot), SHOT2.map(normalizeLot));
  assert.equal(lots.length, 9, "13 May muncul di kedua screenshot → sekali");
  assert.equal(lots[0].date, "2026-10-07");
  assert.equal(lots.at(-1).date, "2026-02-04");
});

test("Lot dicocokkan dengan total lembar: 72 dari 88 → kurang 16", () => {
  const lots = mergeLots(SHOT1.map(normalizeLot), SHOT2.map(normalizeLot));
  const s = lotSummary(lots, 88);
  assert.equal(s.netQty, 72);
  assert.equal(s.diff, 16);
  assert.equal(s.status, "partial");
  assert.equal(s.firstDate, "2026-02-04");
  assert.match(s.message, /72 dari 88/);
  assert.equal(lotSummary(lots, 72).status, "complete");
  assert.equal(lotSummary([...lots, normalizeLot({ date: "2026-11-01", side: "sell", quantity: 2, price: 63 })], 72).status, "partial");
});

test("Holding gabungan membawa lot & tanggal beli paling awal", () => {
  const [h] = mergeHoldings([
    normalizeHolding({ name: "ALRAJHI", ticker: "1120", currency: "SAR", quantity: 88, total_cost: 5731.91, market_value: 5574.8, lots: SHOT2 }),
    normalizeHolding({ name: "ALRAJHI", ticker: "1120", currency: "SAR", last_price: 63.35, lots: SHOT1 }),
  ]);
  assert.equal(h.lots.length, 9);
  assert.equal(h.quantity, 88, "Total tetap dari rincian, bukan dari lot");
  const a = holdingToAsset(h);
  assert.equal(a.purchase_date, "2026-02-04");
  assert.equal(a.quantity, 88);
  assert.equal(a.purchase_price, 5731.91);
});

test("Impor ulang hanya membuat lot yang belum ada (termasuk DCA manual yang sama)", () => {
  const lots = mergeLots(SHOT2.map(normalizeLot));
  const existing = [{ date: "2026-10-07", quantity: 4, price_per_unit: 63.75 }, { date: "2026-08-06T00:00:00Z", quantity: 10, price_per_unit: 65 }];
  const todo = lotsToCreate(lots, existing);
  assert.deepEqual(todo.map((l) => l.date), ["2026-07-08", "2026-06-05", "2026-05-13"]);
});

// ── Angka berupa teks apa adanya dari AI (penyebab nilai pasar 0 di HP) ──
import { num } from "../portfolioImport.js";
test("Angka teks dengan simbol riyal & format lokal terbaca", () => {
  assert.equal(num("⃁ 5,570.40"), 5570.4);
  assert.equal(num("⃁ -161.51"), -161.51);
  assert.equal(num("(319.91)"), -319.91);
  assert.equal(num("Rp 22.287.562,64", "IDR"), 22287562.64);
  assert.equal(num("Rp 537.562", "IDR"), 537562);
  assert.equal(num("1,782", "SAR"), 1782);
  assert.equal(num("0,5", "IDR"), 0.5);
  assert.equal(num("9.0866"), 9.0866);
  assert.equal(num("—"), null);
});
test("Layar Details ALRAJHI (angka teks) → nilai pasar & modal terisi", () => {
  const h = normalizeHolding({ name: "ALRAJHI", ticker: "1120", market_value: "⃁ 5,570.40", quantity: "88", avg_cost: "⃁ 65.14", total_cost: "⃁ 5,731.91", gain: "⃁ -161.51", last_price: "⃁ 63.30" });
  assert.equal(h.currency, "SAR", "Mata uang ditebak dari simbol");
  assert.equal(h.market_value, 5570.4);
  assert.equal(h.total_cost, 5731.91);
  assert.equal(h.gain, -161.51);
  assert.deepEqual(h.warnings, []);
});

// ── Harga online: validasi sebelum dipakai ──
import { validateLivePrice } from "../portfolioImport.js";
test("Harga online divalidasi: mata uang, selisih wajar, kebaruan", () => {
  const it = { ticker: "1120", currency: "SAR", ref_price: 63.3 };
  const now = new Date("2026-11-16");
  assert.equal(validateLivePrice({ price: "63.45", currency: "SAR", as_of: "2026-11-16" }, it, now).ok, true);
  assert.equal(validateLivePrice({ price: "16.9", currency: "USD", as_of: "2026-11-16" }, it, now).ok, false, "Mata uang beda");
  assert.match(validateLivePrice({ price: "126.6", currency: "SAR", as_of: "2026-11-16" }, it, now).reason, /Selisih 100%/);
  assert.match(validateLivePrice({ price: "63", currency: "SAR", as_of: "2026-10-01" }, it, now).reason, /Data lama/);
  assert.equal(validateLivePrice({ price: "", currency: "SAR" }, it, now).ok, false);
});

import { attachLots } from "../portfolioImport.js";
test("Lot datar tingkat atas ditempel ke holding (ticker / satu-satunya / stub)", () => {
  const a = attachLots({ holdings: [{ name: "ALRAJHI", ticker: "1120", last_price: "⃁ 63.35" }], lots: [{ ticker: "1120", date: "13 May 2026", side: "Buy", quantity: "11.0000", price: "65.9500" }, { date: "21 Apr 2026", side: "Buy", quantity: "3", price: "71.75" }] });
  assert.equal(a.length, 1);
  assert.equal(a[0].lots.length, 2, "lot tanpa ticker → holding satu-satunya");
  const b = attachLots({ holdings: [], lots: [{ ticker: "2222", name: "SAUDI ARAMCO", date: "01 Jan 2026", side: "Buy", quantity: "5", price: "26" }] });
  assert.equal(b.length, 1); assert.equal(b[0].ticker, "2222"); assert.equal(b[0].lots.length, 1);
  const h = normalizeHolding(a[0]);
  assert.equal(h.lots.length, 2);
  assert.equal(h.lots[0].quantity, 11);
  assert.equal(h.lots[0].price, 65.95);
});

// ── Asal nilai pasar: broker > manual > online ──
import { brokerPriceSource, valueSourceInfo } from "../portfolioImport.js";
test("Sumber harga resmi mengikuti broker tempat membeli", () => {
  assert.match(brokerPriceSource({ broker: "Al Rajhi Capital", exchange: "TASI", instrument: "saham" }), /Saudi Exchange/);
  assert.match(brokerPriceSource({ broker: "Al Rajhi Capital", instrument: "reksadana", currency: "SAR" }), /NAV resmi/);
  assert.match(brokerPriceSource({ broker: "Al Rajhi Capital", exchange: "ARCA", currency: "USD" }), /bursa ARCA/);
  assert.match(brokerPriceSource({ broker: "Bibit", instrument: "reksadana", currency: "IDR" }), /NAB/);
});
test("Impor broker → asal nilai 'Dari Al Rajhi Capital'; dilengkapi online → perkiraan", () => {
  const h = normalizeHolding({ name: "ALRAJHI", ticker: "1120", exchange: "TASI", currency: "SAR", quantity: 88, market_value: "⃁ 5,570.40", platform: "Al Rajhi Capital", as_of: "2026-11-16" });
  const a = holdingToAsset(h);
  assert.equal(a.value_source, "broker");
  assert.equal(a.exchange, "TASI");
  assert.deepEqual(valueSourceInfo(a), { kind: "broker", label: "Dari Al Rajhi Capital", date: "2026-11-16" });
  assert.equal(holdingToAsset({ ...h, price_source: "Tadawul" }).value_source, "online");
  assert.equal(valueSourceInfo({ value_source: "online", price_date: "2026-11-16" }).label, "Perkiraan harga online");
});
