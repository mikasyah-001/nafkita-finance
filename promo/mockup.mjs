// Mockup ponsel + poster promosi dari hasil promo/capture.mjs.
// Jalankan: node promo/mockup.mjs [mockups|posters]
//   → promo/out/mockups/{ios,android}/{light,dark}/NN.png  (latar transparan, satu ponsel)
//   → promo/out/posters/{feed,story}/PNN-nama.jpg          (1080×1350 & 1080×1920, master 2×)
import fs from "node:fs";
import path from "node:path";
import { ROOT, loadPlaywright } from "../qa/lib.mjs";
import { SCENES } from "./capture.mjs";
import { phone, phoneSize } from "./frames.mjs";

const { chromium } = loadPlaywright();
const OUT = path.join(ROOT, "promo/out");
const SHOTS = path.join(OUT, "screens");
const TMP = path.join(OUT, ".tmp"); fs.mkdirSync(TMP, { recursive: true });
export const APP_URL = "nafkita.mikaiel.com";
const shot = (kind, mode, n) => "file://" + path.join(SHOTS, kind, mode, `${n}.png`);
const brand = (f) => "file://" + path.join(ROOT, "public/brand", f);

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">`;
const BASE_CSS = `
*{box-sizing:border-box;margin:0}
body{font-family:'Plus Jakarta Sans',sans-serif;-webkit-font-smoothing:antialiased}
.canvas{position:relative;overflow:hidden;color:#fff;
  background:radial-gradient(120% 70% at 100% 0%,hsl(43 95% 58% / .28),transparent 55%),
             radial-gradient(90% 60% at 0% 100%,hsl(155 55% 50% / .30),transparent 60%),
             linear-gradient(160deg,hsl(162 70% 22%) 0%,hsl(165 55% 12%) 100%)}
.canvas.cream{color:hsl(165 50% 12%);background:radial-gradient(110% 60% at 100% 0%,hsl(43 95% 58% / .35),transparent 55%),
             radial-gradient(90% 60% at 0% 100%,hsl(155 55% 45% / .18),transparent 60%),hsl(50 30% 95%)}
.eyebrow{display:inline-flex;align-items:center;gap:10px;padding:10px 20px;border-radius:999px;font-weight:700;font-size:24px;
  background:hsl(43 95% 58%);color:hsl(168 45% 12%)}
h1{font-weight:800;letter-spacing:-1.5px;line-height:1.04}
h1 em{font-style:normal;color:hsl(43 95% 62%)}
.cream h1 em{color:hsl(162 70% 28%)}
.sub{font-family:Inter,sans-serif;font-weight:500;opacity:.86;line-height:1.4}
.chips{display:flex;flex-wrap:wrap;gap:10px}
.chip{padding:10px 18px;border-radius:999px;font-weight:600;font-size:22px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22)}
.cream .chip{background:#fff;border-color:hsl(162 30% 85%)}
.logo{display:flex;align-items:center;gap:12px}
.logo img.m{width:56px;height:56px}.logo img.w{height:26px}
.foot{position:absolute;left:64px;right:64px;bottom:52px;display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:24px}
.stage{position:absolute;left:0;right:0;display:flex;justify-content:center;align-items:flex-end;z-index:0}
.fade{z-index:1}.txt,.foot{z-index:3}
`;
const logo = (light = true) => `<div class="logo"><img class="m" src="${brand("mark.png")}"><img class="w" src="${brand(light ? "wordmark-light.png" : "wordmark.png")}"></div>`;
const foot = (light = true) => `<div class="foot">${logo(light)}<span style="opacity:.85">${APP_URL}</span></div>`;

// Tata letak teks (judul di atas, ponsel di bawah).
function textBlock(p, story) {
  const s = story ? 1.12 : 1;
  return `<div class="txt" style="position:absolute;left:64px;right:64px;top:${story ? 230 : 72}px">
    ${p.eyebrow ? `<span class="eyebrow">${p.eyebrow}</span>` : ""}
    <h1 style="font-size:${Math.round((p.size || 76) * s)}px;margin-top:26px">${p.title}</h1>
    ${p.sub ? `<p class="sub" style="font-size:${Math.round(30 * s)}px;margin-top:20px;max-width:900px">${p.sub}</p>` : ""}
    ${p.chips ? `<div class="chips" style="margin-top:26px">${p.chips.map((c) => `<span class="chip">${c}</span>`).join("")}</div>` : ""}
  </div>`;
}

