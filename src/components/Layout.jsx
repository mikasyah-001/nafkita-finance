import { useLocation, useOutlet } from "react-router-dom";
import { Suspense, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import PageTransition from "./PageTransition";
import { base44 } from "@/api/base44Client";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";
import OfflineSyncManager from "./OfflineSyncManager";
import NotificationToaster from "./NotificationToaster";
import InstallPrompt from "./InstallPrompt";
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

  const location = useLocation();
  const outlet = useOutlet();

  return (
    <div className={`min-h-screen flex ${scope === "private" ? "bg-scope-tint-private" : "bg-scope-tint-shared"}`}>
      <Sidebar />
      <main className="flex-1 pb-28 md:pb-8 min-h-screen w-full max-w-md md:max-w-3xl mx-auto px-0 md:px-6 py-0 md:py-6 min-w-0">
        {/* pt-safe: konten tidak tertutup notch / status bar saat dibuka di
            WebView native (viewport-fit=cover). Di desktop nilainya 0. */}
        <div className="pt-safe">
          {/* Kunci per pathname → tiap layar beranimasi saat berpindah; query
              string (mis. ?tab=) tidak memicu animasi ulang. */}
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={location.pathname}>
              <Suspense fallback={<PageFallback />}>{outlet}</Suspense>
            </PageTransition>
          </AnimatePresence>
        </div>
      </main>
      <BottomNav />
      <OfflineSyncManager />
      <NotificationToaster />
      <InstallPrompt />
    </div>
  );
}

// Kerangka sementara saat halaman (code-split) sedang dimuat — dirender di
// dalam Layout sehingga sidebar & nav bawah tidak ikut hilang.
function PageFallback() {
  return (
    <div className="px-5 pt-6 space-y-4" aria-busy="true" aria-label="Memuat halaman">
      <div className="h-7 w-40 rounded-lg bg-muted animate-pulse" />
      <div className="h-36 rounded-3xl bg-muted animate-pulse" />
      <div className="h-48 rounded-2xl bg-muted animate-pulse" />
    </div>
  );
}
