import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { logAdminAction } from "../../shared/auditLog.ts";

// Admin menanggapi umpan balik: ubah status dan/atau kirim balasan.
// Balasan terlihat oleh pengirim di "Laporan saya" + notifikasi in-app
// (dan email bila tersedia). Hanya admin.
const STATUSES = ["open", "in_progress", "resolved", "closed"];
const STATUS_LABEL = { open: "Baru", in_progress: "Sedang diproses", resolved: "Selesai", closed: "Ditutup" };

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (me.role !== "admin") return Response.json({ error: "forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const id = String(body.feedback_id || "");
    if (!id) return Response.json({ error: "missing_id" }, { status: 400 });
    const status = body.status ? String(body.status) : null;
    if (status && !STATUSES.includes(status)) return Response.json({ error: "invalid_status" }, { status: 400 });
    const reply = body.reply != null ? String(body.reply).trim().slice(0, 2000) : null;
    if (!status && !reply) return Response.json({ error: "nothing_to_update" }, { status: 400 });

    let fb;
    try { fb = await base44.asServiceRole.entities.Feedback.get(id); } catch {}
    if (!fb) return Response.json({ error: "not_found" }, { status: 404 });

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {};
    if (status && status !== fb.status) { patch.status = status; patch.status_updated_at = now; }
    if (reply) {
      patch.admin_reply = reply;
      patch.replied_at = now;
      patch.replied_by_name = me.full_name || "Tim NAFKITA";
      // Balasan tanpa status eksplisit → tandai sedang diproses bila masih baru.
      if (!status && fb.status === "open") { patch.status = "in_progress"; patch.status_updated_at = now; }
    }
    if (!Object.keys(patch).length) return Response.json({ ok: true, unchanged: true, feedback: fb });

    const updated = await base44.asServiceRole.entities.Feedback.update(id, patch);

    // Beri tahu pengirim (bukan bila admin melapor ke dirinya sendiri).
    const ownerId = fb.owner_id || fb.created_by_id;
    if (ownerId && ownerId !== me.id) {
      const newStatus = (patch.status as string) || fb.status;
      const title = reply ? `Balasan untuk laporan Anda: ${fb.subject}` : `Laporan Anda: ${STATUS_LABEL[newStatus] || newStatus}`;
      const text = reply ? reply.slice(0, 140) : `Status laporan "${fb.subject}" kini ${STATUS_LABEL[newStatus] || newStatus}.`;
      try {
        await base44.asServiceRole.entities.Notification.create({
          target_user_id: ownerId,
          actor_name: "Tim NAFKITA",
          action: "updated",
          entity_kind: "feedback",
          event_key: `feedback:${id}:${reply ? "reply" : "status"}:${now}`,
          title,
          body: text,
          ref_id: id,
          read: false,
        });
      } catch (e) { console.error("[respondFeedback] notify", e); }
      // Pakai email akun dari platform (created_by), bukan sender_email yang bisa
      // diisi sembarang bila record dibuat langsung oleh klien.
      const to = fb.owner_email || fb.created_by || "";
      if (reply && to) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to,
            subject: `[NAFKITA] Balasan: ${fb.subject}`,
            body: [`Assalamu'alaikum ${fb.sender_name || ""},`.trim(), "", "Terima kasih atas laporan Anda. Balasan dari tim NAFKITA:", "", reply, "", `Status: ${STATUS_LABEL[newStatus] || newStatus}`, "", "Lihat di aplikasi: Lainnya → Umpan Balik → Laporan saya."].join("\n"),
          });
        } catch (e) { console.error("[respondFeedback] email", e); }
      }
    }

    await logAdminAction(base44, {
      actor_id: me.id, actor_name: me.full_name || me.email, actor_email: me.email,
      action: reply ? "feedback_reply" : "feedback_status",
      target_type: "feedback", target_id: id, target_label: fb.subject,
      details: [patch.status ? `Status → ${STATUS_LABEL[patch.status as string]}` : "", reply ? "Membalas" : ""].filter(Boolean).join(" · "),
    });

    return Response.json({ ok: true, feedback: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
