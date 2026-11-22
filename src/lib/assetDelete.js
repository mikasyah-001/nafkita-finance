import { base44 } from "@/api/base44Client";
import { confirmAction } from "@/components/ConfirmHost";

// Teks dampak penghapusan aset (dari dry_run deleteAssetWithLots).
export function deleteImpactText(asset, impact = {}) {
  const parts = [];
  if (impact.transactions) parts.push(`${impact.transactions} transaksi tetap tersimpan, tapi tidak lagi terhubung ke ${asset.name}`);
  if (impact.recurring_bills) parts.push(`${impact.recurring_bills} tagihan berulang dilepas dari aset ini`);
  if (impact.debts) parts.push(`${impact.debts} catatan utang/piutang dilepas dari aset ini`);
  if (impact.savings_goals) parts.push(`${impact.savings_goals} target tabungan tidak lagi memakai aset ini`);
  if (impact.card_labels) parts.push(`${impact.card_labels} label kartu Catat Otomatis berhenti mencatat sampai dihubungkan lagi`);
  if (impact.inbox_items) parts.push(`${impact.inbox_items} item Kotak Masuk perlu dipilihkan rekening lain`);
  if (impact.investment_lots) parts.push(`${impact.investment_lots} riwayat pembelian (DCA) ikut dihapus`);
  const head = "Aset dihapus permanen dan tidak bisa dikembalikan.";
  return parts.length ? `${head} ${parts.join("; ")}.` : head;
}

/**
 * Alur hapus aset (satu-satunya, dipakai detail aset & form edit):
 * hitung dampak → konfirmasi → hapus. Mengembalikan true bila terhapus.
 */
export async function deleteAssetFlow(asset) {
  let impact = {};
  try {
    const res = await base44.functions.invoke("deleteAssetWithLots", { asset_id: asset.id, dry_run: true });
    impact = res?.data?.impact || {};
  } catch { /* tetap tampilkan konfirmasi umum */ }
  const ok = await confirmAction({
    title: `Hapus "${asset.name}"?`,
    description: deleteImpactText(asset, impact),
    confirmText: "Hapus aset",
  });
  if (!ok) return false;
  await base44.functions.invoke("deleteAssetWithLots", { asset_id: asset.id });
  return true;
}
