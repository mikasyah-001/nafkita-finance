import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAssets, useRefresh, useUserCurrencies, useMe } from "@/hooks/useFinance";
import { formatMoney, currencySymbol } from "@/lib/finance";
import { toast } from "sonner";
import { ArrowLeft, ArrowRightLeft, Loader2, Check, Users, Lock } from "lucide-react";

export default function Transfer() {
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data: assets = [] } = useAssets();
  const userCurrencies = useUserCurrencies();
  const [user, setUser] = useState(null);
  const [fromAsset, setFromAsset] = useState("");
  const [toAsset, setToAsset] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState("");
  const [visibility, setVisibility] = useState("shared");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      if (u?.default_currency) setCurrency(u.default_currency);
    }).catch(() => {});
  }, []);

  const bankAssets = assets.filter(
    (a) => a.type === "bank" && (a.currency || "IDR") === currency && a.created_by_id === user?.id
  );

  const handleSave = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Masukkan nominal terlebih dahulu");
    if (!fromAsset) return toast.error("Pilih rekening asal");
    if (!toAsset) return toast.error("Pilih rekening tujuan");
    if (fromAsset === toAsset) return toast.error("Rekening asal dan tujuan tidak boleh sama");

    setSaving(true);
    try {
      const res = await base44.functions.invoke("saveTransfer", {
        from_asset_id: fromAsset,
        to_asset_id: toAsset,
        amount: amt,
        currency,
        date: new Date(date).toISOString(),
        notes,
        visibility,
      });
      if (res.data?.error) throw new Error(res.data.error);
      refresh();
      toast.success("Transfer berhasil!");
      navigate("/");
    } catch (err) {
      toast.error("Gagal membuat transfer", { description: err?.message || "" });
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-5 py-4 border-b border-border">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold">Transfer Antar-Rekening</h1>
        <div className="w-9" />
      </header>

      <div className="flex-1 px-5 py-5 space-y-5 overflow-y-auto">
        <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 flex items-start gap-3">
          <ArrowRightLeft className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Transfer tidak terhitung sebagai pemasukan atau pengeluaran. Saldo kedua rekening disesuaikan otomatis.
          </p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Jangkauan</label>
          <div className="flex gap-2">
            <button onClick={() => setVisibility("shared")} className={`flex-1 py-2.5 rounded-2xl border flex items-center justify-center gap-1.5 text-sm font-medium transition-all ${visibility === "shared" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>
              <Users className="w-4 h-4" /> Bersama
            </button>
            <button onClick={() => setVisibility("private")} className={`flex-1 py-2.5 rounded-2xl border flex items-center justify-center gap-1.5 text-sm font-medium transition-all ${visibility === "private" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>
              <Lock className="w-4 h-4" /> Pribadi
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Mata Uang</label>
          <div className="flex flex-wrap gap-2">
            {userCurrencies.map((c) => (
              <button key={c.code} onClick={() => { setCurrency(c.code); setFromAsset(""); setToAsset(""); }} className={`px-4 py-2 rounded-2xl border text-sm font-medium transition-all ${currency === c.code ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>
                {c.code}
              </button>
            ))}
          </div>
        </div>

        {bankAssets.length < 2 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-700 dark:text-amber-400">
            Anda memerlukan minimal 2 aset bank dengan mata uang {currency} untuk melakukan transfer.
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Dari Rekening</label>
              <select value={fromAsset} onChange={(e) => setFromAsset(e.target.value)} className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30 bg-background">
                <option value="">Pilih rekening asal</option>
                {bankAssets.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({formatMoney(a.value, a.currency)})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Ke Rekening</label>
              <select value={toAsset} onChange={(e) => setToAsset(e.target.value)} className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30 bg-background">
                <option value="">Pilih rekening tujuan</option>
                {bankAssets.filter((a) => a.id !== fromAsset).map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({formatMoney(a.value, a.currency)})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Nominal</label>
              <div className="flex items-center rounded-2xl border border-border px-4 focus-within:ring-2 ring-primary/30">
                <span className="text-lg text-muted-foreground mr-1">{currencySymbol(currency)}</span>
                <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="flex-1 py-3 text-2xl font-bold outline-none bg-transparent" />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Tanggal & Jam</label>
              <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Catatan (opsional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Mis. Transfer ke tabungan pendidikan..." className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30 resize-none" />
            </div>
          </>
        )}
      </div>

      <div className="px-5 py-4 border-t border-border bg-background">
        <button onClick={handleSave} disabled={saving || bankAssets.length < 2} className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-60">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {saving ? "Memproses..." : "Transfer Sekarang"}
        </button>
      </div>
    </div>
  );
}