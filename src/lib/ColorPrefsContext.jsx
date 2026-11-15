import { createContext, useContext, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useMe } from "@/hooks/useFinance";
import { DEFAULT_PRIMARY, DEFAULT_SCOPE_SHARED, DEFAULT_SCOPE_PRIVATE, LEGACY_DEFAULTS, LEGACY_PRESET_MAP } from "@/lib/colorPrefs";

// Pilihan user dianggap "kustom" hanya bila diisi & bukan default lama.
const custom = (v) => (v && !LEGACY_DEFAULTS.includes(v) ? LEGACY_PRESET_MAP[v] || v : null);

const ColorPrefsContext = createContext(null);

// Menerjemahkan preferensi warna user menjadi CSS custom properties di :root,
// meng-override token default dari index.css. Dipakai seluruh app via token
// Tailwind (bg-primary, bg-scope-shared, dll) sehingga perubahan langsung tampak.
export function ColorPrefsProvider({ children }) {
  const { data: me } = useMe();
  const queryClient = useQueryClient();

  const customPrimary = custom(me?.theme_primary);
  const customShared = custom(me?.scope_shared_color);
  const customPrivate = custom(me?.scope_private_color);
  const primary = customPrimary || DEFAULT_PRIMARY;
  const shared = customShared || DEFAULT_SCOPE_SHARED;
  const privateColor = customPrivate || DEFAULT_SCOPE_PRIVATE;

  // Hanya override token bila user memilih warna sendiri. Tanpa itu, token
  // dari index.css dipakai — termasuk varian mode gelap yang lebih terang.
  // (Sebelumnya selalu di-set inline sehingga mode gelap ikut warna terang.)
  // Sejak rebrand "Hutan & Emas", warna brand tetap (tidak lagi bisa diubah
  // pengguna). Bersihkan override lama yang mungkin pernah tersimpan.
  useEffect(() => {
    const root = document.documentElement;
    ["--primary", "--ring", "--scope-shared", "--scope-private"].forEach((n) => root.style.removeProperty(n));
  }, []);

  const saveColorPrefs = useCallback(async (prefs) => {
    await base44.auth.updateMe(prefs);
    queryClient.invalidateQueries(["me"]);
  }, [queryClient]);

  return (
    <ColorPrefsContext.Provider value={{ primary, shared, privateColor, saveColorPrefs }}>
      {children}
    </ColorPrefsContext.Provider>
  );
}

export function useColorPrefs() {
  return useContext(ColorPrefsContext) || {
    primary: DEFAULT_PRIMARY,
    shared: DEFAULT_SCOPE_SHARED,
    privateColor: DEFAULT_SCOPE_PRIVATE,
    saveColorPrefs: async () => {},
  };
}