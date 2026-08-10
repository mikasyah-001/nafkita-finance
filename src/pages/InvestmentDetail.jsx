import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAssets, useInvestmentLots, useRefresh } from "@/hooks/useFinance";
import { formatRupiah, formatNumber, formatDate } from "@/lib/finance";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Loader2, TrendingUp, TrendingDown, Briefcase, Calendar, X, Building2, Layers, Check } from "lucide-react";

export default function InvestmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data: assets = [] } = useAssets();
  const { data: lots = [], isLoading } = useInvestmentLots(id);
  const asset = assets.find((a) => a.id === id);

  const [currentPrice, setCurrentPrice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lot, setLot] = useState({ date: new Date().toISOString().slice(0, 10), price_per_unit: "", quantity: "", notes: "" });

  useEffect(() => {
    if (!asset) return;
    if (currentPrice) return;
    const last = [...lots].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    const seed = asset.purchase_price && asset.quantity ? Math.round(asset.purchase_price / (asset.quantity || 1)) : last?.price_per_unit || "";
    setCurrentPrice(String(seed || ""));
  }, [asset, lots]);

  const sortedLots = useMemo(() => [...lots].sort((a, b) => new Date(b.date) - new Date(a.date)), [lots]);
  const totalUnits = lots.reduce((s, l) => s + (l.quantity || 0), 0);
  const totalInvested = lots.reduce((s, l) => s + (l.amount || 0), 0);
  const avgPrice = totalUnits > 0 ? totalInvested / totalUnits : 0;
  const cp = Number(currentPrice) || 0;
  const currentValue = cp * totalUnits;
  const pl = currentValue - totalInvested;
  const plPct = totalInvested > 0 ? (pl / totalInvested) * 100 : 0;
  const isGain = pl >= 0;

  const computeUpdate = (lotsArr) => {
    const units = lotsArr.reduce((s, l) => s + (l.quantity || 0), 0);
    const invested = lotsArr.reduce((s, l) => s + (l.amount || 0), 0);
    return {
      value: Math.round(cp > 0 ? cp * units : invested),
      purchase_price: Math.round(invested),
      quantity: Number(units.toFixed(4)),
    };
  };

  const handleAddLot = async () => {
    const price = Number(lot.price_per_unit);
    const qty = Number(lot.quantity);
    if (!lot.date) return toast.error("Pilih tanggal");
    if (!price || price <= 0) return toast.error("Isi harga per unit");
    if (!qty || qty <= 0) return toast.error("Isi jumlah unit");
    setSaving(true);
    try {
      const newLot = { quantity: qty, amount: Math.round(price * qty) };
      await base44.entities.InvestmentLot.create({
        asset_id: id,
        date: lot.date,
        price_per_unit: price,
        quantity: qty,
        amount: Math.round(price * qty),
        notes: lot.notes || "",
      });
      if (asset) await base44.entities.Asset.update(asset.id, computeUpdate([...lots, newLot]));
      refresh();
      setLot({ date: new Date().toISOString().slice(0, 10), price_per_unit: "", quantity: "", notes: "" });
      setShowForm(false);
      toast.success("DCA bulanan dicatat");
    } catch {
      toast.error("Gagal mencatat DCA");
    }
    setSaving(false);
  };

  const handleDeleteLot = async (lotId) => {
    try {
      await base44.entities.InvestmentLot.delete(lotId);
      if (asset) await base44.entities.Asset.update(asset.id, computeUpdate(lots.filter((l) => l.id !== lotId)));
      refresh();
      toast.success("Catatan DCA dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  if (!asset) {
    return (
      <div className="px-5 pt-8">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-xl font-semibold">Investasi</h1>
        </div>
        <p className="text-sm text-muted-foreground text-center py-10">Aset tidak ditemukan.</p>
      </div>
    );
  }

  return (
    <div className="px-5 pt-8 pb-8">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold truncate">DCA — {asset.name}</h1>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 mb-4 shadow-lg">
        <div className="flex items-center gap-1.5 text-xs opacity-80 mb-1"><Briefcase className="w-3.5 h-3.5" /> Instrumen Investasi</div>
        <p className="text-sm font-medium truncate">{asset.name}</p>
        {asset.broker && <p className="text-xs opacity-80 flex items-center gap-1 mt-0.5"><Building2 className="w-3 h-3" /> {asset.broker}</p>}
        <p className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums mt-3 break-words">{formatRupiah(currentValue)}</p>
        <div className="flex gap-3 mt-3 text-xs">
          <div className="flex-1 min-w-0">
            <p className="opacity-80">Total Beli</p>
            <p className="font-semibold tabular-nums truncate">{formatRupiah(totalInvested)}</p>
          </div>
          <div className="w-px bg-white/20" />
          <div className="flex-1 min-w-0">
            <p className="opacity-80">Total Unit</p>
            <p className="font-semibold tabular-nums truncate">{formatNumber(Number(totalUnits.toFixed(4)))}</p>
          </div>
          <div className="w-px bg-white/20" />
          <div className="flex-1 min-w-0">
            <p className="opacity-80">Rata-rata</p>
            <p className="font-semibold tabular-nums truncate">{formatRupiah(Math.round(avgPrice))}</p>
          </div>
        </div>
        {totalInvested > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-sm font-medium">
            {isGain ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {isGain ? "+" : ""}{formatRupiah(pl)} ({isGain ? "+" : ""}{plPct.toFixed(1)}%)
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 mb-4">
        <label className="text-xs text-muted-foreground mb-1.5 block">Harga Saat Ini / unit (Rp)</label>
        <div className="flex gap-2">
          <input type="number" value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} placeholder="Mis. 1500" className="input" />
          <button onClick={async () => { if (asset && cp > 0) { try { await base44.entities.Asset.update(asset.id, { value: Math.round(currentValue) }); refresh(); toast.success("Nilai aset diperbarui"); } catch { toast.error("Gagal memperbarui"); } } }} className="px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium shrink-0">Simpan</button>
        </div>
        {cp > 0 && totalUnits > 0 && <p className="text-xs text-muted-foreground mt-2">Nilai saat ini: <span className="font-medium text-foreground">{formatRupiah(currentValue)}</span></p>}
      </div>

      <button onClick={() => setShowForm(true)} className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 mb-4 active:scale-[0.99] transition-transform">
        <Plus className="w-5 h-5" /> Catat DCA Bulanan
      </button>

      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-sm flex items-center gap-2"><Layers className="w-4 h-4 text-muted-foreground" /> Riwayat DCA</h2>
        <span className="text-xs text-muted-foreground">{sortedLots.length} catatan</span>
      </div>

      {isLoading ? (
        <div className="py-8 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : sortedLots.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-10 text-center">
          <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Belum ada catatan DCA</p>
          <p className="text-xs text-muted-foreground mt-1">Mulai catat pembelian rutin tiap bulan.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedLots.map((l) => (
            <div key={l.id} className="rounded-2xl border border-border bg-card p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{formatDate(l.date, "dd MMM yyyy")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatNumber(l.quantity)} unit • {formatRupiah(Math.round(l.price_per_unit))}/unit
                  </p>
                  {l.notes && <p className="text-xs text-muted-foreground mt-1 italic truncate">"{l.notes}"</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{formatRupiah(l.amount)}</p>
                  <button onClick={() => handleDeleteLot(l.id)} className="text-xs text-red-500 flex items-center gap-1 mt-1 ml-auto">
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center max-w-md mx-auto">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative w-full bg-background rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Catat DCA Bulanan</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Tanggal Pembelian</label>
                <input type="date" value={lot.date} onChange={(e) => setLot({ ...lot, date: e.target.value })} className="input" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Harga Beli / unit (Rp)</label>
                <input type="number" value={lot.price_per_unit} onChange={(e) => setLot({ ...lot, price_per_unit: e.target.value })} placeholder="Mis. 1500" className="input" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Jumlah Unit</label>
                <input type="number" value={lot.quantity} onChange={(e) => setLot({ ...lot, quantity: e.target.value })} placeholder="Mis. 10" className="input" />
              </div>
              {lot.price_per_unit && lot.quantity ? (
                <p className="text-xs text-muted-foreground -mt-1">Total beli: <span className="font-medium text-foreground">{formatRupiah(Number(lot.price_per_unit) * Number(lot.quantity))}</span></p>
              ) : null}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Catatan (opsional)</label>
                <input value={lot.notes} onChange={(e) => setLot({ ...lot, notes: e.target.value })} placeholder="Mis. DCA rutin bulan ke-3" className="input" />
              </div>
              <button onClick={handleAddLot} disabled={saving} className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                {saving ? "Menyimpan..." : "Simpan DCA"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}