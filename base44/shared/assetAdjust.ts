// Logika bersama untuk penyesuaian saldo aset terkait transaksi.
// Dipakai oleh adjustLinkedAsset, saveTransactionWithAsset, deleteTransactionWithAsset.

// Efek transaksi terhadap saldo aset: pemasukan menambah, pengeluaran & sedekah mengurangi.
export const txEffect = (tx) => {
  const amt = Number(tx?.amount) || 0;
  return tx?.type === "income" ? amt : -amt;
};

// Pembulatan mengikuti aturan mata uang: IDR 0 desimal, SAR/USD 2 desimal.
export const roundForCurrency = (val, currency) => {
  if (currency === "SAR" || currency === "USD") return Math.round(val * 100) / 100;
  return Math.round(val);
};