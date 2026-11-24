// Video demo 9:16 (Reels / Threads / TikTok / Shorts), dirender frame demi frame lalu disusun ffmpeg.
// Jalankan: node promo/video.mjs   → promo/out/video/nafkita-demo-9x16.mp4 (tanpa audio; tambahkan musik di aplikasi)
// Adegan & durasi mengikuti promo/STORYBOARD.md (versi "Reel 30 detik").
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, loadPlaywright } from "../qa/lib.mjs";
import { phone } from "./frames.mjs";
import { APP_URL } from "./mockup.mjs";

const { chromium } = loadPlaywright();
const OUT = path.join(ROOT, "promo/out/video");
const FR = path.join(OUT, ".frames");
fs.rmSync(FR, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true });
const FPS = 30;
const S = (k, m, n) => "file://" + path.join(ROOT, "promo/out/screens", k, m, `${n}.png`);
const brand = (f) => "file://" + path.join(ROOT, "public/brand", f);

// [mulai, selesai] detik untuk tiap adegan.
const T = { hook: [0, 3.2], intro: [3, 7], scan: [7, 11.5], berdua: [11.3, 15.5], zakat: [15.3, 20], riyal: [19.8, 24], aset: [23.8, 27.5], cta: [27.3, 32] };
const DURATION = 32;

const ph = (id, k, m, n, scale = 1.35) => `<div class="ph" id="${id}">${phone({ kind: k, mode: m, src: S(k, m, n), scale })}</div>`;
const cap = (id, eyebrow, title) => `<div class="cap" id="${id}"><span class="eb">${eyebrow}</span><h1>${title}</h1></div>`;

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1920px;overflow:hidden;font-family:'Plus Jakarta Sans',sans-serif;color:#fff;-webkit-font-smoothing:antialiased;
  background:radial-gradient(120% 60% at 100% 0%,hsl(43 95% 58% / .26),transparent 55%),radial-gradient(90% 60% at 0% 100%,hsl(155 55% 50% / .28),transparent 60%),linear-gradient(160deg,hsl(162 70% 22%),hsl(165 55% 11%))}
.cap,.ph,.free{position:absolute;opacity:0;will-change:transform,opacity}
.cap{left:70px;right:70px;top:250px}
.eb{display:inline-block;padding:10px 22px;border-radius:999px;background:hsl(43 95% 58%);color:hsl(168 45% 12%);font-weight:800;font-size:28px}
h1{font-weight:800;font-size:84px;line-height:1.04;letter-spacing:-2px;margin-top:24px}
h1 em{font-style:normal;color:hsl(43 95% 62%)}
.ph{left:50%;top:700px;width:0;display:flex;justify-content:center}
.chip{display:inline-block;margin:8px 8px 0 0;padding:12px 22px;border-radius:999px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.25);font-weight:700;font-size:30px}
.flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
.fade{position:absolute;left:0;right:0;bottom:0;height:360px;background:linear-gradient(to top,hsl(165 55% 10%) 30%,transparent);z-index:5}
.logo{display:flex;align-items:center;gap:14px}
</style></head><body>
<!-- 1. HOOK -->
<div class="free" id="hook" style="left:70px;right:70px;top:620px">
  <h1 style="font-size:104px">Gaji masuk,<br>lalu <em>ke mana</em><br>perginya?</h1>
  <p style="font-family:Inter;font-weight:600;font-size:40px;opacity:.85;margin-top:36px">Kenalkan cara keluarga Muslim merapikan nafkah.</p>
</div>
<!-- 2. INTRO -->
${cap("c-intro", "NAFKITA", "Keuangan keluarga<br><em>rapi & berkah.</em>")}
${ph("p-intro", "ios", "light", "02-beranda")}
<!-- 3. SCAN -->
${cap("c-scan", "Scan struk AI", "Foto struk.<br><em>Beres dicatat.</em>")}
${ph("p-scan1", "ios", "light", "04-catat-transaksi")}
${ph("p-scan2", "ios", "light", "05-scan-struk-ai")}
<div class="flash" id="flash"></div>
<!-- 4. BERDUA -->
${cap("c-berdua", "Suami & istri", "Satu kas bersama,<br><em>tetap ada privasi.</em>")}
${ph("p-berdua1", "ios", "light", "06-riwayat", 1.2)}
${ph("p-berdua2", "android", "light", "07-persetujuan-pasangan", 1.2)}
<!-- 5. ZAKAT (scroll) -->
${cap("c-zakat", "Zakat mal", "Zakat dihitung<br><em>sesuai ketentuan.</em>")}
${ph("p-zakat", "ios", "light", "12-zakat--full")}
<!-- 6. RIYAL -->
${cap("c-riyal", "Indonesia ⇄ Saudi", "Rupiah & Riyal,<br><em>tak lagi tercampur.</em>")}
${ph("p-riyal1", "ios", "light", "20-catat-otomatis", 1.2)}
${ph("p-riyal2", "android", "light", "21-kartu", 1.2)}
<!-- 7. ASET (scroll, mode gelap) -->
${cap("c-aset", "Aset & emas", "Lihat kekayaan <em>tumbuh.</em>")}
${ph("p-aset", "android", "dark", "14-dashboard-aset--full")}
<!-- 8. CTA -->
<div class="free" id="cta" style="left:70px;right:70px;top:300px;text-align:center">
  <div class="logo" style="justify-content:center"><img src="${brand("mark.png")}" style="width:120px"><img src="${brand("wordmark-light.png")}" style="height:52px"></div>
  <h1 style="font-size:92px;margin-top:60px">Mulai rapikan nafkah keluarga <em>hari ini.</em></h1>
  <div style="margin-top:40px"><span class="chip">Gratis</span><span class="chip">Android & iPhone</span><span class="chip">Bisa offline</span></div>
  <div style="margin-top:70px;display:inline-block;padding:26px 50px;border-radius:999px;background:hsl(43 95% 58%);color:hsl(168 45% 12%);font-weight:800;font-size:46px">${APP_URL}</div>
