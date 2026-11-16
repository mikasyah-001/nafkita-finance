import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAssets, useRefresh, useRateMap, useMe, useUserCurrencies } from "@/hooks/useFinance";
import { formatMoney, formatNumber, formatDate, formatDuration, colorMap, assetTypeLabels, convertTo, hasRate, isGoldType, assetMarketValue, assetGain, goldPriceIn } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import EmptyState from "@/components/EmptyState";
import AssetForm from "@/components/AssetForm";
import ProofViewer from "@/components/ProofViewer";
import AssetGrowthTrend from "@/components/AssetGrowthTrend";
import CurrencyTabs from "@/components/CurrencyTabs";
import Money from "@/components/Money";
import { usePrivacy } from "@/lib/PrivacyContext";
import { useScope } from "@/lib/ScopeContext";
import { toast } from "sonner";
import { Landmark, Trash2, Coins, TrendingUp, TrendingDown, Calendar, BarChart3, Users, Lock, Pencil, ArrowUpDown, Receipt, Layers, Eye, EyeOff, History, ChevronDown, Globe, X, AlertTriangle, Plus, ChevronRight, Loader2 } from "lucide-react";
import ScopeToggle from "@/components/ScopeToggle";
import { confirmAction } from "@/components/ConfirmHost";
import { ListSkeleton } from "@/components/LoadingSkeleton";
import PageHeader from "@/components/PageHeader";
import { refreshAssetPrices } from "@/lib/livePrice";
import GoldPriceCard from "@/components/GoldPriceCard";
import ZakatSummaryCard from "@/components/ZakatSummaryCard";
import { useGoldPrice } from "@/hooks/useGoldPrice";

const sortOptions = [
  { key: "updated", label: "Terbaru" },
  { key: "value_desc", label: "Nilai ↓" },
  { key: "value_asc", label: "Nilai ↑" },
  { key: "date_desc", label: "Beli ↓" },
  { key: "date_asc", label: "Beli ↑" },
];

const rankBadgeClass = (rank) => {
  if (rank === 1) return "bg-warning text-warning";
  if (rank === 2) return "bg-muted text-foreground";
  if (rank === 3) return "bg-warning text-warning";
  return "bg-muted text-muted-foreground";
};

