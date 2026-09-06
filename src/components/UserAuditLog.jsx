import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { formatDate } from "@/lib/finance";
import { ScrollText, Loader2 } from "lucide-react";

// Menampilkan audit log milik user sendiri (aksi yang dilakukan oleh user ini).
// Hanya tampil bila ada entri — jangan tampilkan apa pun bila kosong.
export default function UserAuditLog({ userId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const res = await base44.entities.AuditLog.filter({ actor_id: userId }, "-created_date", 20);
        setLogs(res || []);
      } catch {
        setLogs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) {
    return (
      <div className="mt-5 py-4 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) return null;

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 mb-3">
        <ScrollText className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm">Riwayat Aktivitas Saya</h2>
      </div>
      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-primary">{log.action}</p>
                {log.target_label && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{log.target_label}</p>}
                {log.details && <p className="text-[11px] text-muted-foreground mt-0.5">{log.details}</p>}
              </div>
              <p className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                {formatDate(log.created_date, "dd MMM, HH:mm")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}