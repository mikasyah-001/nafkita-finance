// Screenshot seluruh fitur NAFKITA untuk materi promosi.
// Memakai server QA (data contoh, tanpa Base44) dengan mode promo (data lebih lengkap).
// Jalankan: node promo/capture.mjs   → promo/out/screens/{ios,android}/{light,dark}/NN-nama.png
import fs from "node:fs";
import path from "node:path";
import { ROOT, BASE, loadPlaywright, startServer } from "../qa/lib.mjs";

const { chromium } = loadPlaywright();
const OUT = path.join(ROOT, "promo/out/screens");

// Ukuran layar (CSS px) di bawah status bar. Dipakai juga oleh mockup.mjs.
export const DEVICES = {
  ios: { w: 402, h: 874, status: 62, bottom: 30, label: "iPhone 6.3\"" },      // kelas iPhone Pro terbaru
  android: { w: 412, h: 915, status: 44, bottom: 22, label: "Android 6.7\"" }, // kelas Galaxy/Pixel flagship
};

// Struk contoh untuk adegan "Scan struk AI" (dirender dari HTML).
const RECEIPT_HTML = `<html><body style="margin:0;background:#f4f1ea;font-family:'Courier New',monospace;">
<div style="width:300px;margin:20px auto;background:#fff;padding:22px 20px;box-shadow:0 6px 20px rgba(0,0,0,.15);font-size:14px;line-height:1.5">
<div style="text-align:center;font-weight:bold;font-size:18px">SUPERINDO</div>
<div style="text-align:center;font-size:12px">Jl. Raya Bogor No. 12</div><hr style="border:none;border-top:1px dashed #999">
<div>Beras Pandan 5kg <span style="float:right">78.500</span></div>
<div>Minyak Goreng 2L <span style="float:right">38.900</span></div>
<div>Telur Ayam 1kg <span style="float:right">31.000</span></div>
<div>Susu UHT 1L x2 <span style="float:right">39.800</span></div>
<div>Sayur & Buah <span style="float:right">46.300</span></div>
<hr style="border:none;border-top:1px dashed #999">
<div style="font-weight:bold">TOTAL <span style="float:right">234.500</span></div>
<div style="font-size:12px;margin-top:8px;text-align:center">24/11/2026 18:42 · Terima kasih</div></div></body></html>`;

const wait = (page, ms = 700) => page.waitForTimeout(ms);
const click = async (page, loc) => { await loc.first().click(); await wait(page); };

