import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { restoreBackup, openBackup } from "../../shared/backupCore.ts";

// Pemulihan cadangan milik pemanggil.
//   - { action: "list" }: daftar cadangan Drive milik pengguna ini.
//   - { action: "restore", file_id, mode }: pulihkan dari file Drive.
//   - { action: "restore_data", backup, mode }: pulihkan dari file lokal yang
//     diunggah pengguna (logika sama — shared/backupCore.ts).
// mode: "merge" (lewati duplikat) | "replace" (ganti total; hanya cadangan v3).
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const fail = (status, error) => Response.json({ error }, { status });

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch { /* tanpa sesi */ }
    if (!me) return fail(401, "Unauthorized");

    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";
    const mode = body.mode === "replace" ? "replace" : "merge";

    const runRestore = async (backup, opts = {}) => {
      try {
        const opened = await openBackup(backup);
        const result = await restoreBackup(base44, me, opened, mode, opts);
        return Response.json({ status: "success", ...result });
      } catch (e) {
        const known = ["invalid_backup_file", "backup_not_yours", "replace_needs_v3", "backup_too_large", "backup_key_missing", "backup_decrypt_failed"];
        if (known.includes(e?.message)) return fail(e.status || 400, e.message);
        console.error("[restoreFromDrive] restore", e?.message);
        return fail(500, "restore_failed");
      }
    };

    if (action === "restore_data") {
      return runRestore(body.backup, { allowLegacyNoOwner: true });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googledrive");

    if (action === "list") {
      // Format baru (id penuh) maupun lama (8 karakter terakhir). Hasil disaring
      // lagi dengan awalan persis agar file pengguna lain tidak ikut tampil.
      const full = me.id;
      const suffix = me.id.slice(-8);
      const q = `(name contains 'nafkita-backup-${full}' or name contains 'nafkita-backup-${suffix}') and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc&fields=files(id,name,createdTime,size)&pageSize=50`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return fail(502, "drive_list_failed");
      const data = await res.json();
      const mine = (data.files || []).filter((f) => {
        const n = String(f.name || "");
        return n.startsWith(`nafkita-backup-${full}-`) || n.startsWith(`nafkita-backup-${suffix}-`);
      });
      return Response.json({ files: mine });
    }

    if (action === "restore") {
      const fileId = body.file_id;
      if (!fileId) return fail(400, "file_id required");
      // Id file Drive hanya huruf/angka/_/- (mencegah penyisipan path/parameter API).
      if (!/^[A-Za-z0-9_-]{10,200}$/.test(String(fileId))) return fail(400, "invalid_file_id");

      // Hanya file cadangan (nama berawalan nafkita-backup-<id pengguna>).
      const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,size`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!meta.ok) return fail(404, "backup_not_found");
      const info = await meta.json();
      const name = String(info.name || "");
      if (!name.startsWith(`nafkita-backup-${me.id}-`) && !name.startsWith(`nafkita-backup-${me.id.slice(-8)}-`)) return fail(403, "backup_not_yours");
      if (Number(info.size) > MAX_FILE_BYTES) return fail(413, "backup_too_large");

      const dl = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!dl.ok) return fail(502, "drive_download_failed");
      let backup;
      try { backup = JSON.parse(await dl.text()); } catch { return fail(400, "invalid_backup_file"); }
      return runRestore(backup);
    }

    return fail(400, "unknown action");
  } catch (error) {
    console.error("[restoreFromDrive]", error?.message);
    return fail(500, "restore_failed");
  }
}
