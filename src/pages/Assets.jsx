import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAssets, useRefresh } from "@/hooks/useFinance";
import { formatRupiah, formatNumber, formatDate, formatDuration, colorMap, assetTypeLabels } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import EmptyState from "@/components/EmptyState";
import AssetForm from "@/components/AssetForm";
import AssetGrowthTrend from "@/components/AssetGrowthTrend";
import { Image as SmartImage } from "@/components/ui/image";
import Money from "@/components/Money";
import { usePrivacy } from "@/lib/PrivacyContext";
import { useScope } from "@/lib/ScopeContext";
import { toast } from "sonner";
import { Landmark, Plus, Trash2, X, Coins, TrendingUp, TrendingDown, Calendar, BarChart3, Users, Lock, Pencil, ArrowUpDown, Receipt, Filter, Layers, Eye, EyeOff, History, ArrowRight } from "lucide-react";

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
  const { scope, setScope } = useScope();
  const [sortBy, setSortBy] = useState("updated");
  const [viewProof, setViewProof] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const { hidden, toggle } = usePrivacy();

  const goldPriceNum = Number(goldPrice) || 0;
  const scopedAssets = assets.filter((a) => (scope === "private" ? a.visibility === "private" : a.visibility !== "private"));

  const currentValue = (a) => {
    if (a.type === "emas" && a.quantity && goldPriceNum > 0) return a.quantity * goldPriceNum;
    return a.value || 0;
  };

  const typeOptions = ["all", "bank", "emas", "investasi", "properti", "tanah", "lainnya"];
  const filteredAssets = typeFilter === "all" ? scopedAssets : scopedAssets.filter((a) => a.type === typeFilter);

  const sortedAssets = [...filteredAssets].sort((a, b) => {
    switch (sortBy) {
      case "value_desc": return currentValue(b) - currentValue(a);
      case "value_asc": return currentValue(a) - currentValue(b);
      case "date_desc": return new Date(b.purchase_date || 0) - new Date(a.purchase_date || 0);
      case "date_asc": return new Date(a.purchase_date || 0) - new Date(b.purchase_date || 0);
      default: return new Date(b.updated_date || 0) - new Date(a.updated_date || 0);
    }
  });

  const total = scopedAssets.reduce((s, a) => s + currentValue(a), 0);
  const emasAssets = scopedAssets.filter((a) => a.type === "emas");
  const emasGrams = emasAssets.reduce((s, a) => s + (a.quantity || 0), 0);

  const openAdd = () => { setEditingAsset(null); setFormOpen(true); };
  const openEdit = (a) => { setEditingAsset(a); setFormOpen(true); };

  const handleDelete = async (id) => {
    try {
      await base44.functions.invoke("deleteAssetWithLots", { asset_id: id });
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
          <button onClick={toggle} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform" aria-label="Sembunyikan angka">
            {hidden ? <EyeOff className="w-5 h-5 text-muted-foreground" /> : <Eye className="w-5 h-5 text-muted-foreground" />}
          </button>
          <Link to="/aset-dashboard" className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform">
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
          </Link>
          <button onClick={openAdd} className="h-10 px-3.5 rounded-full bg-primary text-primary-foreground flex items-center gap-1.5 active:scale-95 transition-transform">
            <Landmark className="w-4 h-4" />
            <span className="text-xs font-medium">Tambah Aset</span>
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
        <p className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums break-words"><Money value={total} /></p>
        {emasGrams > 0 && <p className="text-xs opacity-80 mt-2 flex items-center gap-1"><Coins className="w-3.5 h-3.5" /> Emas: {formatNumber(emasGrams)} gram</p>}
      </div>

      <AssetGrowthTrend />

      {scopedAssets.length > 0 && (
        <Link to="/zakat" className="flex items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 p-3.5 mb-4 active:scale-[0.99] transition-transform">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
            <Coins className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Kelola Zakat</p>
            <p className="text-xs text-muted-foreground">Kalkulator nisab, pengingat & pembayaran zakat</p>
          </div>
          <ArrowRight className="w-4 h-4 text-emerald-600 shrink-0" />
        </Link>
      )}

      {scopedAssets.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-3 mb-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Filter className="w-3.5 h-3.5" /> Filter Jenis</div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {typeOptions.map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${typeFilter === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {t === "all" ? "Semua" : assetTypeLabels[t].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><ArrowUpDown className="w-3.5 h-3.5" /> Urutkan</div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
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
      ) : filteredAssets.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Tidak ada aset untuk filter ini.</div>
      ) : (
        <div className="space-y-3">
          {sortedAssets.map((a) => {
            const meta = assetTypeLabels[a.type] || assetTypeLabels.lainnya;
            const cm = colorMap[meta.color] || colorMap.slate;
            const curVal = currentValue(a);
            const hasPurchase = a.purchase_price && a.purchase_price > 0;
            const totalPurchase = hasPurchase ? (a.quantity && (a.type === "emas" || a.type === "tanah") ? a.purchase_price * a.quantity : a.purchase_price) : 0;
            const gain = hasPurchase ? curVal - totalPurchase : 0;
            const gainPct = hasPurchase && totalPurchase > 0 ? (gain / totalPurchase) * 100 : 0;
            const isGain = gain >= 0;
            const showChange = hasPurchase && (a.type !== "emas" || goldPriceNum > 0);
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
                      {a.type === "tanah" && a.quantity ? ` • ${formatNumber(a.quantity)} m²` : ""}
                      {a.type === "investasi" && a.broker ? ` • ${a.broker}` : ""}
                      {a.type === "bank" && a.broker ? ` • ${a.broker}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums"><Money value={curVal} currency={a.currency} /></p>
                    <div className="flex items-center gap-2 mt-1 ml-auto justify-end">
                      {a.purchase_proof_url && (
                        <button onClick={() => setViewProof(a.purchase_proof_url)} className="text-xs text-muted-foreground flex items-center gap-1 active:scale-95 transition-transform" title="Lihat bukti pembelian">
                          <Receipt className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => handleToggleVisibility(a)} className="text-xs text-muted-foreground flex items-center gap-1 active:scale-95 transition-transform" title={a.visibility === "private" ? "Jadikan Bersama" : "Jadikan Pribadi"}>
                        {a.visibility === "private" ? <Users className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      </button>
                      {a.type === "investasi" && (
                        <Link to={`/investasi/${a.id}`} className="text-xs text-emerald-600 flex items-center gap-1 active:scale-95 transition-transform" title="Catat DCA bulanan">
                          <Layers className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      <Link to={`/mutasi-aset?asset_id=${a.id}`} className="text-xs text-muted-foreground flex items-center gap-1 active:scale-95 transition-transform" title="Riwayat mutasi aset">
                        <History className="w-3.5 h-3.5" />
                      </Link>
                      <button onClick={() => openEdit(a)} className="text-xs text-muted-foreground flex items-center gap-1 active:scale-95 transition-transform" title="Edit aset">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(a.id)} className="text-xs text-red-500 flex items-center gap-1" title="Hapus aset">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {(hasPurchase || duration || a.type === "tanah") && (
                  <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
                    {a.type === "tanah" ? (
                      <>
                        <div>
                          <p className="text-muted-foreground">Harga Beli /m²</p>
                          <p className="font-medium"><Money value={a.purchase_price} /></p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Luas</p>
                          <p className="font-medium">{formatNumber(a.quantity)} m²</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Beli</p>
                          <p className="font-medium"><Money value={totalPurchase} /></p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Perkiraan Sekarang</p>
                          <p className="font-medium"><Money value={curVal} /></p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Perubahan</p>
                          <p className={`font-medium flex items-center gap-1 ${isGain ? "text-emerald-600" : "text-red-500"}`}>
                            {isGain ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {isGain ? "+" : ""}{formatRupiah(gain)} ({isGain ? "+" : ""}{gainPct.toFixed(1)}%)
                          </p>
                        </div>
                      </>
                    ) : hasPurchase && (
                      <>
                        <div>
                          <p className="text-muted-foreground">Harga Beli{a.type === "emas" ? " /gr" : ""}</p>
                          <p className="font-medium"><Money value={a.purchase_price} currency={a.currency} /></p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Perubahan</p>
                          {showChange ? (
                            <p className={`font-medium flex items-center gap-1 ${isGain ? "text-emerald-600" : "text-red-500"}`}>
                              {isGain ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {isGain ? "+" : ""}<Money value={gain} currency={a.currency} /> ({isGain ? "+" : ""}{gainPct.toFixed(1)}%)
                            </p>
                          ) : (
                            <p className="text-muted-foreground text-[11px]">Set harga emas dulu</p>
                          )}
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