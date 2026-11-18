import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmountInput, formatAmountInput, caretAfterFormat, significantLeft } from "../moneyInput.js";

test("IDR: titik ribuan, tanpa desimal", () => {
  assert.equal(formatAmountInput("1008000", "IDR"), "1.008.000");
  assert.equal(parseAmountInput("1.008.000", "IDR"), "1008000");
  assert.equal(parseAmountInput("Rp 1.500.000,-", "IDR"), "1500000");
  assert.equal(parseAmountInput("007", "IDR"), "7");
  assert.equal(formatAmountInput("", "IDR"), "");
});

test("SAR/USD: koma ribuan, titik desimal maks. 2", () => {
  assert.equal(formatAmountInput("1785.54", "SAR"), "1,785.54");
  assert.equal(formatAmountInput("1785.", "SAR"), "1,785.", "titik desimal yang sedang diketik tidak hilang");
  assert.equal(parseAmountInput("1,785.549", "SAR"), "1785.54");
  assert.equal(parseAmountInput("1.2.3", "USD"), "1.23");
  assert.equal(parseAmountInput(".5", "USD"), "0.5");
  assert.equal(parseAmountInput("1449.9712", "SAR", 4), "1449.9712", "harga per unit boleh 4 desimal");
  assert.equal(parseAmountInput("12.5", "SAR", 0), "12");
});

test("bolak-balik format ↔ parse stabil", () => {
  for (const [v, c] of [["22315881", "IDR"], ["3694.6", "USD"], ["0.25", "SAR"]]) {
    assert.equal(parseAmountInput(formatAmountInput(v, c), c), v);
  }
});

test("kursor dipertahankan setelah diformat", () => {
  // "1.008.000": 4 digit di kiri kursor → setelah "1.008"
  assert.equal(caretAfterFormat("1.008.000", 4), 5);
  assert.equal(caretAfterFormat("1.008.000", 0), 0);
  assert.equal(caretAfterFormat("1.008.000", 99), 9);
  // SAR: titik desimal ikut dihitung
  assert.equal(significantLeft("1,785.5", 6, "SAR"), 5);
  assert.equal(caretAfterFormat("1,785.5", 5, "SAR"), 6);
});
