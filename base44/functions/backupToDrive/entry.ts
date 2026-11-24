import { createClientFromRequest } from "npm:@base44/sdk@0.8.46";
import { verifyWorkflowToken } from "../../shared/workflowAuth.ts";
import { BACKUP_ENTITIES } from "../../shared/backupFormat.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { collectUserData, buildBackup, sealBackup, dropMeta } from "../../shared/backupCore.ts";

// Cadangan per-pengguna.
//   - { action: "export" } (ada sesi): kembalikan JSON cadangan milik pengguna
//     ini untuk diunduh sebagai file lokal (tidak ke Drive).
//   - Interaktif (ada sesi): cadangkan data pengguna ini ke Google Drive.
//     Dibatasi 1x per 10 menit; disimpan 10 cadangan terbaru per pengguna.
//   - Terjadwal (workflow, tanpa sesi): verifikasi token, lalu cadangkan
//     SEMUA pengguna ke file terpisah.
// Isi file Drive dienkripsi AES-256-GCM bila secret BACKUP_ENCRYPTION_KEY diisi.
const MIN_INTERVAL_MS = 10 * 60 * 1000;
const KEEP_PER_USER = 10;

async function uploadToDrive(accessToken, fileName, description, json) {
  const boundary = "nafkita_" + crypto.randomUUID().replace(/-/g, "");
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify({ name: fileName, description })}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${json}\r\n` +
    `--${boundary}--`;
  return fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
}

// File cadangan milik satu pengguna (format nama baru, id penuh), terbaru dulu.
async function listUserFiles(accessToken, userId) {
  const q = `name contains 'nafkita-backup-${userId}-' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc&fields=files(id,name,createdTime)&pageSize=100`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const files = (await res.json()).files || [];
  // "contains" bisa cocok sebagian — pastikan awalan persis milik pengguna ini.
  return files.filter((f) => String(f.name || "").startsWith(`nafkita-backup-${userId}-`));
}

async function pruneOld(accessToken, files) {
  for (const f of files.slice(KEEP_PER_USER)) {
    try { await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }); }
    catch { /* lanjut */ }
  }
}

const fileNameFor = (userId) => `nafkita-backup-${userId}-${new Date().toISOString().slice(0, 16).replace(":", "")}.json`;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me = null;
    try { me = await base44.auth.me(); } catch { /* tanpa sesi */ }
    const body = await req.clone().json().catch(() => ({}));

    // Ekspor file lokal: tidak menyentuh Drive.
    if (me && body?.action === "export") {
      const data = await collectUserData(base44.asServiceRole.entities, me.id);
      return Response.json({ backup: buildBackup(me, data) });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googledrive");

    // Mode interaktif: cadangkan data pengguna ini saja.
    if (me) {
      const before = await listUserFiles(accessToken, me.id);
      const last = before?.[0]?.createdTime ? new Date(before[0].createdTime).getTime() : 0;
      if (last && Date.now() - last < MIN_INTERVAL_MS) {
        return Response.json({ error: "too_soon", message: "Cadangan baru saja dibuat. Coba lagi beberapa menit lagi." }, { status: 429 });
      }
      const data = await collectUserData(base44.asServiceRole.entities, me.id);
      const fileName = fileNameFor(me.id);
      const sealed = await sealBackup(buildBackup(me, data));
      const uploadRes = await uploadToDrive(accessToken, fileName, "Cadangan data NAFKITA (pribadi)", JSON.stringify(sealed));
      if (!uploadRes.ok) {
        console.error("[backupToDrive] upload", uploadRes.status, await uploadRes.text().catch(() => ""));
        return Response.json({ error: "drive_upload_failed" }, { status: 502 });
      }
      const file = await uploadRes.json();
      const after = await listUserFiles(accessToken, me.id);
      if (after) await pruneOld(accessToken, after);
      const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
      return Response.json({ status: "success", mode: "user", file_name: fileName, file_id: file.id, counts, encrypted: !!sealed.encrypted });
    }

    // Mode terjadwal: verifikasi token, lalu cadangkan SEMUA pengguna.
    if (!await verifyWorkflowToken(req)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await fetchAll(base44.asServiceRole.entities.User);
    // Muat semua record sekali (paginasi penuh), lalu kelompokkan per pemilik.
    const byOwner = {};
    for (const e of BACKUP_ENTITIES) {
      for (const r of await fetchAll(base44.asServiceRole.entities[e.entity]) || []) {
        const owner = e.key === "snapshots" ? r.owner_id : r.created_by_id;
        if (!owner) continue;
        ((byOwner[owner] ||= {})[e.key] ||= []).push(dropMeta(r));
      }
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const results = [];
    for (const u of (users || [])) {
      if (!u || !u.id || !byOwner[u.id]) continue; // lewati pengguna tanpa data
      const data = Object.fromEntries(BACKUP_ENTITIES.map((e) => [e.key, byOwner[u.id][e.key] || []]));
      const fileName = fileNameFor(u.id);
      const sealed = await sealBackup(buildBackup(u, data));
      const uploadRes = await uploadToDrive(accessToken, fileName, "Cadangan data NAFKITA (terjadwal)", JSON.stringify(sealed));
      if (uploadRes.ok) {
        const files = await listUserFiles(accessToken, u.id);
        if (files) await pruneOld(accessToken, files);
      }
      results.push({ user_id: u.id, ok: uploadRes.ok, status: uploadRes.status });
    }
    const uploaded = results.filter((r) => r.ok).length;
    return Response.json({
      status: "success",
      mode: "scheduled",
      users: results.length,
      uploaded,
      failed: results.length - uploaded,
      date: dateStr,
    });
  } catch (error) {
    console.error("[backupToDrive]", error?.message);
    return Response.json({ error: "backup_failed" }, { status: 500 });
  }
}
