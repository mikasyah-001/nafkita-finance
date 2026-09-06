import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAssetMutations, useAssets } from "@/hooks/useFinance";
import { History, ArrowUp, ArrowDown, Filter } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/finance";
import EmptyState from "@/components/EmptyState";

const changeTypeLabels = {
  manual_edit: "Edit Manual",
  transaction: "Transaksi",
  reconciliation: "Rekonsiliasi",
  transfer: "Transfer",
  adjustment: "Penyesuaian",
  reconciliation_adjustment: "Penyesuaian Rekonsiliasi",
};

export default function AssetMutations() {
  const [searchParams] = useSearchParams();
  const assetId = searchParams.get("asset_id");
  const { data: assets = [] } = useAssets();
  const { data: mutations = [], isLoading } = useAssetMutations(assetId);
  const [changeType, setChangeType] = useState("");

  const asset = assets.find(a => a.id === assetId);
  const filtered = useMemo(() => {
    if (!changeType) return mutations;
    return mutations.filter(m => m.change_type === changeType);
  }, [mutations, changeType]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-heading">Riwayat Mutasi Aset</h1>
        {asset && <p className="text-sm text-muted-foreground mt-1">{asset.name} • {formatMoney(asset.value || 0, asset.currency)}</p>}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar">
        <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
        <button
          onClick={() => setChangeType("")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${!changeType ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
        >Semua</button>
        {Object.entries(changeTypeLabels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setChangeType(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${changeType === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >{label}</button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Memuat...</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={History} title="Belum ada riwayat mutasi" subtitle="Setiap perubahan nilai aset akan tercatat di sini" />
      ) : (
        <div className="space-y-2">
          {filtered.map(m => {
            const isPositive = (m.delta || 0) >= 0;
            return (
              <div key={m.id} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isPositive ? "bg-emerald-100 dark:bg-emerald-950/40" : "bg-rose-100 dark:bg-rose-950/40"}`}>
                  {isPositive ? <ArrowUp className="w-4 h-4 text-emerald-600" /> : <ArrowDown className="w-4 h-4 text-rose-600" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{changeTypeLabels[m.change_type] || m.change_type}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(m.created_date, "dd MMM, HH:mm")}</span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-sm font-medium">{formatMoney(m.previous_value, m.currency)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-sm font-bold">{formatMoney(m.new_value, m.currency)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-semibold ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                      {isPositive ? "+" : ""}{formatMoney(m.delta, m.currency)}
                    </span>
                    {m.actor_name && <span className="text-xs text-muted-foreground">• {m.actor_name}</span>}
                  </div>
                  {m.source_description && <p className="text-xs text-muted-foreground mt-1 truncate">{m.source_description}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}