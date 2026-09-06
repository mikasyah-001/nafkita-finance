import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import {
  getActorName, getPreference, shouldSkipInstant, createNotificationIdempotent,
  maybeSendEmail, resolvePartner, formatMoney,
} from "../../shared/notifyCommon.ts";

// Notifikasi untuk pasangan saat aset bersama dibuat, diperbarui, atau dihapus.
// Hanya CRUD aset langsung — perubahan saldo akibat transaksi tidak diberi notifikasi terpisah.
// Dipicu oleh workflow entity trigger pada Asset (create/update/delete).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const assetId = body.asset_id;
    const eventType = body.event_type || "create";
    if (!assetId) return Response.json({ error: "asset_id required" }, { status: 400 });

    // Untuk create/update, re-fetch. Untuk delete, gunakan snapshot.
    let asset = null;
    if (eventType !== "delete") {
      try { asset = await base44.asServiceRole.entities.Asset.get(assetId); } catch {}
    }
    if (!asset) {
      asset = {
        name: body.name,
        type: body.asset_type,
        value: body.value,
        currency: body.currency,
        visibility: body.visibility,
        created_by_id: body.actor_id,
        created_date: body.created_date,
        updated_date: body.updated_date,
      };
    }

    const actorId = asset.created_by_id || body.actor_id;
    if (!actorId) return Response.json({ skipped: "no_actor" });

    // Hanya aset shared yang memicu notifikasi.
    if (asset.visibility !== "shared") return Response.json({ skipped: "not_shared" });

    // Resolve pasangan.
    const { partnerId, partnerEmail } = await resolvePartner(base44, actorId);
    if (!partnerId) return Response.json({ skipped: "no_partner" });

    // Preferensi penerima.
    const pref = await getPreference(base44, partnerId);
    const value = Number(asset.value) || 0;
    // Aset tidak punya ambang nominal (min_amount berlaku untuk transaksi).
    if (pref?.mute) return Response.json({ skipped: "muted" });
    if (pref?.daily_digest) return Response.json({ skipped: "daily_digest" });

    const actorName = await getActorName(base44, actorId);
    const hide = !!pref?.hide_amount;
    const valueStr = hide ? "•••" : formatMoney(value, asset.currency);
    const assetName = asset.name || "Aset";
    const oldValue = body.old_value;
    const oldVisibility = body.old_visibility || null;

    let title = "";
    let bodyText = "";
    let action = "created";

    if (eventType === "create") {
      title = `${actorName} menambahkan aset ${assetName}`;
      bodyText = `${valueStr}`;
      action = "created";
    } else if (eventType === "update") {
      // Jika hanya visibility berubah dari private ke shared, treat as sharing.
      if (oldVisibility === "private" && asset.visibility === "shared") {
        title = `${actorName} membagikan aset ${assetName}`;
        bodyText = `${valueStr}`;
        action = "shared";
      } else if (oldValue != null && Number(oldValue) !== value) {
        const oldStr = hide ? "•••" : formatMoney(Number(oldValue), asset.currency);
        title = `${actorName} memperbarui ${assetName}`;
        bodyText = `${oldStr} → ${valueStr}`;
        action = "updated";
      } else {
        title = `${actorName} memperbarui aset ${assetName}`;
        bodyText = `${valueStr}`;
        action = "updated";
      }
    } else if (eventType === "delete") {
      title = `${actorName} menghapus aset ${assetName}`;
      bodyText = hide ? "•••" : formatMoney(value, asset.currency);
      action = "deleted";
    }

    // Event key untuk idempotensi.
    const versionMarker = eventType === "create" ? (asset.created_date || "") : (asset.updated_date || "");
    const eventKey = `asset:${assetId}:${eventType}:${versionMarker}`;

    const result = await createNotificationIdempotent(base44, {
      target_user_id: partnerId,
      actor_name: actorName,
      action,
      entity_kind: "asset",
      event_key: eventKey,
      title,
      body: bodyText,
      ref_id: assetId,
      amount: value,
    });

    await maybeSendEmail(base44, pref, partnerEmail, actorName, title, bodyText);

    return Response.json({ status: "success", ...result, partner_id: partnerId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}