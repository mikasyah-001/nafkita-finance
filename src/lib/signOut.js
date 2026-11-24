import { base44 } from "@/api/base44Client";
import { getPending } from "@/lib/offlineQueue";
import { confirmAction } from "@/components/ConfirmHost";
import { clearLocalUserData } from "@/lib/localData";

// Keluar: konfirmasi bila masih ada transaksi offline, bersihkan data lokal
// (lib/localData.js), lalu akhiri sesi.
/** @returns {Promise<boolean>} false bila pengguna membatalkan */
export async function signOut(userId, redirectTo) {
  const pending = userId ? getPending(userId).length : 0;
  if (pending > 0) {
    const ok = await confirmAction({
      title: `${pending} transaksi belum tersinkron`,
      description: "Transaksi yang dicatat saat offline belum terkirim ke server. Bila keluar sekarang, catatan itu akan hilang dari perangkat ini. Sambungkan internet dan tunggu sinkron untuk menyimpannya.",
      confirmText: "Tetap keluar",
    });
    if (!ok) return false;
  }
  clearLocalUserData();
  await base44.auth.logout(redirectTo);
  return true;
}
