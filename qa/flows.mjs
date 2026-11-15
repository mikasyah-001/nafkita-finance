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

  await step("Audit kas: tarik tunai menambah 'seharusnya di tangan', selisih disesuaikan & tercatat", async () => {
    const wallet = () => page.evaluate(() => window.__qa.assets.find((a) => a.id === "a6").value);
    const w0 = await wallet();
    await nav("/transfer?to=a6");
    await page.selectOption("#transfer-from", "a1");
    await page.fill("#transfer-amount", "500000");
    await page.getByRole("button", { name: /Transfer Sekarang/ }).click();
    await page.waitForTimeout(800);
    assert.equal(await wallet(), w0 + 500000, "Dompet bertambah dari tarik tunai");
    const h0 = await homeNumbers();
    await nav("/audit-kas");
    const expected = rupiah(await page.locator(".card-gradient-primary p.tabular-nums").first().innerText());
    assert.equal(expected, w0 + 500000, "Seharusnya di tangan");
    await page.fill("#audit-physical", String(expected - 50000));
    assert.ok(await page.getByText("Kurang Rp 50.000").isVisible(), "Selisih tampil");
    await page.getByRole("button", { name: /Sesuaikan saldo/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Sesuaikan" }).click();
    await page.waitForTimeout(800);
    assert.equal(await wallet(), expected - 50000, "Saldo dompet = uang fisik");
    const h1 = await homeNumbers();
    assert.equal(h1.belanja - h0.belanja, 50000, "Kekurangan tercatat sebagai pengeluaran");
  });

  await step("Pengeluaran luar biasa: ditandai, total naik, rata-rata harian rutin tidak berubah", async () => {
    await nav("/laporan?tab=bulanan");
    const avgText = async () => page.getByText(/Rata-rata\/hari/).locator("xpath=following-sibling::p[1]").innerText();
    const avg0 = await avgText();
    await nav("/add");
    await page.fill("#add-tx-amount", "60000000");
    await page.getByRole("button", { name: "Belanja" }).first().click();
    await page.locator("label[for=\"add-tx-extraordinary\"]").click();
    assert.ok(await page.isChecked("#add-tx-extraordinary"), "Sakelar aktif");
    await page.getByRole("button", { name: /Simpan Transaksi/ }).click();
    await page.waitForURL(BASE + "/", { timeout: 5000 });
    await nav("/laporan?tab=bulanan");
    assert.equal(await avgText(), avg0, "Rata-rata harian rutin sama");
    assert.ok(await page.getByText(/Termasuk pengeluaran luar biasa/).first().isVisible(), "Catatan luar biasa tampil");
  });

  await step("Anggaran: toggle Pribadi benar-benar mengganti cakupan data", async () => {
    await nav("/anggaran");
    assert.ok(await page.getByText(/Anggaran Bersama Keluarga/).isVisible(), "Awal: Bersama");
    await page.getByRole("radio", { name: /Pribadi/ }).click();
    await page.waitForTimeout(400);
    assert.ok(await page.getByText(/Anggaran Pribadi/).isVisible(), "Setelah toggle: Pribadi");
    await page.getByRole("radio", { name: /Bersama/ }).click();
  });

  await step("Rencana menabung: diatur di Anggaran, progresnya tampil di Beranda", async () => {
    await nav("/anggaran");
    await page.fill("#plan-savings", "5000000");
    await page.locator("#plan-savings").blur();
    await page.waitForTimeout(800);
    const home = await homeNumbers();
    const text = await page.getByText(/Rencana menabung/).locator("xpath=..").innerText();
    const expectedPct = Math.min(100, Math.round((home.saldo / 5000000) * 100));
    assert.ok(text.includes(expectedPct >= 100 ? "Tercapai" : `${expectedPct}%`), `Progres tampil (${text.replace(/\s+/g, " ")})`);
  });

  await step("Tambah aset emas: nilai = gram × harga, satuan gram, mata uang IDR", async () => {
    await nav("/aset");
    await page.getByRole("button", { name: /Tambah aset/i }).first().click();
    await page.getByRole("radio", { name: "Emas", exact: true }).click();
    await page.fill("#asset-name", "QA Emas");
    await page.fill("#asset-gold-quantity", "10");
    await page.fill("#asset-gold-purchase-price", "1500000");
    await page.getByRole("button", { name: /Simpan aset/i }).click();
    await page.waitForTimeout(600);
    const a = await page.evaluate(() => window.__qa.assets.find((x) => x.name === "QA Emas"));
    assert.ok(a, "Tersimpan");
    assert.equal(a.value, 15000000); assert.equal(a.unit, "gram"); assert.equal(a.currency, "IDR");
  });

  await step("Ganti jenis Emas → Bank: isian gram/harga tidak terbawa", async () => {
    await page.getByRole("button", { name: /Tambah aset/i }).first().click();
    await page.getByRole("radio", { name: "Emas", exact: true }).click();
    await page.fill("#asset-gold-quantity", "40");
    await page.fill("#asset-gold-purchase-price", "1250000");
    await page.getByRole("radio", { name: /Tabungan/ }).click();
    await page.fill("#asset-name", "QA Bank");
    await page.fill("#asset-value", "7000000");
    assert.equal(await page.locator("#asset-purchase-price").count(), 0, "Bank tidak menanyakan harga beli");
    await page.getByRole("button", { name: /Simpan aset/i }).click();
    await page.waitForTimeout(600);
    const a = await page.evaluate(() => window.__qa.assets.find((x) => x.name === "QA Bank"));
    assert.equal(a.value, 7000000); assert.equal(a.quantity, 0); assert.equal(a.purchase_price, 0); assert.equal(a.unit, "");
  });

  await step("Zakat: harta simpanan digabung (IDR+SAR+emas), rumah tidak dihitung, utang dikurangkan", async () => {
    await nav("/zakat");
    await page.fill("#zakat-gold-price", "1500000");
    await page.getByRole("button", { name: "Pakai" }).click();
    await page.waitForTimeout(900);
    const expected = await page.evaluate(() => {
      const rate = { IDR: 1, SAR: 4250 };
      let net = 0;
      for (const a of window.__qa.assets) {
        if (a.type === "emas" || a.type === "emas_digital") {
          const d = a.purchase_date || a.created_date;
          if (d && Date.now() < new Date(d).getTime() + 354 * 86400000) continue; // belum genap haul
          net += (a.quantity || 0) * 1500000;
        }
        else if (["bank", "tunai", "investasi"].includes(a.type)) net += a.value * (rate[a.currency || "IDR"] || 0);
      }
      net -= 5000000; // utang aktif jatuh tempo < 12 bulan (data contoh)
      return Math.round(net * 0.025);
    });
    const hero = rupiah(await page.locator(".card-gradient-primary p.tabular-nums").first().innerText());
    assert.equal(hero, expected, "Zakat = 2,5% × harta bersih gabungan");
    assert.ok(await page.getByText("Wajib zakat").isVisible());
    assert.ok(await page.getByText("Emas belum genap haul").isVisible(), "Emas baru dibeli tampil sebagai belum haul");
    assert.ok(await page.getByText(/Emas tabungan anak · 15 gr/).isVisible());
  });

  await step("Zakat: catat pembayaran sebagian → sisa berkurang & tercatat sebagai transaksi Zakat", async () => {
    const before = rupiah(await page.locator(".card-gradient-primary p.tabular-nums").first().innerText());
    await page.getByRole("button", { name: /Catat pembayaran zakat/ }).click();
    await page.fill("#zakat-pay-amount", "1000000");
    await page.fill("#zakat-pay-recipient", "BAZNAS");
    await page.getByRole("button", { name: /Simpan pembayaran/ }).click();
    await page.waitForTimeout(900);
    const after = rupiah(await page.locator(".card-gradient-primary p.tabular-nums").first().innerText());
    assert.equal(before - after, 1000000, "Sisa berkurang");
    const tx = await page.evaluate(() => window.__qa.tx.find((t) => t.category === "Zakat"));
    assert.ok(tx && tx.type === "sedekah" && tx.amount === 1000000, "Transaksi zakat tercatat");
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
