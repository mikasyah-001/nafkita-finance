import { useEffect, useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";

const DISMISS_KEY = "nafkita_install_dismissed_v1";

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

function detectPlatform() {
  const ua = navigator.userAgent || "";
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && "ontouchend" in document);
  const isAndroid = /android/i.test(ua);
  return { isIOS, isAndroid };
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState({ isIOS: false, isAndroid: false });
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    setPlatform(detectPlatform());

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari tidak memicu beforeinstallprompt — tampilkan hint manual
    const p = detectPlatform();
    if (p.isIOS) {
      setIosHint(true);
      setVisible(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch {
      // ignore
    }
    setDeferredPrompt(null);
    setVisible(false);
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 left-3 right-3 z-50 max-w-md mx-auto animate-in slide-in-from-bottom duration-300">
      <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
        <div className="flex items-start gap-3 p-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Pasang NAFKITA di ponselmu</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {iosHint
                ? "Ketuk tombol Bagikan lalu pilih \"Tambah ke Layar Utama\" untuk akses cepat seperti aplikasi."
                : "Akses lebih cepat dan notifikasi langsung dari ponselmu."}
            </p>
            <div className="flex gap-2 mt-3">
              {iosHint ? (
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); handleDismiss(); }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary"
                >
                  <Share className="w-3.5 h-3.5" /> Bagikan
                  <span className="mx-1 text-muted-foreground">·</span>
                  <Plus className="w-3.5 h-3.5" /> Layar Utama
                </a>
              ) : (
                <button
                  onClick={handleInstall}
                  className="rounded-xl bg-primary text-primary-foreground px-3.5 py-1.5 text-xs font-semibold active:scale-95 transition-transform"
                >
                  Pasang
                </button>
              )}
              <button
                onClick={handleDismiss}
                className="rounded-xl px-3 py-1.5 text-xs font-medium text-muted-foreground"
              >
                Nanti saja
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground -mt-1 -mr-1 p-1"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}