import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { normalizeLabel, TOKEN_PREFIX } from "../../shared/autoIngest.js";

// Pengelolaan "Catat Otomatis" oleh pemilik akun (wajib login).
// Entity IngestDevice / CardLabel / IncomingTransaction hanya bisa ditulis
// lewat function ini (RLS create/update/delete = admin), supaya owner_id dan
// token_hash tidak bisa dipalsukan dari klien.
//
// Aksi (body.action):
//   create_device   { name }                         → { device, token }  (token tampil SEKALI)
//   revoke_device   { device_id }
//   save_label      { label_id?, label, asset_id?, status }
//   delete_label    { label_id }
//   dismiss_incoming{ ids: [] }

const MAX_DEVICES = 5;
const MAX_LABELS = 30;
const LINKABLE_TYPES = ["bank", "tunai", "emas_digital", "lainnya"];

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return TOKEN_PREFIX + b64;
}

const list = (res) => res?.items || res || [];
const err = (status: number, error: string, message?: string) => Response.json({ error, message }, { status });

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch { /* tanpa sesi */ }
    if (!me) return err(401, "unauthorized");
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    const ownDoc = async (entity, id) => {
      if (!id) return null;
      const doc = await db[entity].get(id).catch(() => null);
      return doc && doc.owner_id === me.id ? doc : null;
    };

    if (action === "create_device") {
      const name = String(body.name || "").trim().slice(0, 40) || "iPhone";
      const active = list(await db.IngestDevice.filter({ owner_id: me.id, revoked: false }, "-created_date", 50));
      if (active.length >= MAX_DEVICES)
        return err(400, "device_limit", `Maksimal ${MAX_DEVICES} perangkat aktif. Cabut salah satu dulu.`);
      const token = newToken();
      const device = await db.IngestDevice.create({
        owner_id: me.id, name, token_hash: await sha256Hex(token), token_hint: token.slice(-4),
        revoked: false, rate_count: 0,
      });
      const { token_hash: _h, ...safe } = device;
      return Response.json({ ok: true, device: safe, token });
    }

    if (action === "revoke_device") {
      const device = await ownDoc("IngestDevice", body.device_id);
      if (!device) return err(404, "not_found");
      await db.IngestDevice.update(device.id, { revoked: true, revoked_at: new Date().toISOString() });
      return Response.json({ ok: true });
    }

    if (action === "save_label") {
      const label = normalizeLabel(body.label);
      if (!label) return err(400, "invalid_label", "Label wajib diisi (huruf, angka, tanda -)");
      const status = ["active", "paused", "ignored"].includes(body.status) ? body.status : "active";

      let assetId = body.asset_id || null;
      if (status !== "ignored" || assetId) {
        if (!assetId) return err(400, "asset_required", "Pilih rekening tujuan");
        const asset = await db.Asset.get(assetId).catch(() => null);
        if (!asset || asset.created_by_id !== me.id)
          return err(403, "asset_forbidden", "Hanya rekening milik Anda sendiri yang bisa dihubungkan");
        if (!LINKABLE_TYPES.includes(asset.type || "bank"))
          return err(400, "asset_type", "Pilih aset bertipe bank/tunai");
      }

      const sameLabel = list(await db.CardLabel.filter({ owner_id: me.id, label }, "-created_date", 5));
      const existing = body.label_id ? await ownDoc("CardLabel", body.label_id) : null;
      if (body.label_id && !existing) return err(404, "not_found");
      const clash = sameLabel.find((l) => l.id !== existing?.id);

      // Label yang terdeteksi otomatis ("unmapped") dengan nama sama → pakai record itu.
      const target = existing || (clash && clash.status === "unmapped" ? clash : null);
      if (clash && clash.id !== target?.id) return err(409, "label_exists", `Label "${label}" sudah dipakai`);

      const data = { label, status, asset_id: assetId || null };
      if (target) {
        const saved = await db.CardLabel.update(target.id, data);
        return Response.json({ ok: true, label: saved });
      }
      const all = list(await db.CardLabel.filter({ owner_id: me.id }, "-created_date", MAX_LABELS + 1));
      if (all.length >= MAX_LABELS) return err(400, "label_limit", `Maksimal ${MAX_LABELS} label`);
      const saved = await db.CardLabel.create({ owner_id: me.id, seen_count: 0, ...data });
      return Response.json({ ok: true, label: saved });
    }

    if (action === "delete_label") {
      const l = await ownDoc("CardLabel", body.label_id);
      if (!l) return err(404, "not_found");
      await db.CardLabel.delete(l.id);
      return Response.json({ ok: true });
    }

    if (action === "dismiss_incoming") {
      const ids = Array.isArray(body.ids) ? body.ids.slice(0, 100) : [];
      let n = 0;
      for (const id of ids) {
        const item = await ownDoc("IncomingTransaction", id);
        if (!item || item.status !== "new") continue;
        await db.IncomingTransaction.update(item.id, { status: "dismissed" });
        n++;
      }
      return Response.json({ ok: true, dismissed: n });
    }

    return err(400, "unknown_action");
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
