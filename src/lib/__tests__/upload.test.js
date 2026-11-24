import { test } from "node:test";
import assert from "node:assert/strict";
import { checkUpload } from "../uploadRules.js";

const f = (name, type, size = 1000) => ({ name, type, size });

test("gambar biasa diterima", () => {
  assert.equal(checkUpload(f("a.jpg", "image/jpeg")), null);
  assert.equal(checkUpload(f("IMG_1.HEIC", "")), null); // MIME kosong → ekstensi
});
test("SVG/HTML ditolak walau 'gambar'", () => {
  assert.match(checkUpload(f("x.svg", "image/svg+xml")), /tidak didukung/);
  assert.match(checkUpload(f("x.html", "text/html")), /tidak didukung/);
  assert.match(checkUpload(f("x.jpg", "text/html")), /tidak didukung/); // MIME menang atas ekstensi
});
test("ukuran dibatasi", () => {
  assert.match(checkUpload(f("a.jpg", "image/jpeg", 11 * 1024 * 1024)), /terlalu besar/);
  assert.match(checkUpload(f("a.jpg", "image/jpeg", 0)), /kosong/);
});
test("PDF hanya pada jenis yang mengizinkan", () => {
  assert.match(checkUpload(f("a.pdf", "application/pdf"), "image"), /tidak didukung/);
  assert.equal(checkUpload(f("a.pdf", "application/pdf"), "imageOrPdf"), null);
  assert.equal(checkUpload(f("a.txt", "text/plain"), "document"), null);
});
