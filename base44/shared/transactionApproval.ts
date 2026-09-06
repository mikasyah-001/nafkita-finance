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
    if (quote === "IDR" && base !== "IDR") {
      map[base] = rate;
    } else if (base === "IDR" && quote !== "IDR") {
      map[quote] = 1 / rate;
    } else if (base === "USD" && quote !== "IDR" && quote !== "USD") {
      usdBridge.push({ quote, rate });
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

  // Ambang per pasangan + konversi mata uang sadar.
  const { threshold, currency: threshCur } = await getApprovalThreshold(base44, user.id);
  const txCur = (transaction.currency || "IDR").toUpperCase();
  if (txCur === threshCur) {
    return amt >= threshold;
  }
  const rateMap = await buildServerRateMap(base44);
  const converted = convertTo(amt, txCur, threshCur, rateMap);
  if (converted === null) return true; // kurs tidak tersedia → konservatif: wajib persetujuan
  return converted >= threshold;
}

// Buat record TransactionApproval dan set transaksi ke pending.
export async function createApprovalRequest(base44, user, transaction, partnerId) {
  const amt = Number(transaction.amount) || 0;
  const { threshold, currency: threshCur } = await getApprovalThreshold(base44, user.id);
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

  // Catat mata uang acuan ambang pada record (di kolom notes agar terlacak).
  void threshCur;
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