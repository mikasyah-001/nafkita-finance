import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAssets, useAssetSnapshots, useMe, useUserCurrencies, useRateMap } from "@/hooks/useFinance";
import { formatRupiah, formatNumber, assetTypeLabels, colorMap, formatMoneyShort, convertTo, formatDate, hasRate, isGoldType, formatAxis, assetMarketValue, assetGain, portfolioGain } from "@/lib/finance";
import { toast } from "sonner";
import { Coins, TrendingUp, TrendingDown, Loader2, RefreshCw, BarChart3, PieChart as PieChartIcon, ExternalLink, Layers, Globe, AlertTriangle } from "lucide-react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import GoldPriceCard from "@/components/GoldPriceCard";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import CategoryIcon from "@/components/CategoryIcon";
import ZakatSummaryCard from "@/components/ZakatSummaryCard";
import { useScope } from "@/lib/ScopeContext";
import ScopeToggle from "@/components/ScopeToggle";
import PageHeader from "@/components/PageHeader";

export default function AssetDashboard() {
  const { data: allAssets = [] } = useAssets();
  const { data: snapshots = [], refetch } = useAssetSnapshots();
  const { scope } = useScope();
  const { data: me } = useMe();
  const userCurrencies = useUserCurrencies();
  const { map: rateMap, date: rateDate, source: rateSource } = useRateMap();
  const defaultCurrency = (me?.default_currency || "IDR").toUpperCase();
  // "all" = konsolidasi seluruh mata uang dikonversi ke defaultCurrency.
  const [currency, setCurrency] = useState("all");
  const displayCurrency = currency === "all" ? defaultCurrency : currency;
  const isConsolidated = currency === "all";

  const [goldHistory, setGoldHistory] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [goldSource, setGoldSource] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // Harga emas acuan bersama (sama dengan halaman Aset, Laporan, Zakat).
  const { price: goldPriceNum } = useGoldPrice();

  // Aset dalam cakupan (scope). Saat mode konsolidasi, muat semua mata uang;
  // saat mata uang spesifik, hanya aset dengan mata uang tersebut.
  const scopedAssets = allAssets.filter((a) => {
    if (scope === "private" ? a.visibility !== "private" : a.visibility === "private") return false;
    if (isConsolidated) return true;
    return (a.currency || "IDR").toUpperCase() === displayCurrency;
  });

  // Nilai pasar aset (emas = gram × harga acuan, termasuk emas digital non-IDR via kurs).
  const baseValue = (a) => assetMarketValue(a, goldPriceNum, rateMap);
  // Nilai tampilan: konsolidasi (konversi ke displayCurrency) atau asli (mata uang spesifik).
  const displayValue = (a) => {
    if (isConsolidated) return convertTo(baseValue(a), (a.currency || "IDR").toUpperCase(), displayCurrency, rateMap);
    return baseValue(a);
  };

  const emasAssets = scopedAssets.filter((a) => isGoldType(a.type));
  const emasGrams = emasAssets.reduce((s, a) => s + (a.quantity || 0), 0);




  const totalCurrent = scopedAssets.reduce((s, a) => s + displayValue(a), 0);
  const assetCurrencies = [...new Set(scopedAssets.map((a) => (a.currency || "IDR").toUpperCase()))];
  const missingRates = assetCurrencies.filter((c) => c !== displayCurrency && !hasRate(c, rateMap));
  // Pertumbuhan hanya untuk aset yang punya harga beli. Sebelumnya nilai
  // SEMUA aset (termasuk tabungan bank tanpa harga beli) dibandingkan dengan
  // harga beli sebagian aset, sehingga muncul angka semu seperti +133%.
  // Untung/rugi: per aset dalam mata uangnya sendiri, lalu dikonversi dengan
  // kurs masing-masing dan dijumlahkan (portfolioGain — satu logika dengan halaman Aset).
  const totalGain = portfolioGain(scopedAssets, displayCurrency, { goldPrice: goldPriceNum, rateMap });
  const totalPurchase = totalGain.cost;
  const totalGrowth = totalGain.pct;

  const allocColors = { "Tabungan/Bank": "#3b82f6", "Uang Tunai": "#157A5A", "Emas": "#f59e0b", "Emas Digital": "#f59e0b", "Investasi": "#10b981", "Properti": "#8b5cf6", "Tanah": "#06b6d4", "Lainnya": "#64748b" };
  const allocation = ["bank", "tunai", "emas", "emas_digital", "investasi", "properti", "tanah", "lainnya"]
    .map((type) => {
      const val = scopedAssets.filter((a) => a.type === type).reduce((s, a) => s + displayValue(a), 0);
      return { name: assetTypeLabels[type]?.label || type, value: Math.round(val) };
    })
    .filter((x) => x.value > 0);

  const typeTotals = ["bank", "tunai", "emas", "emas_digital", "investasi", "properti", "tanah", "lainnya"]
    .map((type) => {
      const list = scopedAssets.filter((a) => a.type === type);
      const value = list.reduce((s, a) => s + displayValue(a), 0);
      // Pertumbuhan hanya dari aset yang untung/ruginya bisa dihitung (ada harga
      // beli; emas butuh harga acuan) — aset lain tidak ikut dibandingkan.
      const g = portfolioGain(list, displayCurrency, { goldPrice: goldPriceNum, rateMap });
      return { type, value, purchase: g.cost, growth: g.pct, count: list.length };
    })
    .filter((t) => t.count > 0);

  useEffect(() => {
    (async () => {
      setSeeding(true);
      try {
        await base44.functions.invoke("snapshotAssets", {});
        refetch();
      } catch {}
      setSeeding(false);
    })();
  }, []);

  const fetchGoldHistory = async () => {
    setFetching(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt:
          "Berikan data harga emas Antam (Aneka Logam) per gram di Indonesia untuk 6 bulan terakhir (termasuk bulan ini). Gunakan Antam sebagai sumber utama dan standar. Sertakan nama bulan (format: MMM yyyy, contoh: 'Mar 2026') dan harga per gram dalam Rupiah. Urutkan dari yang paling lama ke terbaru. Sebutkan juga nama sumber referensi data (Antam) dan URL jika ada.",
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            prices: {
              type: "array",
              items: {
                type: "object",
                properties: { month: { type: "string" }, price: { type: "number" } },
              },
            },
            source: { type: "string" },
            url: { type: "string" },
          },
        },
      });
      const prices = (result.prices || []).filter((p) => p.price > 0);
      if (prices.length === 0) {
        toast.error("Tidak dapat menemukan riwayat harga emas");
      } else {
        setGoldHistory(prices);
        setGoldSource(result.source || "");
        toast.success("Riwayat harga emas dimuat", { description: `${prices.length} bulan data${result.source ? ` • ${result.source}` : ""}` });
      }
    } catch {
      toast.error("Gagal mengambil riwayat harga emas");
    }
    setFetching(false);
  };

  const goldChartData = goldHistory.map((h) => ({
    month: h.month,
    value: Math.round(emasGrams * h.price),
  }));

  // Data grafik snapshot: konsolidasi (semua mata uang dikonversi ke displayCurrency) atau per mata uang.
  const snapshotChartData = (() => {
    const list = isConsolidated ? snapshots : snapshots.filter((s) => (s.currency || "IDR").toUpperCase() === displayCurrency);
    if (isConsolidated) {
      const byPeriod = {};
      list.forEach((s) => {
        const p = s.period;
        if (!byPeriod[p]) byPeriod[p] = { period: p.slice(5) + "/" + p.slice(2, 4), Emas: 0, Investasi: 0, Bank: 0, Total: 0 };
        const c = (s.currency || "IDR").toUpperCase();
        byPeriod[p].Emas += convertTo(s.emas_value || 0, c, displayCurrency, rateMap);
        byPeriod[p].Investasi += convertTo(s.investasi_value || 0, c, displayCurrency, rateMap);
        byPeriod[p].Bank += convertTo(s.bank_value || 0, c, displayCurrency, rateMap);
        byPeriod[p].Total += convertTo(s.total_value || 0, c, displayCurrency, rateMap);
      });
      return Object.values(byPeriod).sort((a, b) => a.period.localeCompare(b.period));
    }
    return [...list]
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((s) => ({
        period: s.period.slice(5) + "/" + s.period.slice(2, 4),
        Emas: s.emas_value || 0,
        Investasi: s.investasi_value || 0,
        Bank: s.bank_value || 0,
        Total: s.total_value || 0,
      }));
  })();

  // Opsi mata uang untuk filter: "Semua" + tiap mata uang aktif.
  const currencyOptions = ["all", ...userCurrencies.map((c) => c.code)];

  return (
    <div className="px-5 pt-6">
      <PageHeader title="Dashboard Aset" back />

      <ScopeToggle className="mb-3" />

      <div className="mb-5">
        <div className="flex flex-wrap gap-1.5">
          {currencyOptions.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              aria-pressed={currency === c}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-all ${currency === c ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-muted text-muted-foreground border-border hover:text-foreground"}`}
            >
              {c === "all" ? <><Globe className="w-3 h-3" /> Semua</> : c}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl card-gradient-primary p-5 mb-3 shadow-lg">
        <div className="flex items-center justify-between">
          <p className="text-xs opacity-80">{isConsolidated ? "Total Nilai Aset (Konsolidasi)" : "Total Nilai Aset"}</p>
          {isConsolidated && rateDate && (
            <span className="text-[11px] opacity-75 flex items-center gap-1 bg-white/15 rounded-full px-2 py-0.5">
              <Globe className="w-2.5 h-2.5" />
              dikonversi ke {displayCurrency} · kurs {rateSource === "bi" ? "BI" : "pasar"} {formatDate(rateDate, "dd MMM")}
            </span>
          )}
        </div>
        <p className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums break-words">{formatMoneyShort(totalCurrent, displayCurrency)}</p>
        <div className="flex gap-4 mt-2 text-xs">
          <div>
            <p className="opacity-80">Nilai beli ({totalGain.count} aset)</p>
            <p className="font-semibold tabular-nums">{formatMoneyShort(totalPurchase, displayCurrency)}</p>
          </div>
          <div>
            <p className="opacity-80">Pertumbuhan aset tsb.</p>
            <p className="font-semibold tabular-nums flex items-center gap-1">{totalGrowth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{totalGrowth >= 0 ? "+" : ""}{totalGrowth.toFixed(1)}%</p>
          </div>
          <div>
            <p className="opacity-80">Jenis Aset</p>
            <p className="font-semibold tabular-nums">{typeTotals.length}</p>
          </div>
        </div>
      </div>

      {missingRates.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
          <p className="text-xs text-warning">Kurs belum tersedia untuk {missingRates.join(", ")}. Aset dalam mata uang ini belum termasuk dalam total.</p>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 pb-1">
        <button onClick={() => setActiveTab("all")} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${activeTab === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Layers className="w-3.5 h-3.5" /> Semua
        </button>
        {typeTotals.map((t) => {
          const meta = assetTypeLabels[t.type];
          return (
            <button key={t.type} onClick={() => setActiveTab(t.type)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${activeTab === t.type ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              <CategoryIcon name={meta.icon} className="w-3.5 h-3.5" /> {meta.label}
            </button>
          );
        })}
      </div>

      {activeTab === "all" ? (
        <>
          <p className="text-xs text-muted-foreground mb-2 px-1">Total per Jenis Aset</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {typeTotals.map((t) => {
              const meta = assetTypeLabels[t.type];
              const cm = colorMap[meta.color] || colorMap.slate;
              return (
                <div key={t.type} className="surface p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cm.bg}`}>
                      <CategoryIcon name={meta.icon} className={`w-4 h-4 ${cm.text}`} />
                    </div>
                    {t.growth !== 0 && (
                      <span className={`text-[11px] font-medium flex items-center gap-0.5 ${t.growth >= 0 ? "text-success" : "text-destructive"}`}>
                        {t.growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {t.growth >= 0 ? "+" : ""}{t.growth.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{meta.label}</p>
                  <p className="font-semibold text-sm mt-0.5 truncate tabular-nums">{formatMoneyShort(t.value, displayCurrency)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t.count} aset{isGoldType(t.type) ? ` • ${formatNumber(emasGrams)} gr` : ""}</p>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-3 mb-5">
          {scopedAssets.filter((a) => a.type === activeTab).map((a) => {
            const meta = assetTypeLabels[a.type] || assetTypeLabels.lainnya;
            const cm = colorMap[meta.color] || colorMap.slate;
            const curVal = displayValue(a);
            // Persentase dihitung dalam mata uang aset itu sendiri (tidak tercampur kurs).
            const ag = assetGain(a, goldPriceNum, rateMap);
            const hasPurchase = ag.available;
            const gain = ag.gain;
            const gainPct = ag.pct;
            return (
              <div key={a.id} className="surface p-3.5 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cm.bg}`}>
                  <CategoryIcon name={meta.icon} className={`w-4 h-4 ${cm.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {meta.label}{a.broker ? ` • ${a.broker}` : ""}{a.quantity ? ` • ${formatNumber(a.quantity)} ${isGoldType(a.type) ? "gr" : a.type === "tanah" ? "m²" : (a.unit || "")}` : ""}{isConsolidated && (a.currency || "IDR") !== displayCurrency ? ` • ${a.currency}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{formatMoneyShort(curVal, displayCurrency)}</p>
                  {hasPurchase && (
                    <p className={`text-[11px] flex items-center gap-0.5 justify-end ${gain >= 0 ? "text-success" : "text-destructive"}`}>
                      {gain >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {gain >= 0 ? "+" : ""}{gainPct.toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ZakatSummaryCard />

      <div className="mb-5">
        <GoldPriceCard grams={emasGrams} className="" />
      </div>

      <div className="surface p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-sm flex items-center gap-2"><Coins className="w-4 h-4 text-warning" /> Pertumbuhan Emas</h2>
            <p className="text-xs text-muted-foreground">Nilai emas per bulan mengikuti harga pasar</p>
          </div>
          <button onClick={fetchGoldHistory} disabled={fetching} className="px-3 py-1.5 rounded-xl bg-warning text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-60">
            {fetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Cek History
          </button>
        </div>

        {goldChartData.length > 0 ? (
          <>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={goldChartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis width={44} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={formatAxis} />
                  <Tooltip formatter={(v) => formatRupiah(v)} contentStyle={{ borderRadius: 12, border: "none", fontSize: 12 }} />
                  <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} fill="url(#goldGrad)" name="Nilai Emas" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {goldChartData.length >= 2 && (
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-muted-foreground">Awal: {formatRupiah(goldChartData[0].value)}</span>
                <span className={`flex items-center gap-1 font-medium ${goldChartData[goldChartData.length - 1].value >= goldChartData[0].value ? "text-success" : "text-destructive"}`}>
                  {goldChartData[goldChartData.length - 1].value >= goldChartData[0].value ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {formatRupiah(goldChartData[goldChartData.length - 1].value)}
                </span>
              </div>
            )}
            {goldSource && (
              <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Sumber: {goldSource}</p>
            )}
          </>
        ) : (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground mb-1">Belum ada data grafik</p>
            <p className="text-xs text-muted-foreground">Tekan "Cek History" untuk memuat riwayat harga emas 6 bulan terakhir.</p>
          </div>
        )}
      </div>

      <div className="surface p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Pertumbuhan Total Aset</h2>
            <p className="text-xs text-muted-foreground">{isConsolidated ? `Konsolidasi · ${displayCurrency}` : `Snapshot per bulan · ${displayCurrency}`}</p>
          </div>
          {seeding && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>

        {snapshotChartData.length >= 2 ? (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={snapshotChartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis width={44} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={formatAxis} />
                <Tooltip formatter={(v) => formatMoneyShort(v, displayCurrency)} contentStyle={{ borderRadius: 12, border: "none", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Emas" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Investasi" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Bank" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground mb-1">Data grafik sedang dikumpulkan</p>
            <p className="text-xs text-muted-foreground">Snapshot otomatis tercatat setiap awal bulan. Data saat ini sudah disimpan sebagai titik awal.</p>
          </div>
        )}
      </div>

      {allocation.length > 0 && (
        <div className="surface p-4 mt-5">
          <h2 className="font-semibold text-sm flex items-center gap-2 mb-3"><PieChartIcon className="w-4 h-4 text-scope-private" /> Komposisi Aset</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={allocation} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={42} paddingAngle={2}>
                  {allocation.map((entry, i) => <Cell key={i} fill={allocColors[entry.name] || "#94a3b8"} />)}
                </Pie>
                <Tooltip formatter={(v) => formatMoneyShort(v, displayCurrency)} contentStyle={{ borderRadius: 12, border: "none", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}