// SATU aturan "transaksi yang dihitung sebagai pemasukan/pengeluaran" untuk
// seluruh aplikasi (Beranda, Laporan, Anggaran, rollover, email bulanan, admin).
// Dipakai frontend (src/lib/finance.js) dan backend function.
//
// Tidak dihitung:
//  - transfer antar-rekening (transfer_pair_id) — uang pindah, bukan dibelanjakan
//  - menunggu/ditolak persetujuan pasangan
//  - penyesuaian rekonsiliasi / Audit Kas (is_adjustment) — koreksi pencatatan,
//    bukan uang masuk/keluar baru; saldo rekening tetap disesuaikan
//  - setoran ke target tabungan (is_savings_deposit) — uang disisihkan, bukan
//    dibelanjakan; tetap terlihat sebagai uang keluar di rekening (Dompet)
export function isReportable(t) {
  if (!t) return false;
  if (t.transfer_pair_id) return false;
  if (t.approval_status && t.approval_status !== "approved") return false;
  if (t.is_adjustment) return false;
  if (t.is_savings_deposit) return false;
  return true;
}
