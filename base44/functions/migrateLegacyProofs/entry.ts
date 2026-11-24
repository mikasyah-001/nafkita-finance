import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { fetchAll } from "../../shared/fetchAll.ts";
import { logAdminAction } from "../../shared/auditLog.ts";

// Migrasi satu kali (khusus admin): bukti lama berupa URL PUBLIK
// (Transaction.photo_url, Asset.purchase_proof_url) disalin menjadi file PRIVAT
// (photo_uri / purchase_proof_uri), lalu URL publik dilepas dari data.
//
//   { target: "transactions" | "assets", dry_run = true, limit = 20 (maks 50), skip = 0 }
//   skip = jumlah item gagal sebelumnya (dilewati agar batch berikutnya maju).
//
// - dry_run: hanya menghitung kandidat, tidak mengubah apa pun.
// - Per batch agar tidak melewati batas waktu fungsi; ulangi sampai remaining = 0.
// - Gagal per item tidak menghentikan batch; data item itu dibiarkan apa adanya.
// - Hanya mengunduh dari host penyimpanan yang dikenal (cegah SSRF) atau data:image.
// Catatan: berkas publik lamanya tidak dihapus (tidak ada API hapus file); yang
// dihentikan adalah penyebaran tautannya lewat data (pasangan, admin, ekspor, cadangan).
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = /^(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf)$/i;
const TRUSTED_HOST = /(^|\.)(base44\.app|base44\.com|supabase\.co|storage\.googleapis\.com|googleusercontent\.com|amazonaws\.com|cloudfront\.net)$/i;

const CONF = {
  transactions: { entity: "Transaction", url: "photo_url", uri: "photo_uri" },
  assets: { entity: "Asset", url: "purchase_proof_url", uri: "purchase_proof_uri" },
};

async function download(url) {
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(url)) {
    const [head, b64] = url.split(",", 2);
    const type = head.slice(5, head.indexOf(";"));
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (bytes.length > MAX_BYTES) throw new Error("too_large");
    return { bytes, type };
  }
  return await fetchTrusted(url);
}

const checkHost = (u) => {
  if (u.protocol !== "https:") throw new Error("not_https");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) || u.hostname.includes(":") || !TRUSTED_HOST.test(u.hostname)) throw new Error(`untrusted_host:${u.hostname}`);
};

// Tipe dari "magic bytes" — beberapa CDN mengirim application/octet-stream.
function sniffType(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  // ISO-BMFF ("ftyp"): dipakai HEIC, AVIF, MP4, dll. → bedakan dari brand utama.
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    return ["heic", "heix", "heim", "heis", "hevc", "hevx"].includes(brand) ? "image/heic" : "";
  }
  return "";
}

// Unduh dengan mengikuti redirect SECARA MANUAL (maks 3): setiap tujuan dicek
// ulang (https, bukan IP, host penyimpanan dikenal) — media.base44.com bisa
// mengalihkan ke penyimpanan/CDN.
async function fetchTrusted(url) {
  let u;
  try { u = new URL(url); } catch { throw new Error("invalid_url"); }
  checkHost(u);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    let res;
    for (let hop = 0; ; hop++) {
      res = await fetch(u.toString(), { signal: ctrl.signal, redirect: "manual" });
      // Redirect "opaque" (tanpa Location) tidak bisa diperiksa sebelum diikuti →
      // tolak; mengikutinya otomatis berarti server sempat menghubungi host apa pun.
      if (res.type === "opaqueredirect" || res.status === 0) throw new Error("opaque_redirect");
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc || hop >= 3) throw new Error("too_many_redirects");
        u = new URL(loc, u);
        checkHost(u);
        continue;
      }
      break;
    }
    if (!res.ok) throw new Error(`http_${res.status}`);
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_BYTES) throw new Error("too_large");
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX_BYTES) throw new Error("too_large");
    const header = String(res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const type = ALLOWED_TYPES.test(header) ? header : sniffType(bytes);
    if (!type) throw new Error(`bad_type:${header || "kosong"}`);
    return { bytes, type };
  } catch (e) {
    if (e?.name === "AbortError") throw new Error("timeout");
    throw e;
  } finally { clearTimeout(timer); }
}

const extFor = (type) => (type === "application/pdf" ? "pdf" : (type.split("/")[1] || "jpg").replace("jpeg", "jpg"));

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch { /* tanpa sesi */ }
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (me.role !== "admin") return Response.json({ error: "forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const conf = CONF[body.target];
    if (!conf) return Response.json({ error: "invalid_target" }, { status: 400 });
    const dryRun = body.dry_run !== false;
    const limit = Math.max(1, Math.min(Number(body.limit) || 20, 50));
    const svc = base44.asServiceRole.entities[conf.entity];

    const all = await fetchAll(svc);
    const candidates = (all || []).filter((r) => r[conf.url] && !r[conf.uri]);
    if (dryRun) return Response.json({ dry_run: true, target: body.target, candidates: candidates.length });

    const results = { migrated: 0, failed: [] };
    const skip = Math.max(0, Number(body.skip) || 0);
    for (const r of candidates.slice(skip, skip + limit)) {
      try {
        const { bytes, type } = await download(String(r[conf.url]));
        const file = new File([bytes], `bukti-${r.id}.${extFor(type)}`, { type });
        let up;
        try { up = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file }); }
        catch (e) { throw new Error(`upload_failed:${String(e?.message || "").slice(0, 40)}`); }
        if (!up?.file_uri) throw new Error("upload_failed:tanpa_file_uri");
        // Tulis bersyarat: hanya bila URL lama masih sama (pemilik tidak mengganti/
        // menghapus bukti selama unduhan berjalan). Bila berubah → lewati.
        const w = await svc.updateMany({ id: r.id, [conf.url]: r[conf.url] }, { $set: { [conf.uri]: up.file_uri, [conf.url]: "" } });
        if (Number(w?.updated ?? w?.modified ?? 0) > 0) results.migrated++;
        else results.failed.push({ id: r.id, reason: "changed_during_migration" });
      } catch (e) {
        results.failed.push({ id: r.id, reason: String(e?.message || "error").slice(0, 80) });
      }
    }
    const remaining = candidates.length - results.migrated;

    await logAdminAction(base44, {
      actor_id: me.id, actor_name: me.full_name || me.email, actor_email: me.email,
      action: "migrate_legacy_proofs", target_type: body.target,
      details: `Dipindahkan ${results.migrated}, gagal ${results.failed.length}, sisa ${remaining}`,
    }).catch(() => {});

    return Response.json({ dry_run: false, target: body.target, ...results, remaining });
  } catch (error) {
    console.error("[migrateLegacyProofs]", error?.message);
    return Response.json({ error: "migration_failed" }, { status: 500 });
  }
}
