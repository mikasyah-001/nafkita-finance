import { createClientFromRequest } from "npm:@base44/sdk@0.8.46";
import { verifyWorkflowToken } from "../../shared/workflowAuth.ts";
import { BACKUP_ENTITIES, BACKUP_VERSION } from "../../shared/backupFormat.ts";
import { fetchAll } from "../../shared/fetchAll.ts";

// Cadangan per-pengguna ke Google Drive.
// Dua mode:
//   1) Interaktif (ada sesi user): cadangkan data pengguna ini saja.
//   2) Terjadwal (workflow, tanpa sesi): verifikasi token bersama (secret
//      WORKFLOW_TOKEN), lalu cadangkan SEMUA pengguna ke file terpisah.
// Field created_by_id di-strip agar saat pemulihan kepemilikan dipetakan ulang.
const STRIP = ["id", "created_date", "updated_date", "created_by_id"];
const strip = (r) => { const c = { ...r }; STRIP.forEach((k) => delete c[k]); return c; };

async function uploadToDrive(accessToken, fileName, description, json) {
  const boundary = "nafkita_" + Math.random().toString(36).slice(2);
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

const buildBackup = (user, data) => ({
  app: "NAFKITA",
  version: BACKUP_VERSION,
  exported_at: new Date().toISOString(),
  user_id: user.id,
  user_name: user.full_name || user.email,
  counts: Object.fromEntries(BACKUP_ENTITIES.map((e) => [e.key, data[e.key].length])),
  data,
});

const userDataFor = (allRecords, userId) => {
  const data = {};
  for (const e of BACKUP_ENTITIES) {
    data[e.key] = (allRecords[e.key] || [])
      .filter((r) => (e.key === "snapshots" ? r.owner_id === userId : r.created_by_id === userId))
      .map(strip);
  }
  return data;
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me = null;
    try { me = await base44.auth.me(); } catch {}

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googledrive");

    // Mode interaktif: cadangkan data pengguna ini saja.
    if (me) {
      const allRecords = {};
      for (const e of BACKUP_ENTITIES) {
        allRecords[e.key] = await fetchAll(base44.asServiceRole.entities[e.entity]);
      }
      const data = userDataFor(allRecords, me.id);
      const now = new Date();
      const fileName = `nafkita-backup-${me.id.slice(-8)}-${now.toISOString().slice(0, 10)}.json`;
      const uploadRes = await uploadToDrive(accessToken, fileName, "Cadangan data NAFKITA (pribadi)", JSON.stringify(buildBackup(me, data), null, 2));
      if (!uploadRes.ok) {
        return Response.json({ error: "drive_upload_failed", details: await uploadRes.text() }, { status: 502 });
      }
      const file = await uploadRes.json();
      return Response.json({ status: "success", mode: "user", file_name: fileName, file_id: file.id, counts: data });
    }

    // Mode terjadwal: verifikasi token, lalu cadangkan SEMUA pengguna.
    if (!await verifyWorkflowToken(req)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await fetchAll(base44.asServiceRole.entities.User);
    // Muat semua record sekali (paginasi penuh), lalu saring per pengguna.
    const allRecords = {};
    for (const e of BACKUP_ENTITIES) {
      allRecords[e.key] = await fetchAll(base44.asServiceRole.entities[e.entity]);
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const results = [];
    for (const u of (users || [])) {
      if (!u || !u.id) continue;
      const data = userDataFor(allRecords, u.id);
      const totalRecords = Object.values(data).reduce((s, arr) => s + arr.length, 0);
      if (totalRecords === 0) continue; // lewati pengguna tanpa data
      const fileName = `nafkita-backup-${u.id.slice(-8)}-${dateStr}.json`;
      const uploadRes = await uploadToDrive(accessToken, fileName, `Cadangan data NAFKITA (${u.full_name || u.email})`, JSON.stringify(buildBackup(u, data), null, 2));
      results.push({ user_id: u.id, file_name: fileName, ok: uploadRes.ok, status: uploadRes.status });
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
    return Response.json({ error: error.message }, { status: 500 });
  }
}