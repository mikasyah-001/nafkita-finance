// Screenshot ASLI aplikasi untuk halaman sambutan (/selamat-datang), memakai
// backend tiruan QA (data contoh, bukan data pengguna).
// Jalankan ulang setiap tampilan berubah:  npm run qa:welcome-shots
// Hasil: public/welcome/<nama>.jpg (390×800 @1.5x, JPEG).
import path from "node:path";
import { ROOT, BASE, loadPlaywright, startServer } from "./lib.mjs";

const SHOTS = [
  { name: "beranda", path: "/" },
  { name: "catat", path: "/add" },
  { name: "catat-otomatis", path: "/catat-otomatis" },
  { name: "kartu", path: "/kartu" },
  { name: "aset", path: "/aset" },
  { name: "anggaran", path: "/anggaran" },
  { name: "target", path: "/target-tabungan" },
  { name: "tagihan", path: "/tagihan-berulang" },
  { name: "laporan", path: "/laporan" },
  { name: "zakat", path: "/zakat" },
  { name: "pasangan", path: "/profil/pasangan", partner: true },
  { name: "persetujuan", path: "/persetujuan", partner: true },
];

const { chromium } = loadPlaywright();
const server = await startServer();
const browser = await chromium.launch();
try {
  for (const partner of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 1.5, colorScheme: "light" });
    await ctx.addInitScript((p) => {
      try {
        localStorage.setItem("theme", "light");
        localStorage.setItem("nafkita_install_dismissed_v1", "1");
        localStorage.setItem("nafkita_hide_amounts", "0");
        localStorage.setItem("qa:goldPrice", "1650000"); // harga emas contoh → Zakat menampilkan status nisab
        if (p) localStorage.setItem("qa:partner", "1");
      } catch { /* abaikan */ }
    }, partner);
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    // Data contoh netral (tanpa nama perusahaan sungguhan).
    await page.evaluate(() => { for (const t of window.__qa.tx) if (/Arrahmah/i.test(t.merchant || "")) t.merchant = "Gaji kantor"; });
    for (const s of SHOTS.filter((x) => !!x.partner === partner)) {
      await page.evaluate((p) => { history.pushState({}, "", p); dispatchEvent(new PopStateEvent("popstate")); }, s.path);
      await page.waitForTimeout(1200);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: path.join(ROOT, "public/welcome", `${s.name}.jpg`), type: "jpeg", quality: 78 });
      console.log("✓", s.name);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
