import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAssets, useRefresh, useUserCurrencies, useMe, useRateMap } from "@/hooks/useFinance";
import { useCurrencySwitch } from "@/hooks/useCurrencySwitch";
import CurrencySwitchNotice from "@/components/CurrencySwitchNotice";
import { formatMoney, currencySymbol, isMoneyAsset, formatMoneyPlain } from "@/lib/finance";
import { assetLabel } from "@/lib/bankAccount";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2, Check, Users, Lock, ArrowUpFromLine, ArrowDownToLine, CalendarDays, NotebookPen, Info } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { FieldRow, fieldInput } from "@/components/FormSheet";
import NativeSelect from "@/components/NativeSelect";

export default function Transfer() {
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data: assets = [] } = useAssets();
  const userCurrencies = useUserCurrencies();
  const { data: user = null } = useMe();
  const qs = new URLSearchParams(window.location.search);
  const [fromAsset, setFromAsset] = useState(qs.get("from") || "");
  const [toAsset, setToAsset] = useState(qs.get("to") || "");
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
  const { map: rateMap } = useRateMap();
  const curGuard = useCurrencySwitch({
    currency, amounts: { amount }, rateMap,
    setCurrency: (c) => { setCurrency(c); setFromAsset(""); setToAsset(""); },
    setAmounts: (a) => setAmount(a.amount),
  });

  useEffect(() => {
    if (user?.default_currency) setCurrency(user.default_currency);
  }, [user?.default_currency]);

  // Rekening bank & dompet tunai (tarik tunai = transfer bank → dompet tunai).
  const bankAssets = assets.filter(
    (a) => isMoneyAsset(a) && (a.currency || "IDR") === currency && a.created_by_id === user?.id
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

  const fromObj = bankAssets.find((a) => a.id === fromAsset);
  const toObj = bankAssets.find((a) => a.id === toAsset);
  const amountNum = Number(amount) || 0;
  const disabled = bankAssets.length < 2;

  return (
    <div className="px-5 pt-6">
      <div>
        <PageHeader title="Transfer antar-rekening" subtitle="Pindahkan saldo tanpa tercatat sebagai belanja" back />

        <div className="space-y-5">
          {/* Nominal (fokus utama) */}
          <section aria-label="Nominal" className="card-gradient-primary rounded-[28px] p-5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="transfer-amount" className="text-xs opacity-80">Berapa yang dipindahkan?</label>
              {userCurrencies.length > 1 && (
                <div role="radiogroup" aria-label="Mata uang" className="flex gap-1">
                  {userCurrencies.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      role="radio"
                      aria-checked={currency === c.code}
                      onClick={() => curGuard.change(c.code)}
                      className={`h-7 px-2.5 rounded-full text-[11px] font-bold border transition-colors ${currency === c.code ? "bg-white text-[hsl(var(--hero-from))] border-white" : "border-white/25 text-white/75"}`}
                    >
                      {c.code}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-xl font-semibold opacity-70">{currencySymbol(currency)}</span>
              <input
                id="transfer-amount"
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="flex-1 min-w-0 bg-transparent outline-none font-heading text-[40px] leading-none font-extrabold tracking-tight tabular-nums placeholder:text-white/30 text-[hsl(var(--hero-foreground))]"
              />
            </div>
            <p className="text-xs opacity-70 mt-1 tabular-nums h-4">{amountNum > 0 ? formatMoney(amountNum, currency) : ""}</p>
            <CurrencySwitchNotice guard={curGuard} />
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/[0.07] border border-white/10 px-3 py-2 text-xs">
              <span className="truncate flex-1 min-w-0">{fromObj ? assetLabel(fromObj) : "Rekening asal"}</span>
              <ArrowRightLeft className="w-3.5 h-3.5 opacity-70 shrink-0" />
              <span className="truncate flex-1 min-w-0 text-right">{toObj ? assetLabel(toObj) : "Rekening tujuan"}</span>
            </div>
          </section>

          {disabled ? (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
              Anda memerlukan minimal 2 rekening atau dompet tunai bermata uang {currency} untuk transfer.
            </div>
          ) : (
            <section aria-label="Detail transfer" className="surface rounded-3xl divide-y divide-border">
              <FieldRow icon={ArrowUpFromLine} label="Dari rekening" htmlFor="transfer-from">
                <NativeSelect sheetTitle="Rekening asal" id="transfer-from" value={fromAsset} onChange={(e) => setFromAsset(e.target.value)} className={`${fieldInput} -ml-0.5`}>
                  <option value="">Pilih rekening asal</option>
                  {bankAssets.map((a) => (
                    <option key={a.id} value={a.id}>{assetLabel(a)} ({formatMoneyPlain(a.value, a.currency)})</option>
                  ))}
                </NativeSelect>
              </FieldRow>
              <FieldRow icon={ArrowDownToLine} label="Ke rekening" htmlFor="transfer-to">
                <NativeSelect sheetTitle="Rekening tujuan" id="transfer-to" value={toAsset} onChange={(e) => setToAsset(e.target.value)} className={`${fieldInput} -ml-0.5`}>
                  <option value="">Pilih rekening tujuan</option>
                  {bankAssets.filter((a) => a.id !== fromAsset).map((a) => (
                    <option key={a.id} value={a.id}>{assetLabel(a)} ({formatMoneyPlain(a.value, a.currency)})</option>
                  ))}
                </NativeSelect>
              </FieldRow>
              <FieldRow icon={CalendarDays} label="Tanggal & jam" htmlFor="transfer-date">
                <input id="transfer-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={fieldInput} />
              </FieldRow>
              <div className="flex items-center gap-3 px-4 py-3">
                {visibility === "private" ? <Lock className="w-4 h-4 text-muted-foreground shrink-0" /> : <Users className="w-4 h-4 text-muted-foreground shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-muted-foreground">Jangkauan</p>
                  <p className="text-sm">{visibility === "private" ? "Pribadi, hanya Anda yang melihat" : "Bersama keluarga"}</p>
                </div>
                <div role="radiogroup" aria-label="Jangkauan" className="flex gap-1 p-0.5 rounded-full bg-muted shrink-0">
                  {[["shared", "Bersama"], ["private", "Pribadi"]].map(([v, l]) => (
                    <button key={v} type="button" role="radio" aria-checked={visibility === v} onClick={() => setVisibility(v)} className={`h-7 px-3 rounded-full text-xs font-semibold transition-colors ${visibility === v ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>{l}</button>
                  ))}
                </div>
              </div>
              <FieldRow icon={NotebookPen} label="Catatan (opsional)" htmlFor="transfer-notes">
                <textarea id="transfer-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Mis. Transfer ke tabungan pendidikan..." className={`${fieldInput} resize-none`} />
              </FieldRow>
            </section>
          )}

          <div className="flex items-start gap-2 rounded-2xl bg-muted/60 p-3 text-xs text-muted-foreground leading-snug">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            Transfer tidak terhitung sebagai pemasukan atau pengeluaran. Saldo kedua rekening disesuaikan otomatis.
          </div>
        </div>
      </div>

      {/* Bottom nav tampil di halaman ini, jadi tombol tidak dibuat menempel. */}
      <div className="mt-5">
        <button onClick={handleSave} disabled={saving || disabled} className="w-full btn-primary">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {saving ? "Memproses..." : "Transfer Sekarang"}
        </button>
      </div>
    </div>
  );
}