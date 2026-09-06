import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Bell, CheckCheck, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/finance";

// Format ulang nominal dari field terstruktur agar selalu memakai mata uang
// transaksi asli, bukan mata uang default akun penerima.
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

const fmtTime = (iso) => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return "Baru saja";
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
};

const kindIcon = (k) => {
  if (k === "asset") return "🏦";
  if (k === "bulk") return "📋";
  if (k === "partnership") return "💍";
  return "💸";
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [marking, setMarking] = useState(false);
  const panelRef = useRef(null);

  const loadInitial = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("getNotificationData", {});
      const data = res.data || res;
      setItems(data.items || []);
      setUnreadCount(data.unread_count || 0);
      setHasMore(!!data.has_more);
    } catch {
      toast.error("Gagal memuat notifikasi");
    }
    setLoading(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || items.length === 0) return;
    setLoadingMore(true);
    try {
      const cursor = items[items.length - 1]?.created_date;
      const res = await base44.functions.invoke("getNotificationData", { cursor });
      const data = res.data || res;
      setItems((prev) => [...prev, ...(data.items || [])]);
      setHasMore(!!data.has_more);
    } catch {
      toast.error("Gagal memuat notifikasi lama");
    }
    setLoadingMore(false);
  }, [hasMore, loadingMore, items]);

  useEffect(() => {
    loadInitial();
    const unsub = base44.entities.Notification.subscribe((event) => {
      if (!event || !event.data) return;
      const n = event.data;
      if (event.type === "delete") {
        setItems((prev) => prev.filter((x) => x.id !== n.id));
        return;
      }
      if (event.type === "create") {
        setItems((prev) => {
          if (prev.some((x) => x.id === n.id)) return prev;
          return [n, ...prev];
        });
        if (!n.read) setUnreadCount((c) => c + 1);
        return;
      }
      // update — hanya sesuaikan badge bila status read benar-benar berubah
      setItems((prev) => {
        const exists = prev.some((x) => x.id === n.id);
        if (!exists) return prev;
        const oldItem = prev.find((x) => x.id === n.id);
        const wasUnread = oldItem && !oldItem.read;
        const isRead = !!n.read;
        if (wasUnread && isRead) {
          setUnreadCount((c) => Math.max(0, c - 1));
        } else if (!wasUnread && !isRead) {
          setUnreadCount((c) => c + 1);
        }
        return prev.map((x) => (x.id === n.id ? { ...x, ...n } : x));
      });
    });
    return () => { if (unsub) unsub(); };
  }, [loadInitial]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    setMarking(true);
    const unreadItems = items.filter((n) => !n.read);
    const prevCount = unreadCount;
    setUnreadCount(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await base44.entities.Notification.updateMany({ read: false }, { $set: { read: true } });
    } catch {
      // Hanya kembalikan item yang sebelumnya belum dibaca (bukan semua).
      setUnreadCount(prevCount);
      const unreadIds = new Set(unreadItems.map((n) => n.id));
      setItems((prev) => prev.map((n) => (unreadIds.has(n.id) ? { ...n, read: false } : n)));
      toast.error("Gagal menandai dibaca");
    }
    setMarking(false);
  };

  const openNotif = async (n) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await base44.entities.Notification.update(n.id, { read: true });
      } catch {
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: false } : x)));
        setUnreadCount((c) => c + 1);
        toast.error("Gagal menandai dibaca");
      }
    }
    setOpen(false);
    if (n.ref_id) {
      if (n.entity_kind === "asset") navigate("/aset");
      else if (n.entity_kind === "partnership") navigate("/profil");
      else navigate(`/transaksi/${n.ref_id}`);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform relative"
        aria-label="Notifikasi"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed right-3 top-16 w-[24rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-border bg-card shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold">Notifikasi</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} disabled={marking} className="text-xs text-muted-foreground flex items-center gap-1 disabled:opacity-60">
                {marking ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />} Tandai dibaca
              </button>
            )}
          </div>
          <div className="max-h-[min(32rem,70vh)] overflow-y-auto">
            {loading ? (
              <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada notifikasi</p>
                <p className="text-xs text-muted-foreground mt-1">Notifikasi dari pasangan akan muncul di sini.</p>
              </div>
            ) : (
              <>
                {items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openNotif(n)}
                    className={`w-full text-left px-4 py-3 border-b border-border last:border-0 flex gap-2.5 active:bg-muted/50 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
                  >
                    <div className="text-base shrink-0 leading-6">{kindIcon(n.entity_kind)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <p className="text-sm font-semibold leading-snug whitespace-normal break-words flex-1">{n.title || n.actor_name || "Notifikasi baru"}</p>
                        {n.currency && n.amount != null && !String(n.body || "").includes("•••") && (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">{String(n.currency).toUpperCase()}</span>
                        )}
                      </div>
                      {notifBody(n) && <p className="text-xs text-muted-foreground leading-relaxed whitespace-normal break-words mt-1">{notifBody(n)}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1.5">{fmtTime(n.created_date)}</p>
                    </div>
                    {!n.read && <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-primary" />}
                  </button>
                ))}
                {hasMore && (
                  <button onClick={loadMore} disabled={loadingMore} className="w-full py-3 text-xs text-muted-foreground flex items-center justify-center gap-1 disabled:opacity-60">
                    {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />} Muat lebih lama
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}