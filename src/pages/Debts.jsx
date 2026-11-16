import { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useDebts, useAssets, useRefresh, useUserCurrencies, useMe } from "@/hooks/useFinance";
import { formatMoney, currencySymbol, formatDate, formatMoneyPlain } from "@/lib/finance";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";
import { Plus, Loader2, HandCoins, TrendingUp, TrendingDown, CalendarClock, Check, UserRound, CalendarDays, NotebookPen, Landmark } from "lucide-react";
import FormSheet, { FieldGroup, FieldRow, fieldInput } from "@/components/FormSheet";
import { ListSkeleton } from "@/components/LoadingSkeleton";
import PageHeader from "@/components/PageHeader";

export default function Debts() {
  const { data: debts = [], isLoading } = useDebts();
  const { data: assets = [] } = useAssets();
  const refresh = useRefresh();
  const userCurrencies = useUserCurrencies();
  const { data: user = null } = useMe();
  const [showForm, setShowForm] = useState(false);
  const [payingDebt, setPayingDebt] = useState(null);
  const [saving, setSaving] = useState(false);

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

  const totalBox = (label, Icon, map) => (
    <div className="min-w-0">
      <p className="text-[11px] opacity-75 flex items-center gap-1"><Icon className="w-3 h-3" /> {label}</p>
      {Object.entries(map).map(([c, v]) => (
        <p key={c} className="font-heading font-bold text-[17px] leading-tight tabular-nums truncate">{formatMoney(v, c)}</p>
      ))}
      {isLoading ? <div className="h-5 w-24 rounded bg-white/15 animate-pulse" /> : Object.keys(map).length === 0 && <p className="font-heading font-bold text-[17px] leading-tight opacity-60">—</p>}
    </div>
  );

  return (
    <div className="px-5 pt-6 pb-6 space-y-5">
      <PageHeader
        title="Utang & piutang"
        subtitle="Catat pinjaman dan pelunasannya"
        back
        actions={<>
          <button onClick={() => setShowForm(true)} aria-label="Catat utang/piutang" className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform">
            <Plus className="w-5 h-5" />
          </button>
        </>}
      />

      <section aria-label="Ringkasan utang piutang" className="card-gradient-primary rounded-[24px] p-5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white/10 border border-white/10 rounded-full px-2.5 py-1 mb-3">
          <HandCoins className="w-3 h-3" /> Belum lunas
        </span>
        <div className="grid grid-cols-2 gap-4">
          {totalBox("Total Utang", TrendingDown, totals.utang)}
          {totalBox("Total Piutang", TrendingUp, totals.piutang)}
        </div>
      </section>

      <section>
        <div className="mb-2.5">
          <h2 className="font-semibold text-[17px] leading-tight">Daftar catatan</h2>
          <p className="text-xs text-muted-foreground">Jatuh tempo terdekat perlu perhatian</p>
        </div>

        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : myDebts.length === 0 ? (
          <EmptyState icon={HandCoins} title="Belum ada utang/piutang" subtitle="Catat utang atau piutang dengan jatuh tempo untuk mengingatkan pelunasan." />
        ) : (
          <div className="space-y-3">
            {myDebts.map((d) => {
              const ds = dueStatus(d);
              const outstanding = (d.amount || 0) - (d.paid_amount || 0);
              const isUtang = d.type === "utang";
              const paidPct = d.amount > 0 ? Math.min(100, ((d.paid_amount || 0) / d.amount) * 100) : 0;
              return (
                <div key={d.id} className="surface rounded-3xl p-4">
                  <div className="flex items-start gap-3">
                    <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isUtang ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                      {isUtang ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isUtang ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}>
                          {isUtang ? "Utang" : "Piutang"}
                        </span>
                        {d.status === "partial" && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning">Sebagian</span>}
                      </div>
                      <p className="font-semibold text-sm truncate">{d.counterparty_name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{formatMoney(d.amount, d.currency)}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full shrink-0 ${STATUS_TONE[ds.color] || STATUS_TONE.slate}`}>
                      <ds.icon className="w-3 h-3" /> {ds.label}
                    </span>
                  </div>
                  {d.paid_amount > 0 && d.status !== "paid" && (
                    <div className="mt-3">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden="true">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${paidPct}%` }} />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">Sisa: {formatMoney(outstanding, d.currency)}</p>
                    </div>
                  )}
                  {d.status !== "paid" && (
                    <button onClick={() => setPayingDebt(d)} className="w-full mt-3 btn-secondary btn-sm">
                      Catat Pelunasan
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {showForm && <DebtForm user={user} userCurrencies={userCurrencies} onClose={() => setShowForm(false)} onSaved={() => { refresh(); setShowForm(false); }} />}
      {payingDebt && <PaymentForm debt={payingDebt} assets={assets} onClose={() => setPayingDebt(null)} onSaved={() => { refresh(); setPayingDebt(null); }} />}
    </div>
  );
}

const STATUS_TONE = {
  green: "bg-success/15 text-success",
  red: "bg-destructive/15 text-destructive",
  amber: "bg-warning/15 text-warning",
  slate: "bg-muted text-muted-foreground",
};

const heroAmountInput = "flex-1 min-w-0 bg-transparent outline-none font-heading text-[32px] leading-none font-extrabold tabular-nums placeholder:text-white/30 text-[hsl(var(--hero-foreground))]";

function HeroCurrency({ currencies, value, onChange }) {
  if (!currencies.length) return null;
  return (
    <div role="radiogroup" aria-label="Mata uang" className="flex gap-1">
      {currencies.map((c) => (
        <button key={c.code} type="button" role="radio" aria-checked={value === c.code} onClick={() => onChange(c.code)}
          className={`h-7 px-2.5 rounded-full text-[11px] font-bold border transition-colors ${value === c.code ? "bg-white text-[hsl(var(--hero-from))] border-white" : "border-white/25 text-white/75"}`}>{c.code}</button>
      ))}
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
    <FormSheet
      title="Catat utang/piutang"
      subtitle="Simpan pinjaman beserta jatuh temponya."
      onClose={onClose}
      footer={
        <button onClick={handleSave} disabled={saving} className="w-full btn-primary">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Simpan
        </button>
      }
    >
      <div role="tablist" aria-label="Jenis catatan" className="flex gap-1 p-1 rounded-2xl bg-muted">
        {["utang", "piutang"].map((t) => (
          <button key={t} type="button" role="tab" aria-selected={type === t} onClick={() => setType(t)}
            className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-colors ${type === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "utang" ? "Utang" : "Piutang"}
          </button>
        ))}
      </div>

      <section className="card-gradient-primary rounded-[24px] p-4">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="debt-amount" className="text-xs opacity-80">Nominal</label>
          <HeroCurrency currencies={userCurrencies} value={currency} onChange={setCurrency} />
        </div>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-lg font-semibold opacity-70">{currencySymbol(currency)}</span>
          <input id="debt-amount" type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={heroAmountInput} />
        </div>
      </section>

      <FieldGroup label="Pihak">
        <FieldRow icon={UserRound} label={type === "utang" ? "Kita berhutang ke" : "Siapa yang berhutang ke kita"} htmlFor="debt-counterparty">
          <input id="debt-counterparty" value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} placeholder="Nama pihak lawan" className={fieldInput} />
        </FieldRow>
      </FieldGroup>

      <FieldGroup label="Waktu">
        <FieldRow icon={CalendarDays} label="Tanggal" htmlFor="debt-date">
          <input id="debt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldInput} />
        </FieldRow>
        <FieldRow icon={CalendarClock} label="Jatuh tempo" htmlFor="debt-due-date">
          <input id="debt-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldInput} />
        </FieldRow>
      </FieldGroup>

      <FieldGroup label="Lainnya">
        <FieldRow icon={NotebookPen} label="Catatan (opsional)" htmlFor="debt-notes">
          <textarea id="debt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Opsional" className={`${fieldInput} resize-none`} />
        </FieldRow>
      </FieldGroup>
    </FormSheet>
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
    <FormSheet
      title="Pelunasan"
      subtitle={`${debt.type === "piutang" ? "Piutang dari" : "Utang ke"} ${debt.counterparty_name}`}
      onClose={onClose}
      footer={
        <button onClick={handleSave} disabled={saving} className="w-full btn-primary">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Catat Pelunasan
        </button>
      }
    >
      <section className="card-gradient-primary rounded-[24px] p-4">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="debt-payment-amount" className="text-xs opacity-80">Nominal pelunasan</label>
          <span className="text-[11px] font-semibold bg-white/10 border border-white/10 rounded-full px-2.5 py-1 tabular-nums">Sisa: {formatMoney(outstanding, debt.currency)}</span>
        </div>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-lg font-semibold opacity-70">{currencySymbol(debt.currency)}</span>
          <input id="debt-payment-amount" type="number" inputMode="numeric" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0" className={heroAmountInput} />
        </div>
        {outstanding > 0 && (
          <button type="button" onClick={() => setPaymentAmount(String(outstanding))} className="mt-3 h-7 px-2.5 rounded-full text-[11px] font-bold bg-gold text-gold-foreground">
            Lunasi penuh ({formatMoney(outstanding, debt.currency)})
          </button>
        )}
      </section>

      <FieldGroup label="Detail pembayaran">
        {bankAssets.length > 0 && (
          <FieldRow icon={Landmark} label="Bayar dari rekening (opsional)" htmlFor="debt-payment-asset">
            <select id="debt-payment-asset" value={linkedAssetId} onChange={(e) => setLinkedAssetId(e.target.value)} className={`${fieldInput} bg-background`}>
              <option value="">Tidak ada — tanpa transaksi</option>
              {bankAssets.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({formatMoneyPlain(a.value, a.currency)})</option>
              ))}
            </select>
          </FieldRow>
        )}
        <FieldRow icon={CalendarDays} label="Tanggal bayar" htmlFor="debt-payment-date">
          <input id="debt-payment-date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={fieldInput} />
        </FieldRow>
      </FieldGroup>
    </FormSheet>
  );
}
