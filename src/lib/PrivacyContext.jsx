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