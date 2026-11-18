import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useRecurringBills, useAssets, useRefresh, useUserCurrencies, useMe, useRateMap } from "@/hooks/useFinance";
import { useCurrencySwitch } from "@/hooks/useCurrencySwitch";
import CurrencySwitchNotice from "@/components/CurrencySwitchNotice";
import { formatMoney, currencySymbol, formatDate, formatMoneyPlain } from "@/lib/finance";
import { assetLabel } from "@/lib/bankAccount";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";
import { Plus, Loader2, RefreshCw, Pause, Play, Check, CalendarClock, Tag, Repeat, CalendarDays, Landmark, NotebookPen } from "lucide-react";
import FormSheet, { FieldGroup, FieldRow, ChipChoice, fieldInput } from "@/components/FormSheet";
import NativeSelect from "@/components/NativeSelect";
import { ListSkeleton } from "@/components/LoadingSkeleton";
import PageHeader from "@/components/PageHeader";
import MoneyInput from "@/components/MoneyInput";

const frequencyLabels = {
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
  yearly: "Tahunan",
};

export default function RecurringBills() {
  const { data: bills = [], isLoading } = useRecurringBills();
  const { data: assets = [] } = useAssets();
  const refresh = useRefresh();
  const userCurrencies = useUserCurrencies();
  const { data: user = null } = useMe();
  const [showForm, setShowForm] = useState(false);
  const [toggling, setToggling] = useState(null);
  const qc = useQueryClient();

  const myBills = bills.filter((b) => b.created_by_id === user?.id);

  const toggleStatus = async (bill) => {
    const newStatus = bill.status === "active" ? "paused" : "active";
    const prev = qc.getQueryData(["recurringBills"]);
    setToggling(bill.id);
    // Optimistis: status berubah seketika, dikembalikan bila gagal.
    qc.setQueryData(["recurringBills"], (old = []) =>
      old.map((b) => (b.id === bill.id ? { ...b, status: newStatus } : b))
    );
    try {
      await base44.entities.RecurringBill.update(bill.id, { status: newStatus });
      refresh();
      toast.success(newStatus === "active" ? "Tagihan dilanjutkan" : "Tagihan dijeda");
    } catch {
      if (prev !== undefined) qc.setQueryData(["recurringBills"], prev);
      toast.error("Gagal mengubah status");
    }
    setToggling(null);
  };

  const activeCount = myBills.filter((b) => b.status === "active").length;

  return (
    <div className="px-5 pt-6 pb-6 space-y-5">
      <PageHeader
        title="Tagihan berulang"
        subtitle="Listrik, internet, sewa, dan langganan rutin"
        back
        actions={<>
          <button onClick={() => setShowForm(true)} aria-label="Tambah tagihan berulang" className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform">
            <Plus className="w-5 h-5" />
          </button>
        </>}
      />

      <section className="card-pastel card-pastel-mint rounded-3xl p-4 flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl bg-white/60 dark:bg-white/10 flex items-center justify-center shrink-0">
          <RefreshCw className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          {!isLoading && myBills.length > 0 && (
            <p className="font-heading font-bold text-[15px] leading-tight mb-0.5">{activeCount} aktif · {myBills.length - activeCount} dijeda</p>
          )}
          <p className="text-xs opacity-80">
            Tagihan berulang membuat transaksi otomatis sesuai frekuensi. Pastikan saldo rekening mencukupi pada tanggal berikutnya.
          </p>
        </div>
      </section>

      <section>
        <div className="mb-2.5">
          <h2 className="font-semibold text-[17px] leading-tight">Daftar tagihan</h2>
          <p className="text-xs text-muted-foreground">Jeda kapan saja tanpa menghapus</p>
        </div>

        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : myBills.length === 0 ? (
          <EmptyState icon={RefreshCw} title="Belum ada tagihan berulang" subtitle="Atur tagihan otomatis seperti listrik, internet, atau sewa untuk dicatat tanpa perlu input manual." />
        ) : (
          <div className="surface rounded-3xl divide-y divide-border">
            {myBills.map((b) => {
              const isActive = b.status === "active";
              const asset = assets.find((a) => a.id === b.linked_asset_id);
              const isOverdue = b.status === "active" && b.next_date && new Date(b.next_date + "T00:00:00.000Z") < new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
              return (
                <div key={b.id} className="flex items-start gap-3 px-4 py-3.5">
                  <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${b.type === "sedekah" ? "bg-sedekah/15 text-sedekah" : "bg-expense/10 text-expense"} ${isActive ? "" : "opacity-60"}`}>
                    <RefreshCw className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{b.category}</p>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${isActive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                        {isActive ? "Aktif" : "Jeda"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">{formatMoney(b.amount, b.currency)} • {frequencyLabels[b.frequency] || b.frequency}</p>
                    {asset && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">Dari: {asset.name}</p>}
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                      <CalendarClock className={`w-3.5 h-3.5 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`} />
                      <span className={isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                        {isOverdue ? "Jatuh tempo — akan diproses" : `Berikutnya: ${formatDate(b.next_date, "dd MMM yyyy")}`}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => toggleStatus(b)} disabled={toggling === b.id} aria-label={isActive ? `Jeda tagihan ${b.category}` : `Lanjutkan tagihan ${b.category}`} className="disabled:opacity-50 btn-icon btn-icon-sm shrink-0">
                    {toggling === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : b.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {showForm && <BillForm user={user} userCurrencies={userCurrencies} assets={assets} onClose={() => setShowForm(false)} onSaved={() => { refresh(); setShowForm(false); }} />}
    </div>
  );
}

function BillForm({ user, userCurrencies, assets, onClose, onSaved }) {
  const [category, setCategory] = useState("");
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(user?.default_currency || "IDR");
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [linkedAssetId, setLinkedAssetId] = useState("");
  const [visibility, setVisibility] = useState("shared");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { map: rateMap } = useRateMap();
  const curGuard = useCurrencySwitch({
    currency, amounts: { amount }, rateMap,
    setCurrency: (c) => { setCurrency(c); setLinkedAssetId(""); },
    setAmounts: (a) => setAmount(a.amount),
  });

  const bankAssets = assets.filter((a) => a.type === "bank" && (a.currency || "IDR") === currency && a.created_by_id === user?.id);

  const handleSave = async () => {
    const amt = Number(amount);
    if (!category.trim()) return toast.error("Masukkan kategori/nama tagihan");
    if (!amt || amt <= 0) return toast.error("Masukkan nominal");
    setSaving(true);
    try {
      await base44.entities.RecurringBill.create({
        category: category.trim(),
        type,
        amount: amt,
        currency,
        frequency,
        start_date: startDate,
        next_date: startDate,
        linked_asset_id: linkedAssetId || undefined,
        visibility,
        status: "active",
        notes,
      });
      toast.success("Tagihan berulang dibuat!");
      onSaved();
    } catch {
      toast.error("Gagal menyimpan");
    }
    setSaving(false);
  };

  return (
    <FormSheet
      title="Tagihan berulang"
      subtitle="Dicatat otomatis sesuai frekuensi yang dipilih."
      onClose={onClose}
      footer={
        <button onClick={handleSave} disabled={saving} className="w-full btn-primary">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Simpan
        </button>
      }
    >
      <div role="tablist" aria-label="Jenis tagihan" className="flex gap-1 p-1 rounded-2xl bg-muted">
        {["expense", "sedekah"].map((t) => (
          <button key={t} type="button" role="tab" aria-selected={type === t} onClick={() => setType(t)}
            className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-colors ${type === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "expense" ? "Pengeluaran" : "Sedekah"}
          </button>
        ))}
      </div>

      <section className="card-gradient-primary rounded-[24px] p-4">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="recurring-amount" className="text-xs opacity-80">Nominal</label>
          {userCurrencies.length > 0 && (
            <div role="radiogroup" aria-label="Mata uang" className="flex gap-1">
              {userCurrencies.map((c) => (
                <button key={c.code} type="button" role="radio" aria-checked={currency === c.code} onClick={() => curGuard.change(c.code)}
                  className={`h-7 px-2.5 rounded-full text-[11px] font-bold border transition-colors ${currency === c.code ? "bg-white text-[hsl(var(--hero-from))] border-white" : "border-white/25 text-white/75"}`}>{c.code}</button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-lg font-semibold opacity-70">{currencySymbol(currency)}</span>
          <MoneyInput currency={currency} id="recurring-amount" value={amount} onChange={(v) => setAmount(v)} placeholder="0"
            className="flex-1 min-w-0 bg-transparent outline-none font-heading text-[32px] leading-none font-extrabold tabular-nums placeholder:text-white/30 text-[hsl(var(--hero-foreground))]" />
        </div>
        <CurrencySwitchNotice guard={curGuard} />
      </section>

      <FieldGroup label="Tagihan">
        <FieldRow icon={Tag} label="Kategori / nama tagihan" htmlFor="recurring-category">
          <input id="recurring-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Mis. Listrik, Internet, Sewa..." className={fieldInput} />
        </FieldRow>
        <FieldRow icon={Repeat} label="Frekuensi">
          <div className="mt-1.5">
            <ChipChoice size="sm" ariaLabel="Frekuensi" value={frequency} onChange={setFrequency}
              options={Object.entries(frequencyLabels).map(([value, label]) => ({ value, label }))} />
          </div>
        </FieldRow>
        <FieldRow icon={CalendarDays} label="Tanggal mulai" htmlFor="recurring-start-date">
          <input id="recurring-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldInput} />
        </FieldRow>
      </FieldGroup>

      <FieldGroup label="Lainnya">
        {bankAssets.length > 0 && (
          <FieldRow icon={Landmark} label="Rekening terkait (opsional)" htmlFor="recurring-linked-asset">
            <NativeSelect sheetTitle="Rekening terkait" id="recurring-linked-asset" value={linkedAssetId} onChange={(e) => setLinkedAssetId(e.target.value)} className={`${fieldInput} bg-background`}>
              <option value="">Tidak ada — saldo tidak diubah</option>
              {bankAssets.map((a) => (
                <option key={a.id} value={a.id}>{assetLabel(a)} ({formatMoneyPlain(a.value, a.currency)})</option>
              ))}
            </NativeSelect>
          </FieldRow>
        )}
        <FieldRow icon={NotebookPen} label="Catatan (opsional)" htmlFor="recurring-notes">
          <textarea id="recurring-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Opsional" className={`${fieldInput} resize-none`} />
        </FieldRow>
      </FieldGroup>
    </FormSheet>
  );
}