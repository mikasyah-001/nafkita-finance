import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { normalizeLabel } from "../../shared/autoIngest.js";
import { CARD_KINDS, CARD_NETWORKS, CARD_STATUSES, toLast4, validExpiry, containsSensitiveCardData, cardAssetAllowed } from "../../shared/cards.js";

// Dompet kartu (wajib login). Semua penulisan PaymentCard / PaymentCardSecret /
// CardVault lewat function ini (RLS create/update/delete = admin).
//
// Keamanan:
//  - Nomor lengkap, CVC/CVV, PIN ATM & OTP TIDAK pernah diterima/disimpan:
//    hanya 4 digit terakhir; kolom teks bebas ditolak bila tampak berisi
//    nomor kartu/CVC.
//  - Detail (masa berlaku, nama di kartu, foto) disimpan di PaymentCardSecret
//    (RLS admin) dan hanya keluar lewat "reveal" dengan token buka hasil PIN.
//  - PIN Nafkita: PBKDF2-SHA256 + garam; 5x salah → terkunci 15 menit (naik
//    berlipat tiap kali terkunci lagi, maks. 24 jam); percobaan dicatat atomik
//    sebelum PIN dicek; token buka berlaku 3 menit.
//  - photo_uri hanya diterima dalam bentuk id file privat yang wajar (bukan URL).
//
// Aksi: save_card, delete_card, pin_status, set_pin, unlock, lock,
//       save_details, reveal, migrate_labels

const PBKDF2_ITER = 150_000;
const MAX_FAILS = 5;
const LOCK_MIN = 15;
const UNLOCK_MIN = 3;
const MAX_CARDS = 40;

