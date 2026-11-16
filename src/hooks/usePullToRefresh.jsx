import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

// Tarik-untuk-memuat-ulang berbasis touch event, untuk WebView native
// (overscroll bawaan dimatikan di index.css, jadi gestur ini yang mengambil
// alih). Hanya aktif saat halaman berada di paling atas; tidak bereaksi di
// dalam dialog/sheet atau saat menggeser karusel horizontal.
const THRESHOLD = 64; // jarak tarik (px, setelah redaman) untuk memicu muat ulang
const MAX_PULL = 96;
const MIN_SPIN_MS = 600; // spinner minimal tampil sebentar agar terasa ada umpan balik

export function usePullToRefresh(onRefresh, { disabled = false } = {}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef(null); // { x, y } atau null
  const tracking = useRef(false);
  const pullRef = useRef(0);
  const armed = useRef(false);
  const busy = useRef(false);
  const cb = useRef(onRefresh);
  cb.current = onRefresh;

  const setPullBoth = (v) => { pullRef.current = v; setPull(v); };

  const run = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    setPullBoth(THRESHOLD);
    const t0 = Date.now();
    try {
      await Promise.resolve(cb.current?.());
    } catch {
      /* kegagalan ditangani oleh query masing-masing */
    }
    const wait = MIN_SPIN_MS - (Date.now() - t0);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    busy.current = false;
    setRefreshing(false);
    setPullBoth(0);
  }, []);

  useEffect(() => {
    if (disabled) return undefined;

    const onStart = (e) => {
      if (busy.current || e.touches.length !== 1) return;
      const scroller = document.scrollingElement || document.documentElement;
      if (scroller.scrollTop > 0) return;
      const t = e.target;
      if (t instanceof Element && t.closest('[role="dialog"], [role="alertdialog"], [data-no-ptr], input, textarea, select')) return;
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      tracking.current = false;
      armed.current = false;
    };

    const onMove = (e) => {
      if (!start.current) return;
      const dx = e.touches[0].clientX - start.current.x;
      const dy = e.touches[0].clientY - start.current.y;
      if (!tracking.current) {
        // Tentukan arah sekali: gestur horizontal/ke atas bukan tarik-refresh.
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) { start.current = null; return; }
        tracking.current = true;
      }
      if (dy <= 0) { setPullBoth(0); return; }
      if (e.cancelable) e.preventDefault();
      const damped = Math.min(MAX_PULL, dy * 0.5);
      if (!armed.current && damped >= THRESHOLD) {
        armed.current = true;
        try { navigator.vibrate?.(8); } catch { /* tidak didukung */ }
      } else if (armed.current && damped < THRESHOLD) {
        armed.current = false;
      }
      setPullBoth(damped);
    };

    const onEnd = () => {
      if (!start.current) return;
      const shouldRun = tracking.current && pullRef.current >= THRESHOLD;
      start.current = null;
      tracking.current = false;
      if (shouldRun) run();
      else setPullBoth(0);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [disabled, run]);

  return { pull, refreshing, threshold: THRESHOLD, refresh: run };
}

// Indikator bulat di atas layar. Dirender fixed (tidak menggeser konten)
// sehingga tidak memicu layout ulang daftar panjang saat ditarik.
export function PullToRefreshIndicator({ pull, refreshing, threshold = THRESHOLD }) {
  const visible = pull > 0 || refreshing;
  const progress = Math.min(1, pull / threshold);
  return (
    <div
      aria-hidden={!refreshing}
      role="status"
      aria-live="polite"
      className="fixed left-1/2 z-40 pointer-events-none no-select"
      style={{
        top: "env(safe-area-inset-top)",
        transform: `translate(-50%, ${visible ? Math.max(8, pull - 28) : -56}px)`,
        opacity: visible ? Math.max(0.35, progress) : 0,
        transition: start0(pull, refreshing) ? "transform 200ms ease, opacity 200ms ease" : "none",
      }}
    >
      <span className="w-10 h-10 rounded-full bg-card border border-border shadow-lg flex items-center justify-center text-primary">
        <RefreshCw
          className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
        />
      </span>
      {refreshing && <span className="sr-only">Memuat ulang data…</span>}
    </div>
  );
}

// Animasikan hanya saat melepas/menyelesaikan (pull 0 atau sedang refresh);
// selama jari menarik, indikator mengikuti jari tanpa jeda.
function start0(pull, refreshing) {
  return pull === 0 || refreshing;
}
