// Utilitas bersama runner QA: menyalakan server QA & memuat Playwright.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PORT = Number(process.env.QA_PORT || 5180);
export const BASE = `http://localhost:${PORT}`;

export function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require("playwright");
  } catch {
    console.error("Playwright belum terpasang. Jalankan:\n  npm i -D playwright && npx playwright install chromium");
    process.exit(1);
  }
}

export async function startServer() {
  const proc = spawn(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "--config", "qa/vite.config.mjs"], {
    cwd: ROOT, env: { ...process.env, QA_PORT: String(PORT) }, stdio: "pipe",
  });
  for (let i = 0; i < 60; i++) {
    try { await fetch(BASE); return proc; } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  proc.kill();
  throw new Error("Server QA tidak menyala di " + BASE);
}

export const routes = [
  "/selamat-datang", "/", "/riwayat", "/add", "/aset", "/aset/a2", "/aset/a3", "/aset-dashboard", "/laporan", "/laporan?tab=analisis", "/anggaran",
  "/transfer", "/utang", "/tagihan-berulang", "/target-tabungan", "/zakat", "/persetujuan",
  "/rekonsiliasi", "/kategori", "/kesehatan-data", "/impor", "/impor-portofolio", "/pengaturan", "/profil", "/panduan", "/umpan-balik", "/admin",
  "/catat-otomatis", "/catat-otomatis?tab=sambungan", "/lainnya",
];
