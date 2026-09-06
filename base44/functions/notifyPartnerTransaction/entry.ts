import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import {
  getActorName, getPreference, shouldSkipInstant, createNotificationIdempotent,
  maybeSendEmail, resolvePartner, formatMoney, maskAmount,
} from "../../shared/notifyCommon.ts";
import { evaluateNotificationRules } from "../../shared/notificationRules.ts";

// Membuat notifikasi untuk pasangan saat transaksi bersama dibuat, diperbarui,
// atau dihapus. Menangani transisi visibility (shared<->private), idempoten
// berdasarkan event_key, dan menghormati preferensi notifikasi penerima.
//
// Tidak memeriksa token workflow — fungsi memvalidasi data entitas.
// Dipicu oleh workflow entity trigger (create/update/delete).
const typeLabel = (t) => (t === "income" ? "pemasukan" : t === "sedekah" ? "sedekah" : "pengeluaran");

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const txId = body.transaction_id;
    const eventType = body.event_type || "create";
    if (!txId) return Response.json({ error: "transaction_id required" }, { status: 400 });

    // Untuk create/update, re-fetch data terbaru. Untuk delete, gunakan snapshot.
    let tx = null;
    if (eventType !== "delete") {
      try { tx = await base44.asServiceRole.entities.Transaction.get(txId); } catch {}
    }
    if (!tx) {
      // Gunakan snapshot dari trigger (terutama untuk delete).
      tx = {
        visibility: body.visibility,
        created_by_id: body.actor_id,
        type: body.tx_type,
        amount: body.amount,
        currency: body.currency,
        category: body.category,
        merchant: body.merchant,
        notes: body.notes,
        notif_batch_id: body.notif_batch_id,
        created_date: body.created_date,
        updated_date: body.updated_date,
      };
      }

      const actorId = tx.created_by_id || body.actor_id;
      if (!actorId) return Response.json({ skipped: "no_actor" });

      // Operasi batch (transfer, tagihan berulang, pelunasan utang, restore Drive)
      // menandai notif_batch_id agar tidak memicu notifikasi individual ke pasangan.
      if (tx.notif_batch_id) return Response.json({ skipped: "batched" });

    const oldVisibility = body.old_visibility || null;
    const newVisibility = tx.visibility;

    // Tentukan jenis notifikasi berdasarkan event & transisi visibility.
    let action = null;
    let titleVerb = "";
    let skip = false;

    if (eventType === "create") {
      if (newVisibility !== "shared") return Response.json({ skipped: "not_shared" });
      action = "created";
      titleVerb = "mencatat";
    } else if (eventType === "update") {
      if (oldVisibility === "private" && newVisibility === "shared") {
        action = "shared";
        titleVerb = "membagikan";
      } else if (oldVisibility === "shared" && newVisibility === "private") {
        action = "unshared";
        titleVerb = "menjadikan pribadi";
      } else if (oldVisibility === "shared" && newVisibility === "shared") {
        action = "updated";
        titleVerb = "memperbarui";
      } else {
        skip = true; // private -> private
      }
    } else if (eventType === "delete") {
      if (newVisibility !== "shared") return Response.json({ skipped: "not_shared" });
      action = "deleted";
      titleVerb = "menghapus";
    }

    if (skip) return Response.json({ skipped: "private_to_private" });

    // Resolve pasangan.
    const { partnerId, partnerEmail } = await resolvePartner(base44, actorId);
    if (!partnerId) return Response.json({ skipped: "no_partner" });

    // Preferensi penerima.
    const pref = await getPreference(base44, partnerId);
    const amount = Number(tx.amount) || 0;
    if (shouldSkipInstant(pref, amount)) return Response.json({ skipped: "preference" });

    // Evaluasi aturan notifikasi kategori/ambang.
    const ruleResult = await evaluateNotificationRules(base44, {
      category: tx.category,
      amount,
      target_user_id: partnerId,
    });
    if (!ruleResult.shouldNotify) return Response.json({ skipped: "notification_rule" });

    // Nama pelaku.
    const actorName = await getActorName(base44, actorId);
    const hide = !!pref?.hide_amount;
    const currency = String(tx.currency || "IDR").toUpperCase();
    const sign = tx.type === "income" ? "+" : "-";
    const label = tx.merchant || tx.notes || (tx.type === "sedekah" ? "Sedekah & Infaq" : tx.category) || "Transaksi";
    const amountStr = maskAmount(amount, currency, hide);

    const title = `${actorName} ${titleVerb} ${typeLabel(tx.type)}`;
    let bodyText = `${sign}${amountStr} • ${label}`;
    if (action === "unshared") bodyText += " — kini pribadi";
    if (action === "shared") bodyText = `${actorName} membagikan transaksi: ${sign}${amountStr} • ${label}`;

    // Event key untuk idempotensi.
    const versionMarker = eventType === "create" ? (tx.created_date || "") : (tx.updated_date || "");
    const eventKey = `tx:${txId}:${eventType}:${versionMarker}`;

    const result = await createNotificationIdempotent(base44, {
      target_user_id: partnerId,
      actor_name: actorName,
      action,
      entity_kind: "transaction",
      event_key: eventKey,
      title,
      body: bodyText,
      ref_id: txId,
      amount,
      currency,
      tx_type: tx.type,
    });

    // Email bila channel mencakup email.
    await maybeSendEmail(base44, pref, partnerEmail, actorName, title, bodyText);

    return Response.json({ status: "success", ...result, partner_id: partnerId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}