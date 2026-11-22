// Backend Base44 tiruan untuk QA lokal (BUKAN kode produksi).
// Dipakai lewat alias di qa/vite.config.mjs menggantikan src/api/base44Client.js.
// Stateful di memori: simpan/transfer/setujui benar-benar mengubah data,
// sehingga alur input bisa diuji end-to-end. Reset saat halaman dimuat ulang.
import { defaultCategories } from "@/lib/finance";
import { planTransfer } from "../base44/shared/transferRules.js";
const MOCK_VAULT = {};

const ME = { id: "u1", email: "keluarga@contoh.id", full_name: "Ahmad Fauzi", role: "admin", default_currency: "IDR", enabled_currencies: ["IDR", "SAR"], active_currencies: ["IDR", "SAR"], ref_code: "NAF123" };
try { const c = localStorage.getItem("qaDefaultCur"); if (c) ME.default_currency = c; } catch { /* abaikan */ }
const now = new Date();
const Y = now.getUTCFullYear(), M = now.getUTCMonth();
const d = (dd, mOff = 0, h = 10) => new Date(Date.UTC(Y, M + mOff, dd, h)).toISOString();
let n = 0; const id = () => "id" + (++n);
const T = (o) => ({ id: id(), created_by_id: "u1", input_by_name: "Ahmad", visibility: "shared", currency: "IDR", tags: [], approval_status: "approved", ...o });

