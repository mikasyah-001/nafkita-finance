import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import {
  normalizeLabel, parseAmount, detectCurrency, parseOccurredAt, suggestCategory,
  isDuplicate, reviewReason, extractToken, looksLikeToken, keywordCategory,
} from "../../shared/autoIngest.js";

// Endpoint publik untuk "Catat Otomatis" — dipanggil Shortcuts iOS (pemicu
// Wallet/Transaction) lewat aksi "Get Contents of URL", TANPA sesi login.
//
// Autentikasi: header "Authorization: Bearer nfk_…" (token per perangkat,
// dibuat di manageAutoIngest; disimpan sebagai hash SHA-256).
//
// Body JSON:
//   { label?: "rajhi-harian", amount: "SAR 12.50", merchant: "Panda",
//     card?: "Al Rajhi Visa", occurred_at?: ISO, ping?: true }
//   label kosong → nama kartu (card) dipakai sebagai label.
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

    // Label opsional: shortcut siap pakai ("Kirim ke Nafkita") tidak mengirim
    // label, jadi nama kartu dari Wallet dipakai sebagai label (mis.
    // "Classic Debit Card" → "classic-debit-card"). Kartu baru muncul di
    // Nafkita sebagai "Belum terhubung" untuk dihubungkan sekali.
    const label = normalizeLabel(body?.label) || normalizeLabel(body?.card);
    if (!label) return reply(400, { ok: false, message: "Label & nama kartu kosong — kirim label atau Input Pintasan → Kartu" });

    // --- Label → aset ---
    const link = first(await db.CardLabel.filter({ owner_id: ownerId, label }, "-created_date", 1));
    const touch = (l) => db.CardLabel.update(l.id, { last_seen_at: nowIso, seen_count: (Number(l.seen_count) || 0) + 1 });

    if (!link) {
      // Batasi jumlah label tercatat agar token bocor tidak bisa membanjiri daftar.
      const known = list(await db.CardLabel.filter({ owner_id: ownerId }, "-created_date", 31));
      if (known.length >= 30) return reply(202, { ok: true, result: "unknown_label", message: "Label belum terhubung" });
      await db.CardLabel.create({ owner_id: ownerId, label, status: "unmapped", last_seen_at: nowIso, seen_count: 1 });
      return reply(202, { ok: true, result: "unknown_label", message: "Label belum terhubung. Hubungkan di Nafkita → Catat Otomatis." });
    }
    // Respons sengaja generik: token hanya untuk MENGIRIM, tidak boleh
    // membocorkan nama rekening atau status label ke pemegang token.
    if (link.status !== "active") {
      await touch(link);
      return reply(202, { ok: true, result: "not_recorded", message: "Tidak dicatat (label tidak aktif)" });
    }

    // Bedakan "aset benar-benar tidak ada" dari gangguan sementara: hanya yang
    // pertama yang boleh memutus pemetaan label.
    let asset = null;
    if (link.asset_id) {
      try {
        asset = await db.Asset.get(link.asset_id);
      } catch (e) {
        const status = e?.response?.status ?? e?.status;
        if (status !== 404) {
          console.error("[ingestTransaction] gagal membaca aset", e?.message);
          return reply(503, { ok: false, message: "Server sibuk, coba lagi" });
        }
      }
    }
    if (!asset || asset.created_by_id !== ownerId) {
      // Aset terhapus / bukan milik pemilik → kembalikan ke "unmapped".
      await db.CardLabel.update(link.id, { status: "unmapped", asset_id: null, last_seen_at: nowIso });
      return reply(202, { ok: true, result: "not_recorded", message: "Tidak dicatat (label tidak aktif)" });
    }
    await touch(link);

    // --- Data transaksi ---
    const rawAmount = body?.amount == null ? "" : String(body.amount).slice(0, 64);
    const amount = parseAmount(body?.amount);
    // Penjual (merchant) kadang kosong di Wallet; "Nama" transaksi dipakai sebagai cadangan.
    const merchant = String(body?.merchant || body?.name || "").trim().slice(0, 120);
    const occurredAt = parseOccurredAt(body?.occurred_at);
    const rawCurrency = detectCurrency(body?.amount);
    const currency = asset.currency || "IDR";
    const candidate = { label, amount, merchant, occurred_at: occurredAt };

    // Mirip transaksi lain (nominal & merchant sama, ±10 menit) TIDAK dibuang:
    // bisa jadi memang dua pembelian. Item tetap masuk, ditandai untuk dicek.
    const recentOf = async () => list(await db.IncomingTransaction.filter({ owner_id: ownerId, label }, "-occurred_at", 20));
    const possibleDup = isDuplicate(candidate, await recentOf());

    // Kategori: 1) riwayat merchant yang sama milik pengguna, 2) kamus merchant
    // umum (hanya bila kategorinya ada di daftar kategori pengguna).
    let suggested = null;
    let suggestedSource = null;
    if (merchant) {
      try {
        const history = list(await db.Transaction.filter({ created_by_id: ownerId, type: "expense" }, "-date", 300));
        suggested = suggestCategory(merchant, history);
        if (suggested) suggestedSource = "history";
        else {
          const cats = list(await db.Category.filter({ created_by_id: ownerId }, "name", 500));
          const names = cats.filter((c) => (c.type || "expense") === "expense").map((c) => c.name);
          suggested = keywordCategory(merchant, names.length ? names : null);
          if (suggested) suggestedSource = "keyword";
        }
      } catch (e) {
        console.error("[ingestTransaction] saran kategori", e?.message);
      }
    }

    const DUP_REASON = "Mirip transaksi lain dalam 10 menit — pastikan bukan dobel";
    const created = await db.IncomingTransaction.create({
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
      suggested_source: suggestedSource || undefined,
      review_reason: (possibleDup ? DUP_REASON : reviewReason({ amount, merchant, rawCurrency, assetCurrency: currency })) || undefined,
      source: "apple_pay",
      status: "new",
    });

    // Pengiriman ganda yang bersamaan bisa lolos cek di atas. Cek ulang setelah
    // tersimpan: bila ada kembaran, tandai item ini agar tidak ikut "Simpan semua".
    if (!possibleDup) {
      try {
        const twins = (await recentOf()).filter((r) => r.id !== created.id);
        if (isDuplicate(candidate, twins)) await db.IncomingTransaction.update(created.id, { review_reason: DUP_REASON });
      } catch (e) { console.error("[ingestTransaction] cek kembaran", e?.message); }
    }

    return reply(201, { ok: true, result: "queued", message: "Masuk ke kotak masuk Nafkita" });
  } catch (error) {
    console.error("[ingestTransaction]", error?.message);
    return reply(500, { ok: false, message: "Gagal memproses, coba lagi" });
  }
}
