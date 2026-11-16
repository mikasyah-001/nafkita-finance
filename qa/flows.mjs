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

  await step("Edit transaksi: layar sama dengan Catat, isian terisi, simpan memperbarui (bukan membuat baru)", async () => {
    const t0 = await page.evaluate(() => window.__qa.tx.find((t) => t.merchant === "QA Warung"));
    const countBefore = await page.evaluate(() => window.__qa.tx.length);
    await nav(`/transaksi/${t0.id}`);
    await page.getByRole("button", { name: /Edit atau hapus/ }).click();
    await page.waitForTimeout(500);
    assert.ok(await page.getByRole("heading", { name: "Edit transaksi" }).isVisible(), "Judul Edit transaksi");
    assert.equal(await page.locator("nav a[href='/add']").count(), 0, "Navigasi bawah disembunyikan (tidak menutupi isian)");
    assert.equal(await page.inputValue("#add-tx-merchant"), "QA Warung", "Merchant terisi");
    assert.equal(await page.getByRole("tab", { name: "Pengeluaran" }).getAttribute("aria-selected"), "true");
    assert.equal(await page.getByText("Pakai template").count(), 0, "Template tidak tampil saat edit");
    await page.fill("#add-tx-merchant", "QA Warung Baru");
    await page.getByRole("button", { name: /Simpan Perubahan/ }).click();
    await page.waitForTimeout(900);
    const t1 = await page.evaluate((i) => window.__qa.tx.find((t) => t.id === i), t0.id);
    assert.equal(t1.merchant, "QA Warung Baru", "Tersimpan ke transaksi yang sama");
    assert.equal(t1.amount, t0.amount); assert.equal(t1.currency, t0.currency);
    assert.equal(await page.evaluate(() => window.__qa.tx.length), countBefore, "Tidak membuat transaksi baru");
    assert.ok(page.url().endsWith(`/transaksi/${t0.id}`), "Kembali ke detail");
    await page.evaluate((i) => { window.__qa.tx.find((t) => t.id === i).merchant = "QA Warung"; }, t0.id);
  });

  await step("Bukti transaksi: tambah dari Detail, tampil, buka layar penuh, hapus", async () => {
    const t0 = await page.evaluate(() => window.__qa.tx.find((t) => t.merchant === "QA Warung"));
    await nav(`/transaksi/${t0.id}`);
    assert.ok(await page.getByText("Tambah foto bukti").isVisible(), "Ajakan tambah bukti tampil saat belum ada");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHUlEQVR4nGP4z8BAEmIY1TCqYVTDqIZRDcNKAwBk7P8BYH1n2gAAAABJRU5ErkJggg==", "base64");
    await page.locator('section[aria-label="Bukti transaksi"] input[type=file]').setInputFiles({ name: "bon.png", mimeType: "image/png", buffer: png });
    await page.waitForTimeout(900);
    const saved = await page.evaluate((i) => window.__qa.tx.find((t) => t.id === i).photo_url, t0.id);
    assert.ok(saved && saved.startsWith("data:image/png"), "photo_url tersimpan");
    const img = page.locator('section[aria-label="Bukti transaksi"] img');
    const box = await img.boundingBox();
    assert.ok(box && box.height > 50, `Bukti terlihat (tinggi ${box?.height})`);
    await page.getByRole("button", { name: "Lihat bukti layar penuh" }).click();
    assert.ok(await page.getByRole("dialog", { name: "Bukti transaksi" }).isVisible(), "Pratinjau layar penuh");
    await page.getByRole("button", { name: "Tutup pratinjau" }).click();
    await page.locator('section[aria-label="Bukti transaksi"]').getByRole("button", { name: "Hapus", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /Hapus|Ya/ }).click();
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate((i) => window.__qa.tx.find((t) => t.id === i).photo_url, t0.id), "", "Bukti dihapus, transaksi tetap");
    assert.ok(await page.getByText("Tambah foto bukti").isVisible());
  });

  await step("Hapus transaksi: dialog konfirmasi muncul, Batal tidak menghapus, Hapus menghapus", async () => {
    const txId = await page.evaluate(() => window.__qa.tx.find((t) => t.merchant === "QA Warung").id);
    await nav(`/transaksi/${txId}`);
    await page.getByRole("button", { name: /Edit atau hapus/ }).click();
    await page.getByRole("button", { name: /Hapus transaksi/i }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.waitFor({ timeout: 3000 });
    await dialog.getByRole("button", { name: "Batal" }).click();
    assert.ok(await page.evaluate((i) => window.__qa.tx.some((t) => t.id === i), txId), "Batal tidak menghapus");
    await page.getByRole("button", { name: /Hapus transaksi/i }).click();
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

  await step("Emas dengan mata uang SAR tapi harga diketik Rupiah → peringatan + ganti ke IDR satu ketuk", async () => {
    await page.getByRole("button", { name: /Tambah aset/i }).first().click();
    await page.getByRole("radio", { name: "Emas", exact: true }).click();
    await page.getByRole("radio", { name: "SAR", exact: true }).click();
    assert.ok(await page.getByText("Harga beli / gr (SAR)").isVisible(), "Label harga ikut mata uang terpilih (bukan 'Rp')");
    await page.fill("#asset-name", "QA Emas Makkah");
    await page.fill("#asset-gold-quantity", "2");
    await page.fill("#asset-gold-purchase-price", "1250000");
    assert.ok(await page.getByText(/Sepertinya nominal ini dalam IDR/).isVisible(), "Peringatan salah mata uang muncul");
    await page.getByRole("button", { name: "Ganti ke IDR" }).click();
    assert.equal(await page.getByRole("radio", { name: "IDR", exact: true }).getAttribute("aria-checked"), "true");
    assert.equal(await page.getByText(/Sepertinya nominal ini dalam/).count(), 0, "Peringatan hilang setelah diganti");
    await page.getByRole("button", { name: /Simpan aset/i }).click();
    await page.waitForTimeout(600);
    const a = await page.evaluate(() => window.__qa.assets.find((x) => x.name === "QA Emas Makkah"));
    assert.equal(a.currency, "IDR"); assert.equal(a.value, 2500000);
  });

  await step("Emas fisik dibeli dalam SAR tersimpan sebagai SAR (tidak dipaksa IDR)", async () => {
    await page.getByRole("button", { name: /Tambah aset/i }).first().click();
    await page.getByRole("radio", { name: "Emas", exact: true }).click();
    await page.getByRole("radio", { name: "SAR", exact: true }).click();
    await page.fill("#asset-name", "QA Emas SAR");
    await page.fill("#asset-gold-quantity", "1");
    await page.fill("#asset-gold-purchase-price", "502.38");
    assert.equal(await page.getByText(/Sepertinya nominal ini dalam/).count(), 0, "Harga riyal wajar tidak diperingatkan");
    await page.getByRole("button", { name: /Simpan aset/i }).click();
    await page.waitForTimeout(600);
    const a = await page.evaluate(() => window.__qa.assets.find((x) => x.name === "QA Emas SAR"));
    assert.equal(a.currency, "SAR"); assert.equal(a.purchase_price, 502.38);
  });

  await step("Kesehatan data: emas bertanda SAR dengan harga Rupiah terdeteksi & bisa diperbaiki", async () => {
    await page.evaluate(() => window.__qa.assets.push({ id: "qa-bad", name: "QA Emas Salah", type: "emas", quantity: 1, purchase_price: 1400000, value: 1400000, currency: "SAR", unit: "gram", visibility: "shared", created_by_id: "u1", created_date: new Date().toISOString(), updated_date: new Date().toISOString() }));
    await nav("/kesehatan-data");
    assert.ok(await page.getByText("Mata Uang Tampak Keliru").isVisible());
    await page.getByRole("button", { name: "Jadikan IDR" }).click();
    await page.waitForTimeout(700);
    const a = await page.evaluate(() => window.__qa.assets.find((x) => x.id === "qa-bad"));
    assert.equal(a.currency, "IDR");
    assert.equal(await page.getByText("Mata Uang Tampak Keliru").count(), 0, "Masalah hilang setelah diperbaiki");
    await nav("/aset");
  });

  await step("Ketuk kartu aset → halaman detail; bukti pembelian & form Ubah membuka pratinjau gambar", async () => {
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHUlEQVR4nGP4z8BAEmIY1TCqYVTDqIZRDcNKAwBk7P8BYH1n2gAAAABJRU5ErkJggg==";
    await page.evaluate((u) => window.__qa.assets.push({ id: "qa-proof", name: "QA Emas Bukti", type: "emas", quantity: 1, purchase_price: 1500000, value: 1500000, currency: "IDR", unit: "gram", purchase_proof_url: u, visibility: "shared", created_by_id: "u1", created_date: new Date().toISOString(), updated_date: new Date(Date.now() + 60000).toISOString() }), png);
    await nav("/kesehatan-data"); await nav("/aset");
    await page.getByRole("link", { name: "Detail aset QA Emas Bukti" }).click();
    await page.waitForTimeout(500);
    assert.ok(page.url().endsWith("/aset/qa-proof"), "Kartu membuka halaman detail");
    assert.ok(await page.getByRole("heading", { name: "QA Emas Bukti" }).isVisible());
    assert.ok(await page.getByText("Harga beli /gram").isVisible(), "Rincian sesuai jenis (emas)");
    await page.getByRole("button", { name: "Lihat bukti pembelian QA Emas Bukti" }).click();
    const dlg = page.getByRole("dialog", { name: "Bukti pembelian" });
    assert.ok(await dlg.isVisible(), "Pratinjau terbuka");
    const box = await dlg.locator("img").boundingBox();
    assert.ok(box && box.height > 50, `Gambar terlihat (tinggi ${box?.height})`);
    await page.getByRole("button", { name: "Tutup pratinjau" }).click();
    assert.equal(await dlg.count(), 0, "Pratinjau tertutup");
    await page.getByRole("button", { name: "Ubah aset" }).click();
    await page.getByRole("button", { name: "Lihat bukti pembelian", exact: true }).click();
    assert.ok(await dlg.isVisible(), "Pratinjau dari form terbuka");
    await page.getByRole("button", { name: "Tutup pratinjau" }).click();
    assert.ok(await page.locator("#asset-name").isVisible(), "Form aset tetap terbuka setelah pratinjau ditutup");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    if (await page.locator("#asset-name").count()) await page.getByRole("button", { name: /Tutup|Batal/ }).first().click();
    await page.waitForTimeout(300);
    await nav("/aset");
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

  await step("Harga emas acuan: diisi di Aset → untung/rugi emas tampil & harga sama di Zakat", async () => {
    await nav("/aset");
    assert.ok(await page.getByRole("button", { name: "Atur harga emas acuan" }).first().isVisible(), "Sebelum ada harga: diminta atur harga");
    await page.getByRole("button", { name: "Atur harga emas acuan" }).first().click();
    await page.fill("#gold-price-input", "1500000");
    await page.getByRole("button", { name: "Pakai", exact: true }).click();
    await page.waitForTimeout(900);
    await page.getByRole("dialog", { name: "Harga emas acuan" }).getByRole("button", { name: "Tutup" }).click();
    assert.ok(await page.getByText(/acuan Rp\s?1\.500\.000\/gr/).isVisible(), "Kartu total menampilkan harga acuan");
    const card = page.locator("a.surface", { hasText: "Emas Antam" }).first();
    const text = (await card.innerText()).replace(/\s+/g, " ");
    assert.ok(/\+\s?Rp\s?10\.000\.000/.test(text) && text.includes("+20.0%"), `Kartu: untung 40 gr × (1,5 jt − 1,25 jt) = Rp 10 jt (+20%) — ${text}`);
    await card.click();
    await page.waitForTimeout(500);
    const det = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    assert.ok(/Harga pasar \/gram Rp\s?1\.500\.000/.test(det), `Detail: harga pasar/gr — ${det.slice(0, 300)}`);
    await nav("/zakat");
    assert.ok(await page.getByText("Rp 1.500.000/gram").first().isVisible(), "Harga acuan sama di Zakat");
  });

  await step("Zakat: harta simpanan digabung (IDR+SAR+emas), rumah tidak dihitung, utang dikurangkan", async () => {
    await nav("/zakat");
    await page.fill("#gold-price-input", "1500000");
    await page.getByRole("button", { name: "Pakai", exact: true }).click();
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

  await step("Zakat dibayar dalam SAR: nominal dikonversi, sisa berkurang setara IDR", async () => {
    await nav("/zakat");
    const before = rupiah(await page.locator(".card-gradient-primary p.tabular-nums").first().innerText());
    await page.getByRole("button", { name: /Catat pembayaran zakat/ }).click();
    await page.getByRole("radiogroup", { name: "Mata uang pembayaran" }).getByRole("radio", { name: "SAR", exact: true }).click();
    await page.fill("#zakat-pay-amount", "100");
    assert.ok(await page.getByText(/≈ Rp\s?425\.000/).isVisible(), "Setara IDR tampil");
    await page.getByRole("button", { name: /Simpan pembayaran/ }).click();
    await page.waitForTimeout(900);
    const after = rupiah(await page.locator(".card-gradient-primary p.tabular-nums").first().innerText());
    assert.equal(before - after, 425000, "Sisa berkurang 100 × 4.250");
    const tx = await page.evaluate(() => window.__qa.tx.filter((t) => t.category === "Zakat").find((t) => t.currency === "SAR"));
    assert.ok(tx && tx.amount === 100, "Transaksi zakat tercatat dalam SAR");
  });

  await step("Catat transaksi SAR bernominal Rupiah → peringatan & pratinjau setara IDR", async () => {
    await nav("/add");
    await page.getByRole("radio", { name: "SAR", exact: true }).click();
    await page.fill("#add-tx-amount", "150000");
    assert.ok(await page.getByText(/Yakin bukan Rupiah/).isVisible(), "Peringatan nominal muncul");
    await page.getByRole("button", { name: "Jadikan IDR" }).click();
    assert.equal(await page.getByRole("radio", { name: "IDR", exact: true }).getAttribute("aria-checked"), "true");
    assert.equal(await page.inputValue("#add-tx-amount"), "150.000");
    await page.getByRole("radio", { name: "SAR", exact: true }).click();
    await page.fill("#add-tx-amount", "100");
    assert.ok(await page.getByText(/≈ Rp\s?425\.000/).isVisible(), "Pratinjau setara Rupiah");
  });

  await step("Target tabungan dalam riyal: mata uang aktif bisa dipilih, aset sumber hanya SAR", async () => {
    await nav("/target-tabungan");
    await page.getByRole("button", { name: /Tambah/ }).first().click();
    await page.getByRole("radio", { name: "SAR", exact: true }).click();
    const opts = await page.locator("#savings-goal-linked-asset option").allInnerTexts();
    assert.ok(opts.some((o) => o.includes("Dompet Riyal")), "Dompet SAR tersedia");
    assert.ok(!opts.some((o) => o.includes("Tabungan BCA")), "Rekening IDR tidak ditawarkan");
    await page.fill("#savings-goal-name", "QA Umrah SAR");
    await page.fill("#savings-goal-target-amount", "20000");
    await page.getByRole("button", { name: /^Simpan$/ }).click();
    await page.waitForTimeout(800);
    const g = await page.evaluate(() => (window.__qaData.SavingsGoal || []).find((x) => x.name === "QA Umrah SAR"));
    assert.equal(g?.currency, "SAR");
    assert.equal(g?.target_amount, 20000);
    assert.ok(await page.getByText(/\u20C1/).first().isVisible(), "Simbol riyal tampil di kartu target");
  });

  await step("Panel admin: menu berurutan, total per mata uang (SAR tidak dijumlah sebagai IDR), putus koneksi dengan konfirmasi", async () => {
    await nav("/admin");
    await page.waitForTimeout(800);
    const tabs = await page.getByRole("tablist", { name: "Menu admin" }).getByRole("tab").allInnerTexts();
    assert.deepEqual(tabs.map((t) => t.trim()), ["Ringkasan", "Pengguna", "Pasangan", "Transaksi", "Aset", "Audit"]);
    const sarIncome = await page.evaluate(() => window.__qa.tx.some((t) => t.currency === "SAR"));
    if (sarIncome) assert.ok(await page.getByRole("radio", { name: "SAR", exact: true }).isVisible(), "Pilihan SAR tersedia di ringkasan");
    await page.getByRole("tab", { name: "Pengguna" }).click();
    assert.ok(await page.getByText("4 pengguna", { exact: false }).isVisible());
    await page.getByRole("tab", { name: "Pasangan" }).click();
    await page.getByRole("button", { name: "Putuskan koneksi" }).first().click();
    const dlg = page.getByRole("alertdialog");
    await dlg.getByRole("button", { name: "Batal" }).click();
    assert.ok(await page.getByText("Aktif (1)").isVisible(), "Batal tidak memutus");
    await page.getByRole("button", { name: "Putuskan koneksi" }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Putuskan" }).click();
    await page.waitForTimeout(600);
    assert.ok(await page.getByText("Aktif (0)").isVisible(), "Koneksi pindah ke riwayat");
    await nav("/");
  });

  await step("Impor portofolio: 2 screenshot (daftar + detail) digabung, aset lama diperbarui, aset baru dibuat", async () => {
    // Aset lama hasil impor sebelumnya → harus DIPERBARUI, bukan duplikat.
    await page.evaluate(() => window.__qa.assets.push({ id: "qa-alrajhi", name: "ALRAJHI (1120)", ticker: "1120", type: "investasi", currency: "SAR", value: 5000, quantity: 80, purchase_price: 5200, visibility: "private", notes: "catatan lama", created_by_id: "u1", updated_date: new Date().toISOString() }));
    await page.evaluate(() => { window.__qaLLM = [
      { holdings: [
        { name: "ALRAJHI", ticker: "1120", instrument: "saham", currency: "SAR", quantity: 88, last_price: 61.5, avg_cost: 65.14, market_value: 5412, gain: -319.91, platform: "Al Rajhi Capital" },
        { name: "SAUDI AR...", ticker: "2222", instrument: "saham", currency: "SAR", quantity: 179, last_price: 26.24, avg_cost: 26.19, market_value: 4696.96, gain: 8.86 },
      ] },
      { holdings: [
        { name: "SAUDI ARAMCO", ticker: "2222", exchange: "TASI", instrument: "saham", currency: "SAR", quantity: 179, avg_cost: 26, total_cost: 4688.1, market_value: 4696.96, gain: 8.86 },
        { name: "Gold", instrument: "emas", currency: "SAR", quantity: 1, avg_cost: 502.38, last_price: 493.27, market_value: 493.27 },
      ] },
    ]; });
    await nav("/aset");
    // Impor kini ada di dalam Tambah aset → jenis Investasi
    await page.getByRole("button", { name: /Tambah aset/i }).first().click();
    await page.getByRole("radio", { name: /Investasi/ }).click();
    await page.getByRole("link", { name: /Impor dari aplikasi broker/ }).click();
    await page.waitForTimeout(500);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    await page.locator('input[aria-label="Berkas portofolio"]').setInputFiles([
      { name: "daftar.png", mimeType: "image/png", buffer: png },
      { name: "detail-aramco.png", mimeType: "image/png", buffer: png },
    ]);
    await page.waitForTimeout(1500);
    assert.ok(await page.getByText("Tinjau 3 kepemilikan").isVisible(), "Aramco dari 2 screenshot digabung → 3 kepemilikan");
    assert.equal(await page.inputValue("#pi-platform"), "Al Rajhi Capital", "Nama broker terisi otomatis");
    assert.ok(await page.getByText(/Perbarui "ALRAJHI \(1120\)"/).isVisible(), "ALRAJHI dicocokkan dengan aset lama");
    assert.ok(await page.getByText("SAUDI ARAMCO").isVisible(), "Nama lengkap dari detail dipakai");
    await page.getByRole("button", { name: /Simpan 3 aset/ }).click();
    await page.waitForTimeout(1200);
    const a = await page.evaluate(() => window.__qa.assets);
    const alr = a.filter((x) => x.ticker === "1120");
    assert.equal(alr.length, 1, "Tidak ada duplikat ALRAJHI");
    assert.equal(alr[0].value, 5412); assert.equal(alr[0].quantity, 88);
    assert.equal(alr[0].purchase_price, 5731.91, "Modal = nilai − untung dari aplikasi");
    assert.equal(alr[0].visibility, "private", "Jangkauan lama dipertahankan");
    assert.equal(alr[0].notes, "catatan lama", "Catatan lama dipertahankan");
    const ar = a.find((x) => x.ticker === "2222");
    assert.equal(ar.type, "investasi"); assert.equal(ar.currency, "SAR"); assert.equal(ar.purchase_price, 4688.1); assert.equal(ar.unit, "lembar");
    const gold = a.find((x) => x.type === "emas_digital" && x.import_source);
    assert.ok(gold && gold.purchase_price === 502.38 && gold.quantity === 1 && gold.unit === "gram", "Emas digital: harga beli per gram");
    assert.ok(page.url().endsWith("/aset"), "Kembali ke Aset");
  });

  await step("Lot pembelian: 2 screenshot Lots Breakdown (tumpang tindih) → 9 lot, total 88 tetap, tanggal beli terisi; impor ulang tanpa duplikat", async () => {
    const S1 = [["13 May 2026", 11, 65.95], ["21 Apr 2026", 3, 71.75], ["04 Apr 2026", 2, 106.4], ["05 Mar 2026", 7, 101], ["04 Feb 2026", 5, 107.8]];
    const S2 = [["07 Oct 2026", 4, 63.75], ["06 Aug 2026", 10, 65], ["08 Jul 2026", 17, 65.55], ["05 Jun 2026", 13, 66.5], ["13 May 2026", 11, 65.95]];
    const shot = (rows) => ({ holdings: [{ name: "ALRAJHI", ticker: "1120", exchange: "TASI", instrument: "saham", currency: "SAR", last_price: 63.35, lots: rows.map(([date, quantity, price]) => ({ date, side: "Buy", quantity, price })) }] });
    await page.evaluate((r) => { window.__qaLLM = r; }, [shot(S2), shot(S1)]);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    await nav("/impor-portofolio");
    await page.locator('input[aria-label="Berkas portofolio"]').setInputFiles([{ name: "lot-atas.png", mimeType: "image/png", buffer: png }, { name: "lot-bawah.png", mimeType: "image/png", buffer: png }]);
    await page.waitForTimeout(1500);
    assert.ok(await page.getByText("Tinjau 1 kepemilikan").isVisible(), "Dua screenshot lot → satu kepemilikan");
    assert.ok(await page.getByText(/Tambah riwayat lot ke "ALRAJHI \(1120\)" — total tidak diubah/).isVisible(), "Mode hanya lot untuk aset lama");
    assert.ok(await page.getByText(/9 lot pembelian · sejak 4 Feb 2026/).isVisible(), "13 May tidak dobel");
    assert.ok(await page.getByText(/mencakup 72 dari 88 \(kurang 16\)/).isVisible(), "Selisih dengan total lembar ditampilkan");
    await page.getByRole("button", { name: /Simpan 1 aset/ }).click();
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => ({ a: window.__qa.assets.find((x) => x.ticker === "1120"), lots: (window.__qaData.InvestmentLot || []) }));
    assert.equal(st.a.quantity, 88, "Total lembar tidak ditimpa lot");
    assert.equal(st.a.value, 5412, "Nilai pasar tidak berubah");
    assert.equal(st.a.purchase_date, "2026-02-04", "Tanggal beli = lot paling awal");
    const mine = st.lots.filter((l) => l.asset_id === st.a.id);
    assert.equal(mine.length, 9);
    assert.ok(mine.every((l) => l.source === "import" && l.side === "buy"));

    // Impor ulang screenshot yang sama → tidak ada lot baru.
    await page.evaluate((r) => { window.__qaLLM = r; }, [shot(S2)]);
    await nav("/impor-portofolio");
    await page.locator('input[aria-label="Berkas portofolio"]').setInputFiles([{ name: "lot-atas.png", mimeType: "image/png", buffer: png }]);
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: /Simpan 1 aset/ }).click();
    await page.waitForTimeout(1200);
    const n2 = await page.evaluate((id) => (window.__qaData.InvestmentLot || []).filter((l) => l.asset_id === id).length, st.a.id);
    assert.equal(n2, 9, "Tidak ada lot duplikat");
  });

  await step("Detail aset investasi (gabung DCA): ringkasan dari total aset; DCA manual menambah selisih; hapus lot impor tidak mengubah total", async () => {
    const a = await page.evaluate(() => window.__qa.assets.find((x) => x.ticker === "1120"));
    await nav(`/investasi/${a.id}`); // tautan lama → dialihkan ke detail aset
    await page.waitForTimeout(800);
    assert.ok(page.url().includes(`/aset/${a.id}`), `Rute lama dialihkan: ${page.url()}`);
    assert.ok(await page.getByText(/72 dari 88/).isVisible(), "Status kecocokan lot tampil");
    assert.ok(await page.getByText("88 lembar").first().isVisible(), "Jumlah dari total aset, bukan dari lot");
    await page.getByRole("button", { name: /Catat pembelian/ }).click();
    await page.fill("#investment-lot-quantity", "2");
    await page.fill("#investment-lot-price", "63");
    await page.getByRole("button", { name: /Simpan pembelian/ }).click();
    await page.waitForTimeout(900);
    let x = await page.evaluate((id) => window.__qa.assets.find((y) => y.id === id), a.id);
    assert.equal(x.quantity, 90, "88 + 2");
    assert.equal(x.purchase_price, Math.round((a.purchase_price + 126) * 100) / 100, "Modal + 2 × 63");
    await page.getByRole("button", { name: "Hapus lot 7 Okt 2026" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hapus" }).click();
    await page.waitForTimeout(900);
    x = await page.evaluate((id) => window.__qa.assets.find((y) => y.id === id), a.id);
    assert.equal(x.quantity, 90, "Lot impor dihapus → total tetap");
  });

  await step("Impor: angka teks ber-simbol ⃁ terbaca; baris tanpa nilai pasar dilengkapi harga online tervalidasi", async () => {
    await page.evaluate(() => {
      const t = new Date().toISOString().slice(0, 10);
      // Jawab harga per instrumen berdasarkan nomor urut di prompt (bukan urutan tetap).
      const priceBy = (prices) => ({ prompt }) => ({ prices: prompt.split("\n").map((l) => l.match(/^(\d+)\. (.*)$/)).filter(Boolean)
        .map(([, i, txt]) => { const hit = Object.keys(prices).find((k) => txt.includes(k)); return hit ? { index: i, price: prices[hit], currency: "SAR", as_of: t, source: "Tadawul" } : null; }).filter(Boolean) });
      window.__qaLLM = [
        { holdings: [{ name: "ALRAJHI", ticker: "1120", exchange: "TASI", instrument: "saham", market_value: "⃁ 5,570.40", quantity: "88", avg_cost: "⃁ 65.14", total_cost: "⃁ 5,731.91", gain: "⃁ -161.51", last_price: "⃁ 63.30" }] },
        // SABIC: layar tanpa harga & nilai pasar (mis. daftar terpotong) → butuh pelengkap
        { holdings: [{ name: "SABIC", ticker: "2010", exchange: "TASI", instrument: "saham", currency: "SAR", quantity: "10", total_cost: "⃁ 700.00" }] },
        priceBy({ SABIC: "140.00" }), // salah instrumen (2× harga rata-rata beli) → harus ditolak
        priceBy({ SABIC: "71.20", ALRAJHI: "63.45" }), // wajar → dipakai
      ];
    });
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    await nav("/impor-portofolio");
    await page.locator('input[aria-label="Berkas portofolio"]').setInputFiles([{ name: "IMG_9628.png", mimeType: "image/png", buffer: png }, { name: "sabic.png", mimeType: "image/png", buffer: png }]);
    await page.waitForTimeout(1500);
    const alr = page.locator("li.surface", { hasText: "ALRAJHI" });
    const sab = page.locator("li.surface", { hasText: "SABIC" });
    const t1 = (await alr.innerText()).replace(/\s+/g, " ");
    assert.ok(/5,570\.40/.test(t1) && /5,731\.91/.test(t1), `Nilai pasar & modal dari teks ⃁ terbaca: ${t1}`);
    assert.ok(await sab.getByText(/Nilai pasar belum terbaca/).isVisible(), "SABIC ditandai belum bernilai");
    // Hanya SABIC (tanpa nilai) yang ditawari harga online; ALRAJHI dari broker tidak disentuh.
    assert.equal(await alr.getByRole("button", { name: /Perkiraan online/ }).count(), 0, "Baris bernilai broker tidak ditawari online");
    await sab.getByRole("button", { name: /Perkiraan online/ }).click();
    await page.waitForTimeout(900);
    const toasts = (await page.locator("[data-sonner-toast]").allInnerTexts()).join(" | ").replace(/\s+/g, " ");
    assert.ok(/SABIC.*Selisih 100%/.test(toasts), `Harga tidak wajar ditolak, bukan dipakai — toast: ${toasts}`);
    assert.ok(!/Perkiraan online ·/.test(await sab.innerText()), "SABIC tidak berubah");
    await sab.getByRole("button", { name: /Perkiraan online/ }).click();
    await page.waitForTimeout(900);
    const t2 = (await sab.innerText()).replace(/\s+/g, " ");
    assert.ok(/712\.00/.test(t2) && /Perkiraan online · Tadawul/.test(t2), `Harga online wajar dipakai (10 × 71,20): ${t2}`);
    const t3 = (await alr.innerText()).replace(/\s+/g, " ");
    assert.ok(/5,570\.40/.test(t3), `ALRAJHI tetap nilai dari broker: ${t3}`);
    await page.getByRole("button", { name: /Simpan 2 aset/ }).click();
    await page.waitForTimeout(1300);
    const a = await page.evaluate(() => window.__qa.assets);
    const s1 = a.find((x) => x.ticker === "2010");
    assert.equal(s1.value, 712); assert.equal(s1.last_price, 71.2); assert.equal(s1.purchase_price, 700);
    const r1 = a.filter((x) => x.ticker === "1120");
    assert.equal(r1.length, 1); assert.equal(r1[0].value, 5570.4, "Nilai broker dipertahankan"); assert.equal(r1[0].purchase_price, 5731.91);
    assert.equal(r1[0].value_source, "broker"); assert.equal(s1.value_source, "online");
  });

  await step("Lot sebagai daftar datar (aset BARU) → tersimpan, tampil di kartu Aset & Riwayat DCA, sinkron dengan DCA manual", async () => {
    await page.evaluate(() => { window.__qaLLM = [
      { holdings: [{ name: "KINGDOM", ticker: "4280", exchange: "TASI", instrument: "saham", market_value: "⃁ 960.00", quantity: "100", total_cost: "⃁ 900.00", last_price: "⃁ 9.60" }] },
      // Layar lot: holdings hanya judul, lot di daftar terpisah tingkat atas
      { holdings: [{ name: "KINGDOM", ticker: "4280", last_price: "⃁ 9.60" }], lots: [
        { ticker: "4280", date: "10 Mar 2026", side: "Buy", quantity: "60.0000", price: "9.0000" },
        { ticker: "4280", date: "12 Jan 2026", side: "Buy", quantity: "40.0000", price: "9.0000" },
      ] },
    ]; });
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    await nav("/impor-portofolio");
    await page.locator('input[aria-label="Berkas portofolio"]').setInputFiles([{ name: "details.png", mimeType: "image/png", buffer: png }, { name: "lots.png", mimeType: "image/png", buffer: png }]);
    await page.waitForTimeout(1500);
    assert.ok(await page.getByText("1 kepemilikan · 2 lot").isVisible(), "Kartu berkas menampilkan jumlah lot terbaca");
    assert.ok(await page.getByText(/Riwayat lot lengkap: 100 dari 100/).isVisible(), "Lot lengkap = total");
    await page.getByRole("button", { name: /Simpan 1 aset/ }).click();
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => { const a = window.__qa.assets.find((x) => x.ticker === "4280"); return { a, lots: (window.__qaData.InvestmentLot || []).filter((l) => l.asset_id === a.id) }; });
    assert.ok(st.a.id, "Aset baru punya id");
    assert.equal(st.lots.length, 2, "Lot tersimpan untuk aset baru");
    assert.equal(st.a.purchase_date, "2026-01-12");
    // Kartu Aset menampilkan Riwayat DCA dari data lot yang sama
    await nav("/aset");
    await page.waitForTimeout(600);
    const card = page.locator("a.surface", { hasText: "KINGDOM (4280)" }).first();
    assert.ok(/2 lot DCA/.test((await card.innerText()).replace(/\s+/g, " ")), "Jumlah lot di kartu aset");
    await card.click();
    await page.waitForTimeout(500);
    // Detail aset & Riwayat DCA satu halaman
    assert.ok(await page.getByRole("heading", { name: "Riwayat DCA" }).isVisible(), "Riwayat DCA langsung di detail aset");
    assert.ok(await page.getByText(/2 lot · sejak 12 Jan 2026/).isVisible(), "Ringkasan lot");
    assert.ok(await page.getByText("Modal").first().isVisible(), "Rincian aset di halaman yang sama");
    const det = (await page.locator('section[aria-label="Rincian"]').innerText()).replace(/\s+/g, " ");
    assert.ok(/Pertama beli 12 Jan 2026/.test(det) && /Terakhir beli 10 Mar 2026/.test(det), `Tanggal pertama & terakhir dari Riwayat DCA: ${det}`);
    await page.getByRole("button", { name: /Catat pembelian/ }).click();
    await page.fill("#investment-lot-quantity", "5");
    await page.fill("#investment-lot-price", "9.5");
    await page.getByRole("button", { name: /Simpan pembelian/ }).click();
    await page.waitForTimeout(900);
    await nav("/aset");
    await page.waitForTimeout(600);
    const t = (await page.locator("a.surface", { hasText: "KINGDOM (4280)" }).first().innerText()).replace(/\s+/g, " ");
    assert.ok(/3 lot DCA/.test(t), `DCA manual langsung tampil di kartu aset: ${t}`);
    const a2 = await page.evaluate(() => window.__qa.assets.find((x) => x.ticker === "4280"));
    assert.equal(a2.quantity, 105, "100 + 5 lembar");
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
