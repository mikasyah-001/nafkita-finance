import { base44 } from "@/api/base44Client";

// Cadangan lokal memakai logika server yang SAMA dengan Google Drive
// (base44/shared/backupCore.ts): hanya data milik sendiri, id asli disimpan
// untuk memetakan ulang tautan, validasi & kepemilikan dicek di server.
export const BACKUP_ENTITIES = [
  { key: "transactions", label: "Transaksi" },
  { key: "assets", label: "Aset" },
  { key: "categories", label: "Kategori" },
  { key: "budgets", label: "Anggaran" },
  { key: "debts", label: "Utang/piutang" },
  { key: "savingsGoals", label: "Target tabungan" },
  { key: "recurringBills", label: "Tagihan berulang" },
  { key: "zakatPayments", label: "Zakat" },
  { key: "snapshots", label: "Snapshot aset" },
  { key: "templates", label: "Template" },
  { key: "investmentLots", label: "Lot investasi" },
  { key: "preferences", label: "Preferensi" },
];

export const BACKUP_VERSION = 3;
export const REPLACE_MIN_VERSION = 3;

// Pesan ramah untuk kode galat server.
export const RESTORE_ERRORS = {
  backup_not_yours: "File ini bukan cadangan akun Anda",
  replace_needs_v3: "Ganti total hanya untuk cadangan format baru. Gunakan Gabung untuk cadangan lama.",
  backup_too_large: "File cadangan terlalu besar",
  invalid_backup_file: "File cadangan tidak valid",
  backup_key_missing: "Cadangan terenkripsi, tetapi kunci enkripsi server belum diatur",
  backup_decrypt_failed: "Cadangan tidak bisa dibuka (kunci enkripsi berbeda)",
  too_soon: "Cadangan baru saja dibuat. Coba lagi beberapa menit lagi.",
};

export function restoreErrorMessage(e, fallback = "Gagal memulihkan cadangan") {
  const code = e?.response?.data?.error || e?.data?.error || e?.message;
  return RESTORE_ERRORS[code] || fallback;
}

export async function exportBackup() {
  const res = await base44.functions.invoke("backupToDrive", { action: "export" });
  const backup = res?.data?.backup;
  if (!backup?.data) throw new Error("export_failed");
  return backup;
}

/** Ringkasan hasil pemulihan: total data dibuat. */
export const createdTotal = (result) => Object.values(result?.created || {}).reduce((s, n) => s + (Number(n) || 0), 0);

export async function importBackup(backup, mode) {
  const res = await base44.functions.invoke("restoreFromDrive", { action: "restore_data", backup, mode });
  if (res?.data?.error) throw new Error(res.data.error);
  return res?.data || {};
}
