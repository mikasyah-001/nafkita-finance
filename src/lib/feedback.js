// Konstanta & util umpan balik — satu sumber untuk halaman pengguna & admin.
export const FEEDBACK_TYPES = {
  bug: { label: "Laporan error", short: "Error", desc: "Ada yang tidak berjalan", tone: "bg-destructive/10 text-destructive",
    placeholder: "Apa yang Anda lakukan, apa yang terjadi, dan apa yang seharusnya terjadi?" },
  feature: { label: "Ide fitur", short: "Fitur", desc: "Usulan fitur baru", tone: "bg-warning/15 text-warning",
    placeholder: "Fitur apa yang Anda butuhkan, dan untuk keperluan apa?" },
  suggestion: { label: "Saran", short: "Saran", desc: "Masukan & perbaikan", tone: "bg-primary/10 text-primary",
    placeholder: "Bagian mana yang bisa lebih baik?" },
  other: { label: "Lainnya", short: "Lainnya", desc: "Pertanyaan dll", tone: "bg-muted text-muted-foreground",
    placeholder: "Tulis pesan Anda…" },
};

// Status dari sudut pandang pengirim (label) & admin (adminLabel).
export const FEEDBACK_STATUS = {
  open: { label: "Terkirim", adminLabel: "Baru", tone: "bg-sedekah/10 text-sedekah" },
  in_progress: { label: "Sedang diproses", adminLabel: "Diproses", tone: "bg-warning/15 text-warning" },
  resolved: { label: "Selesai", adminLabel: "Selesai", tone: "bg-success/15 text-success" },
  closed: { label: "Ditutup", adminLabel: "Ditutup", tone: "bg-muted text-muted-foreground" },
};

// Info perangkat untuk laporan error — hanya dikirim bila pengguna setuju.
export function collectContext(win = globalThis.window) {
  if (!win) return null;
  const nav = win.navigator || {};
  return {
    path: (win.location?.pathname || "") + (win.location?.search || ""),
    user_agent: nav.userAgent || "",
    platform: nav.userAgentData?.platform || nav.platform || "",
    screen: win.screen ? `${win.screen.width}×${win.screen.height}` : "",
    standalone: !!(win.matchMedia?.("(display-mode: standalone)")?.matches || nav.standalone),
    online: nav.onLine !== false,
  };
}

// Ringkas user agent untuk admin: "iPhone · iOS 18.1 · Safari".
export function describeDevice(ua = "") {
  if (!ua) return "";
  const dev = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Perangkat lain";
  const ios = ua.match(/OS (\d+)[_.](\d+)/);
  const android = ua.match(/Android (\d+(?:\.\d+)?)/);
  const os = /iPhone|iPad/.test(ua) && ios ? `iOS ${ios[1]}.${ios[2]}` : android ? `Android ${android[1]}` : "";
  const browser = /CriOS|Chrome/.test(ua) && !/Edg/.test(ua) ? "Chrome" : /Edg/.test(ua) ? "Edge" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : /wv|WebView/.test(ua) ? "WebView" : "";
  return [dev, os, browser].filter(Boolean).join(" · ");
}
