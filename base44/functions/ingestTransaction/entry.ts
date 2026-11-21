import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import {
  normalizeLabel, parseAmount, detectCurrency, parseOccurredAt, suggestCategory,
  isDuplicate, reviewReason, extractToken, looksLikeToken,
} from "../../shared/autoIngest.js";

// Endpoint publik untuk "Catat Otomatis" — dipanggil Shortcuts iOS (pemicu
// Wallet/Transaction) lewat aksi "Get Contents of URL", TANPA sesi login.
//
// Autentikasi: header "Authorization: Bearer nfk_…" (token per perangkat,
// dibuat di manageAutoIngest; disimpan sebagai hash SHA-256).
//
// Body JSON:
//   { label: "rajhi-harian", amount: "SAR 12.50", merchant: "Panda",
//     card?: "Al Rajhi Visa", occurred_at?: ISO, ping?: true }
//
// Aturan pencatatan:
//   - Label harus dipetakan ke aset milik pemilik token (CardLabel status active).
//   - Label tak dikenal → dicatat sebagai "unmapped" (HANYA labelnya, nominal &
//     merchant TIDAK disimpan) agar pengguna bisa memetakannya.
//   - Hasil masuk ke IncomingTransaction (kotak masuk), bukan Transaction —
//     saldo & laporan baru berubah setelah pengguna mengonfirmasi.
//
// Token hanya bisa menambah item kotak masuk; tidak bisa membaca data apa pun.

const RATE_LIMIT_PER_MIN = 30;

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const first = (res) => (res?.items || res || [])[0] || null;
const list = (res) => res?.items || res || [];
const reply = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

export default async function (req) {
  try {
    if (req.method && req.method !== "POST") return reply(405, { ok: false, message: "Gunakan POST" });
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;

    const body = await req.json().catch(() => ({}));
    const token = extractToken(req.headers?.get?.("authorization"), body);
    if (!looksLikeToken(token)) return reply(401, { ok: false, message: "Token tidak valid" });

    const device = first(await db.IngestDevice.filter({ token_hash: await sha256Hex(token) }, "-created_date", 1));
    if (!device || device.revoked) return reply(401, { ok: false, message: "Token tidak valid atau sudah dicabut" });
    const ownerId = device.owner_id;
    const nowIso = new Date().toISOString();

    // Pembatasan laju sederhana per perangkat per menit.
    const minute = nowIso.slice(0, 16);
    const count = device.rate_window === minute ? (Number(device.rate_count) || 0) + 1 : 1;
    await db.IngestDevice.update(device.id, { last_used_at: nowIso, rate_window: minute, rate_count: count });
    if (count > RATE_LIMIT_PER_MIN) return reply(429, { ok: false, message: "Terlalu banyak permintaan, coba lagi sebentar" });

    if (body?.ping) return reply(200, { ok: true, result: "connected", message: `Terhubung: ${device.name}` });

    const label = normalizeLabel(body?.label);
    if (!label) return reply(400, { ok: false, message: "Label kosong — isi label kartu di shortcut" });

    // --- Label → aset ---
    const link = first(await db.CardLabel.filter({ owner_id: ownerId, label }, "-created_date", 1));
    const touch = (l) => db.CardLabel.update(l.id, { last_seen_at: nowIso, seen_count: (Number(l.seen_count) || 0) + 1 });

    if (!link) {
      // Batasi jumlah label tercatat agar token bocor tidak bisa membanjiri daftar.
      const known = list(await db.CardLabel.filter({ owner_id: ownerId }, "-created_date", 31));
      if (known.length >= 30) return reply(202, { ok: true, result: "unknown_label", message: `Label "${label}" belum terhubung` });
      await db.CardLabel.create({ owner_id: ownerId, label, status: "unmapped", last_seen_at: nowIso, seen_count: 1 });
      return reply(202, { ok: true, result: "unknown_label", message: `Label "${label}" belum terhubung. Hubungkan di Nafkita → Catat Otomatis.` });
    }
    if (link.status !== "active") {
      await touch(link);
      const msg = link.status === "unmapped" ? `Label "${label}" belum terhubung ke rekening`
        : link.status === "paused" ? `Label "${label}" sedang dijeda` : `Label "${label}" diabaikan`;
      return reply(202, { ok: true, result: link.status, message: msg });
    }

    const asset = link.asset_id ? await db.Asset.get(link.asset_id).catch(() => null) : null;
    if (!asset || asset.created_by_id !== ownerId) {
      // Aset terhapus / bukan milik pemilik → kembalikan ke "unmapped".
      await db.CardLabel.update(link.id, { status: "unmapped", asset_id: null, last_seen_at: nowIso });
      return reply(202, { ok: true, result: "unmapped", message: `Rekening untuk label "${label}" tidak ditemukan` });
    }
    await touch(link);

    // --- Data transaksi ---
    const rawAmount = body?.amount == null ? "" : String(body.amount).slice(0, 64);
    const amount = parseAmount(body?.amount);
    const merchant = String(body?.merchant ?? "").trim().slice(0, 120);
    const occurredAt = parseOccurredAt(body?.occurred_at);
    const rawCurrency = detectCurrency(body?.amount);
    const currency = asset.currency || "IDR";
    const candidate = { label, amount, merchant, occurred_at: occurredAt };

    const recent = list(await db.IncomingTransaction.filter({ owner_id: ownerId, label }, "-occurred_at", 20));
    if (isDuplicate(candidate, recent)) {
      return reply(200, { ok: true, result: "duplicate", message: "Transaksi ini sudah tercatat" });
    }

    let suggested = null;
    if (merchant) {
      try {
        const history = list(await db.Transaction.filter({ created_by_id: ownerId, type: "expense" }, "-date", 300));
        suggested = suggestCategory(merchant, history);
      } catch (e) {
        console.error("[ingestTransaction] riwayat kategori", e?.message);
      }
    }

    await db.IncomingTransaction.create({
      owner_id: ownerId,
      device_id: device.id,
      label,
      asset_id: asset.id,
      amount,
      currency,
      raw_amount: rawAmount,
      raw_currency: rawCurrency || undefined,
      merchant,
      card_name: String(body?.card ?? "").slice(0, 80) || undefined,
      occurred_at: occurredAt,
      suggested_category: suggested || undefined,
      review_reason: reviewReason({ amount, merchant, rawCurrency, assetCurrency: currency }) || undefined,
      source: "apple_pay",
      status: "new",
    });

    return reply(201, { ok: true, result: "queued", message: `Masuk ke Nafkita: ${merchant || "transaksi"} (${asset.name})` });
  } catch (error) {
    console.error("[ingestTransaction]", error?.message);
    return reply(500, { ok: false, message: "Gagal memproses, coba lagi" });
  }
}
