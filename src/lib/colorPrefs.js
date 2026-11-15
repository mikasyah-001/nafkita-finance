// Palet warna terkurasi untuk preferensi pengguna.
// `hsl` disimpan sebagai channel HSL (mis. "236 58% 60%") agar langsung
// dipakai sebagai nilai CSS custom property (--primary, --scope-shared, dll).
// `swatch` adalah hex untuk pratinjau di UI pemilih warna.
// Semua preset dilunakkan (saturasi ±55–65%) agar senada dengan tema "Hutan & Emas".

export const DEFAULT_PRIMARY = "162 70% 28%";       // hijau hutan NAFKITA
export const DEFAULT_SCOPE_SHARED = "162 70% 28%";  // sama dengan primer
export const DEFAULT_SCOPE_PRIVATE = "262 28% 48%"; // plum lembut

// Nilai default lama (sebelum tema dilunakkan). Bila tersimpan di profil user,
// diperlakukan sebagai "belum memilih" agar ikut tema baru & mode gelap.
export const LEGACY_DEFAULTS = ["239 84% 67%", "271 65% 60%", "236 58% 60%", "268 46% 58%"];

// Preset lama (jenuh) → padanan lembutnya, agar pilihan user tetap dihormati.
export const LEGACY_PRESET_MAP = {
  "217 91% 60%": "212 62% 54%",
  "173 80% 40%": "176 50% 36%",
  "142 71% 45%": "152 45% 40%",
  "271 91% 65%": "268 46% 58%",
  "330 81% 60%": "334 55% 58%",
  "25 95% 53%": "24 72% 54%",
  "0 84% 60%": "354 58% 54%",
};

export const PRESETS = [
  { name: "Hutan",   hsl: "162 70% 28%", swatch: "#157A5A" },
  { name: "Indigo",  hsl: "236 58% 60%", swatch: "#5C64D6" },
  { name: "Biru",    hsl: "212 62% 54%", swatch: "#3C80D0" },
  { name: "Toska",   hsl: "176 50% 36%", swatch: "#2E8A86" },
  { name: "Ungu",    hsl: "268 46% 58%", swatch: "#8B67C7" },
  { name: "Pink",    hsl: "334 55% 58%", swatch: "#CF5F8E" },
  { name: "Jingga",  hsl: "24 72% 54%",  swatch: "#DB7836" },
  { name: "Merah",   hsl: "354 58% 54%", swatch: "#CF4A57" },
];
