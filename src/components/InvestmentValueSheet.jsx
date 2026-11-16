import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Check, Globe, Loader2, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import FormSheet from "@/components/FormSheet";
import Money from "@/components/Money";
import { currencySymbol, formatDate, assetDisplayName } from "@/lib/finance";
import { manualValuePatch, valueSourceInfo } from "@/lib/portfolioImport";
import { investmentCategory, CATEGORY_LABEL } from "@/lib/investmentCategory";

/**
 * "Perbarui nilai" investasi — isi nilai terkini langsung per aset (angka
 * dari aplikasi broker). Impor screenshot & perkiraan online tersedia sebagai
 * cara lain, bukan tujuan tombol utama.
 */
export default function InvestmentValueSheet({ assets = [], onClose, onSaved, onLive, livePricing = false, liveCount = 0 }) {
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const changed = assets
    .map((a) => ({ a, patch: manualValuePatch(a, drafts[a.id]) }))
    .filter((x) => x.patch && Number(x.patch.value) !== Number(x.a.value));

  const save = async () => {
    if (!changed.length) return;
    setSaving(true);
    let ok = 0;
    const failed = [];
    for (const { a, patch } of changed) {
      try { await base44.entities.Asset.update(a.id, patch); ok++; } catch { failed.push(assetDisplayName(a).name); }
    }
    setSaving(false);
    onSaved?.();
    if (failed.length) toast.error(`${failed.length} gagal disimpan`, { description: failed.join(", ") });
    if (ok) { toast.success(`${ok} nilai investasi diperbarui`); onClose?.(); }
  };

  return (
    <FormSheet
      title="Perbarui nilai investasi"
      subtitle="Isi nilai terkini sesuai aplikasi broker. Kosongkan yang tidak berubah."
      onClose={onClose}
      footer={
        <button onClick={save} disabled={!changed.length || saving} className="w-full btn-primary disabled:opacity-50">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {changed.length ? `Simpan ${changed.length} perubahan` : "Simpan"}
        </button>
      }
    >
      <ul className="surface rounded-3xl divide-y divide-border">
        {assets.map((a) => {
          const cur = (a.currency || "IDR").toUpperCase();
          const vs = valueSourceInfo(a);
          const dn = assetDisplayName(a);
          return (
            <li key={a.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug line-clamp-2 break-words">{dn.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {CATEGORY_LABEL[investmentCategory(a)]}{a.broker ? ` · ${a.broker}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums"><Money value={a.value} currency={cur} /></p>
                  <p className="text-[10px] text-muted-foreground">{vs.date ? formatDate(vs.date, "d MMM yyyy") : vs.label}</p>
                </div>
              </div>
              <label className="mt-2 flex items-center gap-2 h-10 rounded-xl border border-border bg-card px-3 focus-within:border-primary">
                <span className="text-xs text-muted-foreground shrink-0">{currencySymbol(cur)}</span>
                <input type="number" inputMode="decimal" aria-label={`Nilai baru ${dn.name}`} value={drafts[a.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
                  placeholder="Nilai sekarang" className="flex-1 min-w-0 bg-transparent outline-none text-sm tabular-nums" />
              </label>
            </li>
          );
        })}
      </ul>

      <div className="grid grid-cols-2 gap-2">
        <Link to="/impor-portofolio" className="h-11 rounded-2xl border border-border bg-card text-xs font-semibold inline-flex items-center justify-center gap-1.5">
          <Upload className="w-3.5 h-3.5" /> Impor screenshot
        </Link>
        {/* Hanya aset yang belum diperbarui dari broker hari ini yang perlu dicek online */}
        <button type="button" onClick={onLive} disabled={livePricing || liveCount === 0} title="Perkiraan dari sumber resmi bursa — bisa berbeda dari broker"
          className="h-11 rounded-2xl border border-border bg-card text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
          {livePricing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
          {livePricing ? "Mencari…" : liveCount === 0 ? "Semua sudah terbaru" : `Perkiraan online (${liveCount})`}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground px-1 -mt-2">
        Impor screenshot membaca banyak aset sekaligus. Perkiraan online hanya patokan — angka broker lebih tepat
        {liveCount === 0 && assets.length ? "; semua aset sudah diperbarui dari broker hari ini." : "."}
      </p>
    </FormSheet>
  );
}
