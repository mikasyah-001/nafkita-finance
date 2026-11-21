// Logika "Dompet" di Beranda: rekening mana yang tampil sebagai kartu dan
// ringkasan aktivitas per rekening. Saldo = Asset.value; aktivitas =
// transaksi ber-linked_asset_id (sumber yang sama dengan halaman Aset).
import { isMoneyAsset } from "./finance.js";

// Rekening bank/tunai sesuai cakupan Bersama/Pribadi. Urutan: milik sendiri
// dulu, lalu saldo terbesar (urutan stabil per mata uang tidak dijamin).
export function walletAccounts(assets = [], { scope = "shared", meId } = {}) {
  return assets
    .filter(isMoneyAsset)
    .filter((a) => (scope === "private"
      ? a.visibility === "private" && a.created_by_id === meId
      : a.visibility !== "private"))
    .sort((a, b) => (a.created_by_id === meId ? 0 : 1) - (b.created_by_id === meId ? 0 : 1) || (b.value || 0) - (a.value || 0));
}

const approved = (t) => !t.approval_status || t.approval_status === "approved";

// Masuk/keluar bulan berjalan + transaksi terakhir untuk satu rekening.
// Transfer ikut dihitung: bagi rekening, transfer memang uang masuk/keluar.
export function accountActivity(transactions = [], assetId, { now = new Date(), recent = 3 } = {}) {
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const linked = transactions
    .filter((t) => t.linked_asset_id === assetId && approved(t))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  let masuk = 0, keluar = 0;
  for (const t of linked) {
    if (!String(t.date || "").startsWith(monthKey)) continue;
    if (t.type === "income") masuk += Number(t.amount) || 0;
    else keluar += Number(t.amount) || 0;
  }
  return { masuk, keluar, recent: linked.slice(0, recent), count: linked.length };
}

// Indeks berikutnya/sebelumnya dengan putaran (kartu terakhir → pertama).
export const wrapIndex = (i, n) => (n ? ((i % n) + n) % n : 0);