// Panggung ponsel: 1–2 ponsel, bagian bawah boleh terpotong (gaya iklan aplikasi).
function stage(p, story) {
  const ph = p.phones;
  const top = story ? (p.stageTopStory ?? Math.round(230 + ((p.stageTop ?? 560) - 72) * 1.12 + 80)) : (p.stageTop ?? 560);
  const sc = (story ? 1.32 : 1.1) * (p.scale || 1);
  if (ph.length === 1) {
    const [k, m, n] = ph[0];
    return `<div class="stage" style="top:${top}px;align-items:flex-start">${phone({ kind: k, mode: m, src: shot(k, m, n), scale: sc * 1.18, tilt: p.tilt ?? 0 })}</div>`;
  }
  return `<div class="stage" style="top:${top}px;align-items:flex-start;gap:0">
    <div style="margin-right:-60px;margin-top:70px;z-index:1">${phone({ kind: ph[0][0], mode: ph[0][1], src: shot(...ph[0]), scale: sc, tilt: -7 })}</div>
    <div style="margin-left:-60px;z-index:2">${phone({ kind: ph[1][0], mode: ph[1][1], src: shot(...ph[1]), scale: sc, tilt: 6 })}</div>
  </div>`;
}

function grid(p, story) {
  const cols = 5, rows = story ? 4 : 3, sc = 0.44;
  const { w, h } = phoneSize("ios");
  const cw = 232, rh = h * sc + 34, W = cols * cw;
  const items = p.grid.slice(0, cols * rows);
  return `<div class="stage" style="top:${story ? 680 : 430}px;left:50%;right:auto;width:${W}px;height:${rows * rh}px;margin-left:${-W / 2}px;display:block;transform:rotate(-9deg)">
    ${items.map(([k, m, n], i) => {
      const c = i % cols, r = Math.floor(i / cols);
      return `<div style="position:absolute;left:${c * cw + cw / 2}px;top:${r * rh + (c % 2 ? 110 : 0)}px;transform:translate(-50%,0)"><div style="width:${w * sc}px;height:${h * sc}px;display:flex;align-items:center;justify-content:center">${phone({ kind: k, mode: m, src: shot(k, m, n), scale: sc })}</div></div>`;
    }).join("")}
  </div>`;
}

export const POSTERS = [
  { id: "P01-hero", eyebrow: "✦ Nafkah kita, berkah bersama", title: "Keuangan keluarga yang <em>rapi</em>, <em>terbuka</em>, dan <em>berkah</em>.",
    sub: "Catat bersama pasangan, pantau aset & emas, hitung zakat mal. Satu aplikasi.", size: 74,
    phones: [["android", "light", "12-zakat"], ["ios", "light", "02-beranda"]], stageTop: 610 },
  { id: "P02-scan-struk", eyebrow: "Scan struk AI", title: "Foto struknya.<br><em>Beres dicatat.</em>",
    sub: "AI membaca nominal, toko, tanggal & kategori. Hingga 5 bon sekaligus, Anda tinggal cek lalu simpan.",
    phones: [["ios", "light", "05-scan-struk-ai"]], stageTop: 560 },
  { id: "P03-berdua", eyebrow: "Suami & istri", title: "Satu kas keluarga,<br><em>tetap ada ruang pribadi.</em>", size: 70,
    chips: ["Bersama / Pribadi", "Persetujuan pasangan", "Notifikasi"],
    phones: [["ios", "light", "06-riwayat"], ["android", "light", "07-persetujuan-pasangan"]], stageTop: 600 },
  { id: "P04-zakat", eyebrow: "Zakat mal", title: "Zakat dihitung<br><em>sesuai ketentuan.</em>",
    sub: "Nisab 85 g emas harga terkini, kadar 2,5%, haul hijriah. Lintas Rupiah & Riyal, rujukannya terbuka.",
    phones: [["ios", "light", "12-zakat"]], stageTop: 590 },
  { id: "P05-rupiah-riyal", eyebrow: "Indonesia ⇄ Saudi", title: "Rupiah & Riyal,<br><em>tak lagi tercampur.</em>", size: 72,
    chips: ["Kurs otomatis", "Kartu mada", "Catat otomatis Apple Pay"],
    phones: [["ios", "light", "20-catat-otomatis"], ["android", "light", "21-kartu"]], stageTop: 600 },
  { id: "P06-aset-emas", eyebrow: "Aset & emas", title: "Lihat kekayaan tumbuh,<br><em>bukan sekadar saldo.</em>", size: 68,
    chips: ["Emas per gram", "Investasi & DCA", "Snapshot bulanan"],
    phones: [["android", "light", "15-emas-detail"], ["ios", "light", "14-dashboard-aset"]], stageTop: 600 },
  { id: "P07-anggaran-target", eyebrow: "Rencana", title: "Anggaran rapi,<br><em>umrah makin dekat.</em>",
    chips: ["Anggaran per kategori", "Target tabungan", "Rencana bulanan"],
    phones: [["android", "light", "10-anggaran"], ["ios", "light", "11-target-tabungan"]], stageTop: 600 },
  { id: "P08-laporan", eyebrow: "Laporan", title: "Sebulan keuangan,<br><em>sekali lihat.</em>",
    sub: "Tren, perbandingan, proyeksi. Bagikan sebagai gambar ke pasangan, atau ekspor PDF, CSV & Excel.",
    phones: [["ios", "light", "08-laporan"]], stageTop: 590 },
  { id: "P09-privasi", eyebrow: "Privasi", title: "Sembunyikan semua angka.<br><em>Satu ketuk.</em>", size: 70,
    chips: ["Verifikasi dua langkah", "Cadangan Google Drive", "Bisa offline"],
    phones: [["ios", "light", "03-beranda-privasi"]], stageTop: 600 },
  { id: "P10-mode-gelap", eyebrow: "Mode gelap", title: "Nyaman dipakai<br><em>siang & malam.</em>",
    phones: [["android", "dark", "14-dashboard-aset"], ["ios", "dark", "02-beranda"]], stageTop: 520 },
  { id: "P11-semua-fitur", eyebrow: "27 fitur", title: "Semua kebutuhan nafkah<br><em>dalam satu aplikasi.</em>", size: 68,
    grid: [["ios", "light", "02-beranda"], ["android", "light", "06-riwayat"], ["ios", "light", "12-zakat"], ["android", "light", "14-dashboard-aset"], ["ios", "light", "10-anggaran"],
      ["android", "light", "11-target-tabungan"], ["ios", "light", "08-laporan"], ["android", "light", "21-kartu"], ["ios", "light", "19-tagihan-rutin"], ["android", "light", "18-utang-piutang"],
      ["ios", "light", "32-audit-kas"], ["android", "light", "24-kesehatan-data"], ["ios", "light", "20-catat-otomatis"], ["android", "light", "15-emas-detail"], ["ios", "light", "31-menu-lainnya"],
      ["android", "light", "04-catat-transaksi"], ["ios", "light", "17-transfer"], ["android", "light", "22-dompet"], ["ios", "light", "09-laporan-analisis"], ["android", "light", "28-profil-pasangan"]] },
  { id: "P12-cta", cream: true, eyebrow: "Gratis", title: "Mulai rapikan<br>nafkah keluarga <em>hari ini.</em>", size: 74,
    sub: `Daftar di <b>${APP_URL}</b>, lalu pasang ke layar utama HP. Android & iPhone.`,
    phones: [["android", "light", "01-sambutan"], ["ios", "light", "02-beranda"]], stageTop: 610 },
];

