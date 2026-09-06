import { base44 } from "@/api/base44Client";

// Efek transaksi terhadap saldo aset: pemasukan menambah, pengeluaran & sedekah mengurangi.
export const txEffect = (tx) => {
  const amt = Number(tx.amount) || 0;
  if (tx.type === "income") return amt;
  return -amt;
};

// Menyimpan transaksi + menyesuaikan saldo aset terkait secara atomik (backend).
// Bila transaction_id diberikan → update; jika tidak → create.
export const saveTransactionWithAsset = async (transaction, transaction_id) => {
  const res = await base44.functions.invoke("saveTransactionWithAsset", { transaction, transaction_id });
  return res.data;
};

// Menghapus transaksi + mengembalikan saldo aset secara atomik (backend).
export const deleteTransactionWithAsset = async (transaction_id) => {
  const res = await base44.functions.invoke("deleteTransactionWithAsset", { transaction_id });
  return res.data;
};