const enc = new TextEncoder();
const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
const randomHex = (n = 32) => hex(crypto.getRandomValues(new Uint8Array(n)));
async function sha256(text) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(text))); }
async function pbkdf2(pin, saltHex) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITER }, key, 256));
}
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const list = (res) => res?.items || res || [];
// Id file privat (hasil UploadPrivateFile): tanpa spasi, bukan URL/skema (http:, data:, javascript:), tanpa "..".
const isPrivateFileUri = (u) => typeof u === "string" && u.length <= 1024 && /^\S+$/.test(u) && !/^(https?|javascript|data|vbscript|file):/i.test(u) && !u.includes("..");
const err = (status, error, message) => Response.json({ error, message }, { status });

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch { /* tanpa sesi */ }
    if (!me) return err(401, "unauthorized");
    const svc = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    const ownCard = async (id) => {
      if (!id) return null;
      const c = await svc.PaymentCard.get(id).catch(() => null);
      return c && c.owner_id === me.id ? c : null;
    };
    const vaultOf = async () => list(await svc.CardVault.filter({ owner_id: me.id }, "-created_date", 1))[0] || null;
    const requireUnlocked = async (token) => {
      const v = await vaultOf();
      if (!v?.unlock_hash || !token) return null;
      if (!v.unlock_expires || new Date(v.unlock_expires) < new Date()) return null;
      return safeEqual(await sha256(String(token)), v.unlock_hash) ? v : null;
    };

    // ---------- Kartu ----------
    if (action === "save_card") {
      const c = body.card || {};
      const name = String(c.display_name || "").trim().slice(0, 50);
      if (!name) return err(400, "invalid", "Nama kartu wajib diisi");
      for (const f of [c.display_name, c.issuer]) {
        if (containsSensitiveCardData(f)) return err(400, "sensitive", "Jangan menulis nomor kartu lengkap atau CVC. Cukup 4 digit terakhir.");
      }
      const kind = CARD_KINDS.includes(c.kind) ? c.kind : "debit";
      const network = CARD_NETWORKS.includes(c.network) ? c.network : "lainnya";
      const status = CARD_STATUSES.includes(c.status) && c.status !== "unmapped" ? c.status : "active";
      const last4 = toLast4(c.last4);

      let asset = null;
      if (c.asset_id) {
        asset = await svc.Asset.get(c.asset_id).catch(() => null);
        if (!asset || asset.created_by_id !== me.id) return err(403, "asset_forbidden", "Pilih rekening milik Anda sendiri");
      }
      // Rekening wajib hanya untuk kartu yang dicatat otomatis (kecuali kredit);
      // kartu yang dijeda/diabaikan boleh disimpan tanpa rekening.
      if (asset ? !cardAssetAllowed(kind, asset) : (status === "active" && kind !== "credit")) {
        return err(400, "asset_type", kind === "debit" ? "Kartu debit harus terhubung ke rekening bank" : "Jenis rekening tidak cocok untuk kartu ini");
      }
      const label = normalizeLabel(c.wallet_label);
      if (label) {
        const clash = list(await svc.PaymentCard.filter({ owner_id: me.id, wallet_label: label }, "-created_date", 5)).find((x) => x.id !== c.id);
        if (clash && clash.status !== "unmapped") return err(409, "label_exists", `Label "${label}" sudah dipakai kartu "${clash.display_name}"`);
        if (clash) await svc.PaymentCard.delete(clash.id); // kartu terdeteksi otomatis digabung ke kartu ini
      }
      const data = { display_name: name, kind, network, issuer: String(c.issuer || "").trim().slice(0, 40), last4, asset_id: asset?.id || null, wallet_label: label || null, status, color: String(c.color || "").slice(0, 20) };
      if (c.id) {
        const existing = await ownCard(c.id);
        if (!existing) return err(404, "not_found");
        return Response.json({ ok: true, card: await svc.PaymentCard.update(existing.id, data) });
      }
      const count = list(await svc.PaymentCard.filter({ owner_id: me.id }, "-created_date", MAX_CARDS + 1)).length;
      if (count >= MAX_CARDS) return err(400, "limit", `Maksimal ${MAX_CARDS} kartu`);
      return Response.json({ ok: true, card: await svc.PaymentCard.create({ owner_id: me.id, seen_count: 0, has_photo: false, has_details: false, ...data }) });
    }

    if (action === "set_status") {
      const card = await ownCard(body.card_id);
      if (!card) return err(404, "not_found");
      if (!["active", "paused", "ignored"].includes(body.status)) return err(400, "invalid");
      if (body.status === "active" && !card.asset_id && card.kind !== "credit") return err(400, "asset_required", "Hubungkan kartu ke rekening dulu");
      return Response.json({ ok: true, card: await svc.PaymentCard.update(card.id, { status: body.status }) });
    }

    if (action === "delete_card") {
      const card = await ownCard(body.card_id);
      if (!card) return err(404, "not_found");
      for (const s of list(await svc.PaymentCardSecret.filter({ card_id: card.id, owner_id: me.id }, "-created_date", 5))) await svc.PaymentCardSecret.delete(s.id);
      await svc.PaymentCard.delete(card.id);
      return Response.json({ ok: true });
    }

    // ---------- PIN ----------
    if (action === "pin_status") {
      const v = await vaultOf();
      const locked = v?.locked_until && new Date(v.locked_until) > new Date();
      return Response.json({ ok: true, has_pin: !!v?.pin_hash, locked_until: locked ? v.locked_until : null });
    }

    if (action === "set_pin") {
      const pin = String(body.pin || "");
      if (!/^\d{6}$/.test(pin)) return err(400, "invalid_pin", "PIN harus 6 angka");
      if (/^(\d)\1{5}$/.test(pin) || ["123456", "654321", "012345"].includes(pin)) return err(400, "weak_pin", "PIN terlalu mudah ditebak");
      const v = await vaultOf();
      // Mengganti PIN yang sudah ada butuh token buka (PIN lama sudah dimasukkan).
      if (v?.pin_hash && !(await requireUnlocked(body.unlock_token))) return err(403, "locked", "Masukkan PIN lama dulu");
      const salt = randomHex(16);
      const data = { pin_hash: await pbkdf2(pin, salt), pin_salt: salt, fail_count: 0, locked_until: null, unlock_hash: null, unlock_expires: null };
      if (v) await svc.CardVault.update(v.id, data); else await svc.CardVault.create({ owner_id: me.id, ...data });
      return Response.json({ ok: true });
    }

    if (action === "unlock") {
      let v = await vaultOf();
      if (!v?.pin_hash) return err(400, "no_pin", "Buat PIN dulu");
      if (v.locked_until && new Date(v.locked_until) > new Date())
        return err(429, "locked", `Terlalu banyak percobaan. Coba lagi setelah ${new Date(v.locked_until).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}.`);
      // Vault lama tanpa angka fail_count → set 0 dulu agar bisa dipakai sebagai kunci CAS.
      if (typeof v.fail_count !== "number") v = await svc.CardVault.update(v.id, { fail_count: 0 });
      // Reservasi percobaan secara atomik SEBELUM PIN dicek: permintaan paralel
      // dengan fail_count yang sama hanya satu yang lolos, sehingga batas 5x
      // tidak bisa dilewati dengan menebak serentak.
      const prev = Number(v.fail_count) || 0;
      const claim = await svc.CardVault.updateMany({ id: v.id, fail_count: prev }, { $set: { fail_count: prev + 1 } });
      if (!(Number(claim?.updated ?? claim?.modified ?? 0) > 0)) return err(429, "busy", "Percobaan lain sedang diproses. Coba lagi.");
      const fails = prev + 1;
      const ok = safeEqual(await pbkdf2(String(body.pin || ""), v.pin_salt), v.pin_hash);
      if (!ok) {
        if (fails >= MAX_FAILS) {
          // Kunci progresif: 15 mnt, 30, 60, … maks. 24 jam (direset saat PIN benar).
          const lockCount = (Number(v.lock_count) || 0) + 1;
          const minutes = Math.min(LOCK_MIN * 2 ** (lockCount - 1), 24 * 60);
          await svc.CardVault.update(v.id, { fail_count: 0, lock_count: lockCount, locked_until: new Date(Date.now() + minutes * 60000).toISOString(), unlock_hash: null, unlock_expires: null });
          return err(403, "wrong_pin", `PIN salah ${MAX_FAILS}x. Terkunci ${minutes >= 60 ? `${Math.round(minutes / 60)} jam` : `${minutes} menit`}.`);
        }
        return err(403, "wrong_pin", `PIN salah (${MAX_FAILS - fails} percobaan lagi)`);
      }
      const token = randomHex(32);
      const expires = new Date(Date.now() + UNLOCK_MIN * 60000).toISOString();
      await svc.CardVault.update(v.id, { fail_count: 0, lock_count: 0, locked_until: null, unlock_hash: await sha256(token), unlock_expires: expires });
      return Response.json({ ok: true, unlock_token: token, expires_at: expires });
    }

    if (action === "lock") {
      const v = await vaultOf();
      if (v) await svc.CardVault.update(v.id, { unlock_hash: null, unlock_expires: null });
      return Response.json({ ok: true });
    }

    // ---------- Detail terkunci ----------
    if (action === "save_details") {
      if (!(await requireUnlocked(body.unlock_token))) return err(403, "locked", "Buka dengan PIN dulu");
      const card = await ownCard(body.card_id);
      if (!card) return err(404, "not_found");
      const d = body.details || {};
      // photo_uri harus hasil UploadPrivateFile (id file privat), bukan URL/path sembarang.
      if (d.photo_uri && !isPrivateFileUri(d.photo_uri)) return err(400, "invalid_photo", "Foto kartu tidak valid. Unggah ulang.");
      if (containsSensitiveCardData(d.holder_name)) return err(400, "sensitive", "Jangan menulis nomor kartu atau CVC");
      const hasExp = d.exp_month || d.exp_year;
      if (hasExp && !validExpiry(d.exp_month, d.exp_year)) return err(400, "invalid_expiry", "Masa berlaku tidak valid (bulan 1–12, tahun mis. 29 atau 2029)");
      const year = hasExp ? (Number(d.exp_year) < 100 ? 2000 + Number(d.exp_year) : Number(d.exp_year)) : null;
      const data = {
        exp_month: hasExp ? Number(d.exp_month) : null,
        exp_year: year,
        holder_name: String(d.holder_name || "").trim().slice(0, 40) || null,
        ...(d.photo_uri !== undefined ? { photo_uri: d.photo_uri ? String(d.photo_uri) : null } : {}),
      };
      const existing = list(await svc.PaymentCardSecret.filter({ card_id: card.id, owner_id: me.id }, "-created_date", 1))[0];
      const saved = existing ? await svc.PaymentCardSecret.update(existing.id, data) : await svc.PaymentCardSecret.create({ owner_id: me.id, card_id: card.id, ...data });
      const merged = { ...existing, ...saved, ...data };
      await svc.PaymentCard.update(card.id, { has_photo: !!merged.photo_uri, has_details: !!(merged.exp_month || merged.holder_name || merged.photo_uri) });
      return Response.json({ ok: true });
    }

    if (action === "reveal") {
      if (!(await requireUnlocked(body.unlock_token))) return err(403, "locked", "Buka dengan PIN dulu");
      const card = await ownCard(body.card_id);
      if (!card) return err(404, "not_found");
      const s = list(await svc.PaymentCardSecret.filter({ card_id: card.id, owner_id: me.id }, "-created_date", 1))[0];
      let photo_url = null;
      if (s?.photo_uri) {
        try { photo_url = (await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: s.photo_uri, expires_in: 120 }))?.signed_url || null; }
        catch (e) { console.error("[manageCards] signed url", e?.message); }
      }
      return Response.json({ ok: true, details: s ? { exp_month: s.exp_month, exp_year: s.exp_year, holder_name: s.holder_name, photo_url } : {} });
    }

    // ---------- Migrasi label Catat Otomatis lama (CardLabel → PaymentCard) ----------
    if (action === "migrate_labels") {
      const labels = list(await svc.CardLabel.filter({ owner_id: me.id }, "-created_date", 100));
      const cards = list(await svc.PaymentCard.filter({ owner_id: me.id }, "-created_date", 200));
      let migrated = 0;
      for (const l of labels) {
        if (cards.some((c) => c.wallet_label === l.label)) continue;
        const asset = l.asset_id ? await svc.Asset.get(l.asset_id).catch(() => null) : null;
        await svc.PaymentCard.create({
          owner_id: me.id, display_name: asset ? `${asset.name} (${l.label})` : l.label, kind: "debit", network: "lainnya",
          asset_id: asset?.created_by_id === me.id ? asset.id : null, wallet_label: l.label,
          status: asset?.created_by_id === me.id ? l.status : (l.status === "ignored" ? "ignored" : "unmapped"),
          last_seen_at: l.last_seen_at || null, seen_count: l.seen_count || 0, has_photo: false, has_details: false,
        });
        migrated++;
      }
      return Response.json({ ok: true, migrated });
    }

    return err(400, "unknown_action");
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
