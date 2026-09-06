import { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

// Deteksi zona waktu browser dan simpan ke record user (sekali per ses, hanya jika berubah).
// Juga mengatur default_currency otomatis berdasarkan zona waktu (Asia/Riyadh → SAR,
// lainnya → IDR) bila user belum mengaturnya secara manual.
// Digunakan oleh pengingat harian agar email tiba di jam lokal user.
export function useTimezoneSync() {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let tz;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!tz) return;

    // Tentukan mata uang default berdasarkan zona waktu (deteksi otomatis).
    const detectedCurrency = tz && tz.startsWith("Asia/Riyadh") ? "SAR" : "IDR";
    const needsTz = tz !== user.timezone;
    const needsCurrency = !user.default_currency && detectedCurrency !== "IDR";

    if (needsTz || needsCurrency) {
      const update = {};
      if (needsTz) update.timezone = tz;
      if (needsCurrency) update.default_currency = detectedCurrency;
      base44.auth.updateMe(update).catch(() => {});
    }
  }, [isAuthenticated, user]);
}