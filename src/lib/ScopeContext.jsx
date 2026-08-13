import { createContext, useContext, useEffect, useState } from "react";

const ScopeContext = createContext(null);
const KEY = "nafkita_scope";

export function ScopeProvider({ children }) {
  const [scope, setScope] = useState(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v === "private" || v === "shared" ? v : "shared";
    } catch {
      return "shared";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, scope);
    } catch {}
  }, [scope]);

  return (
    <ScopeContext.Provider value={{ scope, setScope }}>
      {children}
    </ScopeContext.Provider>
  );
}

export function useScope() {
  return useContext(ScopeContext) || { scope: "shared", setScope: () => {} };
}