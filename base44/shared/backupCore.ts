// Inti cadangan & pemulihan — SATU logika untuk Google Drive (backupToDrive /
// restoreFromDrive) dan file lokal (aksi export / restore_data). Semua jalan
// lewat server agar aturan validasi, pemetaan id & kepemilikan sama.
//
// Format v3 (sejak audit keamanan tahap 2):
//  - `id` asli DISIMPAN (dulu dibuang) sehingga tautan antar data bisa
//    dipetakan ulang saat pemulihan: lot investasi → aset, transaksi →
//    rekening/target/tagihan, utang/target/tagihan → rekening.
//  - created_by_id / created_date / updated_date tetap dibuang: kepemilikan
//    selalu = pengguna yang memulihkan.
//  - Ikut dicadangkan: Debt, SavingsGoal, RecurringBill (dulu tidak).
//
// Keamanan pemulihan:
//  - Hanya cadangan milik pemanggil (backup.user_id === me.id).
//  - Field sistem disaring; transaksi divalidasi dengan sanitizeTxInput yang
//    sama dengan input biasa; transaksi yang masih "menunggu persetujuan"
//    tidak dipulihkan (persetujuannya tidak ikut cadangan).
//  - Mode "replace" (v3 saja): data baru dibuat DULU; data lama baru dihapus
//    bila seluruh pembuatan berhasil. Bila gagal di tengah, data baru yang
//    sempat dibuat dihapus lagi → tidak ada kondisi "data lama sudah hilang".
import { BACKUP_ENTITIES, BACKUP_VERSION, txFingerprint, assetFingerprint, categoryFingerprint, budgetFingerprint } from "./backupFormat.ts";
import { fetchAll } from "./fetchAll.ts";
import { sanitizeTxInput, MAX_AMOUNT, isSafeUrl } from "./txInput.js";
import { secrets } from "base44:runtime";

const DROP = ["created_date", "updated_date", "created_by_id", "created_by", "is_sample"];
export const dropMeta = (r) => { const c = { ...r }; DROP.forEach((k) => delete c[k]); return c; };
const noId = (r) => { const c = { ...r }; delete c.id; DROP.forEach((k) => delete c[k]); return c; };

export const ownerFilter = (key, userId) => (key === "snapshots" ? { owner_id: userId } : { created_by_id: userId });

/** Data milik satu pengguna (bukan milik pasangan), siap diserialisasi. */
export async function collectUserData(svc, userId) {
  const data = {};
  for (const e of BACKUP_ENTITIES) {
    const rows = await fetchAll(svc[e.entity], ownerFilter(e.key, userId));
    // Penyaring ganda: jangan pernah ikutkan data orang lain walau filter server longgar.
    data[e.key] = (rows || [])
      .filter((r) => (e.key === "snapshots" ? r.owner_id === userId : r.created_by_id === userId))
      .map(dropMeta);
  }
  return data;
}

export function buildBackup(user, data) {
  return {
    app: "NAFKITA",
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    user_id: user.id,
    user_name: user.full_name || user.email,
    counts: Object.fromEntries(BACKUP_ENTITIES.map((e) => [e.key, (data[e.key] || []).length])),
    data,
  };
}

// ---------------------------------------------------------------------------
// Enkripsi opsional (AES-256-GCM). Aktif bila secret BACKUP_ENCRYPTION_KEY
// diisi. user_id & metadata tetap terbuka agar kepemilikan bisa dicek tanpa
// membuka isi. Tanpa kunci yang sama, cadangan terenkripsi tidak bisa dipulihkan.
// ---------------------------------------------------------------------------
const te = new TextEncoder();
const td = new TextDecoder();
const b64 = (buf) => bytesToB64(new Uint8Array(buf));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function backupSecret() {
  try { return secrets.get("BACKUP_ENCRYPTION_KEY") || ""; } catch { return ""; }
}
async function aesKey(secret) {
  const raw = await crypto.subtle.digest("SHA-256", te.encode(secret));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
// Base64 per potongan agar tidak melampaui batas argumen fungsi.
function bytesToB64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function sealBackup(backup, secret = backupSecret()) {
  if (!secret) return backup;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await aesKey(secret);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(JSON.stringify(backup.data))));
  const { data: _omit, ...meta } = backup;
  return { ...meta, encrypted: { alg: "AES-256-GCM", iv: b64(iv), data: bytesToB64(ct) } };
}

export async function openBackup(backup, secret = backupSecret()) {
  if (!backup?.encrypted) return backup;
  if (!secret) throw new Error("backup_key_missing");
  try {
    const key = await aesKey(secret);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(backup.encrypted.iv) }, key, unb64(backup.encrypted.data));
    return { ...backup, encrypted: undefined, data: JSON.parse(td.decode(pt)) };
  } catch {
    throw new Error("backup_decrypt_failed");
  }
}

