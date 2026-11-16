// Deteksi "halaman refresh 2 kali": buka tiap halaman dengan jaringan lambat
// (400 ms per permintaan, mata uang utama SAR) lalu hitung berapa kali layar
// muat muncul dan berapa kali isi berubah setelah tampil. Target: 1 fase muat,
// lalu langsung tampilan final (angka tidak berubah lagi).
// Jalankan: npm run qa:flicker
import { BASE, routes, loadPlaywright, startServer } from "./lib.mjs";

const { chromium } = loadPlaywright();
const server = await startServer();
const browser = await chromium.launch();
let bad = 0;
try {
  for (const r of routes.filter((x) => x !== "/selamat-datang")) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => { localStorage.setItem("qaLag", "400"); localStorage.setItem("qaDefaultCur", "SAR"); });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__frames = [];
      const snap = () => {
        const m = document.querySelector("main") || document.body;
        const busy = !!m.querySelector('[aria-busy="true"]');
        // Hanya angka uang & jumlah yang dibandingkan — teks lain boleh berubah.
        const nums = ((m.innerText || "").match(/(Rp|SAR|⃁)\s?[\d.,]+|\d+ (catatan|transaksi|aset|pengguna)/g) || []).join("|");
        const last = window.__frames[window.__frames.length - 1];
        if (!last || last.busy !== busy || last.nums !== nums) window.__frames.push({ busy, nums });
      };
      new MutationObserver(snap).observe(document, { subtree: true, childList: true, characterData: true });
    });
    await page.goto(BASE + r);
    await page.waitForTimeout(3500);
    const f = await page.evaluate(() => window.__frames);
    let phases = 0, prev = false;
    f.forEach((x) => { if (x.busy && !prev) phases++; prev = x.busy; });
    const shown = f.filter((x) => !x.busy && x.nums);
    const changes = new Set(shown.map((x) => x.nums)).size - 1;
    const ok = phases <= 1 && changes <= 0;
    if (!ok) bad++;
    console.log(`${ok ? "✓" : "✗"} ${r}  fase muat: ${phases}  angka berubah setelah tampil: ${Math.max(0, changes)}`);
    if (!ok && process.env.QA_VERBOSE) [...new Set(shown.map((x) => x.nums))].forEach((n) => console.log("    ", n.slice(0, 220)));
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(bad ? `\n${bad} halaman masih berkedip` : "\nSemua halaman tampil sekali tanpa kedip");
process.exit(bad ? 1 : 0);
