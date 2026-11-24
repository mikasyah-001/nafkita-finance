import { createContext, useContext, useEffect, useState } from "react";

const PrivacyContext = createContext(null);
const KEY = "nafkita_hide_amounts";

export function PrivacyProvider({ children }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, hidden ? "1" : "0");
    } catch {}
    // Penyamaran global: <Money> menampilkan ••••, sedangkan angka lain yang
    // diformat langsung (formatMoney) dikaburkan lewat CSS .privacy-on di
    // index.css — satu sakelar untuk semua layar, tanpa mengubah data/ekspor.
    document.documentElement.classList.toggle("privacy-on", hidden);
  }, [hidden]);

  const toggle = () => setHidden((h) => !h);

  return (
    <PrivacyContext.Provider value={{ hidden, toggle }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext) || { hidden: false, toggle: () => {} };
}