// ---------------------------------------------------------------------------
// Sanitasi per entitas (data dari file — dianggap tidak tepercaya)
// ---------------------------------------------------------------------------
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const str = (v, n) => (v == null ? v : String(v).slice(0, n));
const amt = (v) => { const n = Number(v); return Number.isFinite(n) && Math.abs(n) <= MAX_AMOUNT ? n : null; };
const cur = (v) => { const c = String(v || "IDR").toUpperCase(); return /^[A-Z]{3}$/.test(c) ? c : null; };
const vis = (v) => (v === "private" ? "private" : "shared");

function pick(r, fields) {
  const o = {};
  for (const f of fields) if (r[f] !== undefined) o[f] = r[f];
  return o;
}

const TX_SYSTEM_KEEP = ["transfer_pair_id", "transfer_direction", "recurring_id", "savings_goal_id", "is_savings_deposit", "is_debt_settlement", "is_adjustment"];

function cleanTransaction(r) {
  // Transaksi yang menunggu/sedang diproses persetujuan tidak dipulihkan:
  // catatan persetujuannya tidak ikut cadangan, sehingga akan menggantung.
  if (["pending", "processing"].includes(r.approval_status)) return { skip: "pending_approval" };
  const { data, error } = sanitizeTxInput(r);
  if (error) return { skip: error };
  const out = { ...data };
  for (const k of TX_SYSTEM_KEEP) if (r[k] !== undefined && r[k] !== null) out[k] = typeof r[k] === "boolean" ? r[k] : str(r[k], 120);
  if (r.approval_status === "approved" || r.approval_status === "rejected") out.approval_status = r.approval_status;
  return { data: out };
}

function cleanAsset(r) {
  const value = amt(r.value);
  const c = cur(r.currency);
  if (value === null || !c || !r.name) return { skip: "invalid_asset" };
  const o = pick(r, ["name", "type", "quantity", "unit", "broker", "account_role", "account_number", "purchase_date", "purchase_price", "purchase_proof_url", "owner", "notes", "ticker", "exchange", "instrument", "instrument_manual", "last_price", "price_date", "value_source", "import_source"]);
  if (o.purchase_proof_url && !isSafeUrl(o.purchase_proof_url)) delete o.purchase_proof_url;
  return { data: { ...o, name: str(r.name, 120), value, currency: c, visibility: vis(r.visibility) } };
}

function cleanGeneric(fields, { money = [], url = [] } = {}) {
  return (r) => {
    const o = pick(r, fields);
    for (const m of money) if (o[m] !== undefined && o[m] !== null) { const n = amt(o[m]); if (n === null) return { skip: "invalid_amount" }; o[m] = n; }
    for (const u of url) if (o[u] && !isSafeUrl(o[u])) delete o[u];
    if (o.currency !== undefined) { const c = cur(o.currency); if (!c) return { skip: "invalid_currency" }; o.currency = c; }
    if (o.visibility !== undefined) o.visibility = vis(o.visibility);
    for (const [k, v] of Object.entries(o)) if (typeof v === "string") o[k] = v.slice(0, 2000);
    return { data: o };
  };
}

const CLEAN = {
  transactions: cleanTransaction,
  assets: cleanAsset,
  categories: cleanGeneric(["name", "type", "color", "icon", "is_default"]),
  budgets: cleanGeneric(["category", "limit_amount", "currency", "period", "period_type", "visibility", "kind", "assignee_id", "assignee_name", "rollover_enabled", "rollover_policy", "rollover_amount"], { money: ["limit_amount", "rollover_amount"] }),
  zakatPayments: cleanGeneric(["year", "zakat_type", "amount", "status", "currency", "period_key", "notes", "amount_idr", "paid_date"], { money: ["amount", "amount_idr"] }),
  snapshots: cleanGeneric(["currency", "period", "scope", "emas_value", "investasi_value", "bank_value", "other_value", "total_value"], { money: ["emas_value", "investasi_value", "bank_value", "other_value", "total_value"] }),
  templates: cleanGeneric(["name", "type", "amount", "currency", "category", "merchant", "notes", "visibility"], { money: ["amount"] }),
  investmentLots: cleanGeneric(["asset_id", "date", "price_per_unit", "quantity", "amount", "notes", "side", "source"], { money: ["amount", "price_per_unit"] }),
  preferences: cleanGeneric(["mute", "min_amount", "daily_digest", "hide_amount", "channel", "approval_threshold", "approval_threshold_currency"], { money: ["min_amount", "approval_threshold"] }),
  debts: cleanGeneric(["counterparty_name", "type", "amount", "currency", "date", "due_date", "status", "paid_amount", "paid_date", "linked_asset_id", "notes", "visibility"], { money: ["amount", "paid_amount"] }),
  savingsGoals: cleanGeneric(["name", "type", "target_amount", "current_amount", "currency", "target_date", "linked_asset_id", "allocated_asset_ids", "cover_url", "icon", "color", "visibility", "status", "contribution_history"], { money: ["target_amount", "current_amount"], url: ["cover_url"] }),
  recurringBills: cleanGeneric(["category", "type", "amount", "currency", "frequency", "start_date", "next_date", "linked_asset_id", "visibility", "status", "last_run_date", "notes"], { money: ["amount"] }),
};

