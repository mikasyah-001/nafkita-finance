import { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Bell } from "lucide-react";

// Menampilkan toast app-wide saat notifikasi baru dibuat untuk user ini.
// Sumber notifikasi adalah entitas Notification (dibuat oleh workflow saat
// pasangan menambah/memperbarui transaksi bersama).
export default function NotificationToaster() {
  useEffect(() => {
    const handle = (event) => {
      if (!event || event.type !== "create" || !event.data) return;
      const n = event.data;
      toast.info(n.title || "Notifikasi baru", {
        description: n.body || "",
        duration: 5000,
        icon: <Bell className="w-4 h-4 text-primary" />,
      });
    };
    const unsub = base44.entities.Notification.subscribe(handle);
    return () => { if (unsub) unsub(); };
  }, []);

  return null;
}