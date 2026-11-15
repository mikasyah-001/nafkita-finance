import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAssets, useTransactions, useCategories, useMe, useRefresh, useReconciliations } from "@/hooks/useFinance";
import { formatMoney, formatMoneyShort, formatDate, isInMonth } from "@/lib/finance";
import PageHeader from "@/components/PageHeader";
import TransactionItem from "@/components/TransactionItem";
import EmptyState from "@/components/EmptyState";
import { ListSkeleton } from "@/components/LoadingSkeleton";
import { confirmAction } from "@/components/ConfirmHost";
import { toast } from "sonner";
import { Wallet, ArrowDownToLine, ReceiptText, Scale, Plus, Loader2, CheckCircle2, Info } from "lucide-react";

// Audit kas tunai: membandingkan uang fisik di dompet dengan catatan.
// Kunci logika: "seharusnya di tangan" = saldo aset dompet tunai, yang hanya
// berubah oleh transaksi yang DIBAYAR DARI dompet itu (linked_asset_id) dan
// transfer ke/dari dompet (tarik/setor tunai). Pengeluaran non-tunai tidak ikut.
export default function AuditKas() {
  const { data: me } = useMe();
  const { data: assets = [], isLoading } = useAssets();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const refresh = useRefresh();

  const wallets = assets.filter((a) => a.type === "tunai" && a.created_by_id === me?.id);
  const [walletId, setWalletId] = useState("");
  useEffect(() => {
    if (!walletId && wallets[0]) setWalletId(wallets[0].id);
  }, [wallets, walletId]);
  const wallet = wallets.find((w) => w.id === walletId);
  const cur = wallet?.currency || "IDR";

  const { data: recons = [] } = useReconciliations(wallet?.id);
  const lastAudit = recons[0];

  const now = new Date();
  const { mutations, cashIn, cashOut } = useMemo(() => {
    const list = transactions
      .filter((t) => wallet && t.linked_asset_id === wallet.id && isInMonth(t, now.getFullYear(), now.getMonth()))
      .filter((t) => !t.approval_status || t.approval_status === "approved");
    const inn = list.filter((t) => t.type === "income").reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const out = list.filter((t) => t.type !== "income").reduce((s, t) => s + (Number(t.amount) || 0), 0);
    return { mutations: list, cashIn: inn, cashOut: out };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, wallet?.id]);

  const [physical, setPhysical] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  useEffect(() => { setPhysical(""); }, [walletId]);

  const expected = Number(wallet?.value) || 0;
  const physicalNum = physical === "" ? null : Number(physical);
  const diff = physicalNum == null || Number.isNaN(physicalNum) ? null : physicalNum - expected;
  const matched = diff != null && Math.abs(diff) < 0.005;

  const createWallet = async (currency) => {
    setCreating(true);
    try {
      const w = await base44.entities.Asset.create({ name: currency === "IDR" ? "Dompet tunai" : `Dompet tunai ${currency}`, type: "tunai", value: 0, currency, visibility: "shared" });
      refresh();
      if (w?.id) setWalletId(w.id);
      toast.success("Dompet tunai dibuat", { description: "Mulai dengan mencatat tarik tunai dari rekening." });
    } catch {
      toast.error("Gagal membuat dompet tunai");
    }
    setCreating(false);
  };

  const applyAdjustment = async () => {
    if (diff == null || matched) return;
    const ok = await confirmAction({
      title: diff < 0 ? `Catat kekurangan ${formatMoney(Math.abs(diff), cur)}?` : `Catat kelebihan ${formatMoney(diff, cur)}?`,
      description: diff < 0
        ? "Selisih dicatat sebagai pengeluaran \"Penyesuaian Rekonsiliasi\" dan saldo dompet disamakan dengan uang fisik. Sebaiknya cek dulu apakah ada belanja tunai yang lupa dicatat."
        : "Selisih dicatat sebagai pemasukan \"Penyesuaian Rekonsiliasi\" dan saldo dompet disamakan dengan uang fisik.",
      confirmText: "Sesuaikan",
      destructive: false,
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke("reconcileAsset", {
        asset_id: wallet.id,
        statement_balance: physicalNum,
        as_of_date: new Date().toISOString().slice(0, 10),
        create_adjustment: true,
        notes: "Audit kas tunai",
      });
      if (res.data?.error) throw new Error(res.data.error);
      refresh();
      setPhysical("");
      toast.success("Saldo dompet disesuaikan");
    } catch (e) {
      toast.error("Gagal menyesuaikan", { description: e?.message || "" });
    }
    setSaving(false);
  };

  const recordMatch = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke("reconcileAsset", { asset_id: wallet.id, statement_balance: physicalNum, as_of_date: new Date().toISOString().slice(0, 10), create_adjustment: false, notes: "Audit kas tunai — cocok" });
      refresh();
      setPhysical("");
      toast.success("Audit dicatat: uang fisik cocok");
    } catch {
      toast.error("Gagal mencatat audit");
    }
    setSaving(false);
  };

  return (
    <div className="px-5 pt-6">
      <PageHeader title="Audit kas" subtitle="Cocokkan uang tunai di dompet dengan catatan" back />

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : wallets.length === 0 ? (
        <div className="surface rounded-3xl p-5">
          <EmptyState icon={Wallet} title="Belum ada dompet tunai" subtitle="Buat dompet tunai untuk mencatat tarik tunai dan belanja pakai uang cash, termasuk riyal saat umrah." />
          <div className="grid grid-cols-2 gap-2 -mt-6">
            <button onClick={() => createWallet(me?.default_currency || "IDR")} disabled={creating} className="btn-primary btn-sm">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Dompet {me?.default_currency || "IDR"}
            </button>
            <button onClick={() => createWallet("SAR")} disabled={creating} className="btn-secondary btn-sm">
              <Plus className="w-4 h-4" /> Dompet SAR
            </button>
          </div>
        </div>
      ) : (
        <>
          {wallets.length > 1 && (
            <div role="radiogroup" aria-label="Pilih dompet" className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
              {wallets.map((w) => (
                <button key={w.id} role="radio" aria-checked={w.id === walletId} onClick={() => setWalletId(w.id)}
                  className={`shrink-0 h-9 px-3.5 rounded-full text-[13px] font-semibold border transition-colors ${w.id === walletId ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground/80"}`}>
                  {w.name}
                </button>
              ))}
            </div>
          )}

          <div className="card-gradient-primary rounded-[28px] p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white/10 border border-white/10 rounded-full px-2.5 py-1">
                <Wallet className="w-3 h-3" /> {wallet?.name}
              </span>
              <span className="text-[11px] opacity-70">{lastAudit ? `Audit terakhir ${formatDate(lastAudit.as_of_date, "d MMM")}` : "Belum pernah diaudit"}</span>
            </div>
            <p className="text-xs opacity-75">Seharusnya di tangan</p>
            <p className="font-heading text-[34px] leading-[1.1] font-extrabold tracking-tight tabular-nums">{formatMoney(expected, cur)}</p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="rounded-2xl bg-white/[0.07] border border-white/10 px-3 py-2">
                <p className="text-[11px] opacity-75">Masuk bulan ini</p>
                <p className="font-semibold text-sm tabular-nums">{formatMoneyShort(cashIn, cur)}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.07] border border-white/10 px-3 py-2">
                <p className="text-[11px] opacity-75">Belanja tunai bulan ini</p>
                <p className="font-semibold text-sm tabular-nums">{formatMoneyShort(cashOut, cur)}</p>
              </div>
            </div>
          </div>

          <section className="surface rounded-3xl p-4 mb-5" aria-labelledby="langkah-audit">
            <h2 id="langkah-audit" className="font-semibold text-[17px] leading-tight">Tiga langkah audit</h2>
            <p className="text-xs text-muted-foreground mb-3">Lakukan rutin, mis. tiap akhir pekan.</p>
            <ol className="space-y-2.5">
              <li>
                <Link to={`/transfer?to=${wallet?.id}`} className="flex items-center gap-3 rounded-2xl border border-border p-3 active:scale-[0.99] transition-transform">
                  <span className="w-8 h-8 rounded-full bg-gold text-gold-foreground text-sm font-bold flex items-center justify-center shrink-0">1</span>
                  <span className="flex-1 min-w-0"><span className="block text-sm font-semibold">Catat tarik tunai</span><span className="block text-xs text-muted-foreground">Transfer dari rekening ke dompet ini.</span></span>
                  <ArrowDownToLine className="w-4 h-4 text-muted-foreground" />
                </Link>
              </li>
              <li>
                <Link to={`/add?asset=${wallet?.id}`} className="flex items-center gap-3 rounded-2xl border border-border p-3 active:scale-[0.99] transition-transform">
                  <span className="w-8 h-8 rounded-full bg-gold text-gold-foreground text-sm font-bold flex items-center justify-center shrink-0">2</span>
                  <span className="flex-1 min-w-0"><span className="block text-sm font-semibold">Catat belanja tunai</span><span className="block text-xs text-muted-foreground">Pilih dompet ini di "Dibayar dari".</span></span>
                  <ReceiptText className="w-4 h-4 text-muted-foreground" />
                </Link>
              </li>
              <li className="rounded-2xl border border-border p-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gold text-gold-foreground text-sm font-bold flex items-center justify-center shrink-0">3</span>
                  <span className="flex-1 min-w-0"><span className="block text-sm font-semibold">Hitung uang fisik</span><span className="block text-xs text-muted-foreground">Masukkan jumlah uang yang benar-benar ada.</span></span>
                  <Scale className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="mt-3 flex items-center rounded-2xl border border-border bg-card px-4 focus-within:ring-2 ring-primary/30">
                  <span className="text-sm text-muted-foreground mr-1">{cur}</span>
                  <input id="audit-physical" aria-label="Jumlah uang fisik" type="number" inputMode="decimal" value={physical} onChange={(e) => setPhysical(e.target.value)} placeholder="0" className="flex-1 py-3 text-lg font-bold outline-none bg-transparent tabular-nums" />
                </div>
                {diff != null && (
                  <div className={`mt-3 rounded-2xl p-3 ${matched ? "bg-success/10" : diff < 0 ? "bg-destructive/10" : "bg-warning/10"}`}>
                    <p className={`text-sm font-semibold flex items-center gap-1.5 ${matched ? "text-success" : diff < 0 ? "text-destructive" : "text-warning"}`}>
                      {matched ? <><CheckCircle2 className="w-4 h-4" /> Cocok, tidak ada selisih</> : diff < 0 ? `Kurang ${formatMoney(Math.abs(diff), cur)}` : `Lebih ${formatMoney(diff, cur)}`}
                    </p>
                    {!matched && <p className="text-xs text-foreground/70 mt-1 leading-snug">{diff < 0 ? "Kemungkinan ada belanja tunai yang belum dicatat. Catat dulu bila ingat, lalu hitung ulang." : "Kemungkinan ada uang masuk tunai yang belum dicatat (mis. kembalian, titipan)."}</p>}
                    <button onClick={matched ? recordMatch : applyAdjustment} disabled={saving} className={`mt-3 w-full ${matched ? "btn-primary" : "btn-secondary"} btn-sm`}>
                      {saving && <Loader2 className="w-4 h-4 animate-spin" />} {matched ? "Catat audit" : "Sesuaikan saldo dengan uang fisik"}
                    </button>
                  </div>
                )}
              </li>
            </ol>
          </section>

          <div className="flex items-start gap-2 rounded-2xl bg-muted/60 p-3 mb-5 text-xs text-muted-foreground leading-snug">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            Hanya transaksi yang dibayar dari dompet ini yang dihitung. Belanja pakai kartu/transfer tidak memengaruhi uang di tangan.
          </div>

          <div className="mb-2.5">
            <h2 className="font-semibold text-[17px] leading-tight">Mutasi kas bulan ini</h2>
            <p className="text-xs text-muted-foreground">{mutations.length} catatan dari dompet ini</p>
          </div>
          <div className="surface px-4 mb-4">
            {mutations.length === 0 ? (
              <EmptyState icon={Wallet} title="Belum ada mutasi kas" subtitle="Mulai dengan mencatat tarik tunai dari rekening." />
            ) : (
              mutations.map((t) => <TransactionItem key={t.id} tx={t} categories={categories} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}
