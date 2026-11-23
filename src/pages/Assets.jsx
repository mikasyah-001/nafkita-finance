import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAssets, useRefresh, useRateMap, useMe, useUserCurrencies, useAllInvestmentLots, useSavingsGoals, useDebts } from "@/hooks/useFinance";
import { investmentCategory, CATEGORY_LABEL, categoryBreakdown, emergencyAssetIds } from "@/lib/investmentCategory";
import { formatMoney, formatNumber, formatDate, formatDuration, colorMap, assetTypeLabels, convertTo, hasRate, isGoldType, assetMarketValue, assetGain, goldPriceIn, assetDisplayName, balanceSheet } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import EmptyState from "@/components/EmptyState";
import AssetForm from "@/components/AssetForm";
import InvestmentValueSheet from "@/components/InvestmentValueSheet";
import { maskAccount, formatAccountNumber } from "@/lib/bankAccount";
import AssetGrowthTrend from "@/components/AssetGrowthTrend";
import CurrencyTabs from "@/components/CurrencyTabs";
import Money from "@/components/Money";
import { usePrivacy } from "@/lib/PrivacyContext";
import { useScope } from "@/lib/ScopeContext";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errorMessage";
import { Landmark, Coins, TrendingUp, TrendingDown, BarChart3, Lock, ArrowUpDown, Eye, EyeOff, ChevronDown, Globe, X, Upload, AlertTriangle, Plus, ChevronRight, Calendar, Layers, ShieldCheck, RefreshCw, CreditCard } from "lucide-react";
import ScopeToggle from "@/components/ScopeToggle";
import { ListSkeleton } from "@/components/LoadingSkeleton";
import PageHeader from "@/components/PageHeader";
import { refreshAssetPrices, summarizeLiveResult, liveTargets } from "@/lib/livePrice";
import { valueSourceInfo } from "@/lib/portfolioImport";
import GoldPriceCard from "@/components/GoldPriceCard";
import ZakatSummaryCard from "@/components/ZakatSummaryCard";
import { useGoldPrice } from "@/hooks/useGoldPrice";

// "Terbaru" = tanggal aset DITAMBAHKAN (created_date), bukan terakhir diubah:
// dulu memindah jangkauan / memperbarui harga membuat aset loncat ke atas.
const sortOptions = [
  { key: "created", label: "Terbaru" },
  { key: "value_desc", label: "Nilai ↓" },
  { key: "value_asc", label: "Nilai ↑" },
  { key: "date_desc", label: "Tgl beli ↓" },
  { key: "date_asc", label: "Tgl beli ↑" },
  { key: "updated", label: "Baru diubah" },
];
const ts = (d) => (d ? new Date(d).getTime() || 0 : 0);

