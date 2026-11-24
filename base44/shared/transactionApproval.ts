// Logika persetujuan transaksi besar (threshold-based approval).
// Dipakai oleh saveTransactionWithAsset untuk menentukan apakah transaksi
// memerlukan persetujuan pasangan sebelum aset disesuaikan.
import { resolvePartnerId } from "./partnerResolve.ts";
import { getActorName, createNotificationIdempotent } from "./notifyCommon.ts";

// Ambang default untuk persetujuan transaksi (dalam SAR).
// Ambang aktual diambil dari NotificationPreference pengguna (approval_threshold +
// approval_threshold_currency), fallback ke nilai ini.
export const DEFAULT_APPROVAL_THRESHOLD = 10000;
export const DEFAULT_THRESHOLD_CURRENCY = "SAR";

// Bangun peta kurs sisi server: { KODE: nilai 1 unit mata uang dalam IDR }.
// Konvensi penyimpanan: 1 base_currency = rate IDR (kurs tengah BI).
// Mendukung arah terbalik (base IDR) dan jembatan USD sebagai fallback.
async function buildServerRateMap(base44) {
  const map = { IDR: 1 };
  let rates = [];
  try {
    rates = await base44.asServiceRole.entities.ExchangeRate.filter({}, "-date", 500);
  } catch {}
  const usdBridge = [];
  (rates || []).forEach((r) => {
    const base = (r.base_currency || "").toUpperCase();
    const quote = (r.quote_currency || "").toUpperCase();
    const rate = Number(r.rate) || 0;
    if (!base || rate <= 0) return;
    // Data diurutkan terbaru dulu: kurs pertama yang ditemukan per mata uang
    // dipakai; kurs lama tidak boleh menimpanya (dulu bisa).
    if (quote === "IDR" && base !== "IDR") {
      if (!(base in map)) map[base] = rate;
    } else if (base === "IDR" && quote !== "IDR") {
      if (!(quote in map)) map[quote] = 1 / rate;
    } else if (base === "USD" && quote !== "IDR" && quote !== "USD") {
      if (!usdBridge.some((x) => x.quote === quote)) usdBridge.push({ quote, rate });
    }
  });
  const usdToIdr = map.USD;
  if (usdToIdr) {
    usdBridge.forEach(({ quote, rate }) => {
      if (!map[quote]) map[quote] = usdToIdr / rate;
    });
  }
  return map;
}

// Konversi amount dari fromCurrency ke toCurrency via jembatan IDR.
// Mengembalikan null bila kurs tidak tersedia (berbeda dari lib frontend yang
// mengembalikan amount asli — di sini null menandakan ketidakpastian).
function convertTo(amount, fromCurrency, toCurrency, rateMap) {
  const from = (fromCurrency || "IDR").toUpperCase();
  const to = (toCurrency || "IDR").toUpperCase();
  const amt = Number(amount) || 0;
  if (from === to) return amt;
  const fromRate = rateMap[from] ?? (from === "IDR" ? 1 : null);
  const toRate = rateMap[to] ?? (to === "IDR" ? 1 : null);
  if (!fromRate || !toRate) return null;
  const inIdr = amt * fromRate;
  return inIdr / toRate;
}

// Ambil ambang persetujuan dari preferensi pengguna (per pasangan).
// Mengembalikan { threshold, currency }. Fallback ke default SAR 10000.
async function getApprovalThreshold(base44, userId) {
  try {
    const list = await base44.asServiceRole.entities.NotificationPreference.filter(
      { created_by_id: userId },
      "-created_date",
      1
    );
    const pref = list && list[0];
    if (pref) {
      const t = Number(pref.approval_threshold);
      return {
        threshold: t > 0 ? t : DEFAULT_APPROVAL_THRESHOLD,
        currency: (pref.approval_threshold_currency || DEFAULT_THRESHOLD_CURRENCY).toUpperCase(),
      };
    }
  } catch {}
  return { threshold: DEFAULT_APPROVAL_THRESHOLD, currency: DEFAULT_THRESHOLD_CURRENCY };
}

