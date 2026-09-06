import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { BACKUP_ENTITIES, BACKUP_VERSION } from "../../shared/backupFormat.ts";

// Cadangan per-pengguna ke Google Drive: hanya data milik pemanggil
// (created_by_id === me.id; snapshot owner_id === me.id). Field created_by_id
// di-strip agar saat pemulihan kepemilikan dipetakan ke user saat ini.
const STRIP = ["id", "created_date", "updated_date", "created_by_id"];
const strip = (r) => { const c = { ...r }; STRIP.forEach((k) => delete c[k]); return c; };

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const data = {};
    for (const e of BACKUP_ENTITIES) {
      const all = await base44.asServiceRole.entities[e.entity].list("-created_date", 5000);
      data[e.key] = (all || []).filter((r) =>
        e.key === "snapshots" ? r.owner_id === me.id : r.created_by_id === me.id
      ).map(strip);
    }

    const now = new Date();
    const backup = {
      app: "NAFKITA",
      version: BACKUP_VERSION,
      exported_at: now.toISOString(),
      user_id: me.id,
      user_name: me.full_name || me.email,
      counts: Object.fromEntries(BACKUP_ENTITIES.map((e) => [e.key, data[e.key].length])),
      data,
    };
    const json = JSON.stringify(backup, null, 2);
    const fileName = `nafkita-backup-${me.id.slice(-8)}-${now.toISOString().slice(0, 10)}.json`;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googledrive");
    const metadata = { name: fileName, description: "Cadangan data NAFKITA (pribadi)" };
    const boundary = "nafkita_" + Math.random().toString(36).slice(2);
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${json}\r\n` +
      `--${boundary}--`;

    const uploadRes = await fetch(
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

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return Response.json({ error: "drive_upload_failed", details: errText }, { status: 502 });
    }

    const file = await uploadRes.json();
    return Response.json({
      status: "success",
      file_name: fileName,
      file_id: file.id,
      counts: backup.counts,
      exported_at: backup.exported_at,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}