export default function Assets() {
  const { data: assets = [], isLoading } = useAssets();
  const refresh = useRefresh();
  const { data: me } = useMe();
  const userCurrencies = useUserCurrencies();
  const { map: rateMap } = useRateMap();
  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [displayCurrency, setDisplayCurrency] = useState(me?.default_currency || "IDR");
  useEffect(() => { if (me?.default_currency) setDisplayCurrency(me.default_currency); }, [me?.default_currency]);
  const { scope, setScope } = useScope();
  const [sortBy, setSortBy] = useState("updated");
  const [viewProof, setViewProof] = useState(null);
  const [livePricing, setLivePricing] = useState(false);
  const [showGold, setShowGold] = useState(false);
  const priceable = assets.filter((a) => a.type === "investasi" && Number(a.quantity) > 0 && (a.ticker || a.name));
  const handleLivePrices = async () => {
    setLivePricing(true);
    try {
      const { updated, skipped } = await refreshAssetPrices(priceable, (id, patch) => base44.entities.Asset.update(id, patch));
      refresh();
      if (updated.length) toast.success(`${updated.length} harga diperbarui`, { description: skipped.length ? `Dilewati: ${skipped.map((x) => `${x.asset.name} (${x.reason})`).join(", ")}` : undefined });
      else toast.error("Belum ada harga yang bisa dipakai", { description: skipped.map((x) => `${x.asset.name}: ${x.reason}`).join(" · ") });
    } catch (e) {
      toast.error("Gagal mencari harga online", { description: e?.message });
    }
    setLivePricing(false);
  };
  const [typeFilter, setTypeFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(10);
  const { hidden, toggle } = usePrivacy();

  // Harga emas acuan bersama (Aset, Dashboard, Laporan, Zakat).
  const { price: goldPriceNum } = useGoldPrice();
  const scopedAssets = assets.filter((a) => (scope === "private" ? a.visibility === "private" : a.visibility !== "private"));

  const currentValue = (a) => assetMarketValue(a, goldPriceNum, rateMap);
  const convertedValue = (a) => convertTo(currentValue(a), (a.currency || "IDR"), displayCurrency, rateMap);
  const assetCurrencies = [...new Set(scopedAssets.map((a) => (a.currency || "IDR").toUpperCase()))];
  const missingRates = assetCurrencies.filter((c) => c !== displayCurrency && !hasRate(c, rateMap));

  // Peringkat berdasarkan nilai tertinggi di seluruh aset (scope aktif).
  const rankMap = useMemo(() => {
    const ranked = [...scopedAssets].sort((a, b) => convertedValue(b) - convertedValue(a));
    const m = {};
    ranked.forEach((a, i) => { m[a.id] = i + 1; });
    return m;
     
  }, [scopedAssets, goldPriceNum, displayCurrency, rateMap]);

  // Reset paginasi saat filter/sort/scope berubah.
  useEffect(() => { setVisibleCount(10); }, [sortBy, typeFilter, scope]);

  const typeOptions = ["all", "bank", "emas", "emas_digital", "investasi", "properti", "tanah", "lainnya"];
  const filteredAssets = typeFilter === "all" ? scopedAssets : scopedAssets.filter((a) => a.type === typeFilter);

  const sortedAssets = [...filteredAssets].sort((a, b) => {
    switch (sortBy) {
      case "value_desc": return convertedValue(b) - convertedValue(a);
      case "value_asc": return convertedValue(a) - convertedValue(b);
      case "date_desc": return new Date(b.purchase_date || 0) - new Date(a.purchase_date || 0);
      case "date_asc": return new Date(a.purchase_date || 0) - new Date(b.purchase_date || 0);
      default: return new Date(b.updated_date || 0) - new Date(a.updated_date || 0);
    }
  });

  const total = scopedAssets.reduce((s, a) => s + convertedValue(a), 0);
  const emasAssets = scopedAssets.filter((a) => isGoldType(a.type));
  const emasGrams = emasAssets.reduce((s, a) => s + (a.quantity || 0), 0);
  const goldGramsIdr = scopedAssets.filter((a) => isGoldType(a.type) && (a.currency || "IDR") === "IDR").reduce((t, a) => t + (Number(a.quantity) || 0), 0);

  const openAdd = () => { setEditingAsset(null); setFormOpen(true); };
  const openEdit = (a) => { setEditingAsset(a); setFormOpen(true); };

  const handleDelete = async (id) => {
    const a = assets.find((x) => x.id === id);
    const ok = await confirmAction({
      title: `Hapus aset${a?.name ? ` "${a.name}"` : ""}?`,
      description: "Aset beserta seluruh riwayat lot/DCA-nya akan dihapus permanen dan tidak bisa dikembalikan.",
    });
    if (!ok) return;
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
    <div className="px-5 pt-6">
      <PageHeader
        title="Aset"
        actions={<>
          <button onClick={toggle} className="btn-icon" aria-label="Sembunyikan angka">
            {hidden ? <EyeOff className="w-5 h-5 text-muted-foreground" /> : <Eye className="w-5 h-5 text-muted-foreground" />}
          </button>
          <Link to="/aset-dashboard" className="btn-icon">
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
          </Link>
          <button onClick={openAdd} aria-label="Tambah aset" className="h-10 px-3.5 rounded-full bg-primary text-primary-foreground flex items-center gap-1 active:scale-95 transition-transform">
            <Plus className="w-4 h-4" />
            <span className="text-xs font-semibold">Tambah</span>
          </button>
        </>}
      />

      <ScopeToggle className="mb-4" />


      <div className="rounded-3xl card-gradient-primary p-5 mb-4 shadow-lg">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs opacity-80">{scope === "private" ? "Total Aset Pribadi" : "Total Nilai Aset"}</p>
          {userCurrencies.length > 1 && (
            <span className="text-[11px] opacity-75 flex items-center gap-1"><Globe className="w-3 h-3" /> konsolidasi ke {displayCurrency}</span>
          )}
        </div>
        <p className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums break-words"><Money value={total} currency={displayCurrency} /></p>
        {userCurrencies.length > 1 && (
          <div className="mt-2"><CurrencyTabs currencies={userCurrencies.map((c) => c.code)} value={displayCurrency} onChange={setDisplayCurrency} variant="inverse" /></div>
        )}
        {emasGrams > 0 && (
          <button onClick={() => setShowGold(true)} aria-label="Atur harga emas acuan"
            className="mt-3 w-full flex items-center gap-2 rounded-2xl bg-white/10 border border-white/10 px-3 py-2 text-left active:scale-[0.99] transition-transform">
            <Coins className="w-4 h-4 shrink-0 opacity-90" />
            <span className="flex-1 min-w-0 text-xs">
              <span className="font-semibold">Emas {formatNumber(emasGrams)} gram</span>
              <span className="opacity-80"> · {goldPriceNum > 0 ? `acuan ${formatMoney(goldPriceNum, "IDR")}/gr` : "atur harga emas acuan"}</span>
            </span>
            <ChevronRight className="w-4 h-4 opacity-70 shrink-0" />
          </button>
        )}
      </div>

      {missingRates.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
          <p className="text-xs text-warning">Kurs belum tersedia untuk {missingRates.join(", ")}. Aset dalam mata uang ini belum termasuk dalam total.</p>
        </div>
      )}


      {scopedAssets.length > 0 && <ZakatSummaryCard className="mb-4" />}


      {/* Daftar aset: judul + urutan sebaris, filter jenis satu baris geser */}
      {scopedAssets.length > 0 && (
        <section aria-label="Daftar aset" className="mb-3">
          <div className="flex items-center justify-between gap-2 mb-2 px-1">
            <h2 className="text-sm font-semibold">Daftar aset <span className="text-muted-foreground font-normal">({filteredAssets.length})</span></h2>
            <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <select aria-label="Urutkan aset" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-transparent outline-none font-semibold text-foreground">
                {sortOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>
          </div>
          <div role="group" aria-label="Filter jenis aset" className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
            {typeOptions.map((t) => (
              <button key={t} aria-pressed={typeFilter === t} onClick={() => setTypeFilter(t)}
                className={`shrink-0 h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${typeFilter === t ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"}`}>
                {t === "all" ? "Semua" : assetTypeLabels[t].label}
              </button>
            ))}
          </div>

          {/* Konteks per jenis: harga emas acuan untuk emas; harga online untuk investasi */}
          {isGoldType(typeFilter) && <GoldPriceCard grams={goldGramsIdr} className="mt-3" />}
          {(typeFilter === "investasi" || typeFilter === "all") && priceable.length > 0 && (
            <button onClick={handleLivePrices} disabled={livePricing}
              className="mt-2.5 w-full h-10 rounded-full border border-border bg-card text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60 active:scale-[0.99] transition-transform">
              {livePricing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
              {livePricing ? "Mencari harga terbaru…" : `Perbarui harga online · ${priceable.length} investasi`}
            </button>
          )}
        </section>
      )}

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : scopedAssets.length === 0 ? (
        <EmptyState icon={scope === "private" ? Lock : Landmark} title={scope === "private" ? "Belum ada aset pribadi" : "Belum ada aset"} subtitle="Catat tabungan, emas, investasi, dan aset lainnya untuk memantau kekayaan dan kewajiban zakat." />
      ) : filteredAssets.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Tidak ada aset untuk filter ini.</div>
      ) : (
        <div className="space-y-3">
          {sortedAssets.slice(0, visibleCount).map((a) => {
            const meta = assetTypeLabels[a.type] || assetTypeLabels.lainnya;
            const cm = colorMap[meta.color] || colorMap.slate;
            const curVal = currentValue(a);
            const rank = rankMap[a.id];
            const hasPurchase = a.purchase_price && a.purchase_price > 0;
            const g = assetGain(a, goldPriceNum, rateMap);
            const totalPurchase = g.cost;
            const gain = g.gain;
            const gainPct = g.pct;
            const isGain = gain >= 0;
            const showChange = g.available;
            const marketPerGram = isGoldType(a.type) ? goldPriceIn(a.currency, goldPriceNum, rateMap) : 0;
            const duration = formatDuration(a.purchase_date);

            return (
              <div key={a.id} className="surface p-4">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${cm.bg}`}>
                      <CategoryIcon name={meta.icon} className={`w-5 h-5 ${cm.text}`} />
                    </div>
                    <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold border-2 border-background ${rankBadgeClass(rank)}`}>
                      {rank}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1">
                      {a.visibility === "private" && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
                      {a.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {meta.label}{a.owner ? ` • ${a.owner}` : ""}
                      {isGoldType(a.type) && a.quantity ? ` • ${formatNumber(a.quantity)} gr` : ""}
                      {a.type === "tanah" && a.quantity ? ` • ${formatNumber(a.quantity)} m²` : ""}
                      {a.type === "investasi" && a.broker ? ` • ${a.broker}` : ""}
                      {a.type === "bank" && a.broker ? ` • ${a.broker}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums"><Money value={curVal} currency={a.currency} /></p>
                    <div className="flex items-center gap-2 mt-1 ml-auto justify-end">
                      {a.purchase_proof_url && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); setViewProof(a.purchase_proof_url); }} aria-label={`Lihat bukti pembelian ${a.name}`} className="-m-2 p-2 text-xs text-muted-foreground flex items-center gap-1 active:scale-95 transition-transform" title="Lihat bukti pembelian">
                          <Receipt className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleToggleVisibility(a)} className="text-xs text-muted-foreground flex items-center gap-1 active:scale-95 transition-transform" title={a.visibility === "private" ? "Jadikan Bersama" : "Jadikan Pribadi"}>
                        {a.visibility === "private" ? <Users className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      </button>
                      {a.type === "investasi" && (
                        <Link to={`/investasi/${a.id}`} className="text-xs text-success flex items-center gap-1 active:scale-95 transition-transform" title="Catat DCA bulanan">
                          <Layers className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      <Link to={`/mutasi-aset?asset_id=${a.id}`} className="text-xs text-muted-foreground flex items-center gap-1 active:scale-95 transition-transform" title="Riwayat mutasi aset">
                        <History className="w-3.5 h-3.5" />
                      </Link>
                      <button onClick={() => openEdit(a)} aria-label={`Edit aset ${a.name}`} className="text-xs text-muted-foreground flex items-center gap-1 active:scale-95 transition-transform" title="Edit aset">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(a.id)} className="text-xs text-destructive flex items-center gap-1" title="Hapus aset">
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
                          <p className="font-medium"><Money value={a.purchase_price} currency={a.currency} /></p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Luas</p>
                          <p className="font-medium">{formatNumber(a.quantity)} m²</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Beli</p>
                          <p className="font-medium"><Money value={totalPurchase} currency={a.currency} /></p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Perkiraan Sekarang</p>
                          <p className="font-medium"><Money value={curVal} currency={a.currency} /></p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Perubahan</p>
                          <p className={`font-medium flex items-center gap-1 ${isGain ? "text-success" : "text-destructive"}`}>
                            {isGain ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {isGain ? "+" : ""}{formatMoney(gain, a.currency)} ({isGain ? "+" : ""}{gainPct.toFixed(1)}%)
                          </p>
                        </div>
                      </>
                    ) : hasPurchase && (
                      <>
                        <div>
                          <p className="text-muted-foreground">Harga Beli{isGoldType(a.type) ? " /gr" : ""}</p>
                          <p className="font-medium"><Money value={a.purchase_price} currency={a.currency} /></p>
                        </div>
                        {isGoldType(a.type) && (
                          <div>
                            <p className="text-muted-foreground">Harga Pasar /gr</p>
                            <p className="font-medium">{marketPerGram > 0 ? <Money value={marketPerGram} currency={a.currency} /> : <span className="text-[11px] text-warning">Belum ada</span>}</p>
                          </div>
                        )}
                        {isGoldType(a.type) && (
                          <div>
                            <p className="text-muted-foreground">Total Beli</p>
                            <p className="font-medium"><Money value={totalPurchase} currency={a.currency} /></p>
                          </div>
                        )}
                        <div>
                          <p className="text-muted-foreground">Perubahan</p>
                          {showChange ? (
                            <p className={`font-medium flex items-center gap-1 ${isGain ? "text-success" : "text-destructive"}`}>
                              {isGain ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {isGain ? "+" : ""}<Money value={gain} currency={a.currency} /> ({isGain ? "+" : ""}{gainPct.toFixed(1)}%)
                            </p>
                          ) : (
                            <p className="text-[11px] text-warning">{g.currencySuspect ? <Link to="/kesehatan-data" className="underline">Mata uang tampak keliru — periksa</Link> : g.needsGoldPrice ? (a.currency && a.currency !== "IDR" ? `Butuh kurs ${a.currency}` : <button onClick={() => setShowGold(true)} className="underline">Atur harga emas acuan</button>) : "—"}</p>
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

      {sortedAssets.length > visibleCount && (
        <button
          onClick={() => setVisibleCount((c) => c + 10)}
          className="w-full mt-3 transition-transform btn-secondary"
        >
          <ChevronDown className="w-4 h-4" /> Lihat lainnya ({sortedAssets.length - visibleCount} lagi)
        </button>
      )}

      {formOpen && <AssetForm asset={editingAsset} onClose={() => { setFormOpen(false); setEditingAsset(null); }} />}

      {/* Analisis di akhir: setelah melihat daftar */}
      {scopedAssets.length > 0 && <div className="mt-6"><AssetGrowthTrend /></div>}

      {/* Harga emas acuan sebagai lembar (dibuka dari kartu total) */}
      {showGold && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/30 backdrop-blur-[2px]" onClick={() => setShowGold(false)}>
          <div role="dialog" aria-modal="true" aria-label="Harga emas acuan" onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-background rounded-t-[28px] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="font-heading font-bold text-lg">Harga emas acuan</h2>
              <button onClick={() => setShowGold(false)} aria-label="Tutup" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <GoldPriceCard grams={goldGramsIdr} className="mb-0" />
          </div>
        </div>
      )}

      {viewProof && <ProofViewer url={viewProof} onClose={() => setViewProof(null)} />}
    </div>
  );
}