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
