// Uji alur input end-to-end di atas backend tiruan (qa/mockClient.js).
// Memastikan aksi pengguna mengubah angka di SEMUA tampilan secara konsisten.
// Jalankan: npm run qa:flows
import assert from "node:assert/strict";
import { BASE, loadPlaywright, startServer } from "./lib.mjs";

const { chromium } = loadPlaywright();
const server = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const jsErrors = [];
page.on("pageerror", (e) => jsErrors.push(e.message));

// Navigasi di dalam SPA (tanpa reload) agar state backend tiruan tetap ada.
const nav = async (p) => {
  await page.evaluate((to) => { window.history.pushState({}, "", to); window.dispatchEvent(new PopStateEvent("popstate")); }, p);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
};
const rupiah = (s) => Number(String(s).replace(/[^\d-]/g, "")) * (/^-|−/.test(String(s).trim()) ? 1 : 1);
const homeNumbers = async () => {
  await nav("/");
  const saldo = rupiah(await page.locator(".card-gradient-primary p.tabular-nums").first().innerText());
  const belanja = rupiah(await page.getByText("Total pengeluaran", { exact: true }).locator("xpath=following-sibling::p[1]").innerText());
  return { saldo, belanja };
};
const laporanTotal = async () => {
  await nav("/laporan?tab=bulanan");
  return rupiah(await page.locator(".card-gradient-primary p.tabular-nums").first().innerText());
};

const results = [];
const step = async (name, fn) => {
  try { await fn(); results.push(["✓", name]); }
  catch (e) { results.push(["✗", name + "\n    " + e.message.split("\n").slice(0, 4).join("\n    ")]); }
};

try {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const start = await homeNumbers();

  await step("Angka awal: Beranda = Laporan", async () => {
    assert.equal(await laporanTotal(), start.belanja);
  });

  await step("Catat pengeluaran Rp 100.000 → saldo turun & belanja naik di semua tampilan", async () => {
    await nav("/add");
    await page.fill("#add-tx-amount", "100000");
    await page.getByRole("button", { name: "Makanan" }).first().click();
    await page.fill("#add-tx-merchant", "QA Warung");
    await page.getByRole("button", { name: /Simpan Transaksi/ }).click();
    await page.waitForURL(BASE + "/", { timeout: 5000 });
    const after = await homeNumbers();
    assert.equal(after.belanja - start.belanja, 100000, "Ringkasan Belanja");
    assert.equal(start.saldo - after.saldo, 100000, "Saldo");
    assert.equal(await laporanTotal(), after.belanja, "Laporan = Beranda");
    start.saldo = after.saldo; start.belanja = after.belanja;
  });

  await step("Transfer Rp 1.000.000 antar rekening → saldo & belanja TIDAK berubah, saldo aset berpindah", async () => {
    const before = await page.evaluate(() => window.__qa.assets.map((a) => [a.id, a.value]));
    await nav("/transfer");
    await page.selectOption("#transfer-from", "a1");
    await page.selectOption("#transfer-to", "a5");
    await page.fill("#transfer-amount", "1000000");
    await page.getByRole("button", { name: /Transfer Sekarang/ }).click();
    await page.waitForTimeout(800);
    const after = await homeNumbers();
    assert.equal(after.belanja, start.belanja, "Ringkasan Belanja");
    assert.equal(after.saldo, start.saldo, "Saldo");
    const assets = Object.fromEntries(await page.evaluate(() => window.__qa.assets.map((a) => [a.id, a.value])));
    const b = Object.fromEntries(before);
    assert.equal(b.a1 - assets.a1, 1000000, "BCA berkurang");
    assert.equal(assets.a5 - b.a5, 1000000, "Mandiri bertambah");
  });

  await step("Kartu persetujuan tampil di Beranda selama ada yang menunggu", async () => {
    await nav("/");
    assert.ok(await page.getByText(/menunggu persetujuan Anda/).isVisible());
  });

  await step("Setujui transaksi pasangan Rp 3.200.000 → baru dihitung setelah disetujui", async () => {
    await nav("/persetujuan");
    await page.getByRole("button", { name: /Setujui/ }).first().click();
    await page.waitForTimeout(800);
    const after = await homeNumbers();
    assert.equal(after.belanja - start.belanja, 3200000, "Ringkasan Belanja");
    assert.equal(start.saldo - after.saldo, 3200000, "Saldo");
    assert.equal(await page.getByText(/menunggu persetujuan Anda/).count(), 0, "Kartu persetujuan hilang");
    start.saldo = after.saldo; start.belanja = after.belanja;
  });

  await step("Hapus transaksi: dialog konfirmasi muncul, Batal tidak menghapus, Hapus menghapus", async () => {
    const txId = await page.evaluate(() => window.__qa.tx.find((t) => t.merchant === "QA Warung").id);
    await nav(`/transaksi/${txId}`);
    await page.getByRole("button", { name: "Edit transaksi" }).click();
    await page.getByRole("button", { name: /Hapus Transaksi/ }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.waitFor({ timeout: 3000 });
    await dialog.getByRole("button", { name: "Batal" }).click();
    assert.ok(await page.evaluate((i) => window.__qa.tx.some((t) => t.id === i), txId), "Batal tidak menghapus");
    await page.getByRole("button", { name: /Hapus Transaksi/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hapus" }).click();
    await page.waitForTimeout(800);
    assert.ok(!(await page.evaluate((i) => window.__qa.tx.some((t) => t.id === i), txId)), "Terhapus");
    const after = await homeNumbers();
    assert.equal(start.belanja - after.belanja, 100000, "Belanja kembali turun");
  });

  await step("Tidak ada error JavaScript selama alur", async () => {
    assert.deepEqual(jsErrors, []);
  });
} finally {
  await browser.close();
  server.kill();
}
for (const [ok, name] of results) console.log(`${ok} ${name}`);
const failed = results.filter((r) => r[0] === "✗").length;
console.log(`\n${results.length - failed}/${results.length} alur lolos`);
process.exit(failed ? 1 : 0);
