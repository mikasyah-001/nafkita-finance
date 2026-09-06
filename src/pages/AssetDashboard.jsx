import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAssets, useAssetSnapshots, useMe, useUserCurrencies } from "@/hooks/useFinance";
import { formatRupiah, formatNumber, assetTypeLabels, colorMap, formatMoneyShort } from "@/lib/finance";
import CurrencyTabs from "@/components/CurrencyTabs";
import { toast } from "sonner";
import { ArrowLeft, Coins, TrendingUp, TrendingDown, Loader2, RefreshCw, BarChart3, PieChart as PieChartIcon, ExternalLink, Users, Lock, Layers } from "lucide-react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import GoldPriceCompare from "@/components/GoldPriceCompare";
import CategoryIcon from "@/components/CategoryIcon";
import ZakatStatus from "@/components/ZakatStatus";
import { useScope } from "@/lib/ScopeContext";

export default function AssetDashboard() {
  const navigate = useNavigate();
  const { data: allAssets = [] } = useAssets();
  const { data: snapshots = [], refetch } = useAssetSnapshots();
  const { scope, setScope } = useScope();
  const { data: me } = useMe();
  const userCurrencies = useUserCurrencies();
  const [currency, setCurrency] = useState(me?.default_currency || "IDR");
  useEffect(() => { if (me?.default_currency) setCurrency(me.default_currency); }, [me?.default_currency]);
  const scopedAssets = allAssets.filter((a) => (scope === "private" ? a.visibility === "private" : a.visibility !== "private") && (a.currency || "IDR") === currency);
  const [goldPrice, setGoldPrice] = useState("");
  const [goldHistory, setGoldHistory] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [goldSource, setGoldSource] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const goldPriceNum = Number(goldPrice) || 0;

  const emasAssets = scopedAssets.filter((a) => a.type === "emas");
  const emasGrams = emasAssets.reduce((s, a) => s + (a.quantity || 0), 0);
  const emasStored = emasAssets.reduce((s, a) => s + (a.value || 0), 0);
  const emasValue = goldPriceNum > 0 ? emasGrams * goldPriceNum : emasStored;

  const investasiAssets = scopedAssets.filter((a) => a.type === "investasi");
  const investasiValue = investasiAssets.reduce((s, a) => s + (a.value || 0), 0);
  const investasiPurchase = investasiAssets.reduce((s, a) => s + (a.purchase_price || 0), 0);

  const nonEmasValue = scopedAssets.filter((a) => a.type !== "emas").reduce((s, a) => s + (a.value || 0), 0);

  const totalCurrent = scopedAssets.reduce((s, a) => {
    if (a.type === "emas" && goldPriceNum > 0) return s + (a.quantity || 0) * goldPriceNum;
    return s + (a.value || 0);
  }, 0);
  const totalPurchase = scopedAssets.reduce((s, a) => s + ((a.type === "emas" || a.type === "tanah") && a.quantity ? (a.purchase_price || 0) * a.quantity : (a.purchase_price || 0)), 0);
  const totalGrowth = totalPurchase > 0 ? ((totalCurrent - totalPurchase) / totalPurchase) * 100 : 0;

  const emasPurchaseTotal = emasAssets.reduce((s, a) => s + (a.type === "emas" && a.quantity ? (a.purchase_price || 0) * a.quantity : (a.purchase_price || 0)), 0);
  const emasGrowthPct = emasPurchaseTotal > 0 && emasValue > 0 ? ((emasValue - emasPurchaseTotal) / emasPurchaseTotal) * 100 : 0;

  const allocColors = { "Bank": "#3b82f6", "Emas": "#f59e0b", "Investasi": "#10b981", "Properti": "#8b5cf6", "Tanah": "#06b6d4", "Lainnya": "#64748b" };
  const allocation = ["bank", "emas", "investasi", "properti", "tanah", "lainnya"]
    .map((type) => {
      const val = scopedAssets.filter((a) => a.type === type).reduce((s, a) => s + (a.type === "emas" && goldPriceNum > 0 ? (a.quantity || 0) * goldPriceNum : (a.value || 0)), 0);
      return { name: assetTypeLabels[type]?.label || type, value: Math.round(val) };
    })
    .filter((x) => x.value > 0);

  const typeTotals = ["bank", "emas", "investasi", "properti", "tanah", "lainnya"]
    .map((type) => {
      const list = scopedAssets.filter((a) => a.type === type);
      const value = list.reduce((s, a) => s + (type === "emas" && goldPriceNum > 0 ? (a.quantity || 0) * goldPriceNum : (a.value || 0)), 0);
      const purchase = list.reduce((s, a) => s + ((type === "emas" || type === "tanah") && a.quantity ? (a.purchase_price || 0) * a.quantity : (a.purchase_price || 0)), 0);
      const growth = purchase > 0 ? ((value - purchase) / purchase) * 100 : 0;
      const curSet = [...new Set(list.map((a) => a.currency || "IDR"))];
      const currency = curSet.length === 1 ? curSet[0] : "IDR";
      return { type, value, purchase, growth, count: list.length, currency };
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
        if (prices.length > 0) setGoldPrice(String(Math.round(prices[prices.length - 1].price)));
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

  const snapshotChartData = [...snapshots]
    .filter((s) => (s.currency || "IDR") === currency)
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((s) => ({
      period: s.period.slice(5) + "/" + s.period.slice(2, 4),
      Emas: s.emas_value || 0,
      Investasi: s.investasi_value || 0,
      Total: s.total_value || 0,
    }));

  return (
    <div className="px-5 pt-8 pb-8">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold">Dashboard Aset</h1>
      </div>

      <div className="flex gap-2 mb-3">
        <button onClick={() => setScope("shared")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "shared" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Users className="w-4 h-4" /> Bersama
        </button>
        <button onClick={() => setScope("private")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "private" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Lock className="w-4 h-4" /> Pribadi
        </button>
      </div>

      <div className="mb-5"><CurrencyTabs currencies={userCurrencies.map((c) => c.code)} value={currency} onChange={setCurrency} /></div>

      <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white p-5 mb-3 shadow-lg">
        <p className="text-xs opacity-80">Total Nilai Aset</p>
        <p className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums break-words">{formatMoneyShort(totalCurrent, currency)}</p>
        <div className="flex gap-4 mt-2 text-xs">
          <div>
            <p className="opacity-80">Nilai Beli</p>
            <p className="font-semibold tabular-nums">{formatMoneyShort(totalPurchase, currency)}</p>
          </div>
          <div>
            <p className="opacity-80">Pertumbuhan</p>
            <p className="font-semibold tabular-nums flex items-center gap-1">{totalGrowth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{totalGrowth >= 0 ? "+" : ""}{totalGrowth.toFixed(1)}%</p>
          </div>
          <div>
            <p className="opacity-80">Jenis Aset</p>
            <p className="font-semibold tabular-nums">{typeTotals.length}</p>
          </div>
        </div>
      </div>

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
                <div key={t.type} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cm.bg}`}>
                      <CategoryIcon name={meta.icon} className={`w-4 h-4 ${cm.text}`} />
                    </div>
                    {t.growth !== 0 && (
                      <span className={`text-[10px] font-medium flex items-center gap-0.5 ${t.growth >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {t.growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {t.growth >= 0 ? "+" : ""}{t.growth.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{meta.label}</p>
                  <p className="font-semibold text-sm mt-0.5 truncate tabular-nums">{formatMoneyShort(t.value, t.currency)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{t.count} aset{t.type === "emas" ? ` • ${formatNumber(emasGrams)} gr` : ""}</p>
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
            const curVal = a.type === "emas" && goldPriceNum > 0 && a.quantity ? a.quantity * goldPriceNum : (a.value || 0);
            const hasPurchase = a.purchase_price && a.purchase_price > 0;
            const totalPurchase = hasPurchase ? (a.quantity && a.type === "emas" ? a.purchase_price * a.quantity : a.purchase_price) : 0;
            const gain = hasPurchase ? curVal - totalPurchase : 0;
            const gainPct = hasPurchase && totalPurchase > 0 ? (gain / totalPurchase) * 100 : 0;
            return (
              <div key={a.id} className="rounded-2xl border border-border bg-card p-3.5 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cm.bg}`}>
                  <CategoryIcon name={meta.icon} className={`w-4 h-4 ${cm.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {meta.label}{a.broker ? ` • ${a.broker}` : ""}{a.quantity ? ` • ${formatNumber(a.quantity)} ${a.type === "emas" ? "gr" : a.type === "tanah" ? "m²" : (a.unit || "")}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{formatMoneyShort(curVal, a.currency)}</p>
                  {hasPurchase && (
                    <p className={`text-[10px] flex items-center gap-0.5 justify-end ${gain >= 0 ? "text-emerald-600" : "text-red-500"}`}>
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

      <ZakatStatus
        emasGrams={emasGrams}
        emasValue={emasValue}
        nonEmasValue={nonEmasValue}
        goldPrice={goldPriceNum}
      />

      <div className="mb-5">
        <GoldPriceCompare value={goldPrice} onChange={setGoldPrice} grams={emasGrams} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-sm flex items-center gap-2"><Coins className="w-4 h-4 text-amber-500" /> Pertumbuhan Emas</h2>
            <p className="text-xs text-muted-foreground">Nilai emas per bulan mengikuti harga pasar</p>
          </div>
          <button onClick={fetchGoldHistory} disabled={fetching} className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-60">
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
                  <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                  <Tooltip formatter={(v) => formatRupiah(v)} contentStyle={{ borderRadius: 12, border: "none", fontSize: 12 }} />
                  <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} fill="url(#goldGrad)" name="Nilai Emas" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {goldChartData.length >= 2 && (
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-muted-foreground">Awal: {formatRupiah(goldChartData[0].value)}</span>
                <span className={`flex items-center gap-1 font-medium ${goldChartData[goldChartData.length - 1].value >= goldChartData[0].value ? "text-emerald-600" : "text-red-500"}`}>
                  {goldChartData[goldChartData.length - 1].value >= goldChartData[0].value ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {formatRupiah(goldChartData[goldChartData.length - 1].value)}
                </span>
              </div>
            )}
            {goldSource && (
              <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Sumber: {goldSource}</p>
            )}
          </>
        ) : (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground mb-1">Belum ada data grafik</p>
            <p className="text-xs text-muted-foreground">Tekan "Cek History" untuk memuat riwayat harga emas 6 bulan terakhir.</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-500" /> Pertumbuhan Total Aset</h2>
            <p className="text-xs text-muted-foreground">Snapshot nilai aset per bulan</p>
          </div>
          {seeding && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>

        {snapshotChartData.length >= 2 ? (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={snapshotChartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                <Tooltip formatter={(v) => formatRupiah(v)} contentStyle={{ borderRadius: 12, border: "none", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Total" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Emas" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Investasi" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
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
        <div className="rounded-2xl border border-border bg-card p-4 mt-5">
          <h2 className="font-semibold text-sm flex items-center gap-2 mb-3"><PieChartIcon className="w-4 h-4 text-violet-500" /> Komposisi Aset</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={allocation} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={42} paddingAngle={2}>
                  {allocation.map((entry, i) => <Cell key={i} fill={allocColors[entry.name] || "#94a3b8"} />)}
                </Pie>
                <Tooltip formatter={(v) => formatRupiah(v)} contentStyle={{ borderRadius: 12, border: "none", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}