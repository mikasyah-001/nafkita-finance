import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { notifyPartnershipLifecycle } from "../../shared/notifyCommon.ts";
import { logAdminAction } from "../../shared/auditLog.ts";

// Penghapusan akun oleh pengguna sendiri (wajib App Store 5.1.1(v) &
// Google Play "Account deletion"). Client SDK tidak menyediakan endpoint
// hapus-diri, jadi seluruhnya dijalankan di sini dengan service role:
//   1. Akhiri semua hubungan pasangan (pending/aktif) + beri tahu pasangan.
//   2. Hapus semua data milik pengguna (created_by_id / owner / target).
//   3. Anonimkan jejak di AuditLog (entri dipertahankan untuk integritas
//      audit, tetapi nama & email dihapus).
//   4. Hapus record User.
// Wajib body { confirm: "HAPUS" } agar tidak terpanggil tanpa sengaja.

// [entity, field kepemilikan]. Urutan: anak dulu, induk belakangan.
const OWNED: Array<[string, string]> = [
  ["InvestmentLot", "created_by_id"],
  ["AssetMutation", "created_by_id"],
  ["AssetMutation", "owner_id"],
  ["AssetSnapshot", "owner_id"],
  ["TransactionApproval", "requester_id"],
  ["TransactionApproval", "approver_id"],
  ["Transaction", "created_by_id"],
  ["Asset", "created_by_id"],
  ["Budget", "created_by_id"],
  ["Category", "created_by_id"],
  ["Debt", "created_by_id"],
  ["RecurringBill", "created_by_id"],
  ["Reconciliation", "created_by_id"],
  ["SavingsGoal", "created_by_id"],
  ["TransactionTemplate", "created_by_id"],
  ["ZakatPayment", "created_by_id"],
  ["NotificationPreference", "created_by_id"],
  ["NotificationRule", "created_by_id"],
  ["Notification", "target_user_id"],
  ["Notification", "created_by_id"],
  ["Feedback", "created_by_id"],
];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (String(body.confirm || "") !== "HAPUS")
      return Response.json({ error: "confirmation_required" }, { status: 400 });

    const svc = base44.asServiceRole.entities;
    const actorName = me.full_name || me.email || "Pasangan";

    // 1. Akhiri hubungan pasangan.
    const email = String(me.email || "").toLowerCase();
    const seen = new Set<string>();
    const partnerships = [];
    for (const q of [{ inviter_id: me.id }, { invitee_id: me.id }, ...(email ? [{ invitee_email: email }] : [])]) {
      try {
        const rows = await svc.Partnership.filter(q, "-created_date", 500);
        for (const p of rows || []) if (!seen.has(p.id)) { seen.add(p.id); partnerships.push(p); }
      } catch (e) { console.error("[deleteMyAccount] list partnership", e); }
    }
    for (const p of partnerships) {
      if (p.status !== "pending" && p.status !== "active") continue;
      const status = p.status === "active" ? "ended" : (p.inviter_id === me.id ? "cancelled" : "declined");
      await svc.Partnership.update(p.id, {
        status,
        ended_at: new Date().toISOString(),
        ended_by: me.id,
        end_reason: "Akun dihapus oleh pemiliknya",
      });
      const otherId = p.inviter_id === me.id ? p.invitee_id : p.inviter_id;
      if (otherId && otherId !== me.id) {
        try {
          await notifyPartnershipLifecycle(
            base44, otherId, actorName, status,
            `${actorName} menghapus akun NAFKITA`,
            "Koneksi pasangan berakhir. Catatan yang dibuat pasangan Anda ikut terhapus.",
            p.id,
          );
        } catch (e) { console.error("[deleteMyAccount] notify", e); }
      }
    }

    // 2. Hapus data milik pengguna.
    const deleted: Record<string, number> = {};
    const failed: string[] = [];
    for (const [entity, field] of OWNED) {
      try {
        // Ulangi sampai habis, berjaga bila server membatasi jumlah per panggilan.
        for (let i = 0; i < 50; i++) {
          const res = await svc[entity].deleteMany({ [field]: me.id });
          const n = Number(res?.deleted) || 0;
          deleted[entity] = (deleted[entity] || 0) + n;
          if (n === 0) break;
        }
      } catch (e) {
        console.error(`[deleteMyAccount] deleteMany ${entity}.${field}`, e);
        failed.push(`${entity}.${field}`);
      }
    }
    if (failed.length) {
      // Data belum bersih → jangan hapus User dulu, agar pengguna bisa mencoba
      // lagi (tanpa akun, sisa data tak lagi bisa dihapus olehnya).
      return Response.json({ error: "partial_failure", failed, deleted }, { status: 500 });
    }

    // 3. Anonimkan AuditLog milik pengguna.
    try {
      await svc.AuditLog.updateMany({ actor_id: me.id }, { $set: { actor_name: "Pengguna terhapus", actor_email: "" } });
    } catch (e) { console.error("[deleteMyAccount] anonymize audit", e); }

    await logAdminAction(base44, {
      actor_id: me.id,
      actor_name: "Pengguna terhapus",
      actor_email: "",
      action: "delete_account",
      target_type: "user",
      target_id: me.id,
      target_label: "",
      details: `Data dihapus: ${Object.entries(deleted).map(([k, v]) => `${k}=${v}`).join(", ")}`,
    });

    // 4. Hapus record User.
    try {
      await svc.User.delete(me.id);
    } catch (e) {
      console.error("[deleteMyAccount] delete user", e);
      // Cadangan: bersihkan profil agar tidak ada data pribadi tersisa.
      try {
        await svc.User.update(me.id, { full_name: "Pengguna terhapus", photo_url: null, account_deleted_at: new Date().toISOString() });
      } catch { /* abaikan */ }
      return Response.json({ error: "user_delete_failed", deleted }, { status: 500 });
    }

    return Response.json({ ok: true, deleted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
