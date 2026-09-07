import { createContext, useContext, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useMe } from "@/hooks/useFinance";
import { DEFAULT_PRIMARY, DEFAULT_SCOPE_SHARED, DEFAULT_SCOPE_PRIVATE } from "@/lib/colorPrefs";

const ColorPrefsContext = createContext(null);

// Menerjemahkan preferensi warna user menjadi CSS custom properties di :root,
// meng-override token default dari index.css. Dipakai seluruh app via token
// Tailwind (bg-primary, bg-scope-shared, dll) sehingga perubahan langsung tampak.
export function ColorPrefsProvider({ children }) {
  const { data: me } = useMe();
  const queryClient = useQueryClient();

  const primary = me?.theme_primary || DEFAULT_PRIMARY;
  const shared = me?.scope_shared_color || DEFAULT_SCOPE_SHARED;
  const privateColor = me?.scope_private_color || DEFAULT_SCOPE_PRIVATE;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--scope-shared", shared);
    root.style.setProperty("--scope-private", privateColor);
  }, [primary, shared, privateColor]);

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