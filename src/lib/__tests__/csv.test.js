import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, rowToCsv } from "../csv.js";

test("angka negatif tetap angka", () => {
  assert.equal(csvCell(-5000), "-5000");
  assert.equal(csvCell(12.5), "12.5");
  assert.equal(csvCell(NaN), "");
});
test("teks berbahaya diberi awalan '", () => {
  assert.equal(csvCell("=HYPERLINK(\"x\")"), "\"'=HYPERLINK(\"\"x\"\")\"");
  assert.equal(csvCell("+62 812"), "'+62 812");
  assert.equal(csvCell("-coba"), "'-coba");
  assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
});
test("koma & kutip di-escape", () => {
  assert.equal(rowToCsv(["a,b", 'k"t', 3]), '"a,b","k""t",3');
});