// Cek apakah transaksi memerlukan persetujuan pasangan.
// Syarat: transaksi shared, bukan income, nominal (dikonversi ke mata uang acuan
// ambang) >= ambang, DAN user memiliki pasangan aktif.
// Bila kurs untuk konversi tidak tersedia, konservatif: wajib persetujuan.
// Ambang yang berlaku = yang PALING KETAT antara ambang pengaju dan ambang
// pasangan (penyetuju). Dulu hanya ambang milik pengaju yang dipakai, sehingga
// pengaju bisa menaikkannya sendiri (mis. 1 miliar) untuk melewati persetujuan.
// Kini penyetuju juga menentukan batasnya; pengaju hanya bisa memperketat.
async function binding(base44, userId, partnerId, amt, txCur) {
  const own = await getApprovalThreshold(base44, userId);
  const theirs = partnerId ? await getApprovalThreshold(base44, partnerId) : null;
  let rateMap = null;
  const check = async (t) => {
    if (txCur === t.currency) return amt >= t.threshold;
    rateMap ||= await buildServerRateMap(base44);
    const converted = convertTo(amt, txCur, t.currency, rateMap);
    if (converted === null) return true; // kurs tidak tersedia → konservatif: wajib persetujuan
    return converted >= t.threshold;
  };
  if (theirs && await check(theirs)) return theirs;
  if (await check(own)) return own;
  return null;
}

export async function needsApproval(base44, user, transaction) {
  if (!user || !transaction) return false;
  // Hanya transaksi shared yang memerlukan persetujuan.
  if (transaction.visibility && transaction.visibility !== "shared") return false;
  // Hanya expense/sedekah yang memerlukan persetujuan (income tidak).
  if (transaction.type === "income") return false;
  const amt = Number(transaction.amount) || 0;
  if (amt <= 0) return false;

  // Cek apakah user memiliki pasangan aktif.
  const partnerId = await resolvePartnerId(base44, user.id);
  if (!partnerId) return false;

  return !!(await binding(base44, user.id, partnerId, amt, (transaction.currency || "IDR").toUpperCase()));
}

// Buat record TransactionApproval dan set transaksi ke pending.
export async function createApprovalRequest(base44, user, transaction, partnerId) {
  const amt = Number(transaction.amount) || 0;
  const hit = await binding(base44, user.id, partnerId, amt, (transaction.currency || "IDR").toUpperCase());
  const { threshold } = hit || await getApprovalThreshold(base44, user.id);
  const approval = await base44.asServiceRole.entities.TransactionApproval.create({
    transaction_id: transaction.id,
    requester_id: user.id,
    requester_name: user.full_name || user.email,
    approver_id: partnerId,
    approver_name: await getActorName(base44, partnerId),
    amount: amt,
    currency: transaction.currency || "IDR",
    category: transaction.category || "",
    merchant: transaction.merchant || "",
    status: "pending",
    threshold_at_request: threshold,
    requested_at: new Date().toISOString(),
  });

  // Set transaksi ke pending.
  await base44.asServiceRole.entities.Transaction.update(transaction.id, {
    approval_status: "pending",
    approval_id: approval.id,
  });

  return approval;
}

// Kirim notifikasi permintaan persetujuan ke pasangan.
export async function notifyApprovalRequest(base44, user, transaction, approval, partnerId) {
  const amt = Number(transaction.amount) || 0;
  const cur = String(transaction.currency || "IDR").toUpperCase();
  const fmt = cur === "IDR" ? "Rp" + amt.toLocaleString("id-ID")
    : cur === "SAR" ? "SAR " + amt.toLocaleString("en-US", { minimumFractionDigits: 2 })
    : cur + " " + amt.toLocaleString("en-US", { minimumFractionDigits: 2 });
  const label = transaction.merchant || transaction.notes || transaction.category || "Transaksi";

  const actorName = user.full_name || user.email || "Pasangan";
  const title = `${actorName} meminta persetujuan transaksi`;
  const bodyText = `${fmt} • ${label}`;

  const eventKey = `approval_request:${approval.id}`;
  return createNotificationIdempotent(base44, {
    target_user_id: partnerId,
    actor_name: actorName,
    action: "created",
    entity_kind: "transaction",
    event_key: eventKey,
    title,
    body: bodyText,
    ref_id: transaction.id,
    amount: amt,
    currency: cur,
    tx_type: transaction.type,
  });
}

