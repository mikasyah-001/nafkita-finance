import { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

// Deteksi zona waktu browser dan simpan ke record user (sekali per ses, hanya jika berubah).
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
    if (!tz || tz === user.timezone) return;
    base44.auth.updateMe({ timezone: tz }).catch(() => {});
  }, [isAuthenticated, user]);
}