// Sidik jari untuk mode gabung (melewati data yang sudah ada).
const json = (o) => JSON.stringify(o, Object.keys(o).sort());
const FP = {
  transactions: txFingerprint,
  assets: assetFingerprint,
  categories: categoryFingerprint,
  budgets: budgetFingerprint,
  preferences: () => "singleton", // satu preferensi per pengguna
  debts: (d) => [String(d.counterparty_name || "").toLowerCase().trim(), d.type, Number(d.amount) || 0, d.currency || "IDR", String(d.date || "").slice(0, 10)].join("|"),
  savingsGoals: (g) => [String(g.name || "").toLowerCase().trim(), g.currency || "IDR"].join("|"),
  recurringBills: (b) => [b.category || "", b.type || "", Number(b.amount) || 0, b.currency || "IDR", b.frequency || ""].join("|"),
};
const fpOf = (key, r) => (FP[key] ? FP[key](r) : json(CLEAN[key](r).data || {}));

// Urutan pembuatan: data induk dulu agar peta id siap untuk anak.
const ORDER = ["assets", "savingsGoals", "recurringBills", "debts", "categories", "budgets", "transactions", "investmentLots", "zakatPayments", "snapshots", "templates", "preferences"];

export const MAX_RESTORE_RECORDS = 20000;

/**
 * @param base44  klien dari request (entities = berlaku RLS pengguna, asServiceRole = admin)
 * @param me      pengguna pemanggil
 * @param backup  objek cadangan (sudah dibuka bila terenkripsi)
 * @param mode    "merge" | "replace"
 * @param opts    { allowLegacyNoOwner } — hanya untuk file lokal v1/v2
 */
