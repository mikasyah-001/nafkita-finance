// Vite config khusus QA: aplikasi asli + backend & login tiruan. Jalankan: npm run qa:serve
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export default defineConfig({
  root,
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@\/api\/base44Client$/, replacement: path.join(root, "qa/mockClient.js") },
      { find: /^@\/lib\/AuthContext$/, replacement: path.join(root, "qa/mockAuth.jsx") },
      { find: /^@\//, replacement: path.join(root, "src") + "/" },
    ],
  },
  server: { port: Number(process.env.QA_PORT || 5180), strictPort: true },
});
