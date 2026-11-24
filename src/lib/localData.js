import { queryClientInstance } from "@/lib/query-client";

// Keluar dengan bersih: data keuangan yang tersimpan di perangkat (antrean
// transaksi offline, cache kueri, pilihan rekening, draf sesi) dihapus agar
// orang berikutnya yang memakai perangkat/peramban ini tidak melihatnya.
// Preferensi tampilan perangkat (tema, mode sembunyikan angka, tutup ajakan
// pasang aplikasi) dipertahankan.
const KEEP_KEYS = new Set(["nafkita_hide_amounts", "nafkita_install_dismissed_v1", "theme"]);
const KEEP_PREFIXES = ["base44_"]; // parameter aplikasi SDK (token dihapus oleh auth.logout)

export function clearLocalUserData() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    for (const k of keys) {
      if (!k || KEEP_KEYS.has(k) || KEEP_PREFIXES.some((p) => k.startsWith(p))) continue;
      if (k.startsWith("nafkita") || k.startsWith("qa:")) localStorage.removeItem(k);
    }
    sessionStorage.clear();
  } catch { /* penyimpanan diblokir */ }
  try { queryClientInstance.clear(); } catch { /* abaikan */ }
}

