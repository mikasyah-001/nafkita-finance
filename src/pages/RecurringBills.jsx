import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useRecurringBills, useAssets, useRefresh, useUserCurrencies } from "@/hooks/useFinance";
import { formatMoney, currencySymbol, formatDate, colorMap, computeRecurringNextDate } from "@/lib/finance";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";
import { Plus, Loader2, X, RefreshCw, Pause, Play, Check, CalendarClock } from "lucide-react";

const frequencyLabels = {
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
  yearly: "Tahunan",
};

export default function RecurringBills() {
  const { data: bills = [] } = useRecurringBills();
  const { data: assets = [] } = useAssets();
  const refresh = useRefresh();
  const userCurrencies = useUserCurrencies();
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [toggling, setToggling] = useState(null);

  useEffect(() => {
    base44.auth.me().then((u) => setUser(u)).catch(() => {});
  }, []);

  const myBills = bills.filter((b) => b.created_by_id === user?.id);

  const toggleStatus = async (bill) => {
    setToggling(bill.id);
    try {
      const newStatus = bill.status === "active" ? "paused" : "active";
      await base44.entities.RecurringBill.update(bill.id, { status: newStatus });
      refresh();
      toast.success(newStatus === "active" ? "Tagihan dilanjutkan" : "Tagihan dijeda");
    } catch {
      toast.error("Gagal mengubah status");
    }
    setToggling(null);
  };

  return (
    <div className="px-5 pt-6 pb-24 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tagihan Berulang</h1>
        <button onClick={() => setShowForm(true)} className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 flex items-start gap-3">
        <RefreshCw className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Tagihan berulang membuat transaksi otomatis sesuai frekuensi. Pastikan saldo rekening mencukupi pada tanggal berikutnya.
        </p>
      </div>

      {myBills.length === 0 ? (
        <EmptyState icon={RefreshCw} title="Belum ada tagihan berulang" subtitle="Atur tagihan otomatis seperti listrik, internet, atau sewa untuk dicatat tanpa perlu input manual." />
      ) : (
        <div className="space-y-3">
          {myBills.map((b) => {
            const cm = colorMap[b.status === "active" ? "green" : "slate"] || colorMap.slate;
            const asset = assets.find((a) => a.id === b.linked_asset_id);
            const isOverdue = b.status === "active" && b.next_date && new Date(b.next_date + "T00:00:00.000Z") < new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
            return (
              <div key={b.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm truncate">{b.category}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cm.bg} ${cm.text}`}>
                        {b.status === "active" ? "Aktif" : "Jeda"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatMoney(b.amount, b.currency)} • {frequencyLabels[b.frequency] || b.frequency}</p>
                    {asset && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">Dari: {asset.name}</p>}
                  </div>
                  <button onClick={() => toggleStatus(b)} disabled={toggling === b.id} className="shrink-0 w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50">
                    {toggling === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : b.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px]">
                  <CalendarClock className={`w-3.5 h-3.5 ${isOverdue ? "text-red-500" : "text-muted-foreground"}`} />
                  <span className={isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}>
                    {isOverdue ? "Jatuh tempo — akan diproses" : `Berikutnya: ${formatDate(b.next_date, "dd MMM yyyy")}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-md bg-background rounded-t-3xl md:rounded-3xl border border-border max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-background">
          <h2 className="font-semibold">Tagihan Berulang</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="flex gap-2 bg-muted p-1 rounded-2xl">
            {["expense", "sedekah"].map((t) => (
              <button key={t} onClick={() => setType(t)} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${type === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
                {t === "expense" ? "Pengeluaran" : "Sedekah"}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Kategori / Nama Tagihan</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Mis. Listrik, Internet, Sewa..." className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Mata Uang</label>
            <div className="flex flex-wrap gap-2">
              {userCurrencies.map((c) => (
                <button key={c.code} onClick={() => { setCurrency(c.code); setLinkedAssetId(""); }} className={`px-4 py-2 rounded-2xl border text-sm font-medium transition-all ${currency === c.code ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>{c.code}</button>
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
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Frekuensi</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(frequencyLabels).map(([val, label]) => (
                <button key={val} onClick={() => setFrequency(val)} className={`py-2.5 rounded-2xl border text-xs font-medium transition-all ${frequency === val ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Tanggal Mulai</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30" />
          </div>
          {bankAssets.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Rekening Terkait (opsional)</label>
              <select value={linkedAssetId} onChange={(e) => setLinkedAssetId(e.target.value)} className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30 bg-background">
                <option value="">Tidak ada — saldo tidak diubah</option>
                {bankAssets.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({formatMoney(a.value, a.currency)})</option>
                ))}
              </select>
            </div>
          )}
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