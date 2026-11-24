import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ExternalLink, ImageOff } from "lucide-react";
import { safeUrl } from "../../base44/shared/txInput.js";

// Pratinjau bukti pembelian layar penuh.
// Sengaja memakai <img> biasa (bukan SmartImage): SmartImage menaruh gambar
// absolut di wadah tanpa tinggi → di media.base44.com tingginya 0 dan
// pratinjau tampak kosong. Di-portal ke body agar selalu di atas FormSheet.
export default function ProofViewer({ url: rawUrl, onClose, title = "Bukti pembelian" }) {
  // Hanya https: tautan javascript:/data: dari data pasangan dulu bisa
  // menjalankan skrip di sesi pengguna (iframe/link "Buka").
  const url = safeUrl(rawUrl);
  const [failed, setFailed] = useState(false);
  const isPdf = /\.pdf($|\?)/i.test(url || "");

  useEffect(() => {
    setFailed(false);
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [url, onClose]);

  if (!rawUrl) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[90] bg-black/85 flex flex-col animate-in fade-in-0 duration-150" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="flex items-center justify-between gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 text-white">
        <p className="text-sm font-semibold truncate">{title}</p>
        <div className="flex items-center gap-2">
          {url && <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
            className="h-10 px-3.5 rounded-full bg-white/15 text-xs font-semibold inline-flex items-center gap-1.5">
            <ExternalLink className="w-4 h-4" /> Buka
          </a>}
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Tutup pratinjau" className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {!url ? (
          <div className="text-white/80 text-sm text-center" onClick={(e) => e.stopPropagation()}>
            <ImageOff className="w-8 h-8 mx-auto mb-2" />
            Tautan bukti tidak aman sehingga tidak dibuka.
          </div>
        ) : isPdf ? (
          <iframe src={url} title={title} referrerPolicy="no-referrer" className="w-full max-w-md h-full rounded-2xl bg-white" onClick={(e) => e.stopPropagation()} />
        ) : failed ? (
          <div className="text-white/80 text-sm text-center" onClick={(e) => e.stopPropagation()}>
            <ImageOff className="w-8 h-8 mx-auto mb-2" />
            Gambar tidak bisa dimuat. Coba tombol <span className="font-semibold">Buka</span>.
          </div>
        ) : (
          <img src={url} alt={title} onError={() => setFailed(true)} onClick={(e) => e.stopPropagation()}
            className="w-full h-full max-w-md object-contain" />
        )}
      </div>
    </div>,
    document.body
  );
}
