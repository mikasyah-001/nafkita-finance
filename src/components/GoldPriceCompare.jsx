import { useState } from "react";
import { fetchGoldPricesMulti, pickAntamSource, isAntamSource } from "@/lib/goldPrice";
import { formatRupiah } from "@/lib/finance";
import { toast } from "sonner";
import { Coins, Loader2, ExternalLink, Check, Search } from "lucide-react";

export default function GoldPriceCompare({ value, onChange, grams = 0 }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(null);

  const handleFetch = async () => {
    setLoading(true);
    try {
      const res = await fetchGoldPricesMulti();
      if (!res.length) {
        toast.error("Tidak ada sumber harga ditemukan");
      } else {
        const std = pickAntamSource(res);
        setSources(res);
        setFetchedAt(new Date());
        if (!value) onChange(String(Math.round(std.price_per_gram)));
        toast.success(`${res.length} sumber harga emas ditemukan`, { description: isAntamSource(std) ? "Harga Antam dipakai sebagai standar." : "Pilih sumber untuk dipakai." });
      }
    } catch {
      toast.error("Gagal mengambil harga emas");
    }
    setLoading(false);
  };

  const valueNum = Number(value) || 0;

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Coins className="w-4 h-4 text-amber-600" />
          <p className="text-sm font-medium">Harga Emas Pasar</p>
        </div>
        <button onClick={handleFetch} disabled={loading} className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-60">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          {loading ? "Memuat..." : "Bandingkan Sumber"}
        </button>
      </div>

      <div className="flex items-center rounded-lg bg-background border border-border px-3 mb-2">
        <span className="text-xs text-muted-foreground">Rp</span>
        <input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder="harga / gram" className="flex-1 px-2 py-2 text-sm outline-none bg-transparent" />
        {grams > 0 && valueNum > 0 && <span className="text-[11px] text-muted-foreground shrink-0">= {formatRupiah(grams * valueNum)}</span>}
      </div>

      {sources.length > 0 ? (
        <div className="space-y-1.5 mt-2">
          <p className="text-[11px] text-muted-foreground">Pilih sumber referensi:</p>
          {[...sources].sort((a, b) => (isAntamSource(b) ? 1 : 0) - (isAntamSource(a) ? 1 : 0)).map((s, i) => {
            const price = Math.round(s.price_per_gram);
            const active = price === valueNum;
            const standard = isAntamSource(s);
            return (
              <div key={i} onClick={() => onChange(String(price))} className={`w-full flex items-center gap-2 rounded-lg p-2 cursor-pointer transition-all ${active ? "bg-amber-600 text-white" : "bg-background border border-border"}`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate flex items-center gap-1.5 ${active ? "text-white" : ""}`}>
                    {s.source}
                    {standard && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${active ? "bg-white/20 text-white" : "bg-amber-100 dark:bg-amber-950/40 text-amber-600"}`}>Standar</span>}
                  </p>
                  <p className={`text-[10px] truncate ${active ? "text-white/80" : "text-muted-foreground"}`}>{s.date || "—"}{grams > 0 ? ` • nilai ${formatRupiah(grams * price)}` : ""}</p>
                </div>
                {s.url && (
                  <a href={s.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className={`shrink-0 ${active ? "text-white/80" : "text-muted-foreground"}`} title={s.url}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <span className={`text-xs font-semibold shrink-0 ${active ? "text-white" : "text-foreground"}`}>{formatRupiah(price)}</span>
                {active && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
              </div>
            );
          })}
          {fetchedAt && <p className="text-[10px] text-muted-foreground pt-1">Diperbarui: {fetchedAt.toLocaleTimeString("id-ID")}</p>}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground mt-1">Tekan "Bandingkan Sumber" untuk memuat harga dari beberapa referensi publik (Antam, Pegadaian, Logam Mulia, dll).</p>
      )}
    </div>
  );
}