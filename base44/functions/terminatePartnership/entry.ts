import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { getActorName, notifyPartnershipLifecycle } from "../../shared/notifyCommon.ts";

// Mengakhiri Partnership (soft-delete): batalkan undangan, tolak permintaan,
// atau putuskan koneksi aktif. Record dipertahankan dengan status terminal
// + riwayat (ended_at, ended_by, end_reason) untuk audit & pemulihan.
// Admin dapat mengakhiri hubungan apa pun (lewati cek 'involved').
// RLS Partnership update/delete dikunci admin-only, jadi semua mutasi
// lewat service role di sini.
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

    const isAdmin = me.role === "admin";
    const reason = body.end_reason ? String(body.end_reason).trim().slice(0, 200) : "";

    // Admin boleh mengakhiri hubungan apa pun; user biasa harus pihak terlibat.
    if (!isAdmin) {
      const involved =
        p.inviter_id === me.id ||
        p.invitee_id === me.id ||
        (p.invitee_email || "").toLowerCase() === (me.email || "").toLowerCase();
      if (!involved) return Response.json({ error: "forbidden" }, { status: 403 });
    }

    // Tentukan status terminal sesuai konteks.
    let terminalStatus;
    if (p.status === "pending") {
      if (isAdmin || p.inviter_id === me.id) {
        // Inviter membatalkan undangannya sendiri, atau admin membatalkan.
        terminalStatus = "cancelled";
      } else {
        // Invitee menolak permintaan masuk.
        terminalStatus = "declined";
      }
    } else if (p.status === "active") {
      terminalStatus = "ended";
    } else {
      // Sudah terminal — tidak ada perubahan.
      return Response.json({ ok: true, status: p.status, unchanged: true });
    }

    await base44.asServiceRole.entities.Partnership.update(partnership_id, {
      status: terminalStatus,
      ended_at: new Date().toISOString(),
      ended_by: me.id,
      end_reason: reason,
    });

    // === Notifikasi lifecycle pasangan ===
    // Beri tahu pihak lain (bukan pelaku) tentang perubahan status hubungan.
    try {
      const actorName = me.full_name || me.email || "Pasangan";
      const otherId =
        p.inviter_id === me.id ? (p.invitee_id || null) : p.inviter_id;
      // Untuk undangan pending yang belum diaccept, gunakan email jika invitee_id belum ada.
      const targetId = otherId || null;

      let notifAction = terminalStatus;
      let notifTitle = "";
      let notifBody = "";

      if (terminalStatus === "declined") {
        notifTitle = `${actorName} menolak undangan Anda`;
        notifBody = reason ? `Alasan: ${reason}` : "Undangan ditolak.";
      } else if (terminalStatus === "cancelled") {
        // Jika inviter membatalkan, beri tahu invitee. Jika admin, beri tahu pihak terkait.
        notifTitle = `${actorName} membatalkan undangan`;
        notifBody = reason ? `Alasan: ${reason}` : "Undangan dibatalkan.";
      } else if (terminalStatus === "ended") {
        notifTitle = `${actorName} memutuskan koneksi pasangan`;
        notifBody = reason ? `Alasan: ${reason}` : "Hubungan pasangan diputus.";
      }

      if (targetId && notifTitle) {
        await notifyPartnershipLifecycle(
          base44, targetId, actorName, notifAction,
          notifTitle, notifBody, partnership_id
        );
      }
    } catch (e) {
      console.error("[terminatePartnership] notify failed:", e);
    }

    return Response.json({ ok: true, status: terminalStatus });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}