export async function restoreBackup(base44, me, backup, mode = "merge", { allowLegacyNoOwner = false } = {}) {
  if (!isObj(backup) || !isObj(backup.data)) throw Object.assign(new Error("invalid_backup_file"), { status: 400 });
  const version = Number(backup.version) || 1;
  // File lokal lama (v1/v2) tidak mencatat pemilik → boleh dipulihkan ke akun
  // yang membuka file. Selain itu pemilik wajib sama.
  const legacyLocal = allowLegacyNoOwner && !backup.user_id && version < 3;
  if (!legacyLocal && (!backup.user_id || backup.user_id !== me.id)) throw Object.assign(new Error("backup_not_yours"), { status: 403 });
  if (mode === "replace" && version < 3) throw Object.assign(new Error("replace_needs_v3"), { status: 409 });
  const d = backup.data;
  const total = ORDER.reduce((s, k) => s + (Array.isArray(d[k]) ? d[k].length : 0), 0);
  if (total > MAX_RESTORE_RECORDS) throw Object.assign(new Error("backup_too_large"), { status: 413 });

  const svc = base44.asServiceRole.entities;
  const user = base44.entities;
  const ent = Object.fromEntries(BACKUP_ENTITIES.map((e) => [e.key, e.entity]));

  // Data milik pengguna saat ini.
  const existing = {};
  for (const key of ORDER) {
    existing[key] = (await fetchAll(svc[ent[key]], ownerFilter(key, me.id)) || [])
      .filter((r) => (key === "snapshots" ? r.owner_id === me.id : r.created_by_id === me.id));
  }

  const idMap = { assets: {}, savingsGoals: {}, recurringBills: {} };
  const pairMap = {};
  const created = Object.fromEntries(ORDER.map((k) => [k, 0]));
  const skipped = {};
  const createdIds = []; // [entity, id] — untuk rollback mode replace
  const skip = (reason) => { skipped[reason] = (skipped[reason] || 0) + 1; };

  const remapOne = (map, v) => (v ? map[v] || null : v);
  // Satu batch → tidak memicu notifikasi per transaksi ke pasangan.
  const restoreBatch = "restore-" + Date.now();

  const prepare = (key, raw) => {
    if (!isObj(raw)) return null;
    const r = { ...raw };
    // Pemetaan tautan ke id baru (tautan ke data yang tidak ikut → dilepas).
    if (key === "transactions") {
      if (r.linked_asset_id) r.linked_asset_id = remapOne(idMap.assets, r.linked_asset_id);
      if (r.savings_goal_id) r.savings_goal_id = remapOne(idMap.savingsGoals, r.savings_goal_id);
      if (r.recurring_id) r.recurring_id = remapOne(idMap.recurringBills, r.recurring_id);
      if (r.transfer_pair_id) r.transfer_pair_id = (pairMap[r.transfer_pair_id] ||= "restore-" + crypto.randomUUID());
    }
    if (["debts", "savingsGoals", "recurringBills"].includes(key) && r.linked_asset_id) r.linked_asset_id = remapOne(idMap.assets, r.linked_asset_id);
    if (key === "savingsGoals" && Array.isArray(r.allocated_asset_ids)) r.allocated_asset_ids = r.allocated_asset_ids.map((x) => idMap.assets[x]).filter(Boolean);
    if (key === "investmentLots") {
      if (!r.asset_id || !idMap.assets[r.asset_id]) return (skip("orphan_lot"), null);
      r.asset_id = idMap.assets[r.asset_id];
    }
    const res = CLEAN[key](noId(r));
    if (res.skip) return (skip(res.skip), null);
    return key === "transactions" ? { ...res.data, notif_batch_id: restoreBatch } : res.data;
  };

  try {
    for (const key of ORDER) {
      const rows = Array.isArray(d[key]) ? d[key] : [];
      if (!rows.length) continue;
      const exById = new Map(existing[key].map((x) => [x.id, x]));
      const exByFp = new Map(existing[key].map((x) => [fpOf(key, x), x]));
      const toCreate = [];
      const oldIds = [];
      for (const raw of rows) {
        if (mode === "merge") {
          // Sama persis (id masih ada) atau sidik jari sama → lewati, tapi petakan id.
          const hit = (raw?.id && exById.get(raw.id)) || exByFp.get(fpOf(key, raw || {}));
          if (hit) {
            if (raw?.id && idMap[key]) idMap[key][raw.id] = hit.id;
            if (key === "transactions" && raw?.transfer_pair_id && hit.transfer_pair_id) pairMap[raw.transfer_pair_id] = hit.transfer_pair_id;
            skip("duplicate");
            continue;
          }
        }
        const data = prepare(key, raw);
        if (!data) continue;
        toCreate.push(key === "snapshots" ? { ...data, owner_id: me.id } : data);
        oldIds.push(raw.id);
      }
      if (!toCreate.length) continue;
      // Snapshot: create khusus admin (RLS) → service role dengan owner_id = pemanggil.
      // Lainnya: lewat klien pengguna agar created_by_id = pemanggil.
      const coll = key === "snapshots" ? svc[ent[key]] : user[ent[key]];
      const out = [];
      for (let i = 0; i < toCreate.length; i += 200) {
        const part = await coll.bulkCreate(toCreate.slice(i, i + 200));
        out.push(...(Array.isArray(part) ? part : []));
      }
      out.forEach((n, i) => {
        if (!n?.id) return;
        createdIds.push([ent[key], n.id]);
        if (idMap[key] && oldIds[i]) idMap[key][oldIds[i]] = n.id;
      });
      created[key] = toCreate.length;
    }
  } catch (e) {
    if (mode === "replace") {
      // Batalkan: hapus yang sempat dibuat; data lama belum disentuh.
      for (const [entity, id] of createdIds) { try { await svc[entity].delete(id); } catch { /* lanjut */ } }
    }
    throw e;
  }

  let removed = 0;
  if (mode === "replace") {
    // Transaksi lama yang menunggu persetujuan ikut terhapus → batalkan permintaannya
    // agar tidak menggantung di layar pasangan.
    const oldTxIds = new Set(existing.transactions.map((t) => t.id));
    const pend = await fetchAll(svc.TransactionApproval, { requester_id: me.id, status: "pending" }).catch(() => []);
    for (const a of pend || []) {
      if (oldTxIds.has(a.transaction_id)) { try { await svc.TransactionApproval.update(a.id, { status: "cancelled", decided_at: new Date().toISOString() }); } catch { /* lanjut */ } }
    }
    for (const key of ORDER) {
      for (const r of existing[key]) {
        try { await svc[ent[key]].delete(r.id); removed++; } catch { /* lanjut */ }
      }
    }
  }

  return { mode, version, created, skipped, removed };
}
