import { useState } from "react";
import { toast } from "sonner";
import { Coins, Loader2, RefreshCw, Check, ExternalLink } from "lucide-react";
import { useGoldPrice, isPlausibleGoldPrice, GOLD_PRICE_MIN, GOLD_PRICE_MAX } from "@/hooks/useGoldPrice";
import { formatMoney, formatMoneyShort } from "@/lib/finance";

// Kartu harga emas acuan — dipakai di Aset, Dashboard Aset, dan Zakat.
// Mengubah harga di sini berlaku untuk seluruh aplikasi.
export default function GoldPriceCard({ grams = 0, className = "mb-5", title = "Harga emas acuan" }) {
  const g = useGoldPrice();
  const [draft, setDraft] = useState("");
  const [showSources, setShowSources] = useState(false);
  const [saving, setSaving] = useState(false);

  const apply = async (value, msg) => {
    if (value != null && !isPlausibleGoldPrice(value)) {
      return toast.error("Harga emas tidak wajar", { description: `Masukkan antara ${formatMoney(GOLD_PRICE_MIN, "IDR")} dan ${formatMoney(GOLD_PRICE_MAX, "IDR")} per gram.` });
    }
    setSaving(true);
    try { await g.save(value); toast.success(msg); setDraft(""); } catch { toast.error("Gagal menyimpan harga emas"); }
    setSaving(false);
  };

  return (
    <section className={`card-pastel card-pastel-butter rounded-3xl p-4 ${className}`} aria-labelledby="gold-price-title">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl bg-white/60 dark:bg-white/10 flex items-center justify-center shrink-0"><Coins className="w-5 h-5" /></span>
        <div className="flex-1 min-w-0">
          <h2 id="gold-price-title" className="text-sm font-semibold">{title}</h2>
          {g.price > 0 ? (
            <>
              <p className="font-heading text-xl font-extrabold tabular-nums leading-tight">{formatMoney(g.price, "IDR")}<span className="text-xs font-semibold opacity-70">/gram</span></p>
              <p className="text-[11px] opacity-75">{g.source?.label}{g.source?.date ? ` · ${g.source.date}` : ""}{grams > 0 ? ` · ${grams} gr ≈ ${formatMoneyShort(grams * g.price, "IDR")}` : ""}</p>
            </>
          ) : (
            <p className="text-xs opacity-80">{g.loading ? "Mencari harga emas terkini…" : "Belum ada harga. Isi manual dari Antam/Pegadaian."}</p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <div className="flex-1 flex items-center rounded-2xl bg-white/70 dark:bg-white/10 px-3">
          <span className="text-xs opacity-70 mr-1">Rp</span>
          <input aria-label="Harga emas per gram (Rp)" id="gold-price-input" type="number" inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder={g.price ? String(g.price) : "1500000"} className="flex-1 min-w-0 py-2.5 text-sm bg-transparent outline-none tabular-nums" />
        </div>
        <button onClick={() => apply(Number(draft), "Harga emas acuan disimpan")} disabled={!draft || saving} className="btn-primary btn-sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pakai"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
        <button onClick={() => { setShowSources(!showSources); if (!showSources) g.refresh(); }} className="text-xs font-semibold inline-flex items-center gap-1">
          <RefreshCw className={`w-3 h-3 ${g.refreshing ? "animate-spin" : ""}`} /> {showSources ? "Tutup sumber" : "Bandingkan sumber"}
        </button>
        {g.hasManual && (
          <button onClick={() => apply(null, "Kembali ke harga otomatis")} className="text-xs font-semibold">Pakai harga otomatis</button>
        )}
      </div>

      {showSources && (
        <ul className="mt-3 space-y-1.5">
          {g.refreshing && g.sources.length === 0 && <li className="text-xs opacity-75">Mencari sumber…</li>}
          {!g.refreshing && g.sources.length === 0 && <li className="text-xs opacity-75">Sumber belum tersedia. Isi manual di atas.</li>}
          {g.sources.map((s, i) => (
            <li key={i} className="flex items-center gap-2 rounded-2xl bg-white/60 dark:bg-white/10 px-3 py-2">
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-semibold truncate">{s.source}</span>
                <span className="block text-[11px] opacity-70">{formatMoney(s.price_per_gram, "IDR")}/gr{s.date ? ` · ${s.date}` : ""}</span>
              </span>
              {s.url && <a href={s.url} target="_blank" rel="noreferrer" aria-label={`Buka sumber ${s.source}`} className="opacity-70"><ExternalLink className="w-3.5 h-3.5" /></a>}
              <button onClick={() => apply(Math.round(s.price_per_gram), `Memakai harga ${s.source}`)} className="h-7 px-2.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold inline-flex items-center gap-1"><Check className="w-3 h-3" /> Pakai</button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] opacity-70 mt-2">Berlaku untuk nilai aset, keuntungan emas, laporan, dan nisab zakat.</p>
    </section>
  );
}
