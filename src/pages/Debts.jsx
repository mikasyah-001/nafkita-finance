import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useDebts, useAssets, useRefresh, useUserCurrencies } from "@/hooks/useFinance";
import { formatMoney, currencySymbol, formatDate, colorMap } from "@/lib/finance";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";
import { ArrowLeft, Plus, Loader2, X, HandCoins, TrendingUp, TrendingDown, CalendarClock, Check } from "lucide-react";

export default function Debts() {
  const { data: debts = [] } = useDebts();
  const { data: assets = [] } = useAssets();
  const refresh = useRefresh();
  const userCurrencies = useUserCurrencies();
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [payingDebt, setPayingDebt] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.auth.me().then((u) => setUser(u)).catch(() => {});
  }, []);

  const myDebts = debts.filter((d) => d.created_by_id === user?.id);

  const totals = useMemo(() => {
    const utang = myDebts.filter((d) => d.type === "utang" && d.status !== "paid");
    const piutang = myDebts.filter((d) => d.type === "piutang" && d.status !== "paid");
    const byCur = (list) => {
      const m = {};
      list.forEach((d) => {
        const c = d.currency || "IDR";
        const outstanding = (d.amount || 0) - (d.paid_amount || 0);
        m[c] = (m[c] || 0) + outstanding;
      });
      return m;
    };
    return { utang: byCur(utang), piutang: byCur(piutang) };
  }, [myDebts]);

  const dueStatus = (d) => {
    if (d.status === "paid") return { label: "Lunas", color: "green", icon: Check };
    if (!d.due_date) return { label: "Tanpa jatuh tempo", color: "slate", icon: CalendarClock };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(d.due_date + "T00:00:00.000Z");
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: `Terlewat ${Math.abs(diff)} hari`, color: "red", icon: CalendarClock };
    if (diff <= 3) return { label: diff === 0 ? "Hari ini" : `${diff} hari lagi`, color: "amber", icon: CalendarClock };
    return { label: formatDate(d.due_date, "dd MMM yyyy"), color: "green", icon: CalendarClock };
  };

  return (
    <div className="px-5 pt-6 pb-24 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Utang & Piutang</h1>
        <button onClick={() => setShowForm(true)} className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center mb-2">
            <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-xs text-muted-foreground">Total Utang</p>
          {Object.entries(totals.utang).map(([c, v]) => (
            <p key={c} className="font-semibold text-sm mt-0.5 tabular-nums">{formatMoney(v, c)}</p>
          ))}
          {Object.keys(totals.utang).length === 0 && <p className="font-semibold text-sm mt-0.5 text-muted-foreground">{formatMoney(0)}</p>}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-xs text-muted-foreground">Total Piutang</p>
          {Object.entries(totals.piutang).map(([c, v]) => (
            <p key={c} className="font-semibold text-sm mt-0.5 tabular-nums">{formatMoney(v, c)}</p>
          ))}
          {Object.keys(totals.piutang).length === 0 && <p className="font-semibold text-sm mt-0.5 text-muted-foreground">{formatMoney(0)}</p>}
        </div>
      </div>

      {myDebts.length === 0 ? (
        <EmptyState icon={HandCoins} title="Belum ada utang/piutang" subtitle="Catat utang atau piutang dengan jatuh tempo untuk mengingatkan pelunasan." />
      ) : (
        <div className="space-y-3">
          {myDebts.map((d) => {
            const ds = dueStatus(d);
            const cm = colorMap[ds.color] || colorMap.slate;
            const outstanding = (d.amount || 0) - (d.paid_amount || 0);
            return (
              <div key={d.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${d.type === "utang" ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"}`}>
                        {d.type === "utang" ? "Utang" : "Piutang"}
                      </span>
                      {d.status === "partial" && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Sebagian</span>}
                    </div>
                    <p className="font-medium text-sm truncate">{d.counterparty_name}</p>
                    <p className="text-xs text-muted-foreground">{formatMoney(d.amount, d.currency)}</p>
                    {d.paid_amount > 0 && d.status !== "paid" && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">Sisa: {formatMoney(outstanding, d.currency)}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full ${cm.bg} ${cm.text}`}>
                      <ds.icon className="w-3 h-3" /> {ds.label}
                    </span>
                  </div>
                </div>
                {d.status !== "paid" && (
                  <button onClick={() => setPayingDebt(d)} className="w-full mt-3 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors">
                    Catat Pelunasan
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && <DebtForm user={user} userCurrencies={userCurrencies} onClose={() => setShowForm(false)} onSaved={() => { refresh(); setShowForm(false); }} />}
      {payingDebt && <PaymentForm debt={payingDebt} assets={assets} onClose={() => setPayingDebt(null)} onSaved={() => { refresh(); setPayingDebt(null); }} />}
    </div>
  );
}

function DebtForm({ user, userCurrencies, onClose, onSaved }) {
  const [type, setType] = useState("utang");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(user?.default_currency || "IDR");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [visibility, setVisibility] = useState("shared");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const amt = Number(amount);
    if (!counterpartyName.trim()) return toast.error("Masukkan nama pihak lawan");
    if (!amt || amt <= 0) return toast.error("Masukkan nominal");
    setSaving(true);
    try {
      await base44.entities.Debt.create({
        counterparty_name: counterpartyName.trim(),
        type,
        amount: amt,
        currency,
        date,
        due_date: dueDate || undefined,
        status: "unpaid",
        paid_amount: 0,
        notes,
        visibility,
      });
      toast.success("Utang/piutang tercatat!");
      onSaved();
    } catch (err) {
      toast.error("Gagal menyimpan");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-md bg-background rounded-t-3xl md:rounded-3xl border border-border max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-background">
          <h2 className="font-semibold">Catat Utang/Piutang</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="flex gap-2 bg-muted p-1 rounded-2xl">
            {["utang", "piutang"].map((t) => (
              <button key={t} onClick={() => setType(t)} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${type === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
                {t === "utang" ? "Utang" : "Piutang"}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">{type === "utang" ? "Kita berhutang ke" : "Siapa yang berhutang ke kita"}</label>
            <input value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} placeholder="Nama pihak lawan" className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Mata Uang</label>
            <div className="flex flex-wrap gap-2">
              {userCurrencies.map((c) => (
                <button key={c.code} onClick={() => setCurrency(c.code)} className={`px-4 py-2 rounded-2xl border text-sm font-medium transition-all ${currency === c.code ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>{c.code}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Nominal</label>
            <div className="flex items-center rounded-2xl border border-border px-4 focus-within:ring-2 ring-primary/30">
              <span className="text-lg text-muted-foreground mr-1">{currencySymbol(currency)}</span>
              <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="flex-1 py-3 text-2xl font-bold outline-none bg-transparent" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Tanggal</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Jatuh Tempo</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Catatan (opsional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30 resize-none" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border sticky bottom-0 bg-background">
          <button onClick={handleSave} disabled={saving} className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentForm({ debt, assets, onClose, onSaved }) {
  const [paymentAmount, setPaymentAmount] = useState("");
  const [linkedAssetId, setLinkedAssetId] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const outstanding = (debt.amount || 0) - (debt.paid_amount || 0);
  const bankAssets = assets.filter((a) => a.type === "bank" && (a.currency || "IDR") === (debt.currency || "IDR"));

  const handleSave = async () => {
    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) return toast.error("Masukkan nominal pelunasan");
    if (amt > outstanding) return toast.error("Nominal melebihi sisa");
    setSaving(true);
    try {
      const res = await base44.functions.invoke("createDebtPayment", {
        debt_id: debt.id,
        payment_amount: amt,
        linked_asset_id: linkedAssetId || undefined,
        payment_date: paymentDate,
      });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success("Pelunasan tercatat!");
      onSaved();
    } catch (err) {
      toast.error("Gagal mencatat pelunasan", { description: err?.message || "" });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-md bg-background rounded-t-3xl md:rounded-3xl border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Pelunasan</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="rounded-2xl bg-muted p-3 text-sm">
            <p className="text-muted-foreground text-xs">{debt.counterparty_name}</p>
            <p className="font-medium">Sisa: {formatMoney(outstanding, debt.currency)}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Nominal Pelunasan</label>
            <div className="flex items-center rounded-2xl border border-border px-4 focus-within:ring-2 ring-primary/30">
              <span className="text-lg text-muted-foreground mr-1">{currencySymbol(debt.currency)}</span>
              <input type="number" inputMode="numeric" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0" className="flex-1 py-3 text-2xl font-bold outline-none bg-transparent" />
            </div>
            {outstanding > 0 && (
              <button onClick={() => setPaymentAmount(String(outstanding))} className="mt-1.5 text-[11px] text-primary font-medium">Lunasi penuh ({formatMoney(outstanding, debt.currency)})</button>
            )}
          </div>
          {bankAssets.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Bayar dari Rekening (opsional)</label>
              <select value={linkedAssetId} onChange={(e) => setLinkedAssetId(e.target.value)} className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30 bg-background">
                <option value="">Tidak ada — tanpa transaksi</option>
                {bankAssets.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({formatMoney(a.value, a.currency)})</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Tanggal Bayar</label>
            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border">
          <button onClick={handleSave} disabled={saving} className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Catat Pelunasan
          </button>
        </div>
      </div>
    </div>
  );
}