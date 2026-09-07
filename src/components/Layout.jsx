import { Outlet } from "react-router-dom";
import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";
import OfflineSyncManager from "./OfflineSyncManager";
import NotificationToaster from "./NotificationToaster";
import InstallPrompt from "./InstallPrompt";
import { Toaster } from "sonner";
import { useSeedCategories } from "@/hooks/useSeedCategories";
import { useScope } from "@/lib/ScopeContext";

export default function Layout() {
  useSeedCategories();
  const { scope } = useScope();

  // Heartbeat: perbarui last_active_at tiap 60 detik + saat tab kembali fokus.
  const heartbeat = useRef(null);
  useEffect(() => {
    const send = () => {
      base44.auth.updateMe({ last_active_at: new Date().toISOString() }).catch(() => {});
    };
    send();
    heartbeat.current = setInterval(send, 60000);
    const onVisibility = () => { if (!document.hidden) send(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    return () => {
      clearInterval(heartbeat.current);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, []);

  return (
    <div className={`min-h-screen flex ${scope === "private" ? "bg-scope-tint-private" : "bg-scope-tint-shared"}`}>
      <Sidebar />
      <main className="flex-1 pb-28 md:pb-8 min-h-screen w-full max-w-md md:max-w-3xl mx-auto px-0 md:px-6 py-0 md:py-6 min-w-0">
        <Outlet />
      </main>
      <BottomNav />
      <OfflineSyncManager />
      <NotificationToaster />
      <InstallPrompt />
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}