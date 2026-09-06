import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAssets, useReconciliations, useRefresh } from "@/hooks/useFinance";
import { formatMoney, formatDate, colorMap } from "@/lib/finance";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";
import { Loader2, Check, Scale, History, AlertCircle } from "lucide-react";

export default function Reconciliation() {
  const { data: assets = [] } = useAssets();
  const refresh = useRefresh();
  const [user, setUser] = useState(null);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [statementBalance, setStatementBalance] = useState("");
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [reconResult, setReconResult] = useState(null);
  const [computing, setComputing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    base44.auth.me().then((u) => setUser(u)).catch(() => {});
  }, []);

  const bankAssets = assets.filter((a) => a.type === "bank" && a.created_by_id === user?.id);
  const selectedAsset = bankAssets.find((a) => a.id === selectedAssetId);
  const { data: reconciliations = [] } = useReconciliations(selectedAssetId);

  const handleCompute = async () => {
    if (!selectedAssetId) return toast.error("Pilih rekening terlebih dahulu");
    const stmt = Number(statementBalance);
    if (isNaN(stmt)) return toast.error("Masukkan saldo statement yang valid");
    setComputing(true);
    setReconResult(null);
    try {
      const res = await base44.functions.invoke("reconcileAsset", {
        asset_id: selectedAssetId,
        statement_balance: stmt,
        as_of_date: asOfDate,
        create_adjustment: false,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setReconResult(res.data);
      refresh();
    } catch (err) {
      toast.error("Gagal menghitung rekonsiliasi", { description: err?.message || "" });
    }
    setComputing(false);
  };

  const handleAdjust = async () => {
    if (!reconResult) return;
    setAdjusting(true);
    try {
      const res = await base44.functions.invoke("reconcileAsset", {
        asset_id: selectedAssetId,
        statement_balance: reconResult.statement_balance,
        as_of_date: reconResult.as_of_date || asOfDate,
        create_adjustment: true,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setReconResult(res.data);
      refresh();
      toast.success("Penyesuaian dibuat, rekonsiliasi selesai!");
    } catch (err) {
      toast.error("Gagal membuat penyesuaian", { description: err?.message || "" });
    }
    setAdjusting(false);
  };

  const diff = reconResult?.difference;
  const isMatch = diff != null && Math.abs(diff) <= 0.005;

  return (
    <div className="px-5 pt-6 pb-24 space-y-5">
      <h1 className="text-xl font-semibold">Rekonsiliasi Saldo</h1>

      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 flex items-start gap-3">
        <Scale className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Bandingkan saldo per ekstrak rekening/statement dengan saldo terhitung dari mutasi transaksi. Buat penyesuaian otomatis bila ada selisih.
        </p>
      </div>

      {bankAssets.length === 0 ? (
        <EmptyState icon={Scale} title="Belum ada aset bank" subtitle="Tambahkan aset bertipe Tabungan/Bank untuk melakukan rekonsiliasi." />
      ) : (
        <>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Pilih Rekening</label>
            <select value={selectedAssetId} onChange={(e) => { setSelectedAssetId(e.target.value); setReconResult(null); }} className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30 bg-background">
              <option value="">Pilih rekening bank</option>
              {bankAssets.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({formatMoney(a.value, a.currency)})</option>
              ))}
            </select>
          </div>

          {selectedAsset && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Saldo saat ini di aplikasi</p>
              <p className="font-semibold text-lg tabular-nums">{formatMoney(selectedAsset.value, selectedAsset.currency)}</p>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Saldo per Statement</label>
            <div className="flex items-center rounded-2xl border border-border px-4 focus-within:ring-2 ring-primary/30">
              <input type="number" inputMode="numeric" value={statementBalance} onChange={(e) => setStatementBalance(e.target.value)} placeholder="0" className="flex-1 py-3 text-xl font-bold outline-none bg-transparent" />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Per Tanggal</label>
            <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30" />
          </div>

          <button onClick={handleCompute} disabled={computing || !selectedAssetId} className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-60">
            {computing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scale className="w-5 h-5" />} Hitung Rekonsiliasi
          </button>

          {reconResult && (
            <div className={`rounded-2xl border p-4 space-y-3 ${isMatch ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" : "border-amber-200 bg-amber-50 dark:bg-amber-950/20"}`}>
              <div className="flex items-center gap-2">
                {isMatch ? <Check className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-amber-600" />}
                <h2 className="font-semibold text-sm">{isMatch ? "Saldo Cocok" : "Ada Selisih"}</h2>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Saldo statement</span><span className="font-medium tabular-nums">{formatMoney(reconResult.statement_balance, selectedAsset?.currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Saldo terhitung</span><span className="font-medium tabular-nums">{formatMoney(reconResult.computed_balance, selectedAsset?.currency)}</span></div>
                <div className="flex justify-between border-t border-border pt-1.5"><span className="text-muted-foreground">Selisih</span><span className={`font-bold tabular-nums ${isMatch ? "text-emerald-600" : "text-amber-600"}`}>{formatMoney(diff, selectedAsset?.currency)}</span></div>
              </div>
              {!isMatch && reconResult.status !== "reconciled" && (
                <button onClick={handleAdjust} disabled={adjusting} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                  {adjusting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Buat Penyesuaian & Tandai Selesai
                </button>
              )}
              {reconResult.status === "reconciled" && (
                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Rekonsiliasi selesai</p>
              )}
            </div>
          )}

          {reconciliations.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-sm flex items-center gap-2"><History className="w-4 h-4 text-muted-foreground" /> Riwayat Rekonsiliasi</h2>
              {reconciliations.map((r) => {
                const rMatch = Math.abs(r.difference || 0) <= 0.005;
                const cm = colorMap[rMatch ? "green" : r.status === "reconciled" ? "blue" : "amber"] || colorMap.slate;
                return (
                  <div key={r.id} className="rounded-2xl border border-border bg-card p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{formatDate(r.as_of_date, "dd MMM yyyy")}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cm.bg} ${cm.text}`}>
                        {r.status === "reconciled" ? "Selesai" : "Terbuka"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Selisih: {formatMoney(r.difference, r.currency)}</span>
                      <span className="font-medium tabular-nums">{formatMoney(r.statement_balance, r.currency)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}