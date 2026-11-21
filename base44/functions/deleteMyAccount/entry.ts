import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { notifyPartnershipLifecycle } from "../../shared/notifyCommon.ts";
import { logAdminAction } from "../../shared/auditLog.ts";
import { fetchAll } from "../../shared/fetchAll.ts";

// Penghapusan akun oleh pengguna sendiri (wajib App Store 5.1.1(v) &
// Google Play "Account deletion"). Client SDK tidak menyediakan endpoint
// hapus-diri, jadi seluruhnya dijalankan di sini dengan service role:
//   1. Bila ada pasangan aktif: catatan BERSAMA (visibility "shared") milik
//      pengguna dipindahkan ke pasangan — nama penginput dianonimkan — agar
//      riwayat keuangan rumah tangga tidak hilang. Catatan pribadi dihapus.
//   2. Akhiri semua hubungan pasangan (pending/aktif) + beri tahu pasangan.
//   3. Hapus semua data milik pengguna yang tersisa (created_by_id / owner / target).
//   4. Anonimkan jejak di AuditLog (entri dipertahankan untuk integritas
//      audit, tetapi nama & email dihapus).
//   5. Hapus record User.
// Wajib body { confirm: "HAPUS" } agar tidak terpanggil tanpa sengaja.

// Entitas berfield visibility yang dipindahkan ke pasangan bila "shared".
// Transaction & Asset ditangani khusus (status persetujuan, lot, mutasi).
const SHARED_SIMPLE = ["Budget", "Debt", "RecurringBill", "SavingsGoal"];
const ANON_NAME = "Pasangan (akun dihapus)";

// [entity, field kepemilikan]. Urutan: anak dulu, induk belakangan.
const OWNED: Array<[string, string]> = [
  ["IncomingTransaction", "owner_id"],
  ["CardLabel", "owner_id"],
  ["IngestDevice", "owner_id"],
  ["InvestmentLot", "created_by_id"],
  ["AssetMutation", "created_by_id"],
  ["AssetMutation", "owner_id"],
  ["AssetSnapshot", "owner_id"],
  ["TransactionApproval", "requester_id"],
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

    // Kumpulkan hubungan pasangan.
    const email = String(me.email || "").toLowerCase();
    const seen = new Set<string>();
    const partnerships = [];
    for (const q of [{ inviter_id: me.id }, { invitee_id: me.id }, ...(email ? [{ invitee_email: email }] : [])]) {
      try {
        const rows = await svc.Partnership.filter(q, "-created_date", 500);
        for (const p of rows || []) if (!seen.has(p.id)) { seen.add(p.id); partnerships.push(p); }
      } catch (e) { console.error("[deleteMyAccount] list partnership", e); }
    }
    // 1. Pindahkan catatan bersama ke pasangan aktif.
    const active = partnerships.find((p) => p.status === "active" && (p.inviter_id === me.id || p.invitee_id === me.id));
    const partnerId = active ? (active.inviter_id === me.id ? active.invitee_id : active.inviter_id) : null;
    let transferred: Record<string, number> = {};
    if (partnerId && partnerId !== me.id) {
      const result = await transferSharedToPartner(base44, me.id, partnerId);
      if (!result.ok) return Response.json({ error: result.error, transferred: result.transferred }, { status: 500 });
      transferred = result.transferred;
    }

    // 2. Akhiri hubungan pasangan.
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
            "Koneksi pasangan berakhir. Catatan bersama yang ia buat kini tersimpan di akun Anda; catatan pribadinya dihapus.",
            p.id,
          );
        } catch (e) { console.error("[deleteMyAccount] notify", e); }
      }
    }

    // 3. Hapus data milik pengguna yang tersisa (catatan pribadi).
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

    // 4. Anonimkan AuditLog milik pengguna.
    try {
      // Query memuat actor_email agar berhenti cocok setelah dibersihkan
      // (updateMany bekerja per batch).
      if (me.email) {
        for (let i = 0; i < 500; i++) {
          const res = await svc.AuditLog.updateMany(
            { actor_id: me.id, actor_email: me.email },
            { $set: { actor_name: "Pengguna terhapus", actor_email: "" } },
          );
          if (!res?.has_more) break;
        }
      }
    } catch (e) { console.error("[deleteMyAccount] anonymize audit", e); }

    await logAdminAction(base44, {
      actor_id: me.id,
      actor_name: "Pengguna terhapus",
      actor_email: "",
      action: "delete_account",
      target_type: "user",
      target_id: me.id,
      target_label: "",
      details: `Dipindah ke pasangan: ${Object.entries(transferred).map(([k, v]) => `${k}=${v}`).join(", ") || "-"} · Data dihapus: ${Object.entries(deleted).map(([k, v]) => `${k}=${v}`).join(", ")}`,
    });

    // 5. Hapus record User.
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

    return Response.json({ ok: true, deleted, transferred });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}


