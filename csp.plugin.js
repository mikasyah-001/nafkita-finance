import { createHash } from "node:crypto";

// Content-Security-Policy untuk build produksi (bukan dev server: Vite dev
// memakai script inline untuk HMR). Script inline yang ada di index.html hasil
// build (mis. pelacak dari plugin Base44) diizinkan lewat hash SHA-256-nya;
// script inline lain, handler onclick="…", dan tautan javascript: diblokir.
// Darurat: VITE_CSP=off saat build untuk menonaktifkan.
const POLICY = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "https:"],
  "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
  "img-src": ["'self'", "https:", "data:", "blob:"],
  "media-src": ["'self'", "https:", "blob:"],
  "connect-src": ["'self'", "https:", "wss:"],
  "frame-src": ["'self'", "https:", "blob:"],
  "worker-src": ["'self'", "blob:"],
  "manifest-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'", "https:"],
};

export function buildCsp(html) {
  const hashes = [];
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!m[1].trim()) continue;
    hashes.push(`'sha256-${createHash("sha256").update(m[1], "utf8").digest("base64")}'`);
  }
  const p = { ...POLICY, "script-src": [...POLICY["script-src"], ...hashes] };
  return Object.entries(p).map(([k, v]) => `${k} ${v.join(" ")}`).join("; ");
}

export default function cspPlugin() {
  return {
    name: "nafkita-csp",
    apply: "build",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        if (process.env.VITE_CSP === "off") return html;
        const csp = buildCsp(html).replace(/"/g, "&quot;");
        return html.replace(/<head>/i, `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
      },
    },
  };
}