function posterHTML(p, story) {
  const H = story ? 1920 : 1350;
  const light = !p.cream;
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE_CSS}</style></head><body>
  <div class="canvas ${p.cream ? "cream" : ""}" style="width:1080px;height:${H}px">
    ${p.grid ? grid(p, story) : stage(p, story)}
    <div class="fade" style="position:absolute;left:0;right:0;bottom:0;height:${story ? 380 : 280}px;background:linear-gradient(to top,${p.cream ? "hsl(50 30% 95%)" : "hsl(165 55% 10%)"} 25%,transparent)"></div>
    ${p.grid ? `<div class="fade" style="position:absolute;left:0;right:0;top:0;height:${story ? 840 : 560}px;background:linear-gradient(to bottom,hsl(163 62% 17%) 55%,transparent)"></div>` : ""}
    ${textBlock(p, story)}
    ${foot(light)}
  </div></body></html>`;
}

function mockupHTML(kind, mode, n) {
  const { w, h } = phoneSize(kind);
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE_CSS}body{background:transparent}</style></head><body>
  <div id="wrap" style="width:${w + 80}px;height:${h + 120}px;padding:40px 40px 80px;background:transparent">${phone({ kind, mode, src: shot(kind, mode, n), shadow: true })}</div></body></html>`;
}

async function render(page, html, file, opts) {
  const tmp = path.join(TMP, "page.html");
  fs.writeFileSync(tmp, html);
  await page.goto("file://" + tmp, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, ...opts });
}

const what = process.argv[2] || "all";
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const browser = await chromium.launch();
  try {
    if (what === "all" || what === "mockups") {
      const page = await browser.newPage({ deviceScaleFactor: 3, viewport: { width: 600, height: 1100 } });
      for (const kind of ["ios", "android"]) for (const mode of ["light", "dark"]) {
        const dir = path.join(OUT, "mockups", kind, mode); fs.mkdirSync(dir, { recursive: true });
        for (const s of SCENES) {
          await render(page, mockupHTML(kind, mode, s.n), path.join(dir, `${s.n}.png`), { omitBackground: true, clip: await clipOf(page, kind) });
        }
        console.log(`✓ mockups ${kind}/${mode}`);
      }
      await page.close();
    }
    if (what === "all" || what === "posters") {
      for (const story of [false, true]) {
        const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1080, height: story ? 1920 : 1350 } });
        const dir = path.join(OUT, "posters", story ? "story" : "feed"); fs.mkdirSync(dir, { recursive: true });
        for (const p of POSTERS) {
          await render(page, posterHTML(p, story), path.join(dir, `${p.id}.jpg`), { type: "jpeg", quality: 90 });
          console.log(`✓ poster ${story ? "story" : "feed"}/${p.id}`);
        }
        await page.close();
      }
    }
  } finally { await browser.close(); }
}

async function clipOf(page, kind) {
  const { w, h } = phoneSize(kind);
  return { x: 0, y: 0, width: w + 80, height: h + 120 };
}
