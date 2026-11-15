import { useRef, useState } from "react";
import { X, Share2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatMoneyShort, computeSavingsRate } from "@/lib/finance";

// Laporan bulanan sebagai GAMBAR untuk dikirim ke pasangan/WhatsApp.
// Kartu digambar dengan gaya inline (hex) agar html2canvas merender konsisten
// di semua perangkat — tidak bergantung pada CSS modern (color-mix, var()).
const C = {
  ivory: "#F8F6EF", ink: "#123A33", muted: "#5B6B66", line: "#E6E1D3",
  heroA: "#0E3F35", heroB: "#175A47", gold: "#F8C33A", mint: "#DDF2E7", butter: "#FCEFC2",
  bars: ["#157A5A", "#E0A21B", "#2E8A99", "#D4583F", "#7A8A2E"],
};

export default function ShareReportSheet({ open, onClose, monthName, scopeLabel, cur, summary, rows, contributors, extraordinary }) {
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const savings = computeSavingsRate(summary.income, summary.expense, summary.sedekah);
  const top = rows.slice(0, 4);
  const max = top[0]?.value || 1;

  const render = async () => {
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: C.ivory, useCORS: true, logging: false });
    return new Promise((res) => canvas.toBlob((b) => res(b), "image/png"));
  };
  const fileName = `Laporan-NAFKITA-${monthName.replace(/\s+/g, "-")}.png`;

  const handleShare = async () => {
    setBusy(true);
    try {
      const blob = await render();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Laporan ${monthName}`, text: `Laporan keuangan keluarga ${monthName} dari NAFKITA` });
      } else {
        download(blob);
        toast.info("Perangkat ini belum mendukung bagikan langsung", { description: "Gambar disimpan; kirim lewat WhatsApp dari galeri." });
      }
    } catch (e) {
      if (e?.name !== "AbortError") toast.error("Gagal membuat gambar laporan");
    }
    setBusy(false);
  };
  const handleSave = async () => {
    setBusy(true);
    try { download(await render()); toast.success("Gambar laporan disimpan"); } catch { toast.error("Gagal membuat gambar laporan"); }
    setBusy(false);
  };
  const download = (blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = fileName; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-foreground/30 backdrop-blur-[2px] flex items-end md:items-center justify-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Bagikan laporan bulanan" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-background rounded-t-[28px] md:rounded-[28px] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-semibold text-primary">Siap dibagikan</p>
            <h2 className="font-heading text-xl font-extrabold leading-tight">Laporan {monthName}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Ringkasan untuk pasangan, tanpa daftar transaksi rinci.</p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="btn-icon btn-icon-sm"><X className="w-4 h-4" /></button>
        </div>

        {/* ── Kartu yang dirender menjadi gambar ── */}
        <div className="flex justify-center">
          <div ref={cardRef} style={{ width: 340, background: C.ivory, color: C.ink, padding: 16, borderRadius: 24, fontFamily: "'Nunito Sans', sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <img src="/brand/mark.png" alt="" style={{ width: 28, height: 28 }} />
                <img src="/brand/wordmark.png" alt="NAFKITA" style={{ height: 14 }} />
              </div>
              <span style={{ fontSize: 11, color: C.muted }}>{scopeLabel} · {monthName}</span>
            </div>

            <div style={{ background: `linear-gradient(150deg, ${C.heroA}, ${C.heroB})`, color: "#F7F4EA", borderRadius: 20, padding: 16 }}>
              <div style={{ fontSize: 11, opacity: 0.8 }}>Total pengeluaran</div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: -0.5, marginTop: 2, lineHeight: "36px" }}>{formatMoney(summary.expense, cur)}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {[["Pemasukan", formatMoneyShort(summary.income, cur)], ["Sedekah", formatMoneyShort(summary.sedekah, cur)], ["Menabung", savings.label || `${savings.rate}%`]].map(([l, v]) => (
                  <div key={l} style={{ flex: 1, background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "6px 8px" }}>
                    <div style={{ fontSize: 10, opacity: 0.75 }}>{l}</div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#FFFFFF", border: `1px solid ${C.line}`, borderRadius: 18, padding: 14, marginTop: 10 }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Ke mana perginya?</div>
              {top.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>Belum ada pengeluaran.</div>}
              {top.map((r, i) => (
                <div key={r.name} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, lineHeight: "18px", height: 18 }}>
                    <span>{r.name}</span><span style={{ fontWeight: 700 }}>{formatMoneyShort(r.value, cur)}</span>
                  </div>
                  <div style={{ height: 6, background: "#EFEBDF", borderRadius: 6, marginTop: 10 }}>
                    <div style={{ height: 6, width: `${Math.max(4, (r.value / max) * 100)}%`, background: C.bars[i % C.bars.length], borderRadius: 6 }} />
                  </div>
                </div>
              ))}
            </div>

            {contributors.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {contributors.slice(0, 2).map((p, i) => (
                  <div key={p.name} style={{ flex: 1, background: i === 0 ? C.mint : C.butter, borderRadius: 16, padding: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>Pemasukan</div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{formatMoneyShort(p.income, cur)}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>Pengeluaran</div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{formatMoneyShort(p.expense, cur)}</div>
                  </div>
                ))}
              </div>
            )}

            {extraordinary > 0 && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>Termasuk pengeluaran luar biasa {formatMoneyShort(extraordinary, cur)} (tidak rutin).</div>
            )}
            <div style={{ textAlign: "center", fontSize: 11, color: C.muted, marginTop: 12 }}>Nafkah kita, berkah bersama · NAFKITA</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={handleSave} disabled={busy} className="btn-secondary btn-sm"><Download className="w-4 h-4" /> Simpan gambar</button>
          <button onClick={handleShare} disabled={busy} className="btn-gold !h-10 !rounded-xl !text-sm">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} Bagikan</button>
        </div>
      </div>
    </div>
  );
}
