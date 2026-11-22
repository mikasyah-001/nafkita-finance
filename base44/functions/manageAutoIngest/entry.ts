import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { TOKEN_PREFIX } from "../../shared/autoIngest.js";

// Pengelolaan "Catat Otomatis" oleh pemilik akun (wajib login).
// Entity IngestDevice / IncomingTransaction hanya bisa ditulis
// lewat function ini (RLS create/update/delete = admin), supaya owner_id dan
// token_hash tidak bisa dipalsukan dari klien.
//
// Aksi (body.action):
//   create_device   { name }                         → { device, token }  (token tampil SEKALI)
//   revoke_device   { device_id }
//   dismiss_incoming{ ids: [] }

const MAX_DEVICES = 5;

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

    // Label kartu kini dikelola sebagai Kartu (PaymentCard) lewat manageCards.
    if (action === "save_label" || action === "delete_label") return err(410, "moved", "Kelola kartu di halaman Kartu");

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
