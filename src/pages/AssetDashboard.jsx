import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAssets, useAssetSnapshots } from "@/hooks/useFinance";
import { formatRupiah, formatNumber, assetTypeLabels } from "@/lib/finance";
import { toast } from "sonner";
import { ArrowLeft, Coins, TrendingUp, TrendingDown, Loader2, RefreshCw, Briefcase, BarChart3, Wallet, PieChart as PieChartIcon, ExternalLink } from "lucide-react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import GoldPriceCompare from "@/components/GoldPriceCompare";

export default function AssetDashboard() {
  const navigate = useNavigate();
  const { data: assets = [] } = useAssets();
  const { data: snapshots = [], refetch } = useAssetSnapshots();
  const [goldPrice, setGoldPrice] = useState("");
  const [goldHistory, setGoldHistory] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [goldSource, setGoldSource] = useState("");

  const goldPriceNum = Number(goldPrice) || 0;

  const emasAssets = assets.filter((a) => a.type === "emas");
  const emasGrams = emasAssets.reduce((s, a) => s + (a.quantity || 0), 0);
  const emasStored = emasAssets.reduce((s, a) => s + (a.value || 0), 0);
  const emasValue = goldPriceNum > 0 ? emasGrams * goldPriceNum : emasStored;

  const investasiAssets = assets.filter((a) => a.type === "investasi");
  const investasiValue = investasiAssets.reduce((s, a) => s + (a.value || 0), 0);
  const investasiPurchase = investasiAssets.reduce((s, a) => s + (a.purchase_price || 0), 0);

  const totalCurrent = assets.reduce((s, a) => {
    if (a.type === "emas" && goldPriceNum > 0) return s + (a.quantity || 0) * goldPriceNum;
    return s + (a.value || 0);
  }, 0);
  const totalPurchase = assets.reduce((s, a) => s + (a.type === "emas" && a.quantity ? (a.purchase_price || 0) * a.quantity : (a.purchase_price || 0)), 0);
  const totalGrowth = totalPurchase > 0 ? ((totalCurrent - totalPurchase) / totalPurchase) * 100 : 0;

  const emasPurchaseTotal = emasAssets.reduce((s, a) => s + (a.type === "emas" && a.quantity ? (a.purchase_price || 0) * a.quantity : (a.purchase_price || 0)), 0);
  const emasGrowthPct = emasPurchaseTotal > 0 && emasValue > 0 ? ((emasValue - emasPurchaseTotal) / emasPurchaseTotal) * 100 : 0;

  const allocColors = { "Bank": "#3b82f6", "Emas": "#f59e0b", "Investasi": "#10b981", "Properti": "#8b5cf6", "Tanah": "#06b6d4", "Lainnya": "#64748b" };
  const allocation = ["bank", "emas", "investasi", "properti", "tanah", "lainnya"]
    .map((type) => {
      const val = assets.filter((a) => a.type === type).reduce((s, a) => s + (a.type === "emas" && goldPriceNum > 0 ? (a.quantity || 0) * goldPriceNum : (a.value || 0)), 0);
      return { name: assetTypeLabels[type]?.label || type, value: Math.round(val) };
    })
    .filter((x) => x.value > 0);

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
          "Berikan data harga emas per gram di Indonesia untuk 6 bulan terakhir (termasuk bulan ini). Sertakan nama bulan (format: MMM yyyy, contoh: 'Mar 2026') dan harga per gram dalam Rupiah. Urutkan dari yang paling lama ke terbaru. Sebutkan juga nama sumber referensi data (mis. Antam, Pegadaian, Logam Mulia) dan URL jika ada.",
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

      <div className="grid grid-cols-2 gap-3 mb-5">
        <SummaryCard icon={Coins} color="amber" label="Nilai Emas" value={formatRupiah(emasValue)} sub={`${formatNumber(emasGrams)} gram`} growth={emasGrowthPct} />
        <SummaryCard icon={Briefcase} color="green" label="Investasi" value={formatRupiah(investasiValue)} sub={`${investasiAssets.length} aset`} growth={investasiPurchase > 0 ? ((investasiValue - investasiPurchase) / investasiPurchase) * 100 : 0} />
        <SummaryCard icon={Wallet} color="indigo" label="Total Aset" value={formatRupiah(totalCurrent)} sub={`Beli: ${formatRupiah(totalPurchase)}`} growth={totalGrowth} />
        <SummaryCard icon={BarChart3} color="violet" label="Snapshot" value={`${snapshots.length} bln`} sub="Data tersimpan" />
      </div>

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

function SummaryCard({ icon: Icon, color, label, value, sub, growth = 0 }) {
  const colorClasses = {
    amber: "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
    green: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
    indigo: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400",
    violet: "bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400",
  };
  const cm = colorClasses[color] || colorClasses.indigo;
  const isPositive = growth >= 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cm}`}>
          <Icon className="w-4 h-4" />
        </div>
        {growth !== 0 && (
          <span className={`text-[10px] font-medium flex items-center gap-0.5 ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? "+" : ""}{growth.toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-sm mt-0.5 truncate">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}