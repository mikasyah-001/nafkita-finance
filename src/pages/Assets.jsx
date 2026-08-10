import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAssets, useRefresh } from "@/hooks/useFinance";
import { formatRupiah, formatNumber, formatDate, formatDuration, colorMap, assetTypeLabels } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import EmptyState from "@/components/EmptyState";
import AssetForm from "@/components/AssetForm";
import { Image as SmartImage } from "@/components/ui/image";
import { toast } from "sonner";
import { Landmark, Plus, Loader2, Trash2, X, Coins, RefreshCw, TrendingUp, TrendingDown, Calendar, BarChart3, Users, Lock, Pencil, ArrowUpDown, Receipt } from "lucide-react";

const sortOptions = [
  { key: "updated", label: "Terbaru" },
  { key: "value_desc", label: "Nilai ↓" },
  { key: "value_asc", label: "Nilai ↑" },
  { key: "date_desc", label: "Beli ↓" },
  { key: "date_asc", label: "Beli ↑" },
];

export default function Assets() {
  const { data: assets = [] } = useAssets();
  const refresh = useRefresh();
  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [goldPrice, setGoldPrice] = useState("");
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [scope, setScope] = useState("shared");
  const [sortBy, setSortBy] = useState("updated");
  const [viewProof, setViewProof] = useState(null);

  const goldPriceNum = Number(goldPrice) || 0;
  const scopedAssets = assets.filter((a) => (scope === "private" ? a.visibility === "private" : a.visibility !== "private"));

  const currentValue = (a) => {
    if (a.type === "emas" && a.quantity && goldPriceNum > 0) return a.quantity * goldPriceNum;
    return a.value || 0;
  };

  const sortedAssets = [...scopedAssets].sort((a, b) => {
    switch (sortBy) {
      case "value_desc": return currentValue(b) - currentValue(a);
      case "value_asc": return currentValue(a) - currentValue(b);
      case "date_desc": return new Date(b.purchase_date || 0) - new Date(a.purchase_date || 0);
      case "date_asc": return new Date(a.purchase_date || 0) - new Date(b.purchase_date || 0);
      default: return new Date(b.updated_date || 0) - new Date(a.updated_date || 0);
    }
  });

  const total = scopedAssets.reduce((s, a) => s + currentValue(a), 0);
  const emasGrams = scopedAssets.filter((a) => a.type === "emas").reduce((s, a) => s + (a.quantity || 0), 0);

  const fetchGoldPrice = async () => {
    setFetchingPrice(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: "Cari harga emas per gram di Indonesia saat ini (harga emas Antam atau emas batangan terbaru). Berikan harga per gram dalam Rupiah. Jawab hanya dengan angka.",
        add_context_from_internet: true,
        response_json_schema: { type: "object", properties: { price_per_gram: { type: "number" } } },
      });
      const price = result.price_per_gram;
      if (price && price > 0) {
        setGoldPrice(String(Math.round(price)));
        toast.success("Harga emas diperbarui", { description: `Rp ${formatNumber(Math.round(price))} /gram` });
      } else {
        toast.error("Tidak dapat menemukan harga emas");
      }
    } catch {
      toast.error("Gagal mengambil harga emas", { description: "Masukkan harga manual." });
    }
    setFetchingPrice(false);
  };

  const openAdd = () => { setEditingAsset(null); setFormOpen(true); };
  const openEdit = (a) => { setEditingAsset(a); setFormOpen(true); };

  const handleDelete = async (id) => {
    try {
      await base44.entities.Asset.delete(id);
      refresh();
      toast.success("Aset dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const handleToggleVisibility = async (a) => {
    const next = a.visibility === "private" ? "shared" : "private";
    try {
      await base44.entities.Asset.update(a.id, { visibility: next });
      refresh();
      toast.success(next === "private" ? "Aset diubah menjadi Pribadi" : "Aset diubah menjadi Bersama");
    } catch {
      toast.error("Gagal mengubah jangkauan");
    }
  };

  return (
    <div className="px-5 pt-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Aset Keluarga</h1>
        <div className="flex items-center gap-2">
          <Link to="/aset-dashboard" className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform">
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
          </Link>
          <button onClick={openAdd} className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setScope("shared")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "shared" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Users className="w-4 h-4" /> Bersama
        </button>
        <button onClick={() => setScope("private")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "private" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Lock className="w-4 h-4" /> Pribadi
        </button>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white p-5 mb-4 shadow-lg">
        <p className="text-xs opacity-80">{scope === "private" ? "Total Aset Pribadi" : "Total Nilai Aset"}</p>
        <p className="text-3xl font-bold tracking-tight">{formatRupiah(total)}</p>
        {emasGrams > 0 && <p className="text-xs opacity-80 mt-2 flex items-center gap-1"><Coins className="w-3.5 h-3.5" /> Emas: {formatNumber(emasGrams)} gram</p>}
      </div>

      {scopedAssets.some((a) => a.type === "emas") && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-medium">Harga Emas Pasar</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center flex-1 rounded-xl bg-background border border-border px-3">
              <span className="text-xs text-muted-foreground">Rp</span>
              <input type="number" value={goldPrice} onChange={(e) => setGoldPrice(e.target.value)} placeholder="harga / gram" className="flex-1 px-2 py-2.5 text-sm outline-none bg-transparent" />
            </div>
            <button onClick={fetchGoldPrice} disabled={fetchingPrice} className="px-3 rounded-xl bg-amber-600 text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-60">
              {fetchingPrice ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Cek
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">Nilai emas diperbarui otomatis mengikuti harga pasar ini.</p>
        </div>
      )}

      {scopedAssets.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground"><ArrowUpDown className="w-3.5 h-3.5" /> Urutkan</div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
            {sortOptions.map((o) => (
              <button key={o.key} onClick={() => setSortBy(o.key)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${sortBy === o.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {scopedAssets.length === 0 ? (
        <EmptyState icon={scope === "private" ? Lock : Landmark} title={scope === "private" ? "Belum ada aset pribadi" : "Belum ada aset"} subtitle="Catat tabungan, emas, investasi, dan aset lainnya untuk memantau kekayaan dan kewajiban zakat." />
      ) : (
        <div className="space-y-3">
          {sortedAssets.map((a) => {
            const meta = assetTypeLabels[a.type] || assetTypeLabels.lainnya;
            const cm = colorMap[meta.color] || colorMap.slate;
            const curVal = currentValue(a);
            const hasPurchase = a.purchase_price && a.purchase_price > 0;
            const gain = hasPurchase ? curVal - a.purchase_price : 0;
            const gainPct = hasPurchase && a.purchase_price > 0 ? (gain / a.purchase_price) * 100 : 0;
            const isGain = gain >= 0;
            const duration = formatDuration(a.purchase_date);

            return (
              <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${cm.bg}`}>
                    <CategoryIcon name={meta.icon} className={`w-5 h-5 ${cm.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1">
                      {a.visibility === "private" && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
                      {a.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {meta.label}{a.owner ? ` • ${a.owner}` : ""}
                      {a.type === "emas" && a.quantity ? ` • ${formatNumber(a.quantity)} gr` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatRupiah(curVal)}</p>
                    <div className="flex items-center gap-2 mt-1 ml-auto justify-end">
                      {a.purchase_proof_url && (
                        <button onClick={() => setViewProof(a.purchase_proof_url)} className="text-xs text-muted-foreground flex items-center gap-1 active:scale-95 transition-transform" title="Lihat bukti pembelian">
                          <Receipt className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => handleToggleVisibility(a)} className="text-xs text-muted-foreground flex items-center gap-1 active:scale-95 transition-transform" title={a.visibility === "private" ? "Jadikan Bersama" : "Jadikan Pribadi"}>
                        {a.visibility === "private" ? <Users className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => openEdit(a)} className="text-xs text-muted-foreground flex items-center gap-1 active:scale-95 transition-transform" title="Edit aset">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(a.id)} className="text-xs text-red-500 flex items-center gap-1" title="Hapus aset">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {(hasPurchase || duration) && (
                  <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
                    {hasPurchase && (
                      <>
                        <div>
                          <p className="text-muted-foreground">Harga Beli</p>
                          <p className="font-medium">{formatRupiah(a.purchase_price)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Perubahan</p>
                          <p className={`font-medium flex items-center gap-1 ${isGain ? "text-emerald-600" : "text-red-500"}`}>
                            {isGain ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {isGain ? "+" : ""}{formatRupiah(gain)} ({isGain ? "+" : ""}{gainPct.toFixed(1)}%)
                          </p>
                        </div>
                      </>
                    )}
                    {duration && (
                      <div className={hasPurchase ? "" : "col-span-2"}>
                        <p className="text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Disimpan</p>
                        <p className="font-medium">{duration}{a.purchase_date ? ` (sejak ${formatDate(a.purchase_date, "dd MMM yyyy")})` : ""}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {formOpen && <AssetForm asset={editingAsset} onClose={() => { setFormOpen(false); setEditingAsset(null); }} />}

      {viewProof && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-5" onClick={() => setViewProof(null)}>
          <button className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
          <div className="max-w-md w-full max-h-[85vh] rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <SmartImage src={viewProof} alt="Bukti pembelian" className="w-full" fittingType="fit" />
          </div>
        </div>
      )}
    </div>
  );
}