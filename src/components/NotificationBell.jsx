import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Bell, CheckCheck, Loader2 } from "lucide-react";

const fmtTime = (iso) => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return "Baru saja";
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const panelRef = useRef(null);

  const load = async () => {
    try {
      const list = await base44.entities.Notification.list("-created_date", 30);
      setItems(list || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Notification.subscribe((event) => {
      if (!event || !event.data) return;
      setItems((prev) => {
        const exists = prev.some((n) => n.id === event.data.id);
        if (event.type === "delete") return prev.filter((n) => n.id !== event.data.id);
        if (exists) return prev.map((n) => (n.id === event.data.id ? { ...n, ...event.data } : n));
        return [event.data, ...prev];
      });
    });
    return () => { if (unsub) unsub(); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  const markAllRead = async () => {
    if (unread === 0) return;
    setMarking(true);
    try {
      await base44.entities.Notification.updateMany({ read: false }, { $set: { read: true } });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
    setMarking(false);
  };

  const openNotif = (n) => {
    if (!n.read) {
      base44.entities.Notification.update(n.id, { read: true }).catch(() => {});
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    setOpen(false);
    if (n.ref_id) navigate(`/transaksi/${n.ref_id}`);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform relative"
        aria-label="Notifikasi"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-border bg-card shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold">Notifikasi</p>
            {unread > 0 && (
              <button onClick={markAllRead} disabled={marking} className="text-xs text-muted-foreground flex items-center gap-1 disabled:opacity-60">
                {marking ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />} Tandai dibaca
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada notifikasi</p>
                <p className="text-xs text-muted-foreground mt-1">Notifikasi dari pasangan akan muncul di sini.</p>
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNotif(n)}
                  className={`w-full text-left px-4 py-3 border-b border-border last:border-0 flex gap-2.5 active:bg-muted/50 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? "bg-transparent" : "bg-primary"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{fmtTime(n.created_date)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}