import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import {
  normalizeLabel, parseAmount, detectCurrency, parseOccurredAt, suggestCategory,
  isDuplicate, reviewReason, extractToken, looksLikeToken, keywordCategory, findManualTwin,
} from "../../shared/autoIngest.js";
import { parseBankSms, isOtpSms, matchCardForSms, findCrossSourceTwin } from "../../shared/cards.js";

// Endpoint publik untuk "Catat Otomatis" — dipanggil Shortcuts iOS (pemicu
// Wallet/Transaction) lewat aksi "Get Contents of URL", TANPA sesi login.
//
// Autentikasi: header "Authorization: Bearer nfk_…" (token per perangkat,
// dibuat di manageAutoIngest; disimpan sebagai hash SHA-256).
//
// Body JSON (Apple Pay):
//   { label?: "rajhi-harian", amount: "SAR 12.50", merchant: "Panda",
//     card?: "Al Rajhi Visa", occurred_at?: ISO, ping?: true }
//   label kosong → nama kartu (card) dipakai sebagai label.
// Body JSON (SMS bank):
//   { text: "<isi SMS>", label?: "alrajhi", sender?: "AlRajhiBank", occurred_at?: ISO }
//   kartu dicocokkan lewat 4 digit terakhir di SMS. SMS OTP tidak pernah disimpan.
//
// Aturan pencatatan:
//   - Kartu (PaymentCard) harus aktif & terhubung ke aset milik pemilik token.
//   - Kartu tak dikenal → dibuat sebagai "unmapped" (HANYA kartunya; nominal &
//     merchant TIDAK disimpan) agar pengguna bisa menghubungkannya.
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

    const empty = (v) => v == null || String(v).trim() === "";

    // --- Sumber ---
    // SMS: Otomasi "Pesan" di Pintasan mengirim isi SMS mentah sebagai `text`.
    // Apple Pay: Otomasi "Transaksi" mengirim amount/merchant/card terpisah.
    const smsText = typeof body?.text === "string" ? body.text.slice(0, 1000) : "";
    const isSms = !empty(smsText) || body?.source === "sms";
    let sms = null;
    if (isSms) {
      // OTP & SMS non-transaksi TIDAK disimpan sama sekali (isi teks dibuang).
      if (isOtpSms(smsText)) return reply(200, { ok: true, result: "ignored", message: "Diabaikan: SMS kode OTP tidak pernah dicatat" });
      sms = parseBankSms(smsText);
      if (!sms.ok) return reply(200, { ok: true, result: "ignored", message: "Bukan SMS transaksi — diabaikan" });
    } else if (empty(body?.amount) && empty(body?.merchant) && empty(body?.name)) {
      // Tombol ▶ di app Pintasan menjalankan shortcut tanpa transaksi:
      // anggap sebagai uji koneksi, jangan membuat item kosong.
      return reply(200, { ok: true, result: "connected", message: `Terhubung ✓ ${device.name}. Transaksi asli akan masuk otomatis.` });
    }

    // --- Kartu (PaymentCard) → rekening ---
    // Apple Pay: label opsional; nama kartu di Wallet dipakai sebagai label
    //   ("Classic Debit Card" → "classic-debit-card").
    // SMS: dicocokkan lewat 4 digit terakhir di SMS, lalu label (mis. "alrajhi").
    const label = normalizeLabel(body?.label) || (isSms ? "" : normalizeLabel(body?.card));
    const cards = list(await db.PaymentCard.filter({ owner_id: ownerId }, "-created_date", 200));
    let card = isSms ? matchCardForSms(cards, { last4: sms.last4, label }) : (label ? cards.find((c) => c.wallet_label === label) : null);

    if (!card && !isSms && label) {
      // Migrasi malas dari label lama (CardLabel) agar pengguna lama tidak perlu menghubungkan ulang.
      const legacy = first(await db.CardLabel.filter({ owner_id: ownerId, label }, "-created_date", 1));
      if (legacy) {
        card = await db.PaymentCard.create({
          owner_id: ownerId, display_name: String(body?.card || label).slice(0, 50), kind: "debit", network: "lainnya",
          asset_id: legacy.asset_id || null, wallet_label: label, status: legacy.asset_id ? legacy.status : (legacy.status === "ignored" ? "ignored" : "unmapped"),
          seen_count: Number(legacy.seen_count) || 0, has_photo: false, has_details: false,
        });
      }
    }
    if (!card) {
      if (!label && !(isSms && sms.last4)) return reply(400, { ok: false, message: isSms ? "SMS tanpa 4 digit kartu — tambahkan label di shortcut" : "Label & nama kartu kosong — kirim label atau Input Pintasan → Kartu" });
      // Batasi jumlah kartu tercatat agar token bocor tidak bisa membanjiri daftar.
      if (cards.length >= 40) return reply(202, { ok: true, result: "unknown_label", message: "Kartu belum terhubung" });
      const name = isSms ? `${String(body?.sender || label || "SMS").slice(0, 30)}${sms.last4 ? " ••" + sms.last4 : ""}` : String(body?.card || label).slice(0, 50);
      await db.PaymentCard.create({
        owner_id: ownerId, display_name: name, kind: "debit", network: "lainnya", last4: isSms ? sms.last4 : "",
        wallet_label: label || null, status: "unmapped", last_seen_at: nowIso, seen_count: 1, has_photo: false, has_details: false,
      });
      // Hanya kartunya yang dicatat; nominal & merchant transaksi ini TIDAK disimpan.
      return reply(202, { ok: true, result: "unknown_label", message: "Kartu baru terdeteksi. Hubungkan di Nafkita → Kartu." });
    }
    const touch = () => db.PaymentCard.update(card.id, { last_seen_at: nowIso, seen_count: (Number(card.seen_count) || 0) + 1 });
    // Respons sengaja generik: token hanya untuk MENGIRIM, tidak boleh
    // membocorkan nama rekening atau status kartu ke pemegang token.
    if (card.status !== "active" || !card.asset_id) {
      await touch();
      return reply(202, { ok: true, result: "not_recorded", message: "Tidak dicatat (kartu tidak aktif)" });
    }

    // Bedakan "aset benar-benar tidak ada" dari gangguan sementara: hanya yang
    // pertama yang boleh memutus hubungan kartu.
    let asset = null;
    try {
      asset = await db.Asset.get(card.asset_id);
    } catch (e) {
      const status = e?.response?.status ?? e?.status;
      if (status !== 404) {
        console.error("[ingestTransaction] gagal membaca aset", e?.message);
        return reply(503, { ok: false, message: "Server sibuk, coba lagi" });
      }
    }
    if (!asset || asset.created_by_id !== ownerId) {
      await db.PaymentCard.update(card.id, { status: "unmapped", asset_id: null, last_seen_at: nowIso });
      return reply(202, { ok: true, result: "not_recorded", message: "Tidak dicatat (kartu tidak aktif)" });
    }
    await touch();

    // --- Data transaksi ---
    const direction = isSms ? sms.direction : "out";
    const rawAmount = isSms ? `${sms.currency || ""} ${sms.amount}`.trim() : (body?.amount == null ? "" : String(body.amount).slice(0, 64));
    const amount = isSms ? sms.amount : parseAmount(body?.amount);
    // Penjual (merchant) kadang kosong di Wallet; "Nama" transaksi dipakai sebagai cadangan.
    const merchant = (isSms ? sms.merchant : String(body?.merchant || body?.name || "")).trim().slice(0, 120);
    const occurredAt = parseOccurredAt(body?.occurred_at);
    const rawCurrency = isSms ? sms.currency : detectCurrency(body?.amount);
    const currency = asset.currency || "IDR";
    const itemLabel = card.wallet_label || (card.last4 ? `kartu-${card.last4}` : `kartu-${card.id}`);
    const source = isSms ? "sms" : "apple_pay";
    const candidate = { label: itemLabel, amount, merchant, occurred_at: occurredAt, source, direction, asset_id: asset.id };

    // Mirip transaksi lain (nominal & merchant sama, ±10 menit) TIDAK dibuang:
    // bisa jadi memang dua pembelian. Item tetap masuk, ditandai untuk dicek.
    const recentOf = async () => list(await db.IncomingTransaction.filter({ owner_id: ownerId, asset_id: asset.id }, "-occurred_at", 30));
    const recent = await recentOf();
    const possibleDup = isDuplicate(candidate, recent);
    // Pembelian yang sama bisa datang dari Apple Pay DAN SMS bank.
    const crossTwin = findCrossSourceTwin(candidate, recent);

    // Riwayat transaksi pengguna: saran kategori & cek "mungkin sudah dicatat manual".
    const txType = direction === "in" ? "income" : "expense";
    let history = [];
    try {
      history = list(await db.Transaction.filter({ created_by_id: ownerId, type: txType }, "-date", 300));
    } catch (e) { console.error("[ingestTransaction] riwayat", e?.message); }
    const manualTwin = direction === "out" ? findManualTwin(candidate, history, { currency, assetId: asset.id }) : null;

    // Kategori: 1) riwayat merchant yang sama milik pengguna, 2) kamus merchant
    // umum (pengeluaran saja; hanya bila kategorinya ada di daftar pengguna).
    let suggested = null;
    let suggestedSource = null;
    if (merchant) {
      try {
        suggested = suggestCategory(merchant, history);
        if (suggested) suggestedSource = "history";
        else if (direction === "out") {
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
    const otherSrc = (r) => (r.source === "sms" ? "SMS bank" : "Apple Pay");
    const reasonFor = () => {
      if (possibleDup) return DUP_REASON;
      if (crossTwin) return `Mungkin sama dengan notifikasi ${otherSrc(crossTwin)} (nominal sama) — abaikan salah satunya`;
      if (manualTwin) return `Mungkin sudah dicatat manual: "${manualTwin.merchant || manualTwin.category || "transaksi"}" dengan nominal sama — abaikan bila dobel`;
      const r = reviewReason({ amount, merchant, rawCurrency, assetCurrency: currency });
      // Uang masuk lewat SMS sering tanpa nama pengirim; itu bukan masalah.
      return direction === "in" && r === "Nama merchant kosong" ? "" : r;
    };
    const created = await db.IncomingTransaction.create({
      owner_id: ownerId,
      device_id: device.id,
      label: itemLabel,
      card_id: card.id,
      asset_id: asset.id,
      amount,
      currency,
      raw_amount: rawAmount,
      raw_currency: rawCurrency || undefined,
      merchant,
      card_name: (isSms ? card.display_name : String(body?.card ?? "")).slice(0, 80) || undefined,
      occurred_at: occurredAt,
      suggested_category: suggested || undefined,
      suggested_source: suggestedSource || undefined,
      review_reason: reasonFor() || undefined,
      source,
      direction,
      // Teks SMS disimpan (dipotong) agar pengguna bisa memeriksa hasil urai.
      raw_text: isSms ? smsText.slice(0, 500) : undefined,
      status: "new",
    });

    // Pengiriman ganda yang bersamaan bisa lolos cek di atas. Cek ulang setelah
    // tersimpan: bila ada kembaran, tandai item ini agar tidak ikut "Simpan semua".
    if (!possibleDup) {
      try {
        const twins = (await recentOf()).filter((r) => r.id !== created.id && (r.source || "apple_pay") === source);
        if (isDuplicate(candidate, twins)) await db.IncomingTransaction.update(created.id, { review_reason: DUP_REASON });
      } catch (e) { console.error("[ingestTransaction] cek kembaran", e?.message); }
    }

    return reply(201, { ok: true, result: "queued", message: "Masuk ke kotak masuk Nafkita" });
  } catch (error) {
    console.error("[ingestTransaction]", error?.message);
    return reply(500, { ok: false, message: "Gagal memproses, coba lagi" });
  }
}
