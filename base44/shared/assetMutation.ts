// Mencatat mutasi aset secara immutable.
// Dipanggil oleh semua backend function yang mengubah nilai aset:
// saveTransactionWithAsset, reconcileAsset, saveTransfer, adjustLinkedAsset, deleteTransactionWithAsset.
//
// Record AssetMutation tidak dapat diubah/dihapus (RLS update/delete = null).
// Hanya dibuat via asServiceRole dari backend function.
import { roundForCurrency } from "./assetAdjust.ts";

export async function recordAssetMutation(base44, params) {
  const {
    asset_id,
    previous_value,
    new_value,
    change_type,
    source_ref,
    source_description,
    actor_id,
    actor_name,
    notes,
    currency,
  } = params;

  if (!asset_id) return null;
  const cur = currency || "IDR";
  const prev = Number(previous_value) || 0;
  const next = Number(new_value) || 0;
  const delta = roundForCurrency(next - prev, cur);

  try {
    // Ambil snapshot nama aset.
    const asset = await base44.asServiceRole.entities.Asset.get(asset_id);
    const assetName = asset?.name || "";
    const ownerId = asset?.created_by_id || null;

    return await base44.asServiceRole.entities.AssetMutation.create({
      asset_id,
      asset_name_snapshot: assetName,
      owner_id: ownerId,
      previous_value: prev,
      new_value: next,
      delta,
      currency: cur,
      change_type: change_type || "manual_edit",
      source_ref: source_ref || null,
      source_description: source_description || null,
      actor_id: actor_id || null,
      actor_name: actor_name || null,
      notes: notes || null,
    });
  } catch (e) {
    console.error("[recordAssetMutation] failed", e?.message || e);
    return null;
  }
}