</div>
${ph("p-cta1", "android", "light", "12-zakat", 1.05)}
${ph("p-cta2", "ios", "light", "02-beranda", 1.05)}
<div class="fade"></div>
<script>
const T=${JSON.stringify(T)};
const clamp=(x)=>Math.max(0,Math.min(1,x)), ease=(x)=>1-Math.pow(1-clamp(x),3), inout=(x)=>{x=clamp(x);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2};
const $=(id)=>document.getElementById(id);
// Masuk/keluar standar: naik + memudar; dx untuk geser horizontal.
function show(id,t,[a,b],{dx=0,dy=80,rot=0,x=0,y=0,delay=0,inDur=.6,outDur=.45}={}){
  const el=$(id); const i=ease((t-a-delay)/inDur), o=ease((t-(b-outDur))/outDur);
  const op=Math.min(i,1-o); el.style.opacity=op;
  const off=(1-i)*1 + o*-1;
  el.style.transform='translate('+(x+dx*off)+'px,'+(y+dy*off)+'px) rotate('+rot+'deg)';
  return {i,o};
}
function scroll(id,t,a,b,maxFrac){ // gulir isi layar ponsel
  const img=$(id).querySelector('.shot'); const h=img.naturalHeight/3, view=img.parentElement.clientHeight;
  const max=Math.max(0,(h-view+120)*maxFrac); img.style.transform='translateY('+(-max*inout((t-a)/(b-a)))+'px)';
}
window.setTime=(t)=>{
  show('hook',t,T.hook,{dy:60});
  show('c-intro',t,T.intro); show('p-intro',t,T.intro,{dy:500,delay:.15,x:0,y:40});
  // scan: form kosong → kilat → hasil AI
  show('c-scan',t,T.scan);
  const sw=T.scan[0]+2.0;
  show('p-scan1',t,[T.scan[0],sw+.05],{dy:500,delay:.1,outDur:.05,y:20});
  show('p-scan2',t,[sw,T.scan[1]],{dy:0,inDur:.05,y:20});
  $('flash').style.opacity=Math.max(0,.85-Math.abs(t-sw)*4);
  show('c-berdua',t,T.berdua);
  show('p-berdua1',t,T.berdua,{dx:-700,dy:0,x:-200,y:120,rot:-6,delay:.1});
  show('p-berdua2',t,T.berdua,{dx:700,dy:0,x:210,y:40,rot:5,delay:.3});
  show('c-zakat',t,T.zakat); show('p-zakat',t,T.zakat,{dy:500,delay:.1,y:20}); scroll('p-zakat',t,T.zakat[0]+1.2,T.zakat[1]-.6,.35);
  show('c-riyal',t,T.riyal);
  show('p-riyal1',t,T.riyal,{dx:-700,dy:0,x:-210,y:60,rot:-6,delay:.1});
  show('p-riyal2',t,T.riyal,{dx:700,dy:0,x:200,y:140,rot:5,delay:.3});
  show('c-aset',t,T.aset); show('p-aset',t,T.aset,{dy:500,delay:.1,y:20}); scroll('p-aset',t,T.aset[0]+1,T.aset[1]-.5,.3);
  show('cta',t,[T.cta[0],99],{dy:60});
  show('p-cta1',t,[T.cta[0],99],{dy:600,x:-190,y:640,rot:-7,delay:.3});
  show('p-cta2',t,[T.cta[0],99],{dy:600,x:190,y:600,rot:6,delay:.45});
};
</script></body></html>`;

const tmp = path.join(OUT, ".video.html");
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(tmp, html);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto("file://" + tmp, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const test = process.argv.slice(2).map(Number);
  if (test.length) {
    for (const t of test) { await page.evaluate((x) => window.setTime(x), t); await page.screenshot({ path: path.join(OUT, `test-${t}.jpg`), type: "jpeg", quality: 80 }); }
    process.exit(0);
  }
  const N = Math.round(DURATION * FPS);
  for (let f = 0; f < N; f++) {
    await page.evaluate((t) => window.setTime(t), f / FPS);
    await page.screenshot({ path: path.join(FR, String(f).padStart(5, "0") + ".jpg"), type: "jpeg", quality: 92 });
    if (f % 150 === 0) console.log(`frame ${f}/${N}`);
  }
} finally { await browser.close(); }
const mp4 = path.join(OUT, "nafkita-demo-9x16.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(FR, "%05d.jpg"),
  "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
fs.rmSync(FR, { recursive: true, force: true });
console.log("✓ " + path.relative(ROOT, mp4));
