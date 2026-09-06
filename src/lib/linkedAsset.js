import { base44 } from "@/api/base44Client";

// Efek transaksi terhadap saldo aset: pemasukan menambah, pengeluaran & sedekah mengurangi.
export const txEffect = (tx) => {
  const amt = Number(tx.amount) || 0;
  if (tx.type === "income") return amt;
  return -amt;
};

// Menyesuaikan saldo aset yang ditautkan lewat backend function (service role,
// divalidasi lewat relasi Partnership). No-op bila tidak ada aset/delta.
export const adjustLinkedAsset = async (assetId, delta) => {
  if (!assetId || !delta) return;
  try {
    await base44.functions.invoke("adjustLinkedAsset", { asset_id: assetId, delta });
  } catch {}
};

// Penyesuaian saat transaksi diperbarui: membalik efek lama & menerapkan efek baru,
// menangani perubahan aset terkait maupun nominal.
export const adjustOnUpdate = async (oldTx, newTx) => {
  const oldLinked = oldTx?.linked_asset_id;
  const newLinked = newTx?.linked_asset_id;
  if (oldLinked && oldLinked === newLinked) {
    const delta = txEffect(newTx) - txEffect(oldTx);
    if (delta) await adjustLinkedAsset(oldLinked, delta);
  } else {
    if (oldLinked) await adjustLinkedAsset(oldLinked, -txEffect(oldTx));
    if (newLinked) await adjustLinkedAsset(newLinked, txEffect(newTx));
  }
};