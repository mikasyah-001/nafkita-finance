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
    const parts = raw.split(" • ");
    const label = parts.length > 1 ? parts[parts.length - 1] : "";
    return `${sign}${formatMoney(n.amount, n.currency)}${label ? ` • ${label}` : ""}`;
  }
  return raw;
};

export default function NotificationToaster() {
  useEffect(() => {
    const handle = (event) => {
      if (!event || event.type !== "create" || !event.data) return;
      const n = event.data;
      const title = n.actor_name ? `${n.actor_name}` : "Notifikasi baru";
      const body = notifBody(n);
      toast.info(title, {
        description: n.title === n.actor_name ? body : `${n.title}${body ? ` — ${body}` : ""}`,
        duration: 5000,
        icon: <Bell className="w-4 h-4 text-primary" />,
      });
    };
    const unsub = base44.entities.Notification.subscribe(handle);
    return () => { if (unsub) unsub(); };
  }, []);

  return null;
}