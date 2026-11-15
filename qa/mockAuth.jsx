// Login tiruan untuk QA: selalu masuk sebagai user contoh (BUKAN kode produksi).
import { createContext, useContext } from "react";
const Ctx = createContext(null);
const value = {
  user: { id: "u1", email: "keluarga@contoh.id", full_name: "Ahmad Fauzi", role: "admin" },
  isAuthenticated: true, isLoadingAuth: false, isLoadingPublicSettings: false, authError: null,
  authChecked: true, appPublicSettings: {}, logout: () => {}, navigateToLogin: () => {},
  checkUserAuth: async () => {}, checkAppState: async () => {},
};
export const AuthProvider = ({ children }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const useAuth = () => useContext(Ctx) || value;