// Memindahkan kepemilikan catatan bersama ke pasangan. created_by_id adalah
// field bawaan server; sebelum memindahkan massal, satu record diuji dulu
// (probe) — bila server menolak mengubahnya, proses dihentikan SEBELUM ada
// data yang dihapus, sehingga tidak ada riwayat yang hilang diam-diam.
async function transferSharedToPartner(base44, meId: string, partnerId: string) {
  const svc = base44.asServiceRole.entities;
  const transferred: Record<string, number> = {};
  let partnerEmail: string | null = null;
  try { partnerEmail = (await svc.User.get(partnerId))?.email || null; } catch { /* opsional */ }
  const owner = partnerEmail ? { created_by_id: partnerId, created_by: partnerEmail } : { created_by_id: partnerId };

  // Probe: pastikan server mengizinkan perubahan pemilik.
  // Transaksi yang menunggu/ditolak tidak dipakai sebagai probe karena
  // tidak akan dipindahkan.
  const entities = ["Transaction", "Asset", ...SHARED_SIMPLE];
  const movable = (r) => r && r.approval_status !== "pending" && r.approval_status !== "rejected";
  let probe: { entity: string; id: string } | null = null;
  for (const entity of entities) {
    const rows = await svc[entity].filter({ created_by_id: meId, visibility: "shared" }, "-created_date", 25).catch(() => []);
    const row = (rows || []).find(movable);
    if (row) { probe = { entity, id: row.id }; break; }
  }
  if (!probe) return { ok: true, transferred }; // tidak ada catatan bersama
  try {
    await svc[probe.entity].update(probe.id, owner);
    const check = await svc[probe.entity].get(probe.id);
    if (check?.created_by_id !== partnerId) return { ok: false, error: "transfer_unsupported", transferred };
    transferred[probe.entity] = 1;
    if (probe.entity === "Transaction") await svc.Transaction.update(probe.id, { input_by_name: ANON_NAME });
  } catch (e) {
    console.error("[deleteMyAccount] probe", e);
    return { ok: false, error: "transfer_unsupported", transferred };
  }

  // updateMany bekerja per batch (has_more) → ulangi sampai habis. Syarat:
  // query harus berhenti cocok setelah diperbarui (mis. memuat field yang
  // diubah), kalau tidak batch yang sama terus diproses ulang.
  const updateAll = async (entity: string, query: Record<string, unknown>, set: Record<string, unknown>) => {
    let n = 0;
    for (let i = 0; i < 500; i++) {
      const res = await svc[entity].updateMany(query, { $set: set });
      n += Number(res?.updated) || 0;
      if (!res?.has_more) break;
    }
    return n;
  };
  const move = async (entity: string, query: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    transferred[entity] = (transferred[entity] || 0) + await updateAll(entity, query, { ...owner, ...extra });
  };

  try {
    // Transaksi bersama yang belum/tidak disetujui bukan bagian buku rumah
    // tangga — tidak dipindahkan (ikut terhapus bersama data pribadi).
    for (const status of ["pending", "rejected"]) {
      await svc.Transaction.deleteMany({ created_by_id: meId, visibility: "shared", approval_status: status });
    }

    // Aset bersama: catat id-nya dulu untuk memindahkan lot & mutasinya.
    const sharedAssets = await fetchAll(svc.Asset, { created_by_id: meId, visibility: "shared" });
    await move("Transaction", { created_by_id: meId, visibility: "shared" }, { input_by_name: ANON_NAME });
    await move("Asset", { created_by_id: meId, visibility: "shared" });
    for (const a of sharedAssets) {
      await move("InvestmentLot", { asset_id: a.id, created_by_id: meId });
      await move("AssetMutation", { asset_id: a.id, owner_id: meId }, { owner_id: partnerId });
    }
    for (const entity of SHARED_SIMPLE) await move(entity, { created_by_id: meId, visibility: "shared" });

    // Jejak nama pengguna pada mutasi aset milik pasangan.
    await updateAll("AssetMutation", { actor_id: meId }, { actor_id: null, actor_name: ANON_NAME }).catch(() => {});

    // Tautan ke aset pribadi (yang akan dihapus) dilepas agar tidak menggantung.
    const privateAssets = await fetchAll(svc.Asset, { created_by_id: meId });
    for (const a of privateAssets) {
      for (const entity of ["Transaction", "SavingsGoal", "RecurringBill"]) {
        await updateAll(entity, { linked_asset_id: a.id, created_by_id: partnerId }, { linked_asset_id: null }).catch(() => {});
      }
    }
  } catch (e) {
    console.error("[deleteMyAccount] transfer", e);
    return { ok: false, error: "transfer_failed", transferred };
  }

  // Verifikasi: tidak boleh ada catatan bersama yang tertinggal (akan
  // ikut terhapus). Bila ada, hentikan; pemindahan bersifat idempoten
  // sehingga pengguna bisa mencoba lagi.
  for (const entity of entities) {
    const left = await svc[entity].filter({ created_by_id: meId, visibility: "shared" }, "-created_date", 1).catch(() => null);
    if (left === null || left.length) return { ok: false, error: `transfer_incomplete:${entity}`, transferred };
  }
  return { ok: true, transferred };
}