const rankBadgeClass = (rank) => {
  // Teks harus kontras dengan latar (dulu "bg-warning text-warning" → angka tak terlihat).
  if (rank === 1) return "bg-warning text-warning-foreground";
  if (rank === 2) return "bg-muted text-foreground";
  if (rank === 3) return "bg-warning/25 text-foreground";
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
  const [sortBy, setSortBy] = useState("created");
  const [livePricing, setLivePricing] = useState(false);
  const [showGold, setShowGold] = useState(false);
  const { data: allLots = [] } = useAllInvestmentLots();
  // Aset yang ditautkan ke target "Dana darurat" — label dari data, bukan tebakan.
  const { data: goals = [] } = useSavingsGoals();
  const emergencyIds = useMemo(() => emergencyAssetIds(goals), [goals]);
  const [invCat, setInvCat] = useState("all");
  const lotsByAsset = useMemo(() => {
    const m = {};
    allLots.forEach((l) => { (m[l.asset_id] ||= []).push(l); });
    return m;
  }, [allLots]);
  // Hanya aset milik sendiri yang bisa diperbarui (aset bersama pasangan = hak pemiliknya).
  const ownInvestments = assets.filter((a) => a.type === "investasi" && (!a.created_by_id || !me?.id || a.created_by_id === me.id));
  const priceable = ownInvestments.filter((a) => Number(a.quantity) > 0 && (a.ticker || a.name));
  const [valueSheet, setValueSheet] = useState(false);
  const handleLivePrices = async () => {
    setLivePricing(true);
    try {
      const res = await refreshAssetPrices(priceable, (id, patch) => base44.entities.Asset.update(id, patch));
      refresh();
      // Ringkas: "sudah terbaru dari broker" bukan kegagalan → bukan toast error.
      const sum = summarizeLiveResult(res);
      (sum.tone === "success" ? toast.success : sum.tone === "info" ? toast.info : toast.warning)(sum.title, sum.description ? { description: sum.description } : undefined);
    } catch (e) {
      toast.error("Gagal mencari harga online", { description: errorMessage(e) });
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
  useEffect(() => { setVisibleCount(10); }, [sortBy, typeFilter, scope, invCat]);
  useEffect(() => { if (typeFilter !== "investasi") setInvCat("all"); }, [typeFilter]);

  const typeOptions = ["all", "bank", "emas", "emas_digital", "investasi", "properti", "tanah", "lainnya"];
  const typeFiltered = typeFilter === "all" ? scopedAssets : scopedAssets.filter((a) => a.type === typeFilter);
  // Kategori investasi otomatis (ETF, saham, pasar uang, …) + porsinya.
  const invBreakdown = useMemo(
    () => categoryBreakdown(scopedAssets.filter((a) => a.type === "investasi"), convertedValue),
    [scopedAssets, goldPriceNum, displayCurrency, rateMap], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const filteredAssets = typeFilter === "investasi" && invCat !== "all"
    ? typeFiltered.filter((a) => investmentCategory(a) === invCat)
    : typeFiltered;

  const sortedAssets = [...filteredAssets].sort((a, b) => {
    const tie = String(a.name || "").localeCompare(String(b.name || ""), "id");
    switch (sortBy) {
      case "value_desc": return convertedValue(b) - convertedValue(a) || tie;
      case "value_asc": return convertedValue(a) - convertedValue(b) || tie;
      case "date_desc": return ts(b.purchase_date || b.created_date) - ts(a.purchase_date || a.created_date) || tie;
      case "date_asc": return ts(a.purchase_date || a.created_date) - ts(b.purchase_date || b.created_date) || tie;
      case "updated": return ts(b.updated_date) - ts(a.updated_date) || tie;
      default: return ts(b.created_date) - ts(a.created_date) || tie;
    }
  });

  const total = scopedAssets.reduce((s, a) => s + convertedValue(a), 0);
  // Neraca: kas (harian/tabungan) · investasi · aset pakai, lalu utang/piutang.
  const { data: debts = [] } = useDebts();
  const scopedDebts = debts.filter((d) => (scope === "private" ? d.visibility === "private" : d.visibility !== "private"));
  const sheet = balanceSheet({ assets: scopedAssets, debts: scopedDebts, valueOf: convertedValue, currency: displayCurrency, rateMap });
  const emasAssets = scopedAssets.filter((a) => isGoldType(a.type));
  const emasGrams = emasAssets.reduce((s, a) => s + (a.quantity || 0), 0);
  const goldGramsIdr = scopedAssets.filter((a) => isGoldType(a.type) && (a.currency || "IDR") === "IDR").reduce((t, a) => t + (Number(a.quantity) || 0), 0);

  const openAdd = () => { setEditingAsset(null); setFormOpen(true); };



  return (
    <div className="px-5 pt-6">
      <PageHeader
        title="Aset"
        actions={<>
          <button onClick={toggle} className="btn-icon" aria-label="Sembunyikan angka">
            {hidden ? <EyeOff className="w-5 h-5 text-muted-foreground" /> : <Eye className="w-5 h-5 text-muted-foreground" />}
          </button>
          <Link to="/dompet" className="btn-icon" aria-label="Dompet: saldo & transaksi per rekening">
            <CreditCard className="w-5 h-5 text-muted-foreground" />
          </Link>
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
        {total > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              ["Kas & tabungan", sheet.kas, sheet.kasTabungan > 0 ? <>harian <Money value={sheet.kasHarian} currency={displayCurrency} format="short" /></> : "rekening & tunai"],
              ["Investasi", sheet.investasi, "emas, reksa dana, saham"],
              ["Aset pakai", sheet.pakai + sheet.lainnya, "rumah, tanah, dll"],
            ].map(([label, v, hint]) => (
              <div key={label} className="rounded-2xl bg-white/[0.08] border border-white/10 px-2.5 py-2 min-w-0">
                <p className="text-[10px] opacity-75 truncate">{label}</p>
                <p className="text-sm font-semibold tabular-nums truncate"><Money value={v} currency={displayCurrency} format="short" /></p>
                <p className="text-[10px] opacity-60 truncate">{hint}</p>
              </div>
            ))}
          </div>
        )}
        {(sheet.utang > 0 || sheet.piutang > 0) && (
          <Link to="/utang" className="mt-2 flex items-center justify-between gap-2 rounded-2xl bg-white/[0.08] border border-white/10 px-3 py-2.5 active:scale-[0.99] transition-transform">
            <span className="min-w-0">
              <span className="block text-[11px] opacity-75">Kekayaan bersih</span>
              <span className="block text-lg font-bold tabular-nums leading-tight"><Money value={sheet.netWorth} currency={displayCurrency} /></span>
              <span className="block text-[10px] opacity-70 tabular-nums">
                aset{sheet.piutang > 0 && <> + piutang <Money value={sheet.piutang} currency={displayCurrency} format="short" /></>}{sheet.utang > 0 && <> − utang <Money value={sheet.utang} currency={displayCurrency} format="short" /></>}
              </span>
            </span>
            <ChevronRight className="w-4 h-4 opacity-70 shrink-0" />
          </Link>
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

          {/* Investasi: kategori otomatis dengan porsi nilai */}
          {typeFilter === "investasi" && invBreakdown.length > 1 && (
            <div role="group" aria-label="Kategori investasi" className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5 pt-2 pb-1">
              <button aria-pressed={invCat === "all"} onClick={() => setInvCat("all")}
                className={`shrink-0 h-7 px-2.5 rounded-full text-[11px] font-semibold border transition-colors ${invCat === "all" ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground"}`}>
                Semua jenis
              </button>
              {invBreakdown.map((c) => (
                <button key={c.key} aria-pressed={invCat === c.key} onClick={() => setInvCat(c.key)}
                  className={`shrink-0 h-7 px-2.5 rounded-full text-[11px] font-semibold border transition-colors tabular-nums ${invCat === c.key ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground"}`}>
                  {c.label} <span className="opacity-70">{Math.round(c.pct)}%</span>
                </button>
              ))}
            </div>
          )}
          {typeFilter === "investasi" && invCat === "pasar_uang" && (
            <p className="text-[11px] text-muted-foreground mt-1.5 px-1 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 shrink-0" /> Likuid & stabil — lazim dipakai untuk dana darurat.</p>
          )}

          {/* Konteks per jenis: harga emas acuan untuk emas; harga online untuk investasi */}
          {isGoldType(typeFilter) && <GoldPriceCard grams={goldGramsIdr} className="mt-3" />}
          {/* Perbarui nilai investasi: isi nilai terkini langsung; impor & online ada di dalam lembar */}
          {(typeFilter === "investasi" || typeFilter === "all") && ownInvestments.length > 0 && (
            <button onClick={() => setValueSheet(true)}
              className="mt-2.5 w-full h-10 rounded-full border border-border bg-card text-xs font-semibold inline-flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform">
              <RefreshCw className="w-3.5 h-3.5" /> Perbarui nilai investasi
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
            const dn = assetDisplayName(a);
            const hasPurchase = a.purchase_price && a.purchase_price > 0;
            const g = assetGain(a, goldPriceNum, rateMap);
            const gain = g.gain;
            const gainPct = g.pct;
            const isGain = gain >= 0;
            const showChange = g.available;

            // Rincian di kartu (seperti sebelumnya) — tanpa ikon aksi kecil yang mudah
            // tersentuh tak sengaja; aksi (jangkauan, ubah, hapus) ada di halaman detail.
            const gold = isGoldType(a.type);
            const marketPerGram = gold ? goldPriceIn(a.currency, goldPriceNum, rateMap) : 0;
            const duration = formatDuration(a.purchase_date);
            const lotsN = lotsByAsset[a.id]?.length || 0;
            const vs = a.type === "investasi" ? valueSourceInfo(a) : null;
            const cells = [];
            if (gold && hasPurchase) {
              cells.push(["Harga Beli /gr", <Money key="b" value={a.purchase_price} currency={a.currency} />]);
              cells.push(["Harga Pasar /gr", marketPerGram > 0 ? <Money key="p" value={marketPerGram} currency={a.currency} /> : <span key="p" className="text-warning">{a.currency && a.currency !== "IDR" ? `Butuh kurs ${a.currency}` : "Belum diatur"}</span>]);
              cells.push(["Total Beli", <Money key="t" value={g.cost} currency={a.currency} />]);
            } else if (a.type === "tanah" && hasPurchase) {
              cells.push(["Harga Beli /m²", <Money key="b" value={a.purchase_price} currency={a.currency} />]);
              cells.push(["Luas", `${formatNumber(a.quantity)} m²`]);
            } else if (hasPurchase) {
              cells.push([a.type === "investasi" ? "Modal" : "Harga Beli", <Money key="b" value={g.cost} currency={a.currency} />]);
              if (a.type === "investasi" && Number(a.last_price) > 0) cells.push(["Harga terakhir", <Money key="l" value={a.last_price} currency={a.currency} />]);
            }
            if (hasPurchase) {
              cells.push(["Perubahan", showChange ? (
                <span key="c" className={`inline-flex items-center gap-1 ${isGain ? "text-income" : "text-expense"}`}>
                  {isGain ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  <span>{isGain ? "+" : ""}<Money value={gain} currency={a.currency} /> ({isGain ? "+" : ""}{gainPct.toFixed(1)}%)</span>
                </span>
              ) : <span key="c" className="text-warning">{g.currencySuspect ? "Mata uang tampak keliru" : g.needsGoldPrice ? "Atur harga emas acuan" : "—"}</span>]);
            }

            return (
              <Link key={a.id} to={`/aset/${a.id}`} aria-label={`Detail aset ${a.name}`}
                className="surface p-4 block active:scale-[0.99] transition-transform">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0 self-start">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${cm.bg}`}>
                      <CategoryIcon name={meta.icon} className={`w-5 h-5 ${cm.text}`} />
                    </div>
                    {rank <= 3 && (
                      <span title={`Nilai terbesar ke-${rank}`} className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold border-2 border-background ${rankBadgeClass(rank)}`}>
                        {rank}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-snug line-clamp-2 break-words" title={a.name}>
                      {a.visibility === "private" && <Lock className="inline w-3 h-3 mr-1 -mt-0.5 text-muted-foreground" aria-label="Pribadi" />}
                      {dn.name}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {a.type === "investasi" ? CATEGORY_LABEL[investmentCategory(a)] : meta.label}{dn.ticker ? ` · ${dn.ticker}` : ""}{a.owner ? ` · ${a.owner}` : ""}
                      {gold && a.quantity ? ` · ${formatNumber(a.quantity)} gr` : ""}
                      {a.type === "investasi" && a.quantity ? ` · ${formatNumber(a.quantity)} ${a.unit || "unit"}` : ""}
                      {(a.type === "investasi" || a.type === "bank") && a.broker ? ` · ${a.broker}` : ""}
                    </p>
                    {/* No. rekening tampil jelas (disamarkan hanya saat mode privasi) */}
                    {a.type === "bank" && (a.account_number
                      ? <p className="text-xs mt-0.5 tabular-nums"><span className="text-muted-foreground">No. rek </span><span className="font-semibold tracking-wide">{hidden ? maskAccount(a.account_number) : formatAccountNumber(a.account_number)}</span></p>
                      : <p className="text-[11px] text-warning mt-0.5">No. rekening belum diisi</p>)}
                  </div>
                  <p className="text-sm font-bold tabular-nums shrink-0"><Money value={curVal} currency={a.currency} /></p>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 -mr-1" />
                </div>

                {(cells.length > 0 || duration) && (
                  <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    {cells.map(([label, val]) => (
                      <div key={label} className="min-w-0">
                        <p className="text-muted-foreground">{label}</p>
                        <p className="font-medium tabular-nums truncate">{val}</p>
                      </div>
                    ))}
                    {duration && (
                      <div className={`min-w-0 ${cells.length % 2 === 0 ? "col-span-2" : ""}`}>
                        <p className="text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Disimpan</p>
                        <p className="font-medium">{duration} (sejak {formatDate(a.purchase_date, "d MMM yyyy")})</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Satu baris bawah: dana darurat, asal nilai & ringkasan DCA */}
                {(vs || emergencyIds.has(a.id)) && (
                  <p className="mt-2.5 text-[11px] text-muted-foreground flex items-center gap-x-2.5 gap-y-1 flex-wrap">
                    {emergencyIds.has(a.id) && <span className="inline-flex items-center gap-1 font-semibold text-income"><ShieldCheck className="w-3 h-3" /> Dana darurat</span>}
                    {vs && <span className={`inline-flex items-center gap-1 ${vs.kind === "online" ? "text-warning" : ""}`}>
                      {vs.kind === "online" ? <Globe className="w-3 h-3" /> : <Upload className="w-3 h-3" />}{vs.label}{vs.date ? ` · ${formatDate(vs.date, "d MMM yyyy")}` : ""}
                    </span>}
                    {lotsN > 0 && <span className="inline-flex items-center gap-1"><Layers className="w-3 h-3" /> {lotsN} lot DCA</span>}
                  </p>
                )}
              </Link>
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

      {valueSheet && (
        <InvestmentValueSheet assets={ownInvestments} onClose={() => setValueSheet(false)} onSaved={refresh}
          onLive={handleLivePrices} livePricing={livePricing} liveCount={liveTargets(priceable).targets.length} />
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

    </div>
  );
}