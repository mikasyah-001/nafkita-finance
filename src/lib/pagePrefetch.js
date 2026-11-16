import { lazy } from "react";

// Halaman code-split + daftar pemuatnya. Setelah data inti siap, Layout
// memanggil prefetchPages() sehingga kode semua halaman diunduh di latar —
// berpindah halaman tidak lagi menampilkan layar kosong sambil menunggu kode.
const PAGE_LOADERS = [];
let prefetched = false;

export function lazyPage(loader) {
  PAGE_LOADERS.push(loader);
  return lazy(loader);
}

export function prefetchPages() {
  if (prefetched) return;
  prefetched = true;
  const run = () => PAGE_LOADERS.forEach((load) => load().catch(() => {}));
  if (typeof window !== "undefined" && "requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 3000 });
  else setTimeout(run, 1500);
}