// Adegan = satu fungsi aplikasi. `full: true` → juga simpan versi satu halaman penuh (untuk video scroll).
export const SCENES = [
  { n: "01-sambutan", route: "/selamat-datang", full: true },
  { n: "02-beranda", route: "/", full: true },
  { n: "03-beranda-privasi", route: "/", act: async (p) => click(p, p.getByRole("button", { name: "Sembunyikan angka" })) },
  { n: "04-catat-transaksi", route: "/add", act: async (p) => {
    await p.locator("#add-tx-amount").fill("85000"); await wait(p, 300);
    await click(p, p.getByRole("button", { name: /Makanan/ }));
    await p.locator("#add-tx-merchant").fill("Bakso Pak Kumis"); await p.locator("#add-tx-merchant").blur();
    await p.evaluate(() => window.scrollTo(0, 0)); await wait(p, 500);
  } },
  { n: "05-scan-struk-ai", route: "/add", act: async (p, ctx) => {
    const rp = await ctx.newPage(); await rp.setViewportSize({ width: 340, height: 360 }); await rp.setContent(RECEIPT_HTML);
    const png = await rp.screenshot(); await rp.close();
    await p.evaluate(() => { window.__qaLLM = [{ transactions: [{ amount: 234500, merchant: "Superindo", category: "Belanja", date: new Date().toISOString().slice(0, 10), currency: "IDR", notes: "Beras, minyak, telur, susu, sayur" }] }]; });
    await p.locator('input[type=file][accept="image/*"]').first().setInputFiles({ name: "struk-superindo.png", mimeType: "image/png", buffer: png });
    await wait(p, 1500); await p.evaluate(() => window.scrollTo(0, 0)); await wait(p, 400);
  } },
  { n: "06-riwayat", route: "/riwayat", full: true },
  { n: "07-persetujuan-pasangan", route: "/persetujuan" },
  { n: "08-laporan", route: "/laporan", full: true },
  { n: "09-laporan-analisis", route: "/laporan?tab=analisis", full: true },
  { n: "10-anggaran", route: "/anggaran", full: true },
  { n: "11-target-tabungan", route: "/target-tabungan", full: true },
  { n: "12-zakat", route: "/zakat", full: true },
  { n: "13-aset", route: "/aset", full: true },
  { n: "14-dashboard-aset", route: "/aset-dashboard", full: true },
  { n: "15-emas-detail", route: "/aset/a2" },
  { n: "16-investasi-detail", route: "/aset/a3" },
  { n: "17-transfer", route: "/transfer" },
  { n: "18-utang-piutang", route: "/utang" },
  { n: "19-tagihan-rutin", route: "/tagihan-berulang" },
  { n: "20-catat-otomatis", route: "/catat-otomatis", full: true },
  { n: "21-kartu", route: "/kartu" },
  { n: "22-dompet", route: "/dompet" },
  { n: "23-rekonsiliasi", route: "/rekonsiliasi" },
  { n: "24-kesehatan-data", route: "/kesehatan-data" },
  { n: "25-impor-mutasi", route: "/impor" },
  { n: "26-impor-portofolio", route: "/impor-portofolio" },
  { n: "27-kategori", route: "/kategori" },
  { n: "28-profil-pasangan", route: "/profil", full: true },
  { n: "29-pengaturan", route: "/pengaturan", full: true },
  { n: "30-panduan", route: "/panduan" },
  { n: "31-menu-lainnya", route: "/lainnya", full: true },
  { n: "32-audit-kas", route: "/audit-kas" },
];

const only = process.argv.slice(2);
const isMain = import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const server = await startServer();
  const browser = await chromium.launch();
  let errors = 0;
  try {
    for (const [dev, d] of Object.entries(DEVICES)) {
      for (const mode of ["light", "dark"]) {
        const dir = path.join(OUT, dev, mode);
        fs.mkdirSync(dir, { recursive: true });
        const ctx = await browser.newContext({
          viewport: { width: d.w, height: d.h - d.status - d.bottom }, deviceScaleFactor: 3, colorScheme: mode, isMobile: true, hasTouch: true,
          userAgent: dev === "ios"
            ? "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1"
            : "Mozilla/5.0 (Linux; Android 16; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Mobile Safari/537.36",
        });
        await ctx.addInitScript((m) => {
          try {
            localStorage.setItem("theme", m); localStorage.setItem("qa:promo", "1");
            localStorage.setItem("nafkita_install_dismissed_v1", "1");
            if (!location.hash.includes("privasi")) localStorage.setItem("nafkita_hide_amounts", "0");
          } catch { /* abaikan */ }
        }, mode);
        for (const s of SCENES) {
          if (only.length && !only.some((o) => s.n.includes(o))) continue;
          const page = await ctx.newPage();
          const errs = []; page.on("pageerror", (e) => errs.push(e.message));
          await page.goto(BASE + s.route, { waitUntil: "networkidle" });
          await wait(page, 1200);
          try { if (s.act) await s.act(page, ctx); } catch (e) { errs.push("aksi: " + e.message); }
          await page.screenshot({ path: path.join(dir, `${s.n}.png`) });
          // Versi penuh: elemen melayang (nav bawah, toast) disembunyikan agar tidak muncul di tengah halaman.
          if (s.full) await page.evaluate(() => document.querySelectorAll("body *").forEach((el) => { if (getComputedStyle(el).position === "fixed") el.style.visibility = "hidden"; }));
          if (s.full) await page.screenshot({ path: path.join(dir, `${s.n}--full.png`), fullPage: true });
          if (errs.length) { errors++; console.log(`✗ ${dev}/${mode}/${s.n}: ${errs[0]}`); } else console.log(`✓ ${dev}/${mode}/${s.n}`);
          await page.close();
        }
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(`\nSelesai → promo/out/screens. Adegan bermasalah: ${errors}`);
}
