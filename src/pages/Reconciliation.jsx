import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAssets, useReconciliations, useRefresh, useMe } from "@/hooks/useFinance";
import { formatMoney, formatDate, formatMoneyPlain } from "@/lib/finance";
import { assetLabel } from "@/lib/bankAccount";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";
import { Loader2, Check, Scale, History, AlertCircle, Landmark, ReceiptText, CalendarDays } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { FieldRow, fieldInput } from "@/components/FormSheet";

export default function Reconciliation() {
  const { data: assets = [] } = useAssets();
  const refresh = useRefresh();
  const { data: user = null } = useMe();
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [statementBalance, setStatementBalance] = useState("");
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [reconResult, setReconResult] = useState(null);
  const [computing, setComputing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

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
    <div className="px-5 pt-6 space-y-5">
      <PageHeader title="Rekonsiliasi saldo" subtitle="Cocokkan saldo aplikasi dengan rekening koran" back className="mb-0" />

      {bankAssets.length === 0 ? (
        <div className="surface rounded-3xl px-4">
          <EmptyState icon={Scale} title="Belum ada aset bank" subtitle="Tambahkan aset bertipe Tabungan/Bank untuk melakukan rekonsiliasi." />
        </div>
      ) : (
        <>
          <section aria-label="Saldo aplikasi" className="card-gradient-primary rounded-[28px] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white/10 border border-white/10 rounded-full px-2.5 py-1 max-w-[70%] truncate">
                <Landmark className="w-3 h-3 shrink-0" /> {selectedAsset?.name || "Belum memilih rekening"}
              </span>
              {reconciliations[0] && <span className="text-[11px] opacity-70">Terakhir {formatDate(reconciliations[0].as_of_date, "d MMM")}</span>}
            </div>
            <p className="text-xs opacity-75">Saldo saat ini di aplikasi</p>
            <p className="font-heading text-[34px] leading-[1.1] font-extrabold tracking-tight tabular-nums">{selectedAsset ? formatMoney(selectedAsset.value, selectedAsset.currency) : "—"}</p>
            <p className="text-[11px] opacity-70 mt-2 leading-snug">Dihitung dari mutasi transaksi. Bandingkan dengan saldo di ekstrak rekening/statement.</p>
          </section>

          <section aria-label="Data statement" className="surface rounded-3xl divide-y divide-border">
            <FieldRow icon={Landmark} label="Pilih rekening" htmlFor="recon-asset">
              <select id="recon-asset" value={selectedAssetId} onChange={(e) => { setSelectedAssetId(e.target.value); setReconResult(null); }} className={`${fieldInput} -ml-0.5`}>
                <option value="">Pilih rekening bank</option>
                {bankAssets.map((a) => (
                  <option key={a.id} value={a.id}>{assetLabel(a)} ({formatMoneyPlain(a.value, a.currency)})</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow icon={ReceiptText} label="Saldo per statement" htmlFor="recon-statement-balance">
              <input id="recon-statement-balance" type="number" inputMode="numeric" value={statementBalance} onChange={(e) => setStatementBalance(e.target.value)} placeholder="0" className="w-full bg-transparent outline-none py-1 font-heading text-xl font-extrabold tabular-nums placeholder:text-muted-foreground/60" />
            </FieldRow>
            <FieldRow icon={CalendarDays} label="Per tanggal" htmlFor="recon-as-of-date">
              <input id="recon-as-of-date" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className={fieldInput} />
            </FieldRow>
          </section>

          <button onClick={handleCompute} disabled={computing || !selectedAssetId} className="w-full btn-primary">
            {computing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scale className="w-5 h-5" />} Hitung Rekonsiliasi
          </button>

          {reconResult && (
            <section aria-live="polite" className={`rounded-3xl border p-4 space-y-3 ${isMatch ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10"}`}>
              <div className="flex items-center gap-2">
                {isMatch ? <Check className="w-5 h-5 text-success" /> : <AlertCircle className="w-5 h-5 text-warning" />}
                <h2 className="font-semibold text-[17px] leading-tight">{isMatch ? "Saldo cocok" : "Ada selisih"}</h2>
              </div>
              <div className="rounded-2xl bg-card border border-border divide-y divide-border text-sm">
                <div className="flex justify-between px-3 py-2.5"><span className="text-muted-foreground">Saldo statement</span><span className="font-medium tabular-nums">{formatMoney(reconResult.statement_balance, selectedAsset?.currency)}</span></div>
                <div className="flex justify-between px-3 py-2.5"><span className="text-muted-foreground">Saldo terhitung</span><span className="font-medium tabular-nums">{formatMoney(reconResult.computed_balance, selectedAsset?.currency)}</span></div>
                <div className="flex justify-between px-3 py-2.5"><span className="text-muted-foreground">Selisih</span><span className={`font-bold tabular-nums ${isMatch ? "text-success" : "text-warning"}`}>{formatMoney(diff, selectedAsset?.currency)}</span></div>
              </div>
              {!isMatch && reconResult.status !== "reconciled" && (
                <button onClick={handleAdjust} disabled={adjusting} className="w-full btn-primary btn-sm">
                  {adjusting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Buat Penyesuaian & Tandai Selesai
                </button>
              )}
              {reconResult.status === "reconciled" && (
                <p className="text-xs text-success font-medium flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Rekonsiliasi selesai</p>
              )}
            </section>
          )}

          {reconciliations.length > 0 && (
            <section aria-labelledby="recon-history" className="pb-4">
              <div className="mb-2.5">
                <h2 id="recon-history" className="font-semibold text-[17px] leading-tight flex items-center gap-2"><History className="w-4 h-4 text-muted-foreground" /> Riwayat rekonsiliasi</h2>
                <p className="text-xs text-muted-foreground">{reconciliations.length} catatan untuk rekening ini</p>
              </div>
              <div className="surface rounded-3xl divide-y divide-border">
                {reconciliations.map((r) => {
                  const rMatch = Math.abs(r.difference || 0) <= 0.005;
                  const tone = rMatch ? "bg-success/15 text-success" : r.status === "reconciled" ? "bg-primary/10 text-primary" : "bg-warning/15 text-warning";
                  return (
                    <div key={r.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{formatDate(r.as_of_date, "dd MMM yyyy")}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${tone}`}>
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
            </section>
          )}
        </>
      )}
    </div>
  );
}
