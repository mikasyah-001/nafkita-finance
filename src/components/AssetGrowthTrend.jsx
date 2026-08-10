import { Link } from "react-router-dom";
import { useAssetSnapshots } from "@/hooks/useFinance";
import { formatRupiah } from "@/lib/finance";
import { usePrivacy } from "@/lib/PrivacyContext";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { BarChart3, ArrowRight } from "lucide-react";

export default function AssetGrowthTrend() {
  const { data: snapshots = [] } = useAssetSnapshots();
  const { hidden } = usePrivacy();

  const data = [...snapshots]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((s) => ({
      period: s.period.slice(5) + "/" + s.period.slice(2, 4),
      Emas: s.emas_value || 0,
      Investasi: s.investasi_value || 0,
      Bank: s.bank_value || 0,
      Total: s.total_value || 0,
    }));

  if (data.length < 2) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-500" /> Pertumbuhan Aset Bulanan</h2>
          <p className="text-xs text-muted-foreground">Perkembangan tabungan & investasi keluarga</p>
        </div>
        <Link to="/aset-dashboard" className="text-xs text-muted-foreground flex items-center gap-1">
          Detail <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => (hidden ? "" : `${(v / 1000000).toFixed(0)}jt`)} />
            <Tooltip formatter={(v) => (hidden ? "••••••" : formatRupiah(v))} contentStyle={{ borderRadius: 12, border: "none", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="Total" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="Emas" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="Investasi" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="Bank" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}