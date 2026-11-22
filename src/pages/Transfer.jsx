import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAssets, useRefresh, useMe, useRateMap } from "@/hooks/useFinance";
import { usePartnership } from "@/hooks/usePartnership";
import { currencySymbol, isMoneyAsset, formatMoneyPlain, convertTo, canConvert } from "@/lib/finance";
import { assetLabel } from "@/lib/bankAccount";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2, Check, Users, Lock, ArrowUpFromLine, ArrowDownToLine, CalendarDays, NotebookPen, Info, HeartHandshake, Coins } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { FieldRow, fieldInput } from "@/components/FormSheet";
import NativeSelect from "@/components/NativeSelect";
import MoneyInput from "@/components/MoneyInput";

// Transfer antar-rekening — juga ke rekening PASANGAN dan antar mata uang.
// Aturan (asal milik sendiri; tujuan milik sendiri/pasangan bukan pribadi;
// beda mata uang wajib nominal diterima) ditegakkan di backend
// (shared/transferRules.js); halaman ini hanya menyaring pilihan yang sah.
const up = (c) => String(c || "IDR").toUpperCase();

export default function Transfer() {
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data: assets = [] } = useAssets();
  const { data: user = null } = useMe();
  const { partners } = usePartnership();
  const partner = partners?.[0] || null;
  const partnerName = String(partner?.full_name || "Pasangan").split(/\s+/)[0];
  const qs = new URLSearchParams(window.location.search);
  const [fromAsset, setFromAsset] = useState(qs.get("from") || "");
  const [toAsset, setToAsset] = useState(qs.get("to") || "");
  const [amount, setAmount] = useState("");
  const [received, setReceived] = useState("");
  const [receivedTouched, setReceivedTouched] = useState(false);
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState("");
  const [visibility, setVisibility] = useState("shared");
  const [saving, setSaving] = useState(false);
  const { map: rateMap } = useRateMap();

  // Rekening asal: bank & tunai milik sendiri (semua mata uang).
  const myAccounts = useMemo(() => assets.filter((a) => isMoneyAsset(a) && a.created_by_id === user?.id), [assets, user?.id]);
  // Rekening tujuan pasangan: bank & tunai bersama milik pasangan aktif.
  const partnerAccounts = useMemo(
    () => (partner ? assets.filter((a) => isMoneyAsset(a) && a.created_by_id === partner.id && a.visibility !== "private") : []),
    [assets, partner],
  );

  const fromObj = myAccounts.find((a) => a.id === fromAsset);
  const toObj = [...myAccounts, ...partnerAccounts].find((a) => a.id === toAsset);
  const fromCur = up(fromObj?.currency);
  const toCur = up(toObj?.currency || fromObj?.currency);
  const cross = !!fromObj && !!toObj && fromCur !== toCur;
  const toPartner = !!toObj && toObj.created_by_id !== user?.id;
  const amountNum = Number(amount) || 0;

  // Nominal diterima (beda mata uang): isi otomatis dari kurs, boleh dikoreksi sesuai kurs bank.
  useEffect(() => {
    if (!cross || receivedTouched) return;
    if (amountNum > 0 && canConvert(fromCur, toCur, rateMap)) {
      const v = convertTo(amountNum, fromCur, toCur, rateMap);
      setReceived(String(toCur === "IDR" ? Math.round(v) : Math.round(v * 100) / 100));
    } else setReceived("");
  }, [cross, amountNum, fromCur, toCur, rateMap, receivedTouched]);

  // Asal berganti → tujuan tak valid lagi bila sama.
  useEffect(() => { if (toAsset && toAsset === fromAsset) setToAsset(""); }, [fromAsset, toAsset]);

  const handleSave = async () => {
    if (!(amountNum > 0)) return toast.error("Masukkan nominal terlebih dahulu");
    if (!fromObj) return toast.error("Pilih rekening asal");
    if (!toObj) return toast.error("Pilih rekening tujuan");
    if (cross && !(Number(received) > 0)) return toast.error(`Isi nominal yang diterima dalam ${toCur}`);

    setSaving(true);
    try {
      const res = await base44.functions.invoke("saveTransfer", {
        from_asset_id: fromObj.id,
        to_asset_id: toObj.id,
        amount: amountNum,
        received_amount: cross ? Number(received) : undefined,
        date: new Date(date).toISOString(),
        notes,
        visibility,
      });
      if (res.data?.error) throw new Error(res.data.message || res.data.error);
      refresh();
      toast.success(toPartner ? `Terkirim ke ${partnerName}` : "Transfer berhasil!", toPartner ? { description: `${partnerName} mendapat notifikasi uang masuk.` } : undefined);
      navigate("/");
    } catch (err) {
      toast.error("Gagal membuat transfer", { description: err?.response?.data?.message || err?.message || "" });
    }
    setSaving(false);
  };

  const destinationOptions = myAccounts.filter((a) => a.id !== fromAsset);
  const disabled = myAccounts.length + partnerAccounts.length < 2 || myAccounts.length < 1;

  return (
    <div className="px-5 pt-6">
      <PageHeader title="Transfer" subtitle="Antar rekening sendiri atau ke pasangan — tidak tercatat sebagai belanja" back />

      <div className="space-y-5">
        {/* Nominal (fokus utama) */}
        <section aria-label="Nominal" className="card-gradient-primary rounded-[28px] p-5">
          <label htmlFor="transfer-amount" className="text-xs opacity-80">Berapa yang dikirim?</label>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xl font-semibold opacity-70">{currencySymbol(fromCur)}</span>
            <MoneyInput currency={fromCur}
              id="transfer-amount"
              value={amount}
              onChange={(v) => setAmount(v)}
              placeholder="0"
              className="flex-1 min-w-0 bg-transparent outline-none font-heading text-[40px] leading-none font-extrabold tracking-tight tabular-nums placeholder:text-white/30 text-[hsl(var(--hero-foreground))]"
            />
          </div>
          <p className="text-xs opacity-70 mt-1 h-4">{fromObj ? `Saldo ${assetLabel(fromObj)}: ${formatMoneyPlain(fromObj.value || 0, fromCur)}` : "Pilih rekening asal di bawah"}</p>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/[0.07] border border-white/10 px-3 py-2 text-xs">
            <span className="truncate flex-1 min-w-0">{fromObj ? assetLabel(fromObj) : "Rekening asal"}</span>
            <ArrowRightLeft className="w-3.5 h-3.5 opacity-70 shrink-0" />
            <span className="truncate flex-1 min-w-0 text-right">{toObj ? `${toPartner ? `${partnerName} · ` : ""}${assetLabel(toObj)}` : "Rekening tujuan"}</span>
          </div>
        </section>

        {disabled ? (
          <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            Perlu minimal 2 rekening (milik Anda, atau rekening bersama pasangan) untuk transfer.
          </div>
        ) : (
          <section aria-label="Detail transfer" className="surface rounded-3xl divide-y divide-border">
            <FieldRow icon={ArrowUpFromLine} label="Dari rekening saya" htmlFor="transfer-from">
              <NativeSelect sheetTitle="Rekening asal" id="transfer-from" value={fromAsset} onChange={(e) => setFromAsset(e.target.value)} className={`${fieldInput} -ml-0.5`}>
                <option value="">Pilih rekening asal</option>
                {myAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{assetLabel(a)} ({formatMoneyPlain(a.value, a.currency)})</option>
                ))}
              </NativeSelect>
            </FieldRow>
            <FieldRow icon={toPartner ? HeartHandshake : ArrowDownToLine} label="Ke rekening" htmlFor="transfer-to"
              hint={toPartner ? `Saldo rekening ${partnerName} bertambah otomatis dan ${partnerName} mendapat notifikasi.` : undefined}>
              <NativeSelect sheetTitle="Rekening tujuan" id="transfer-to" value={toAsset} onChange={(e) => { setToAsset(e.target.value); setReceivedTouched(false); }} className={`${fieldInput} -ml-0.5`}>
                <option value="">Pilih rekening tujuan</option>
                {destinationOptions.length > 0 && (
                  <optgroup label="Rekening saya">
                    {destinationOptions.map((a) => (
                      <option key={a.id} value={a.id}>{assetLabel(a)} ({formatMoneyPlain(a.value, a.currency)})</option>
                    ))}
                  </optgroup>
                )}
                {partnerAccounts.length > 0 && (
                  <optgroup label={`Rekening ${partnerName}`}>
                    {partnerAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{partnerName} · {assetLabel(a)} ({up(a.currency)})</option>
                    ))}
                  </optgroup>
                )}
              </NativeSelect>
            </FieldRow>
            {cross && (
              <FieldRow icon={Coins} label={`Diterima di ${assetLabel(toObj)} (${toCur})`} htmlFor="transfer-received"
                hint={receivedTouched ? "Sesuai kurs bank yang Anda isi." : canConvert(fromCur, toCur, rateMap) ? "Dihitung dari kurs hari ini — ubah bila kurs bank berbeda." : "Kurs belum tersedia — isi sesuai nominal yang benar-benar diterima."}>
                <MoneyInput id="transfer-received" currency={toCur} value={received} onChange={(v) => { setReceived(v); setReceivedTouched(true); }} className={fieldInput} placeholder="0" />
              </FieldRow>
            )}
            <FieldRow icon={CalendarDays} label="Tanggal & jam" htmlFor="transfer-date">
              <input id="transfer-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={fieldInput} />
            </FieldRow>
            {!toPartner && (
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
            )}
            <FieldRow icon={NotebookPen} label="Catatan (opsional)" htmlFor="transfer-notes">
              <textarea id="transfer-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={toPartner ? "Mis. Uang belanja bulan ini" : "Mis. Transfer ke tabungan pendidikan..."} className={`${fieldInput} resize-none`} />
            </FieldRow>
          </section>
        )}

        <div className="flex items-start gap-2 rounded-2xl bg-muted/60 p-3 text-xs text-muted-foreground leading-snug">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Transfer tidak terhitung sebagai pemasukan atau pengeluaran keluarga. Saldo kedua rekening disesuaikan otomatis.
            {partner ? ` Transfer ke ${partnerName} hanya ke rekening bersamanya; rekening pribadinya tidak ditampilkan.` : " Hubungkan pasangan untuk bisa transfer ke rekeningnya."}
          </span>
        </div>
      </div>

      {/* Bottom nav tampil di halaman ini, jadi tombol tidak dibuat menempel. */}
      <div className="mt-5">
        <button onClick={handleSave} disabled={saving || disabled} className="w-full btn-primary">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {saving ? "Memproses..." : toPartner ? `Kirim ke ${partnerName}` : "Transfer Sekarang"}
        </button>
      </div>
    </div>
  );
}