const later = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
const db = {
  tx: [
    T({ type: "income", amount: 15000000, category: "Gaji", date: d(1), merchant: "PT Arrahmah" }),
    T({ type: "expense", amount: 1250000, category: "Belanja", date: d(2), merchant: "Superindo" }),
    T({ type: "expense", amount: 85000, category: "Makanan", date: d(3), merchant: "Bakso Pak Kumis" }),
    T({ type: "expense", amount: 450000, category: "Transportasi", date: d(4), merchant: "Pertamina" }),
    T({ type: "sedekah", amount: 500000, category: "Sedekah & Infaq", date: d(6), merchant: "Masjid Al-Ikhlas" }),
    T({ type: "expense", amount: 2100000, category: "Tagihan", date: d(7), merchant: "PLN & Indihome" }),
    T({ type: "expense", amount: 320, currency: "SAR", category: "Makanan", date: d(9), merchant: "Al Baik Makkah" }),
    T({ type: "expense", amount: 5000000, category: "Transfer", date: d(10), merchant: "BCA → Mandiri", transfer_pair_id: "p1" }),
    T({ type: "income", amount: 5000000, category: "Transfer", date: d(10), merchant: "BCA → Mandiri", transfer_pair_id: "p1" }),
    T({ id: "tx-pending", type: "expense", amount: 3200000, category: "Belanja", date: d(12), merchant: "Elektronik", approval_status: "pending", input_by_name: "Siti" }),
    T({ type: "expense", amount: 175000, category: "Makanan", date: d(13), merchant: "Warteg Bahari", input_by_name: "Siti", linked_asset_id: "a6" }),
    T({ type: "expense", amount: 900000, category: "Belanja", date: d(5), visibility: "private", merchant: "Hadiah" }),
    T({ type: "income", amount: 15000000, category: "Gaji", date: d(1, -1) }),
    T({ type: "expense", amount: 1800000, category: "Belanja", date: d(3, -1) }),
    T({ type: "expense", amount: 300000, category: "Makanan", date: d(8, -1) }),
    T({ type: "expense", amount: 1900000, category: "Tagihan", date: d(7, -1) }),
  ],
  assets: [
    { id: "a1", name: "Tabungan BCA", type: "bank", value: 88000000, currency: "IDR", visibility: "shared", created_by_id: "u1" },
    { id: "a5", name: "Rekening Mandiri", type: "bank", value: 12000000, currency: "IDR", visibility: "shared", created_by_id: "u1" },
    { id: "a2", name: "Emas Antam", type: "emas", quantity: 40, purchase_price: 1250000, value: 64000000, currency: "IDR", visibility: "shared", created_by_id: "u1" },
    { id: "a7", name: "Emas tabungan anak", type: "emas", quantity: 15, purchase_price: 1400000, value: 21000000, currency: "IDR", visibility: "shared", created_by_id: "u1", purchase_date: later(-60) },
    { id: "a3", name: "Reksa Dana Syariah", type: "investasi", value: 43500000, purchase_price: 38000000, currency: "IDR", visibility: "shared", created_by_id: "u1" },
    { id: "a4", name: "Dompet Riyal", type: "tunai", value: 2400, currency: "SAR", visibility: "shared", created_by_id: "u1" },
    { id: "a6", name: "Dompet tunai", type: "tunai", value: 800000, currency: "IDR", visibility: "shared", created_by_id: "u1" },
  ],
  approvals: [{ id: "ap1", transaction_id: "tx-pending", requester_name: "Siti", amount: 3200000, currency: "IDR", status: "pending" }],
};
// Mode QA pasangan (opt-in): localStorage.qaPartner = "1" → Siti (u2) aktif + rekening bersamanya.
let QA_PARTNER = false;
try { QA_PARTNER = !!localStorage.getItem("qaPartner"); } catch { /* abaikan */ }
if (QA_PARTNER) {
  db.assets.push({ id: "p1a", name: "BSI Siti", type: "bank", value: 2_000_000, currency: "IDR", visibility: "shared", created_by_id: "u2" });
  db.assets.push({ id: "p1b", name: "Rahasia Siti", type: "bank", value: 9_000_000, currency: "IDR", visibility: "private", created_by_id: "u2" });
}
const ym = `${Y}-${String(M + 1).padStart(2, "0")}`;
const DATA = {
  Category: defaultCategories.map((c) => ({ id: id(), created_by_id: "u1", ...c })),
  AssetSnapshot: [-3, -2, -1].map((o, i) => {
    const p = new Date(Date.UTC(Y, M + o, 1));
    return { id: id(), period: p.toISOString().slice(0, 7), currency: "IDR", total_value: 182e6 + i * 7e6, emas_value: 60e6 + i * 2e6, investasi_value: 40e6 + i * 1.5e6, bank_value: 82e6 + i * 3.5e6 };
  }),
  AuditLog: [
    { id: id(), actor_name: "Ahmad Fauzi", action: "terminate_partnership", target_label: "Rudi ⇄ Lina", details: "Alasan: permintaan pengguna", created_date: d(12) },
    { id: id(), actor_name: "Ahmad Fauzi", action: "view_admin_stats", target_label: "", details: "Statistik: 4 user", created_date: d(13) },
    { id: id(), actor_name: "Ahmad Fauzi", action: "export_data", target_label: "Laporan November", details: "", created_date: d(14) },
  ],
  TransactionTemplate: [{ id: id(), name: "Belanja mingguan", type: "expense", amount: 400000, category: "Belanja", currency: "IDR" }],
  // Catat Otomatis (Apple Pay via Shortcuts)
  IngestDevice: [{ id: "dev1", owner_id: "u1", name: "iPhone Ahmad", token_hint: "x9Qa", revoked: false, last_used_at: d(14, 0, 9) }],
  CardLabel: [
    { id: "cl1", owner_id: "u1", label: "riyal-harian", asset_id: "a4", status: "active", last_seen_at: d(14, 0, 9), seen_count: 4 },
    { id: "cl2", owner_id: "u1", label: "bca-debit", asset_id: "a1", status: "paused", seen_count: 0 },
    { id: "cl3", owner_id: "u1", label: "kartu-kantor", status: "unmapped", last_seen_at: d(13, 0, 18), seen_count: 1 },
  ],
  PaymentCard: [
    { id: "pc1", owner_id: "u1", display_name: "Al Rajhi mada", kind: "debit", network: "mada", issuer: "Al Rajhi Bank", last4: "0315", asset_id: "a4", wallet_label: "riyal-harian", status: "active", has_details: true, has_photo: false, last_seen_at: d(14, 0, 9), seen_count: 4, created_date: d(1) },
    { id: "pc2", owner_id: "u1", display_name: "BCA Debit", kind: "debit", network: "gpn", issuer: "BCA", last4: "9876", asset_id: "a1", wallet_label: "bca-debit", status: "paused", has_details: false, seen_count: 0, created_date: d(2) },
    { id: "pc3", owner_id: "u1", display_name: "Kartu Kantor", kind: "debit", network: "lainnya", last4: "", wallet_label: "kartu-kantor", status: "unmapped", last_seen_at: d(13, 0, 18), seen_count: 1, created_date: d(3) },
    { id: "pc4", owner_id: "u1", display_name: "Flazz", kind: "emoney", network: "flazz", issuer: "BCA", last4: "4410", status: "paused", has_details: false, created_date: d(4) },
  ],
  PaymentCardSecret: [{ id: "ps1", owner_id: "u1", card_id: "pc1", exp_month: 8, exp_year: 2029, holder_name: "AHMAD FAUZI", photo_uri: null }],
  IncomingTransaction: [
    { id: "in5", owner_id: "u1", label: "riyal-harian", card_id: "pc1", card_name: "Al Rajhi mada", asset_id: "a4", amount: 5000, currency: "SAR", raw_amount: "SAR 5000", merchant: "", occurred_at: d(14, 0, 10), source: "sms", direction: "in", raw_text: "إيداع راتب\nمبلغ: 5000 SAR\nبطاقة: 0315", status: "new" },
    { id: "in1", owner_id: "u1", label: "riyal-harian", asset_id: "a4", amount: 18.5, currency: "SAR", merchant: "Al Baik Makkah", occurred_at: d(14, 0, 9), suggested_category: "Makanan", status: "new" },
    { id: "in2", owner_id: "u1", label: "riyal-harian", asset_id: "a4", amount: 0, currency: "SAR", raw_amount: "", merchant: "Jarir Bookstore", occurred_at: d(14, 0, 8), review_reason: "Nominal tidak terbaca", status: "new" },
    { id: "in3", owner_id: "u1", label: "riyal-harian", asset_id: "a4", amount: 42, currency: "SAR", merchant: "Panda Retail", occurred_at: d(13, 0, 20), status: "new" },
    { id: "in4", owner_id: "u1", label: "visa-debit", asset_id: "a1", amount: 45000, currency: "IDR", merchant: "Indomaret Point", occurred_at: d(13, 0, 19), suggested_category: "Belanja", suggested_source: "keyword", status: "new" },
  ],
};
if (QA_PARTNER) DATA.Partnership = [{ id: "pp1", inviter_id: "u1", invitee_id: "u2", status: "active", created_by_id: "u1" }];
// Data admin (pengguna lain di aplikasi) — hanya untuk Panel Admin.
// Simulasi jaringan lambat untuk QA: localStorage.qaLag = "400" (ms).
const lag = (label = "") => { try { if (localStorage.getItem("qaTrace")) console.log("REQ", Math.round(performance.now()), label); } catch { /* abaikan */ } let ms = 0; try { ms = Number(localStorage.getItem("qaLag")) || 0; } catch { /* abaikan */ } return ms ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve(); };
const ago = (m) => new Date(Date.now() - m * 60000).toISOString();
const ADMIN_USERS = [
  { id: "u1", full_name: "Ahmad Fauzi", email: "keluarga@contoh.id", role: "admin", last_active_at: ago(1), created_date: d(1, -6) },
  { id: "u2", full_name: "Siti Aminah", email: "siti@contoh.id", role: "user", last_active_at: ago(180), created_date: d(2, -6) },
  { id: "u3", full_name: "Rudi Hartono", email: "rudi@contoh.id", role: "user", last_active_at: ago(60 * 24 * 9), created_date: d(5, -2) },
  { id: "u4", full_name: "Lina Marlina", email: "lina@contoh.id", role: "user", last_active_at: null, created_date: d(7, -1) },
];
const PARTNERSHIPS = [
  { id: "p1", inviter_id: "u1", invitee_id: "u2", inviter_role: "suami", invitee_role: "istri", status: "active", created_date: d(3, -6) },
  { id: "p2", inviter_id: "u3", invitee_email: "lina@contoh.id", status: "pending", created_date: d(8) },
  { id: "p3", inviter_id: "u3", invitee_id: "u4", status: "ended", end_reason: "permintaan pengguna", created_date: d(1, -1) },
];
const FN = {
  // Emulasi backend: lot pada aset yang terlihat (milik sendiri + bersama pasangan).
  listVisibleInvestmentLots: ({ asset_id } = {}) => {
    const visible = new Set(db.assets.filter((a) => a.created_by_id === "u1" || a.visibility !== "private").map((a) => a.id));
    const lots = (DATA.InvestmentLot || []).filter((l) => visible.has(l.asset_id) && (!asset_id || l.asset_id === asset_id));
    return { lots: lots.map((l) => ({ ...l })) };
  },
  adminListUsers: () => ({ users: ADMIN_USERS.map((u) => ({ ...u })), partnerships: PARTNERSHIPS.map((p) => ({ ...p })) }),
  adminListTransactions: () => ({ transactions: db.tx.map((t) => ({ ...t })).sort((a, b) => new Date(b.date) - new Date(a.date)), has_more: false }),
  adminListAssets: () => ({ assets: db.assets.map((a) => ({ ...a })) }),
  adminStats: () => {
    const by = {}; const ab = {};
    db.tx.forEach((t) => { if (t.transfer_pair_id || (t.approval_status && t.approval_status !== "approved")) return; const c = t.currency || "IDR"; const e = (by[c] ||= { income: 0, expense: 0, sedekah: 0, count: 0 }); e.count++; if (e[t.type] != null) e[t.type] += t.amount; });
    db.assets.forEach((a) => { const c = a.currency || "IDR"; const e = (ab[c] ||= { value: 0, count: 0 }); e.value += a.value || 0; e.count++; });
    return {
      users: { total: ADMIN_USERS.length, active_now: 1, active_24h: 2, active_30d: 3 },
      transactions: { count: db.tx.length, by_currency: by },
      assets: { count: db.assets.length, by_currency: ab },
      user_breakdown: ADMIN_USERS.map((u) => ({ id: u.id, name: u.full_name, email: u.email, role: u.role, last_active_at: u.last_active_at, tx_count: db.tx.filter((t) => t.created_by_id === u.id).length, asset_count: db.assets.filter((a) => a.created_by_id === u.id).length })),
    };
  },
  terminatePartnership: ({ partnership_id, end_reason }) => { const p = PARTNERSHIPS.find((x) => x.id === partnership_id); if (p) Object.assign(p, { status: "ended", end_reason }); return { ok: true }; },
  listVisibleTransactions: () => ({ transactions: db.tx.map((t) => ({ ...t })).sort((a, b) => new Date(b.date) - new Date(a.date)) }),
  listVisibleAssets: () => ({ assets: db.assets.map((a) => ({ ...a })) }), // salinan, seperti respons server
  listVisibleBudgets: () => ({ budgets: [...(DATA.Budget || []),
    { id: "b1", category: "Belanja", limit_amount: 2000000, currency: "IDR", period: ym, visibility: "shared" },
    { id: "b2", category: "Makanan", limit_amount: 1500000, currency: "IDR", period: ym, visibility: "shared" },
    { id: "b3", category: "Transportasi", limit_amount: 500000, currency: "IDR", period: ym, visibility: "shared" },
  ] }),
  listVisibleDebts: () => ({ debts: [
    { id: "d1", created_by_id: "u1", type: "utang", counterparty_name: "Pak Hasan", amount: 5000000, remaining: 3000000, currency: "IDR", due_date: later(30), status: "active" },
  ] }),
  listVisibleRecurringBills: () => ({ bills: [
    { id: "r1", created_by_id: "u1", name: "Listrik PLN", amount: 750000, currency: "IDR", frequency: "monthly", next_date: later(-1), start_date: later(-1), status: "active", category: "Tagihan", type: "expense" },
    { id: "r2", created_by_id: "u1", name: "Internet", amount: 450000, currency: "IDR", frequency: "monthly", next_date: later(2), start_date: later(2), status: "active", category: "Tagihan", type: "expense" },
  ] }),
  listSavingsGoals: () => ({ goals: [...(DATA.SavingsGoal || []),{ id: "g1", created_by_id: "u1", name: "Umrah keluarga", target_amount: 120000000, current_amount: 46000000, currency: "IDR", target_date: later(200), status: "active" }] }),
  listPendingApprovals: () => ({
    pending_approvals: db.approvals.filter((a) => a.status === "pending").map((a) => ({ ...a, transaction: db.tx.find((t) => t.id === a.transaction_id) })),
    my_requests: [],
  }),
  listExchangeRates: () => ({ rates: [{ base_currency: "SAR", quote_currency: "IDR", rate: 4250 }, { base_currency: "USD", quote_currency: "IDR", rate: 16100 }] }),
  getPartnerProfile: () => ({ partner: QA_PARTNER ? { id: "u2", full_name: "Siti Aminah", email: "siti@contoh.id" } : null }),
  // ── Mutasi ──
  manageAutoIngest: (args) => {
    const L = DATA.CardLabel, I = DATA.IncomingTransaction, D = DATA.IngestDevice;
    if (args.action === "create_device") { const tok = "nfk_" + "QaToken".repeat(6).slice(0, 43); const dev = { id: id(), owner_id: "u1", name: args.name, token_hint: tok.slice(-4), revoked: false }; D.push(dev); return { ok: true, device: dev, token: tok }; }
    if (args.action === "revoke_device") { Object.assign(D.find((x) => x.id === args.device_id), { revoked: true }); return { ok: true }; }
    if (args.action === "dismiss_incoming") { I.forEach((x) => { if (args.ids.includes(x.id)) x.status = "dismissed"; }); return { ok: true }; }
    return {};
  },
  manageCards: (args) => {
    const C = DATA.PaymentCard, S = DATA.PaymentCardSecret;
    const V = (MOCK_VAULT.v ||= { pin: null, fails: 0, token: null });
    const bad = (status, message) => { const e = new Error(message); e.response = { status, data: { message } }; throw e; };
    const unlocked = () => V.token && args.unlock_token === V.token;
    if (args.action === "save_card") {
      const c = args.card;
      if (/\d{13,}/.test(String(c.display_name).replace(/\s/g, ""))) bad(400, "Jangan menulis nomor kartu lengkap atau CVC. Cukup 4 digit terakhir.");
      const status = c.status && c.status !== "unmapped" ? c.status : "active";
      if (!c.asset_id && status === "active" && c.kind !== "credit") bad(400, "Kartu debit harus terhubung ke rekening bank");
      const data = { display_name: c.display_name, kind: c.kind, network: c.network, issuer: c.issuer, last4: String(c.last4 || "").replace(/\D/g, "").slice(-4), asset_id: c.asset_id || null, wallet_label: c.wallet_label ? c.wallet_label.toLowerCase().replace(/[^a-z0-9]+/g, "-") : null, status };
      const t = C.find((x) => x.id === c.id); if (t) Object.assign(t, data); else C.push({ id: id(), owner_id: "u1", created_date: new Date().toISOString(), has_details: false, ...data });
      return { ok: true };
    }
    if (args.action === "set_status") { Object.assign(C.find((x) => x.id === args.card_id), { status: args.status }); return { ok: true }; }
    if (args.action === "delete_card") { DATA.PaymentCard = C.filter((x) => x.id !== args.card_id); return { ok: true }; }
    if (args.action === "pin_status") return { ok: true, has_pin: !!V.pin };
    if (args.action === "set_pin") { if (!/^\d{6}$/.test(args.pin)) bad(400, "PIN harus 6 angka"); V.pin = args.pin; return { ok: true }; }
    if (args.action === "unlock") {
      if (args.pin !== V.pin) { V.fails++; bad(403, `PIN salah (${5 - V.fails} percobaan lagi)`); }
      V.fails = 0; V.token = "unlock-" + id(); return { ok: true, unlock_token: V.token, expires_at: new Date(Date.now() + 180000).toISOString() };
    }
    if (args.action === "lock") { V.token = null; return { ok: true }; }
    if (args.action === "reveal") {
      if (!unlocked()) bad(403, "Buka dengan PIN dulu");
      const x = S.find((y) => y.card_id === args.card_id);
      return { ok: true, details: x ? { exp_month: x.exp_month, exp_year: x.exp_year, holder_name: x.holder_name, photo_url: x.photo_uri } : {} };
    }
    if (args.action === "save_details") {
      if (!unlocked()) bad(403, "Buka dengan PIN dulu");
      const d = args.details; let x = S.find((y) => y.card_id === args.card_id);
      if (!x) { x = { id: id(), owner_id: "u1", card_id: args.card_id }; S.push(x); }
      Object.assign(x, { exp_month: Number(d.exp_month) || null, exp_year: d.exp_year ? 2000 + Number(String(d.exp_year).slice(-2)) : null, holder_name: d.holder_name || null }, d.photo_uri !== undefined ? { photo_uri: d.photo_uri } : {});
      Object.assign(C.find((y) => y.id === args.card_id), { has_details: true, has_photo: !!x.photo_uri });
      return { ok: true };
    }
    if (args.action === "migrate_labels") return { ok: true, migrated: 0 };
    return {};
  },
  saveTransactionWithAsset: ({ transaction, transaction_id, incoming_id }) => {
    if (incoming_id) { const it = DATA.IncomingTransaction.find((x) => x.id === incoming_id); if (it) it.status = "saved"; }
    if (transaction_id) { const t = db.tx.find((x) => x.id === transaction_id); Object.assign(t, transaction); return { ok: true, transaction: t }; }
    const t = T(transaction); db.tx.push(t);
    const a = db.assets.find((x) => x.id === t.linked_asset_id);
    if (a) a.value += t.type === "income" ? t.amount : -t.amount;
    return { ok: true, transaction: t };
  },
  reconcileAsset: ({ asset_id, statement_balance, as_of_date, create_adjustment, notes }) => {
    const a = db.assets.find((x) => x.id === asset_id);
    const difference = statement_balance - a.value;
    const rec = { id: id(), asset_id, asset_name: a.name, statement_balance, computed_balance: a.value, difference, currency: a.currency, as_of_date, status: "open", notes };
    if (create_adjustment && Math.abs(difference) > 0.005) {
      db.tx.push(T({ type: difference > 0 ? "income" : "expense", amount: Math.abs(difference), currency: a.currency, category: "Penyesuaian Rekonsiliasi", date: as_of_date + "T23:59:00.000Z", merchant: `Penyesuaian ${a.name}`, linked_asset_id: asset_id }));
      a.value = statement_balance; rec.status = "reconciled";
    } else if (Math.abs(difference) <= 0.005) rec.status = "reconciled";
    (DATA.Reconciliation ||= []).unshift(rec);
    return rec;
  },
  saveTransactionBatch: ({ transactions }) => { transactions.forEach((t) => db.tx.push(T(t))); return { saved: transactions.length, pending: 0 }; },
  deleteTransactionWithAsset: ({ transaction_id }) => { db.tx = db.tx.filter((t) => t.id !== transaction_id); return { ok: true }; },
  deleteTransferPair: ({ transaction_id }) => {
    const t = db.tx.find((x) => x.id === transaction_id);
    db.tx.filter((x) => x.transfer_pair_id === t.transfer_pair_id).forEach((leg) => {
      const a = db.assets.find((x) => x.id === leg.linked_asset_id);
      if (a) a.value += leg.type === "income" ? -leg.amount : leg.amount;
    });
    db.tx = db.tx.filter((x) => x.transfer_pair_id !== t.transfer_pair_id);
    return { ok: true };
  },
  // Meniru backend: aturan sama (shared/transferRules.js), tiap sisi dalam mata uangnya.
  saveTransfer: ({ from_asset_id, to_asset_id, amount, received_amount, date, visibility }) => {
    const from = db.assets.find((a) => a.id === from_asset_id), to = db.assets.find((a) => a.id === to_asset_id);
    const plan = planTransfer({ from, to, meId: "u1", partnerId: QA_PARTNER ? "u2" : null, amount, receivedAmount: received_amount, visibility });
    if (plan.error) return { error: "invalid_transfer", message: plan.error };
    from.value -= plan.amount; to.value += plan.received;
    const pair = id(), merchant = `${from.name} → ${to.name}`;
    db.tx.push(T({ type: "expense", amount: plan.amount, currency: plan.fromCur, date, category: "Transfer", merchant, transfer_pair_id: pair, linked_asset_id: from_asset_id, visibility: plan.outVisibility }));
    db.tx.push(T({ type: "income", amount: plan.received, currency: plan.toCur, date, category: "Transfer", merchant, transfer_pair_id: pair, linked_asset_id: to_asset_id, visibility: plan.inVisibility }));
    return { ok: true, to_partner: plan.toPartner };
  },
  approveTransaction: ({ approval_id }) => {
    const a = db.approvals.find((x) => x.id === approval_id); a.status = "approved";
    db.tx.find((t) => t.id === a.transaction_id).approval_status = "approved"; return { ok: true };
  },
  rejectTransaction: ({ approval_id }) => {
    const a = db.approvals.find((x) => x.id === approval_id); a.status = "rejected";
    db.tx.find((t) => t.id === a.transaction_id).approval_status = "rejected"; return { ok: true };
  },
  deleteAssetWithLots: ({ asset_id, dry_run }) => {
    // Tiru backend: hitung dampak; saat hapus, lepas tautan transaksi (riwayat tetap).
    const txs = db.tx.filter((t) => t.linked_asset_id === asset_id);
    const labels = (DATA.CardLabel || []).filter((l) => l.asset_id === asset_id);
    const impact = { transactions: txs.length, card_labels: labels.length, payment_cards: (DATA.PaymentCard || []).filter((c) => c.asset_id === asset_id).length, recurring_bills: 0, debts: 0, savings_goals: 0, inbox_items: (DATA.IncomingTransaction || []).filter((i) => i.asset_id === asset_id && i.status === "new").length, investment_lots: (DATA.InvestmentLot || []).filter((l) => l.asset_id === asset_id).length };
    if (dry_run) return { ok: true, dry_run: true, impact };
    txs.forEach((t) => { t.linked_asset_id = null; });
    labels.forEach((l) => { l.asset_id = null; l.status = "unmapped"; });
    db.assets = db.assets.filter((a) => a.id !== asset_id);
    return { ok: true, impact };
  },
};
const entity = (name) => ({
  list: async () => (DATA[name] || []).map((r) => ({ ...r })),
  // Filter sederhana: kecocokan nilai persis per kunci (cukup untuk asset_id, created_by_id).
  filter: async (q = {}) => (DATA[name] || []).filter((r) => Object.entries(q || {}).every(([k, v]) => r[k] === v)).map((r) => ({ ...r })), get: async () => (DATA[name] || [])[0] || null,
  create: async (o) => {
    const ts = new Date().toISOString(); // seperti server: tanggal dibuat/diubah otomatis
    const r = { id: id(), created_by_id: "u1", created_date: ts, updated_date: ts, ...o };
    if (name === "Asset") db.assets.push(r); else (DATA[name] ||= []).push(r);
    return r;
  },
  bulkCreate: async (a) => a,
  update: async (i, o) => { const list = name === "Asset" ? db.assets : name === "Transaction" ? db.tx : DATA[name] || []; const r = list.find((x) => x.id === i); if (r) Object.assign(r, o, { updated_date: new Date().toISOString() }); return { id: i, ...o }; },
  updateMany: async () => ({}),
  delete: async (i) => { DATA[name] = (DATA[name] || []).filter((r) => r.id !== i); return {}; },
  subscribe: () => () => {},
});
export const base44 = {
  auth: {
    me: async () => { await lag("auth.me"); return { ...ME }; }, updateMe: async (o) => ({ ...Object.assign(ME, o) }), isAuthenticated: async () => true,
    logout: () => {}, redirectToLogin: () => {}, setToken: () => {}, loginWithProvider: () => {},
  },
  entities: new Proxy({}, { get: (_, k) => entity(k) }),
  functions: { invoke: async (name, args = {}) => {
    await lag("fn:" + name);
    // Simulasi kegagalan backend: window.__qaFnFail = { adminStats: { status: 500, error: "..." } }
    const fail = typeof window !== "undefined" && window.__qaFnFail?.[name];
    if (fail) { const e = new Error(`Request failed with status code ${fail.status || 500}`); e.response = { status: fail.status || 500, data: { error: fail.error } }; throw e; }
    const partial = typeof window !== "undefined" && window.__qaFnPartial?.[name];
    const data = FN[name] ? FN[name](args) : {};
    return { data: partial ? { ...data, errors: partial } : data };
  } },
  integrations: new Proxy({}, { get: (_, ns) => new Proxy({}, { get: (__, fn) => (ns === "Core" && fn === "UploadPrivateFile")
    ? async ({ file }) => ({ file_uri: await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); }) })
    : (ns === "Core" && fn === "UploadFile")
    // Unggah tiruan: kembalikan data URL agar gambar benar-benar tampil di QA.
    ? async ({ file }) => ({ file_url: await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); }) })
    // AI tiruan: tes mengisi window.__qaLLM = [respons1, respons2, ...] (urut per panggilan).
    : (ns === "Core" && fn === "InvokeLLM") ? async (args) => {
      await lag("llm");
      // Entri boleh fungsi (menerima argumen/prompt) agar jawaban bisa bergantung pada isi prompt.
      const next = window.__qaLLM && window.__qaLLM.shift();
      return (typeof next === "function" ? next(args) : next) || {};
    }
    : async () => ({}) }) }),
};
// Akses dari test (window.__qa) untuk memeriksa state.
if (typeof window !== "undefined") { window.__qa = db; window.__qaData = DATA; }
export default base44;
