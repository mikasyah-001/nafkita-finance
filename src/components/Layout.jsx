import { useLocation, useOutlet } from "react-router-dom";
import { Suspense, useEffect, useRef } from "react";
import PageTransition from "./PageTransition";
import { base44 } from "@/api/base44Client";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";
import OfflineSyncManager from "./OfflineSyncManager";
import NotificationToaster from "./NotificationToaster";
import InstallPrompt from "./InstallPrompt";
import { useSeedCategories } from "@/hooks/useSeedCategories";
import { useScope } from "@/lib/ScopeContext";
import { useCoreDataReady, useMe, WarmSecondaryData } from "@/hooks/useFinance";
import { prefetchPages } from "@/lib/pagePrefetch";

export default function Layout() {
  useSeedCategories();
  const { scope } = useScope();
  const ready = useCoreDataReady();
  // Halaman baru dipasang setelah profil ada, agar state awalnya (mis. mata
  // uang utama) langsung benar — bukan IDR dulu lalu berganti.
  const { data: me } = useMe();
  useEffect(() => { if (ready) prefetchPages(); }, [ready]);

  // Heartbeat: perbarui last_active_at tiap 60 detik + saat tab kembali fokus.
  const heartbeat = useRef(null);
  useEffect(() => {
    // focus & visibilitychange sering terpicu bersamaan → batasi 1x per 30 dtk.
    let last = 0;
    const send = () => {
      const now = Date.now();
      if (now - last < 30000) return;
      last = now;
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
          {/* Satu layar muat sampai data inti siap (paralel). Halaman sudah
              dirender tersembunyi agar kode & state siap — tampil sekali,
              tanpa "Rp 0 → angka → angka berubah lagi". */}
          {!ready && <PageFallback />}
          <div className={ready ? "contents" : "hidden"} aria-hidden={!ready}>
            {/* Kunci per pathname → tiap layar beranimasi saat berpindah; query
                string (mis. ?tab=) tidak memicu animasi ulang. */}
            {/* Tanpa AnimatePresence mode="wait": halaman lama tidak perlu
                memudar dulu (dulu menimbulkan jeda kosong = kedip pertama). */}
            {/* Suspense di LUAR pembungkus ber-key: boundary tetap sama antar
                halaman, sehingga navigasi (startTransition) mempertahankan
                halaman lama sampai halaman baru siap — tanpa skeleton sesaat. */}
            {me && (
              <Suspense fallback={<PageFallback />}>
                <PageTransition key={location.pathname}>{outlet}</PageTransition>
              </Suspense>
            )}
          </div>
        </div>
      </main>
      {ready && <WarmSecondaryData />}
      <BottomNav />
      <OfflineSyncManager />
      <NotificationToaster />
      <InstallPrompt />
    </div>
  );
}

// Kerangka sementara saat data inti atau kode halaman sedang dimuat —
// dirender di dalam Layout sehingga sidebar & nav bawah tidak ikut hilang.
function PageFallback() {
  return (
    <div className="px-5 pt-6 space-y-4" aria-busy="true" aria-label="Memuat halaman">
      <div className="flex items-center gap-3">
        <img src="/brand/mark.png" alt="" className="w-10 h-10 animate-pulse" />
        <div className="space-y-2 flex-1">
          <div className="h-3 w-32 rounded bg-muted animate-pulse" />
          <div className="h-5 w-44 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
      <div className="h-40 rounded-[28px] bg-muted animate-pulse" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-28 rounded-3xl bg-muted animate-pulse" />
        <div className="h-28 rounded-3xl bg-muted animate-pulse" />
      </div>
      <div className="h-48 rounded-3xl bg-muted animate-pulse" />
    </div>
  );
}
