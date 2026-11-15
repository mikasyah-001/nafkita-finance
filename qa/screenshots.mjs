// Screenshot semua halaman (mode terang & gelap, lebar ponsel) + deteksi error JS.
// Jalankan: npm run qa          → hasil di qa/out/
import fs from "node:fs";
import path from "node:path";
import { ROOT, BASE, routes, loadPlaywright, startServer } from "./lib.mjs";

const { chromium } = loadPlaywright();
const out = path.join(ROOT, "qa/out");
fs.mkdirSync(out, { recursive: true });
const server = await startServer();
const browser = await chromium.launch();
let errors = 0;
try {
  for (const mode of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: mode });
    await ctx.addInitScript((m) => { try { localStorage.setItem("theme", m); } catch { /* abaikan */ } }, mode);
    const page = await ctx.newPage();
    for (const r of routes) {
      const errs = [];
      const onErr = (e) => errs.push(e.message);
      page.on("pageerror", onErr);
      await page.goto(BASE + r, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
      const name = (r === "/" ? "beranda" : r.replace(/^\//, "").replace(/[/?=&]+/g, "_")) + `-${mode}.png`;
      await page.screenshot({ path: path.join(out, name), fullPage: true });
      page.off("pageerror", onErr);
      if (errs.length) { errors++; console.log(`✗ ${r} (${mode}): ${errs[0]}`); } else console.log(`✓ ${r} (${mode})`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(`\nScreenshot tersimpan di qa/out/. Halaman dengan error JS: ${errors}`);
process.exit(errors ? 1 : 0);
