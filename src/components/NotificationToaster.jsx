import { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { formatMoney } from "@/lib/finance";

// Menampilkan toast app-wide saat notifikasi baru dibuat untuk user ini.
// Menampilkan nama pelaku (actor_name) dan judul eksplisit.
const notifBody = (n) => {
  const raw = String(n.body || "");
  if (n.entity_kind === "transaction" && n.currency && n.amount != null && !raw.includes("•••")) {
    const sign = n.tx_type === "income" ? "+" : "-";
    const separator = raw.indexOf(" • ");
    const label = separator >= 0 ? raw.slice(separator + 3).trim() : "";
    return `${sign}${formatMoney(Number(n.amount) || 0, String(n.currency).toUpperCase())}${label ? ` • ${label}` : ""}`;
  }
  return raw;
};

export default function NotificationToaster() {
  useEffect(() => {
    const handle = (event) => {
      if (!event || event.type !== "create" || !event.data) return;
      const n = event.data;
      const title = n.title || n.actor_name || "Notifikasi baru";
      const body = notifBody(n);
      toast.info(title, {
        description: body,
        duration: 7000,
        icon: <Bell className="w-4 h-4 text-primary" />,
      });
    };
    const unsub = base44.entities.Notification.subscribe(handle);
    return () => { if (unsub) unsub(); };
  }, []);

  return null;
}