// Kirim notifikasi hasil persetujuan ke pembuat transaksi.
export async function notifyApprovalResult(base44, approverName, approval, transaction, approved, reason) {
  const amt = Number(transaction.amount) || 0;
  const cur = String(transaction.currency || "IDR").toUpperCase();
  const label = transaction.merchant || transaction.notes || transaction.category || "Transaksi";

  const title = approved
    ? `${approverName} menyetujui transaksi Anda`
    : `${approverName} menolak transaksi Anda`;
  let bodyText = approved
    ? `Transaksi ${label} telah disetujui.`
    : `Transaksi ${label} ditolak.${reason ? " Alasan: " + reason : ""}`;

  const eventKey = `approval_result:${approval.id}:${approved ? "approved" : "rejected"}`;
  return createNotificationIdempotent(base44, {
    target_user_id: approval.requester_id,
    actor_name: approverName,
    action: approved ? "accepted" : "declined",
    entity_kind: "transaction",
    event_key: eventKey,
    title,
    body: bodyText,
    ref_id: transaction.id,
    amount: amt,
    currency: cur,
    tx_type: transaction.type,
  });
}
// ── Validasi keputusan persetujuan (approve/reject) ─────────────────────
// Dulu hanya approval.approver_id yang dicek; TransactionApproval bisa dibuat
// klien sehingga seseorang bisa "menyetujui" transaksi mana pun dan mengubah
// saldo rekening orang lain lewat service role. Kini:
//  - pengaju ≠ penyetuju, dan pengaju = pasangan AKTIF penyetuju;
//  - transaksi milik pengaju, masih pending, dan menunjuk approval ini;
//  - rekening yang ditautkan milik pengaju.
// Lalu klaim approval secara atomik (pending → processing) agar dua klik
// bersamaan tidak menerapkan efek saldo dua kali.
export async function validateApprovalDecision(base44, me, approval, tx) {
  const svc = base44.asServiceRole.entities;
  if (!approval || !tx) return { status: 404, error: "not_found" };
  if (approval.approver_id !== me.id || approval.requester_id === me.id) return { status: 403, error: "forbidden" };
  if (tx.created_by_id !== approval.requester_id) return { status: 403, error: "forbidden" };
  if (tx.approval_status !== "pending") return { status: 400, error: "sudah_diproses" };
  if (tx.approval_id && tx.approval_id !== approval.id) return { status: 409, error: "approval_mismatch" };
  const partners = await svc.Partnership.filter({ status: "active" }, "-created_date", 500).catch(() => []);
  const linked = (partners || []).some((p) =>
    (p.inviter_id === me.id && p.invitee_id === approval.requester_id) ||
    (p.invitee_id === me.id && p.inviter_id === approval.requester_id));
  if (!linked) return { status: 403, error: "not_partner", message: "Koneksi pasangan sudah tidak aktif" };
  if (tx.linked_asset_id) {
    const asset = await svc.Asset.get(tx.linked_asset_id).catch(() => null);
    if (asset && asset.created_by_id !== tx.created_by_id) return { status: 403, error: "forbidden", message: "Rekening bukan milik pengaju" };
  }
  return { ok: true };
}

export async function claimApproval(base44, approvalId) {
  const res = await base44.asServiceRole.entities.TransactionApproval.updateMany(
    { id: approvalId, status: "pending" },
    { $set: { status: "processing" } },
  );
  return Number(res?.updated ?? res?.modified ?? 0) > 0;
}

export async function releaseApproval(base44, approvalId) {
  try { await base44.asServiceRole.entities.TransactionApproval.update(approvalId, { status: "pending" }); } catch { /* biarkan */ }
}

// Saat hubungan berakhir (putus koneksi / hapus akun), permintaan persetujuan
// yang masih menunggu di antara dua orang ini tidak akan pernah diputuskan.
// Batalkan seperti cancelApproval: status "cancelled", transaksi "rejected"
// (terkunci, tidak memengaruhi saldo; pengaju bisa menghapus & mencatat ulang).
export async function cancelPendingApprovalsBetween(base44, userA, userB) {
  const svc = base44.asServiceRole.entities;
  let n = 0;
  for (const q of [{ requester_id: userA, status: "pending" }, { approver_id: userA, status: "pending" }]) {
    let rows = [];
    try { rows = await svc.TransactionApproval.filter(q, "-created_date", 500); } catch { continue; }
    for (const a of rows || []) {
      if (userB && a.requester_id !== userB && a.approver_id !== userB) continue;
      try {
        // Bersaing dengan approveTransaction lewat klaim atomik yang sama
        // (pending → processing): bila penyetuju sedang memproses, lewati.
        if (!(await claimApproval(base44, a.id))) continue;
        const tx = a.transaction_id ? await svc.Transaction.get(a.transaction_id).catch(() => null) : null;
        if (tx && tx.approval_id === a.id && tx.approval_status === "pending") {
          await svc.Transaction.update(tx.id, { approval_status: "rejected" });
        }
        await svc.TransactionApproval.update(a.id, { status: "cancelled", decided_at: new Date().toISOString() });
        n++;
      } catch (e) { console.error("[cancelPendingApprovalsBetween]", a.id, e?.message); }
    }
  }
  return n;
}
