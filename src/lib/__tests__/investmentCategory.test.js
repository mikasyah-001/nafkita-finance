import { test } from "node:test";
import assert from "node:assert/strict";
import { inferInstrument, investmentCategory, emergencyAssetIds, categoryBreakdown } from "../investmentCategory.js";

test("inferInstrument: contoh nyata dari portofolio", () => {
  assert.equal(inferInstrument({ name: "Mandiri Pasar Uang Syariah Kelas A" }), "pasar_uang");
  assert.equal(inferInstrument({ name: "Saving and Liquidity SAR" }), "pasar_uang");
  assert.equal(inferInstrument({ name: "Al Rajhi Commodity Murabaha Fund" }), "pasar_uang");
  assert.equal(inferInstrument({ name: "SP FUNDS S&P 500 SHARIA (SPUS)", ticker: "SPUS" }), "etf");
  assert.equal(inferInstrument({ name: "Wahed FTSE USA Shariah", ticker: "HLAL" }), "etf");
  assert.equal(inferInstrument({ name: "KINGDOM (4280)" }), "saham");
  assert.equal(inferInstrument({ name: "SABIC", ticker: "2010", exchange: "TASI" }), "saham");
  assert.equal(inferInstrument({ name: "Bank Syariah Indonesia", ticker: "BRIS" }), "saham");
  assert.equal(inferInstrument({ name: "Sukuk Ritel SR019" }), "sukuk");
  assert.equal(inferInstrument({ name: "SBR013" }), "sukuk");
  assert.equal(inferInstrument({ name: "Reksa Dana Syariah Saham Manulife" }), "reksadana");
  assert.equal(inferInstrument({ name: "Al Rajhi GCC Equity Fund" }), "reksadana");
  assert.equal(inferInstrument({ name: "Investasi teman" }), "lainnya");
});

test("investmentCategory: manual menang; tebakan spesifik menyempurnakan label lama", () => {
  assert.equal(investmentCategory({ name: "Mandiri Pasar Uang Syariah", instrument: "reksadana" }), "pasar_uang");
  assert.equal(investmentCategory({ name: "SP FUNDS S&P 500 SHARIA", ticker: "SPUS", instrument: "saham" }), "etf");
  assert.equal(investmentCategory({ name: "Mandiri Pasar Uang Syariah", instrument: "reksadana", instrument_manual: true }), "reksadana");
  assert.equal(investmentCategory({ name: "Apa saja", instrument: "sukuk" }), "sukuk");
  assert.equal(investmentCategory({ name: "KINGDOM (4280)", instrument: "lainnya" }), "saham");
});

test("emergencyAssetIds & categoryBreakdown", () => {
  assert.deepEqual([...emergencyAssetIds([{ type: "darurat", linked_asset_id: "a1" }, { type: "haji", linked_asset_id: "a2" }, { type: "darurat" }])], ["a1"]);
  const rows = categoryBreakdown([
    { name: "Pasar Uang A", value: 300 }, { name: "X", ticker: "SPUS", value: 600 }, { name: "Pasar Uang B", value: 100 },
  ]);
  assert.deepEqual(rows.map((r) => [r.key, r.count, r.value, Math.round(r.pct)]), [["etf", 1, 600, 60], ["pasar_uang", 2, 400, 40]]);
});
