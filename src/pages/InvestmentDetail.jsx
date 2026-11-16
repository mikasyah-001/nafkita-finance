import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAssets, useInvestmentLots, useRefresh } from "@/hooks/useFinance";
import { formatMoney, formatNumber, formatDate, assetGain } from "@/lib/finance";
import { lotSummary } from "@/lib/portfolioImport";
import { fetchLivePrices } from "@/lib/livePrice";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, TrendingUp, TrendingDown, Building2, Layers, Check, Upload, Calendar, X, Globe } from "lucide-react";
import { confirmAction } from "@/components/ConfirmHost";
import PageHeader from "@/components/PageHeader";

// ─────────────────────────────────────────────────────────────────────────
// Investasi & riwayat lot (DCA).
// Sumber kebenaran: TOTAL ASET (jumlah, modal, nilai) — dari rincian broker
// (impor) atau isian. Lot = riwayat tanggal & harga beli. Menambah/menghapus
// lot mengubah total SEBESAR SELISIHNYA, tidak menghitung ulang dari daftar
// lot (riwayat lot bisa belum lengkap, mis. 72 dari 88 lembar).
// ─────────────────────────────────────────────────────────────────────────
const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;

export default function InvestmentDetail() {
  const { id } = useParams();
  const refresh = useRefresh();
  const { data: assets = [] } = useAssets();
  const { data: lots = [], isLoading } = useInvestmentLots(id);
  const asset = assets.find((a) => a.id === id);

  const [priceDraft, setPriceDraft] = useState("");
  const [live, setLive] = useState(null); // { price, source, as_of } | { error }
  const [liveBusy, setLiveBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lot, setLot] = useState({ date: new Date().toISOString().slice(0, 10), price_per_unit: "", quantity: "", notes: "" });

  const sortedLots = useMemo(() => [...lots].sort((a, b) => String(b.date).localeCompare(String(a.date))), [lots]);

  if (!asset) {
    return (
      <div className="px-5 pt-6">
        <PageHeader title="Investasi" back />
        <p className="text-sm text-muted-foreground text-center py-10">Aset tidak ditemukan.</p>
      </div>
    );
  }

  const cur = asset.currency || "IDR";
  const qty = Number(asset.quantity) || 0;
  const unit = asset.unit || "unit";
  const g = assetGain(asset);
  const avg = qty > 0 && g.cost > 0 ? g.cost / qty : 0;
  const lastPrice = Number(asset.last_price) || (qty > 0 ? (Number(asset.value) || 0) / qty : 0);
  const info = lotSummary(lots.map((l) => ({ ...l, date: String(l.date).slice(0, 10), side: l.side || "buy", price: l.price_per_unit })), qty);

  // Perubahan total sebesar selisih lot (beli menambah, jual mengurangi).
  const applyDelta = (l, sign) => {
    const dir = (l.side === "sell" ? -1 : 1) * sign;
    const q = Number(l.quantity) || 0;
    const amt = Number(l.amount) || q * (Number(l.price_per_unit) || 0);
    const newQty = Math.max(0, r4(qty + dir * q));
    // Jual mengurangi modal secara proporsional (rata-rata tetap); beli menambah modal sebesar nilai beli.
    const newCost = Math.max(0, r2(dir > 0 ? g.cost + amt : g.cost - (qty > 0 ? (g.cost / qty) * q : 0)));
    const price = lastPrice || Number(l.price_per_unit) || 0;
    return { quantity: newQty, purchase_price: newCost, value: r2(price * newQty) };
  };

  const handleAddLot = async () => {
    const price = Number(lot.price_per_unit);
    const q = Number(lot.quantity);
    if (!lot.date) return toast.error("Pilih tanggal");
    if (!price || price <= 0) return toast.error("Isi harga per unit");
    if (!q || q <= 0) return toast.error("Isi jumlah unit");
    setSaving(true);
    const rec = { asset_id: id, date: lot.date, side: "buy", price_per_unit: price, quantity: q, amount: r2(price * q), notes: lot.notes || "", source: "manual" };
    let created = null;
    try {
      created = await base44.entities.InvestmentLot.create(rec);
      const upd = applyDelta(rec, +1);
      if (!asset.purchase_date || lot.date < String(asset.purchase_date).slice(0, 10)) upd.purchase_date = lot.date;
      await base44.entities.Asset.update(asset.id, upd);
      refresh();
      setLot({ date: new Date().toISOString().slice(0, 10), price_per_unit: "", quantity: "", notes: "" });
      setShowForm(false);
      toast.success("Pembelian dicatat", { description: `Total kini ${formatNumber(upd.quantity)} ${unit}.` });
    } catch {
      // Rollback agar riwayat & total tetap sinkron.
      if (created?.id) { try { await base44.entities.InvestmentLot.delete(created.id); } catch { /* abaikan */ } }
      toast.error("Gagal mencatat pembelian");
    }
    setSaving(false);
  };

  const handleDeleteLot = async (l) => {
    const imported = l.source === "import";
    const ok = await confirmAction({
      title: "Hapus lot ini?",
      description: imported
        ? "Lot ini dari impor broker. Hanya riwayatnya yang dihapus — total aset tidak berubah."
        : `Total aset ikut dikurangi ${formatNumber(l.quantity)} ${unit}.`,
    });
    if (!ok) return;
    try {
      await base44.entities.InvestmentLot.delete(l.id);
      // Lot manual mengubah total saat dibuat → dikembalikan saat dihapus.
      // Lot impor tidak pernah mengubah total (total dari rincian broker).
      if (!imported) {
        try { await base44.entities.Asset.update(asset.id, applyDelta(l, -1)); }
        catch (e) {
          try { const { id: _omit, ...rest } = l; await base44.entities.InvestmentLot.create(rest); } catch { /* abaikan */ }
          throw e;
        }
      }
      refresh();
      toast.success("Lot dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const savePrice = async () => {
    const p = Number(priceDraft);
    if (!(p > 0)) return;
    try {
      await base44.entities.Asset.update(asset.id, { value: r2(p * qty), last_price: p, price_date: (live?.price === p && live.as_of) || new Date().toISOString().slice(0, 10) });
      refresh();
      setPriceDraft("");
      toast.success("Nilai pasar diperbarui");
    } catch { toast.error("Gagal memperbarui"); }
  };

  const findOnline = async () => {
    setLiveBusy(true);
    setLive(null);
    try {
      const found = await fetchLivePrices([{ key: asset.id, name: String(asset.name || "").replace(/\s*\(.*?\)\s*$/, ""), ticker: asset.ticker, exchange: asset.exchange || "", currency: cur, ref_price: lastPrice }]);
      const lp = found.get(asset.id);
      if (lp?.ok) { setLive(lp); setPriceDraft(String(lp.price)); }
      else setLive({ error: lp?.reason || "Harga tidak ditemukan" });
    } catch (e) { setLive({ error: e?.message || "Gagal mencari" }); }
    setLiveBusy(false);
  };

  const tone = info.status === "complete" ? "card-pastel-mint" : info.status === "none" ? "card-pastel-sage" : "card-pastel-butter";

  return (
    <div className="px-5 pt-6 pb-28">
      <PageHeader title={asset.name} subtitle={[asset.ticker, asset.broker].filter(Boolean).join(" · ") || "Investasi"} back />

      {/* Ringkasan — dari total aset */}
      <section className="card-gradient-primary relative rounded-[28px] p-5 overflow-hidden mb-4">
        <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full bg-white/10 pointer-events-none" aria-hidden="true" />
        <div className="relative">
          {asset.broker && <p className="text-[11px] opacity-80 flex items-center gap-1"><Building2 className="w-3 h-3" /> {asset.broker}</p>}
          <p className="text-xs opacity-80 mt-2">Nilai pasar{asset.price_date ? ` · ${formatDate(asset.price_date, "d MMM yyyy")}` : ""}</p>
          <p className="font-heading text-[32px] leading-none font-extrabold tracking-tight tabular-nums mt-1 break-all">{formatMoney(asset.value || 0, cur)}</p>
          {g.available && (
            <p className="text-sm font-semibold mt-2 inline-flex items-center gap-1 tabular-nums">
              {g.gain >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {g.gain >= 0 ? "+" : ""}{formatMoney(g.gain, cur)} ({g.gain >= 0 ? "+" : ""}{g.pct.toFixed(2)}%)
            </p>
          )}
          <div className="grid grid-cols-3 gap-2 mt-4 text-[11px]">
            {[["Jumlah", `${formatNumber(qty)} ${unit}`], ["Modal", formatMoney(g.cost, cur)], ["Rata-rata", avg ? formatMoney(avg, cur) : "—"]].map(([l, v]) => (
              <div key={l} className="rounded-2xl bg-white/10 border border-white/10 p-2.5 min-w-0">
                <p className="opacity-75">{l}</p>
                <p className="font-bold text-[13px] tabular-nums truncate mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Harga terakhir */}
      <section className="surface rounded-3xl p-4 mb-4">
        <label htmlFor="investment-current-price" className="text-xs text-muted-foreground">Perbarui harga terakhir per {unit}{lastPrice ? ` (kini ${formatMoney(lastPrice, cur)})` : ""}</label>
        <div className="flex gap-2 mt-1.5">
          <span className="flex-1 flex items-center h-11 rounded-full border border-border bg-card px-4">
            <input id="investment-current-price" type="number" inputMode="decimal" value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)} placeholder={lastPrice ? String(r4(lastPrice)) : "0"} className="flex-1 min-w-0 bg-transparent outline-none text-sm tabular-nums" />
            <span className="text-[11px] text-muted-foreground">{cur}</span>
          </span>
          <button onClick={savePrice} disabled={!(Number(priceDraft) > 0)} className="btn-primary btn-sm shrink-0 disabled:opacity-50">Simpan</button>
        </div>
        <button onClick={findOnline} disabled={liveBusy} className="mt-2 text-xs font-semibold text-primary inline-flex items-center gap-1.5 disabled:opacity-60">
          {liveBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />} {liveBusy ? "Mencari harga terbaru…" : "Cari harga online"}
        </button>
        {live?.price && <p className="text-[11px] text-muted-foreground mt-1">Ditemukan {formatMoney(live.price, cur)} · {live.source || "internet"}{live.as_of ? ` · ${formatDate(live.as_of, "d MMM yyyy")}` : ""} — periksa lalu ketuk Simpan.</p>}
        {live?.error && <p className="text-[11px] text-warning mt-1">{live.error}. Isi manual dari aplikasi broker.</p>}
        {Number(priceDraft) > 0 && <p className="text-xs text-muted-foreground mt-2 tabular-nums">Nilai pasar baru: <span className="font-semibold text-foreground">{formatMoney(Number(priceDraft) * qty, cur)}</span></p>}
      </section>

      {/* Riwayat lot */}
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-sm font-semibold flex items-center gap-1.5"><Layers className="w-4 h-4 text-muted-foreground" /> Riwayat DCA</h2>
        <span className="text-xs text-muted-foreground">{lots.length} lot</span>
      </div>

      {info.count > 0 && (
        <div className={`card-pastel ${tone} rounded-2xl px-3.5 py-2.5 mb-2.5 text-xs leading-snug`}>
          <p className="font-semibold">{info.firstDate ? `Dibeli sejak ${formatDate(info.firstDate, "d MMM yyyy")}` : "Riwayat lot"}</p>
          {info.message && <p className="opacity-85 mt-0.5">{info.message}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3">
        <button onClick={() => setShowForm(true)} className="btn-primary btn-sm"><Plus className="w-4 h-4" /> Catat pembelian</button>
        <Link to="/impor-portofolio" className="btn-secondary btn-sm"><Upload className="w-4 h-4" /> Impor dari broker</Link>
      </div>

      {isLoading ? (
        <div className="py-8 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : sortedLots.length === 0 ? (
        <div className="surface rounded-3xl py-8 text-center px-6">
          <Calendar className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">Belum ada riwayat pembelian</p>
          <p className="text-xs text-muted-foreground mt-1 leading-snug">Catat DCA rutin, atau impor screenshot "Lots Breakdown" dari aplikasi broker.</p>
        </div>
      ) : (
        <ul className="surface rounded-3xl divide-y divide-border">
          {sortedLots.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-4 py-3">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${l.side === "sell" ? "bg-expense/10 text-expense" : "bg-income/10 text-income"}`}><Layers className="w-4 h-4" /></span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  {formatDate(l.date, "d MMM yyyy")}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${l.side === "sell" ? "bg-expense/10 text-expense" : "bg-income/10 text-income"}`}>{l.side === "sell" ? "Jual" : "Beli"}</span>
                  {l.source === "import" && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">impor</span>}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">{formatNumber(l.quantity)} {unit} × {formatMoney(l.price_per_unit, cur)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold tabular-nums">{formatMoney(l.amount ?? l.quantity * l.price_per_unit, cur)}</p>
                <button onClick={() => handleDeleteLot(l)} aria-label={`Hapus lot ${formatDate(l.date, "d MMM yyyy")}`} className="text-[11px] text-destructive inline-flex items-center gap-1 mt-0.5"><Trash2 className="w-3 h-3" /> Hapus</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/30 backdrop-blur-[2px]" onClick={() => setShowForm(false)}>
          <div role="dialog" aria-modal="true" aria-label="Catat pembelian" onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-background rounded-t-[28px] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-lg">Catat pembelian</h2>
              <button onClick={() => setShowForm(false)} aria-label="Tutup" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="col-span-2 block">
                <span className="text-[11px] text-muted-foreground">Tanggal beli</span>
                <input id="investment-lot-date" type="date" value={lot.date} onChange={(e) => setLot({ ...lot, date: e.target.value })} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm mt-0.5" />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Jumlah ({unit})</span>
                <input id="investment-lot-quantity" type="number" inputMode="decimal" value={lot.quantity} onChange={(e) => setLot({ ...lot, quantity: e.target.value })} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm mt-0.5 tabular-nums" />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Harga /{unit} ({cur})</span>
                <input id="investment-lot-price" type="number" inputMode="decimal" value={lot.price_per_unit} onChange={(e) => setLot({ ...lot, price_per_unit: e.target.value })} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm mt-0.5 tabular-nums" />
              </label>
              <label className="col-span-2 block">
                <span className="text-[11px] text-muted-foreground">Catatan (opsional)</span>
                <input id="investment-lot-notes" value={lot.notes} onChange={(e) => setLot({ ...lot, notes: e.target.value })} placeholder="Mis. DCA rutin" className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm mt-0.5" />
              </label>
            </div>
            {Number(lot.price_per_unit) > 0 && Number(lot.quantity) > 0 && (
              <p className="text-xs text-muted-foreground mt-2.5 tabular-nums">
                Total beli <span className="font-semibold text-foreground">{formatMoney(Number(lot.price_per_unit) * Number(lot.quantity), cur)}</span> · jumlah aset jadi {formatNumber(r4(qty + Number(lot.quantity)))} {unit}
              </p>
            )}
            <button onClick={handleAddLot} disabled={saving} className="w-full btn-primary mt-4">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} {saving ? "Menyimpan…" : "Simpan pembelian"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
