import { useMemo } from "react";
import { formatMoney, formatNumber, colorMap, assetTypeLabels } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

const typeColors = { bank: "#3b82f6", emas: "#f59e0b", investasi: "#10b981", properti: "#8b5cf6", tanah: "#06b6d4", lainnya: "#64748b" };

export default function AssetGrowthChart({ assets, goldPrice = 0 }) {
  const byType = useMemo(() => {
    const map = {};
    assets.forEach((a) => {
      const t = a.type || "lainnya";
      const cur = a.type === "emas" && goldPrice > 0 ? (a.quantity || 0) * goldPrice : (a.value || 0);
      map[t] = (map[t] || 0) + cur;
    });
    return Object.entries(map)
      .map(([type, total]) => {
        const list = assets.filter((a) => (a.type || "lainnya") === type);
        const curSet = [...new Set(list.map((a) => a.currency || "IDR"))];
        const currency = curSet.length === 1 ? curSet[0] : "IDR";
        return { type, label: assetTypeLabels[type]?.label || type, total, currency };
      })
      .sort((a, b) => b.total - a.total);
  }, [assets, goldPrice]);

  const perAsset = useMemo(
    () =>
      assets.map((a) => {
        // Emas & tanah: harga beli per unit (gram/m²) × quantity. Lainnya: total langsung.
        const purchase = a.purchase_price
          ? (a.type === "emas" || a.type === "tanah") && a.quantity
            ? a.purchase_price * a.quantity
            : a.purchase_price
          : 0;
        const current = a.type === "emas" && goldPrice > 0 ? (a.quantity || 0) * goldPrice : (a.value || 0);
        const gain = purchase > 0 ? current - purchase : 0;
        const gainPct = purchase > 0 ? (gain / purchase) * 100 : 0;
        return { ...a, purchase, current, gain, gainPct };
      }),
    [assets, goldPrice]
  );

  if (!assets.length) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-muted-foreground" /> Total per Jenis Aset</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byType} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={55} />
              <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 10 }} width={48} />
              <Tooltip formatter={(v, _n, item) => formatMoney(v, item?.payload?.currency)} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {byType.map((d, i) => (
                  <Cell key={i} fill={typeColors[d.type] || "#64748b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {byType.map((d) => (
            <div key={d.type} className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-full" style={{ background: typeColors[d.type] || "#64748b" }} />
              <span className="flex-1 text-muted-foreground truncate">{d.label}</span>
              <span className="font-medium">{formatMoney(d.total, d.currency)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold text-sm mb-3">Pertumbuhan per Aset</h2>
        <div className="space-y-3">
          {perAsset.map((a) => {
            const meta = assetTypeLabels[a.type] || assetTypeLabels.lainnya;
            const cm = colorMap[meta.color] || colorMap.slate;
            const hasPurchase = a.purchase > 0;
            const isGain = a.gain >= 0;
            return (
              <div key={a.id} className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cm.bg}`}>
                  <CategoryIcon name={meta.icon} className={`w-4 h-4 ${cm.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  {hasPurchase ? (
                    <p className="text-xs text-muted-foreground truncate">{formatMoney(a.purchase, a.currency)} → {formatMoney(a.current, a.currency)}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nilai {formatMoney(a.current, a.currency)}</p>
                  )}
                </div>
                {hasPurchase && (
                  <div className={`text-right text-xs ${isGain ? "text-emerald-600" : "text-red-500"}`}>
                    <p className="font-medium flex items-center gap-1 justify-end">
                      {isGain ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {isGain ? "+" : ""}{a.gainPct.toFixed(1)}%
                    </p>
                    <p>{isGain ? "+" : ""}{formatMoney(a.gain, a.currency)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}