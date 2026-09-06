// Helper bersama untuk fungsi notifikasi antar-pasangan.
// Dipakai oleh notifyPartnerTransaction, notifyPartnerAsset, notifyPartnerBulk.
import { resolvePartnerId } from "./partnerResolve.ts";

const formatMoney = (n, cur) => {
  const c = (cur || "IDR").toUpperCase();
  const v = Number(n || 0);
  if (c === "USD") return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (c === "SAR") return "SAR " + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "Rp" + v.toLocaleString("id-ID");
};

// Mask nominal bila preferensi hide_amount aktif.
const maskAmount = (amount, currency, hide) => {
  if (hide) return "•••";
  return formatMoney(amount, currency);
};

// Ambil nama tampilan user.
export async function getActorName(base44, actorId) {
  if (!actorId) return "Pasangan";
  try {
    const u = await base44.asServiceRole.entities.User.get(actorId);
    if (u && (u.full_name || u.email)) return u.full_name || u.email;
  } catch {}
  return "Pasangan";
}

// Ambil preferensi notifikasi user (target/penerima). Null bila belum ada.
export async function getPreference(base44, userId) {
  if (!userId) return null;
  try {
    const list = await base44.asServiceRole.entities.NotificationPreference.filter(
      { created_by_id: userId },
      "-created_date",
      1
    );
    return (list && list[0]) || null;
  } catch {
    return null;
  }
}

// Apakah notifikasi instan harus dilewati?
// true = skip (mute, di bawah ambang, atau daily_digest).
export function shouldSkipInstant(pref, amount) {
  if (!pref) return false;
  if (pref.mute) return true;
  if (pref.daily_digest) return true;
  const min = Number(pref.min_amount || 0);
  if (min > 0 && Number(amount || 0) < min) return true;
  return false;
}

// Buat notifikasi idempoten — cek event_key terlebih dahulu.
export async function createNotificationIdempotent(base44, payload) {
  const { event_key, target_user_id } = payload;
  if (event_key) {
    try {
      const existing = await base44.asServiceRole.entities.Notification.filter(
        { target_user_id, event_key },
        "-created_date",
        1
      );
      if (existing && existing.length > 0) {
        return { skipped: "duplicate", id: existing[0].id };
      }
    } catch {}
  }
  const created = await base44.asServiceRole.entities.Notification.create({
    target_user_id,
    actor_name: payload.actor_name || "Pasangan",
    action: payload.action || "created",
    entity_kind: payload.entity_kind || "transaction",
    event_key: event_key || null,
    title: payload.title,
    body: payload.body || "",
    ref_id: payload.ref_id || null,
    amount: payload.amount ?? null,
    currency: payload.currency || null,
    tx_type: payload.tx_type || null,
    read: false,
  });
  return { created: true, id: created?.id };
}

// Kirim email notifikasi bila channel mencakup email.
export async function maybeSendEmail(base44, pref, email, actorName, title, body) {
  if (!pref) return;
  const channel = pref.channel || "in_app";
  if (channel !== "email" && channel !== "both") return;
  if (!email) return;
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: title,
      body: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:20px;">
        <p style="color:#6366f1;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">NAFKITA &middot; Notifikasi</p>
        <h2 style="margin:8px 0 12px;">${title}</h2>
        <p style="color:#334155;font-size:15px;line-height:1.6;">${body}</p>
        <p style="color:#94a3b8;font-size:12px;margin-top:20px;">— ${actorName} via NAFKITA</p>
      </div>`,
    });
  } catch {}
}

// Resolve pasangan + ambil email pasangan untuk notifikasi email.
export async function resolvePartner(base44, actorId) {
  const partnerId = await resolvePartnerId(base44, actorId);
  if (!partnerId) return { partnerId: null, partnerEmail: null };
  let partnerEmail = null;
  try {
    const u = await base44.asServiceRole.entities.User.get(partnerId);
    partnerEmail = u?.email || null;
  } catch {}
  return { partnerId, partnerEmail };
}

export { formatMoney, maskAmount };