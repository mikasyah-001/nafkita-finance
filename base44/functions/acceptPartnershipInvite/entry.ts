import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { hasActivePartnership } from "../../shared/partnerResolve.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { getActorName, notifyPartnershipLifecycle } from "../../shared/notifyCommon.ts";

// Menerima undangan Partnership: memverifikasi invitee_email cocok dengan
// email pemanggil, mencegah pasangan ganda (penerima maupun pengundang belum
// terhubung), lalu mengisi invitee_id + status active. Setelah aktivasi,
// semua undangan pending lain milik kedua pihak dibatalkan otomatis agar
// tidak ada dua hubungan aktif yang bisa terbentuk bersamaan (race condition).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const partnership_id = String(body.partnership_id || "");
    if (!partnership_id)
      return Response.json({ error: "missing_id" }, { status: 400 });

    let p;
    try { p = await base44.asServiceRole.entities.Partnership.get(partnership_id); }
    catch { return Response.json({ error: "not_found" }, { status: 404 }); }
    if (!p) return Response.json({ error: "not_found" }, { status: 404 });
    if (p.status !== "pending")
      return Response.json({ error: "not_pending" }, { status: 409 });
    if ((p.invitee_email || "").toLowerCase() !== (me.email || "").toLowerCase())
      return Response.json({ error: "forbidden" }, { status: 403 });

    // Cek pasangan ganda untuk kedua pihak (fast-fail; atomic check di bawah).
    if (await hasActivePartnership(base44, me.id))
      return Response.json({ error: "already_connected" }, { status: 409 });
    if (await hasActivePartnership(base44, p.inviter_id))
      return Response.json({ error: "inviter_connected" }, { status: 409 });

    const now = new Date().toISOString();

    // === Aktivasi atomik ===
    // updateMany dengan filter status:"pending" memastikan hanya satu permintaan
    // bersamaan yang berhasil mengaktifkan — yang lain mendapat modified=0.
    const result = await base44.asServiceRole.entities.Partnership.updateMany(
      { id: partnership_id, status: "pending" },
      { $set: { invitee_id: me.id, status: "active" } }
    );
    if (!result || !result.modified) {
      return Response.json({ error: "not_pending_or_already_accepted" }, { status: 409 });
    }

    // Batalkan otomatis semua undangan pending lain milik inviter & invitee
    // agar tidak ada dua hubungan aktif yang bisa terbentuk bersamaan.
    const all = await fetchAll(base44.asServiceRole.entities.Partnership);
    const myEmail = (me.email || "").toLowerCase();
    const toCancel = (all || []).filter((x) =>
      x.status === "pending" &&
      x.id !== partnership_id &&
      (
        x.inviter_id === p.inviter_id ||
        (x.invitee_email || "").toLowerCase() === myEmail ||
        x.invitee_id === me.id
      )
    );
    if (toCancel.length) {
      await base44.asServiceRole.entities.Partnership.bulkUpdate(
        toCancel.map((x) => ({
          id: x.id,
          status: "cancelled",
          ended_at: now,
          ended_by: "system",
          end_reason: "auto-cancelled on accept",
        }))
      );
    }

    // === Verifikasi anti-race ===
    // Jika akibat race condition user punya >1 hubungan aktif, batalkan sisanya
    // (pertahankan yang baru saja diaktifkan).
    const myActives = (all || []).filter((x) =>
      x.status === "active" && (x.inviter_id === me.id || x.invitee_id === me.id)
    );
    if (myActives.length > 1) {
      const extras = myActives.filter((x) => x.id !== partnership_id);
      await base44.asServiceRole.entities.Partnership.bulkUpdate(
        extras.map((x) => ({
          id: x.id,
          status: "cancelled",
          ended_at: now,
          ended_by: "system",
          end_reason: "duplicate active resolved",
        }))
      );
    }

    // === Notifikasi lifecycle: beri tahu pengundang bahwa undangan diterima ===
    try {
      const inviteeName = me.full_name || me.email || "Pasangan";
      await notifyPartnershipLifecycle(
        base44,
        p.inviter_id,
        inviteeName,
        "accepted",
        `${inviteeName} menerima undangan Anda`,
        "Kini Anda terhubung dan dapat mencatat bersama.",
        partnership_id
      );
    } catch (e) {
      console.error("[acceptPartnershipInvite] notify failed:", e);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}