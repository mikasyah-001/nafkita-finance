import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  Loader2, RefreshCw, Users, Receipt, Landmark,
  TrendingUp, TrendingDown, Heart, UserCircle, Activity,
} from "lucide-react";
import { formatMoney } from "@/lib/finance";

export default function AdminStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await base44.functions.invoke("adminStats", {});
      const data = res?.data || res;
      setStats(data);
    } catch (e) {
      toast.error("Gagal memuat statistik", { description: e?.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Refresh tiap 30 detik untuk data real-time
    const interval = setInterval(() => load(true), 30000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  const { users: u, transactions: tx, assets: a, user_breakdown } = stats;

  return (
    <div className="space-y-4">
      {/* Header dengan tombol refresh */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Diperbarui otomatis tiap 30 detik</p>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center disabled:opacity-60"
          title="Segarkan"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Kartu aktivitas user */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" /> Aktivitas Pengguna
        </h3>
        <div className="grid grid-cols-3 gap-2.5">
          <StatCard
            icon={Users}
            color="emerald"
            label="Online Sekarang"
            value={u.active_now}
            pulse
          />
          <StatCard
            icon={Activity}
            color="blue"
            label="Aktif 24 Jam"
            value={u.active_24h}
          />
          <StatCard
            icon={Users}
            color="violet"
            label="Aktif 30 Hari"
            value={u.active_30d}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Total {u.total} pengguna terdaftar
        </p>
      </div>

      {/* Kartu transaksi */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5" /> Transaksi
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          <StatCard
            icon={TrendingUp}
            color="green"
            label="Total Pemasukan"
            value={formatMoney(tx.income, "IDR")}
            compact
          />
          <StatCard
            icon={TrendingDown}
            color="red"
            label="Total Pengeluaran"
            value={formatMoney(tx.expense, "IDR")}
            compact
          />
          <StatCard
            icon={Heart}
            color="teal"
            label="Total Sedekah"
            value={formatMoney(tx.sedekah, "IDR")}
            compact
          />
          <StatCard
            icon={Receipt}
            color="slate"
            label="Jumlah Transaksi"
            value={tx.count}
          />
        </div>
      </div>

      {/* Kartu aset */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Landmark className="w-3.5 h-3.5" /> Aset
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          <StatCard
            icon={Landmark}
            color="amber"
            label="Total Nilai Aset"
            value={formatMoney(a.total_value, "IDR")}
            compact
          />
          <StatCard
            icon={Landmark}
            color="blue"
            label="Jumlah Aset"
            value={a.count}
          />
        </div>
      </div>

      {/* Breakdown per-user */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Aktivitas per Pengguna
        </h3>
        <div className="space-y-2">
          {user_breakdown.map((ub) => (
            <div
              key={ub.id}
              className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <UserCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1">
                  {ub.name}
                  {ub.role === "admin" && (
                    <span className="px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[9px] font-semibold">ADMIN</span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{ub.email}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <span className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-[11px] font-semibold tabular-nums" title="Jumlah transaksi">
                  {ub.tx_count} tx
                </span>
                <span className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 text-[11px] font-semibold tabular-nums" title="Jumlah aset">
                  {ub.asset_count} aset
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const COLOR_MAP = {
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-600 dark:text-emerald-400" },
  blue: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-600 dark:text-blue-400" },
  violet: { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-600 dark:text-violet-400" },
  green: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-600 dark:text-emerald-400" },
  red: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-600 dark:text-red-400" },
  teal: { bg: "bg-teal-50 dark:bg-teal-950/30", text: "text-teal-600 dark:text-teal-400" },
  amber: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-600 dark:text-amber-400" },
  slate: { bg: "bg-slate-100 dark:bg-slate-800/50", text: "text-slate-600 dark:text-slate-400" },
};

function StatCard({ icon: Icon, color, label, value, pulse, compact }) {
  const cm = COLOR_MAP[color] || COLOR_MAP.slate;
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${cm.bg}`}>
          <Icon className={`w-4 h-4 ${cm.text}`} />
        </div>
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
      <p className={`font-semibold tabular-nums truncate ${compact ? "text-sm" : "text-lg"}`}>
        {typeof value === "number" ? value.toLocaleString("id-ID") : value}
      </p>
    </div>
  );
}