import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAssetSnapshots, useMe, useRateMap } from "@/hooks/useFinance";
import { formatMoney, convertTo } from "@/lib/finance";
import { usePrivacy } from "@/lib/PrivacyContext";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { BarChart3, ArrowRight } from "lucide-react";

// Grafik pertumbuhan aset bulanan.
// Mode "all" (default): konsolidasi seluruh mata uang dikonversi ke displayCurrency.
// Mode mata uang spesifik: tampilkan rincian Emas/Investasi/Bank/Total per mata uang.
export default function AssetGrowthTrend({ displayCurrency: propDisplayCur, rates: propRates }) {
  const { data: snapshots = [] } = useAssetSnapshots();
  const { data: me } = useMe();
  const { hidden } = usePrivacy();
  const fallback = useRateMap();
  const displayCurrency = (propDisplayCur || me?.default_currency || "IDR").toUpperCase();
  const rates = propRates || fallback.map;

  const byCur = useMemo(() => {
    const map = {};
    (snapshots || []).forEach((s) => {
      const c = (s.currency || "IDR").toUpperCase();
      if (!map[c]) map[c] = [];
      map[c].push(s);
    });
    return map;
  }, [snapshots]);

  const activeCurs = Object.keys(byCur).filter((c) => (byCur[c] || []).length > 0);
  const [mode, setMode] = useState("all");

  // Data konsolidasi: gabungkan semua mata uang dikonversi ke displayCurrency per periode.
  const consolidatedData = useMemo(() => {
    if (mode !== "all") return null;
    const byPeriod = {};
    Object.entries(byCur).forEach(([c, list]) => {
      list.forEach((s) => {
        const p = s.period;
        if (!byPeriod[p]) byPeriod[p] = { period: p.slice(5) + "/" + p.slice(2, 4), Total: 0 };
        byPeriod[p].Total += convertTo(s.total_value || 0, c, displayCurrency, rates);
      });
    });
    return Object.values(byPeriod).sort((a, b) => a.period.localeCompare(b.period));
  }, [mode, byCur, displayCurrency, rates]);

  const perCurData = useMemo(() => {
    if (mode === "all") return null;
    const cur = mode;
    return [...(byCur[cur] || [])]
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((s) => ({
        period: s.period.slice(5) + "/" + s.period.slice(2, 4),
        Emas: s.emas_value || 0,
        Investasi: s.investasi_value || 0,
        Bank: s.bank_value || 0,
        Total: s.total_value || 0,
      }));
  }, [mode, byCur]);

  const data = mode === "all" ? consolidatedData : perCurData;
  if (!data || data.length < 2) return null;

  const fmtCur = mode === "all" ? displayCurrency : mode;
  const showTabs = activeCurs.length > 1;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-500" /> Pertumbuhan Aset Bulanan</h2>
          <p className="text-xs text-muted-foreground">
            {mode === "all" ? `Konsolidasi semua mata uang · ${displayCurrency}` : `Per mata uang · ${mode}`}
          </p>
        </div>
        <Link to="/aset-dashboard" className="text-xs text-muted-foreground flex items-center gap-1">
          Detail <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {showTabs && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button onClick={() => setMode("all")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${mode === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Semua</button>
          {activeCurs.map((c) => (
            <button key={c} onClick={() => setMode(c)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${mode === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{c}</button>
          ))}
        </div>
      )}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => (hidden ? "" : formatMoney(v, fmtCur).replace(/\.\d+$/, ""))} />
            <Tooltip formatter={(v) => (hidden ? "••••••" : formatMoney(v, fmtCur))} contentStyle={{ borderRadius: 12, border: "none", fontSize: 12 }} />
            {mode === "all" ? (
              <Line type="monotone" dataKey="Total" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} name="Total" />
            ) : (
              <>
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="Total" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="Emas" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="Investasi" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="Bank" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}