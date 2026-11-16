import { test } from "node:test";
import assert from "node:assert/strict";
import { liveTargets, summarizeLiveResult } from "../liveSummary.js";

const inv = (o) => ({ type: "investasi", quantity: 1, name: "X", ...o });

test("liveTargets: nilai broker hari ini tidak perlu dicek online", () => {
  const { fresh, targets } = liveTargets([
    inv({ id: "a", value_source: "broker", price_date: "2026-11-16" }),
    inv({ id: "b", value_source: "broker", price_date: "2026-11-05" }),
    inv({ id: "c", value_source: "manual", price_date: "2026-11-16" }),
    inv({ id: "d", quantity: 0 }),
  ], "2026-11-16");
  assert.deepEqual(fresh.map((x) => x.id), ["a"]);
  assert.deepEqual(targets.map((x) => x.id), ["b", "c"]);
});

test("summarizeLiveResult: singkat, 'sudah terbaru' bukan error", () => {
  const fresh = ["Bank Syariah Indonesia (Persero) Tbk. (BRIS)", "Saving and Liquidity SAR", "SP FUNDS S&P 500 SHARIA (SPUS)", "ALRAJHI (1120)", "SAUDI ARAMCO (2222)"].map((name) => ({ name }));
  const skipped = [{ asset: { name: "Mandiri Pasar Uang Syariah Kelas A" }, reason: "Data lama: harga online terakhir 2026-11-05" }];
  // Kasus di screenshot: 5 sudah terbaru dari broker + 1 harga online lama
  const s = summarizeLiveResult({ updated: [], skipped, fresh });
  assert.equal(s.tone, "warning");
  assert.equal(s.title, "Belum ada harga online terbaru");
  assert.equal(s.description, "5 sudah terbaru dari broker hari ini · harga online Mandiri Pasar Uang Syariah Kelas A belum terbaru. Isi nilai dari aplikasi broker di atas.");
  assert.ok(s.description.length < 160, "Tidak panjang");
  // Semua sudah terbaru → info, bukan error
  assert.equal(summarizeLiveResult({ fresh }).tone, "info");
  // Ada yang berhasil → sukses
  const ok = summarizeLiveResult({ updated: [{}], fresh, skipped: [{ asset: { name: "A" }, reason: "x" }, { asset: { name: "B" }, reason: "x" }, { asset: { name: "C" }, reason: "x" }] });
  assert.equal(ok.tone, "success");
  assert.match(ok.description, /harga online A, B & 1 lainnya tidak ditemukan/);
});
