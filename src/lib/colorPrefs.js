// Palet warna terkurasi untuk preferensi pengguna.
// `hsl` disimpan sebagai channel HSL (mis. "239 84% 67%") agar langsung
// dipakai sebagai nilai CSS custom property (--primary, --scope-shared, dll).
// `swatch` adalah hex untuk pratinjau di UI pemilih warna.

export const DEFAULT_PRIMARY = "239 84% 67%";       // indigo
export const DEFAULT_SCOPE_SHARED = "239 84% 67%";  // indigo (sama dengan primer)
export const DEFAULT_SCOPE_PRIVATE = "271 65% 60%"; // violet

export const PRESETS = [
  { name: "Indigo",  hsl: "239 84% 67%", swatch: "#6366f1" },
  { name: "Biru",    hsl: "217 91% 60%", swatch: "#3b82f6" },
  { name: "Toska",   hsl: "173 80% 40%", swatch: "#14b8a6" },
  { name: "Hijau",   hsl: "142 71% 45%", swatch: "#22c55e" },
  { name: "Ungu",    hsl: "271 91% 65%", swatch: "#a855f7" },
  { name: "Pink",    hsl: "330 81% 60%", swatch: "#ec4899" },
  { name: "Jingga",  hsl: "25 95% 53%",  swatch: "#f97316" },
  { name: "Merah",   hsl: "0 84% 60%",   swatch: "#ef4444" },
];