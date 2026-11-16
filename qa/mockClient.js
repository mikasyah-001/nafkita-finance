// Backend Base44 tiruan untuk QA lokal (BUKAN kode produksi).
// Dipakai lewat alias di qa/vite.config.mjs menggantikan src/api/base44Client.js.
// Stateful di memori: simpan/transfer/setujui benar-benar mengubah data,
// sehingga alur input bisa diuji end-to-end. Reset saat halaman dimuat ulang.
import { defaultCategories } from "@/lib/finance";

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
};
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
  getPartnerProfile: () => ({ partner: null }),
  // ── Mutasi ──
  saveTransactionWithAsset: ({ transaction, transaction_id }) => {
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
  saveTransfer: ({ from_asset_id, to_asset_id, amount, currency, date }) => {
    const from = db.assets.find((a) => a.id === from_asset_id), to = db.assets.find((a) => a.id === to_asset_id);
    from.value -= amount; to.value += amount;
    const pair = id(), merchant = `${from.name} → ${to.name}`;
    db.tx.push(T({ type: "expense", amount, currency, date, category: "Transfer", merchant, transfer_pair_id: pair, linked_asset_id: from_asset_id }));
    db.tx.push(T({ type: "income", amount, currency, date, category: "Transfer", merchant, transfer_pair_id: pair, linked_asset_id: to_asset_id }));
    return { ok: true };
  },
  approveTransaction: ({ approval_id }) => {
    const a = db.approvals.find((x) => x.id === approval_id); a.status = "approved";
    db.tx.find((t) => t.id === a.transaction_id).approval_status = "approved"; return { ok: true };
  },
  rejectTransaction: ({ approval_id }) => {
    const a = db.approvals.find((x) => x.id === approval_id); a.status = "rejected";
    db.tx.find((t) => t.id === a.transaction_id).approval_status = "rejected"; return { ok: true };
  },
  deleteAssetWithLots: ({ asset_id }) => { db.assets = db.assets.filter((a) => a.id !== asset_id); return { ok: true }; },
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
  functions: { invoke: async (name, args = {}) => { await lag("fn:" + name); return { data: FN[name] ? FN[name](args) : {} }; } },
  integrations: new Proxy({}, { get: (_, ns) => new Proxy({}, { get: (__, fn) => (ns === "Core" && fn === "UploadFile")
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
