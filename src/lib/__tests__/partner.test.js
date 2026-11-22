import { test } from "node:test";
import assert from "node:assert/strict";
import { connectionDuration, lastActiveLabel } from "../partner.js";

const NOW = new Date(2026, 10, 22, 10, 0); // 22 Nov 2026 10:00

test("connectionDuration: tahun, bulan, hari", () => {
  assert.equal(connectionDuration(new Date(2026, 10, 22, 8).toISOString(), NOW), "hari ini");
  assert.equal(connectionDuration(new Date(2026, 10, 10).toISOString(), NOW), "12 hari");
  assert.equal(connectionDuration(new Date(2026, 2, 19).toISOString(), NOW), "8 bulan 3 hari");
  assert.equal(connectionDuration(new Date(2025, 8, 30).toISOString(), NOW), "1 tahun 1 bulan");
  assert.equal(connectionDuration(new Date(2026, 9, 25).toISOString(), NOW), "28 hari"); // belum genap sebulan
  assert.equal(connectionDuration(null, NOW), "");
});

test("lastActiveLabel: relatif lalu tanggal", () => {
  const ago = (ms) => new Date(NOW.getTime() - ms).toISOString();
  assert.equal(lastActiveLabel(ago(30e3), NOW), "baru saja");
  assert.equal(lastActiveLabel(ago(5 * 60e3), NOW), "5 menit lalu");
  assert.equal(lastActiveLabel(ago(3 * 3600e3), NOW), "3 jam lalu");
  assert.equal(lastActiveLabel(ago(30 * 3600e3), NOW), "kemarin");
  assert.equal(lastActiveLabel(ago(4 * 864e5), NOW), "4 hari lalu");
  assert.equal(lastActiveLabel(ago(20 * 864e5), NOW, () => "2 Nov"), "2 Nov");
});
