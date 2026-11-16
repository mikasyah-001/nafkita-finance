import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAssets, useRefresh, useUserCurrencies } from "@/hooks/useFinance";
import { useZakat } from "@/hooks/useZakat";
import GoldPriceCard from "@/components/GoldPriceCard";
import { formatMoney, formatMoneyShort, formatNumber, formatDate, isMoneyAsset, assetTypeLabels, formatMoneyPlain, convertTo, canConvert, currencySymbol } from "@/lib/finance";
import { assetLabel } from "@/lib/bankAccount";
import { ZAKAT_GROUP_LABEL, NISAB_GOLD_GRAM, formatHijri, HAUL_DAYS } from "@/lib/zakat";
import { saveTransactionWithAsset } from "@/lib/linkedAsset";
import PageHeader from "@/components/PageHeader";
import ZakatMethodNotice from "@/components/ZakatMethodNotice";
import FormSheet, { FieldGroup, FieldRow, fieldInput } from "@/components/FormSheet";
import { ListSkeleton } from "@/components/LoadingSkeleton";
import { toast } from "sonner";
import { Coins, Wallet, CheckCircle2, Loader2, Mail, CalendarClock, HandCoins, TrendingUp, MinusCircle, Ban, Info, Check, Building2, CalendarDays, NotebookPen } from "lucide-react";

// Halaman Zakat mal. Semua angka dari useZakat() → lib/zakat.js (sumber tunggal).
export default function Zakat() {
  const z = useZakat();
  const refresh = useRefresh();
  const [payOpen, setPayOpen] = useState(false);
  const [haulDraft, setHaulDraft] = useState(null);
  const [savingPref, setSavingPref] = useState(false);
  const [sending, setSending] = useState(false);
  const cur = z.currency;

  const savePrefs = async (patch, okMsg) => {
    setSavingPref(true);
    try {
      await base44.auth.updateMe(patch);
      refresh();
      toast.success(okMsg);
    } catch {
      toast.error("Gagal menyimpan");
    }
    setSavingPref(false);
  };



  const status = z.needsGoldPrice ? "price" : z.isPaidOff ? "paid" : z.reachesNisab ? "due" : "below";
  const statusMeta = {
    price: { label: "Butuh harga emas", tone: "bg-gold text-gold-foreground" },
    paid: { label: "Sudah ditunaikan", tone: "bg-white text-[hsl(var(--hero-from))]" },
    due: { label: "Wajib zakat", tone: "bg-gold text-gold-foreground" },
    below: { label: "Belum mencapai nisab", tone: "bg-white/15 text-white" },
  }[status];

  const handleEmailReminder = async () => {
    if (!z.me?.email) return toast.error("Email tidak ditemukan");
    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: z.me.email,
        subject: "Pengingat zakat mal — NAFKITA",
        body: `Assalamu'alaikum ${z.me.full_name || ""},\n\nRingkasan zakat mal (perkiraan):\n- Harta bersih: ${formatMoney(z.net, cur)}\n- Nisab (${NISAB_GOLD_GRAM} gr emas @ ${formatMoney(z.goldPrice, cur)}): ${formatMoney(z.nisab, cur)}\n- Zakat 2,5%: ${formatMoney(z.zakat, cur)}\n- Sudah dibayar periode ini: ${formatMoney(z.paidTotal, cur)}\n- Sisa: ${formatMoney(z.remaining, cur)}\n${z.period.due ? `- Jatuh tempo haul: ${formatDate(z.period.due, "d MMMM yyyy")} (${formatHijri(z.period.due)})\n` : ""}\nAngka ini perkiraan, bukan fatwa. Konsultasikan dengan amil/BAZNAS setempat.\n\nNAFKITA`,
      });
      toast.success("Pengingat zakat dikirim", { description: `Ke ${z.me.email}` });
    } catch {
      toast.error("Gagal mengirim pengingat");
    }
    setSending(false);
  };

  const rows = [
    { key: "kas", icon: Wallet, value: z.groups.kas },
    { key: "emas", icon: Coins, value: z.groups.emas, sub: z.goldGrams ? `${formatNumber(z.goldGrams)} gram sudah genap haul` : z.goldGramsPending ? "Belum ada emas yang genap haul" : null },
    { key: "investasi", icon: TrendingUp, value: z.groups.investasi },
    { key: "piutang", icon: HandCoins, value: z.groups.piutang, toggle: true },
    { key: "utang", icon: MinusCircle, value: -z.groups.utang },
  ];
  const nisabPct = z.nisab > 0 ? Math.min(100, (z.net / z.nisab) * 100) : 0;

  return (
    <div className="px-5 pt-6">
      <PageHeader title="Zakat mal" subtitle="Perkiraan dari aset, utang & piutang tercatat" back />

      {z.loading ? <ListSkeleton rows={3} /> : (
        <>
          {/* Ringkasan */}
          <section aria-label="Ringkasan zakat" className="card-gradient-primary rounded-[28px] p-5 mb-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 ${statusMeta.tone}`}>
                {status === "paid" ? <CheckCircle2 className="w-3 h-3" /> : <Coins className="w-3 h-3" />} {statusMeta.label}
              </span>
              <span className="text-[11px] opacity-75">{z.period.label}</span>
            </div>
            <p className="text-xs opacity-75">{status === "paid" ? "Zakat periode ini" : "Zakat yang perlu ditunaikan"}</p>
            <p className="font-heading text-[34px] leading-[1.1] font-extrabold tracking-tight tabular-nums">{formatMoney(status === "paid" ? z.zakat : z.remaining, cur)}</p>
            <p className="text-[11px] opacity-75 mt-1">
              {status === "price" ? "Isi harga emas di bawah untuk menghitung nisab." :
                status === "below" ? `Kurang ${formatMoneyShort(z.nisabGap, cur)} lagi untuk mencapai nisab.` :
                `2,5% × harta bersih ${formatMoney(z.net, cur)}${z.paidTotal > 0 ? ` · sudah dibayar ${formatMoneyShort(z.paidTotal, cur)}` : ""}`}
            </p>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[["Harta bersih", z.net], ["Nisab", z.nisab], ["Sudah dibayar", z.paidTotal]].map(([l, v]) => (
                <div key={l} className="rounded-2xl bg-white/[0.07] border border-white/10 px-2.5 py-2 min-w-0">
                  <p className="text-[11px] opacity-75">{l}</p>
                  <p className="font-semibold text-sm tabular-nums truncate">{v || l !== "Nisab" ? formatMoneyShort(v, cur) : "—"}</p>
                </div>
              ))}
            </div>
            {z.nisab > 0 && (
              <div className="mt-3">
                <div className="h-1.5 rounded-full bg-white/15 overflow-hidden"><div className="h-full rounded-full bg-gold" style={{ width: `${nisabPct}%` }} /></div>
                <p className="text-[11px] opacity-70 mt-1">{Math.round(nisabPct)}% dari nisab ({NISAB_GOLD_GRAM} gr emas)</p>
              </div>
            )}
          </section>

          {z.reachesNisab && z.remaining > 0 && (
            <button onClick={() => setPayOpen(true)} className="w-full btn-gold mb-5">
              <Check className="w-5 h-5" /> Catat pembayaran zakat
            </button>
          )}

          <ZakatMethodNotice />

          {/* Rincian */}
          <section className="surface rounded-3xl mb-5" aria-labelledby="rincian-zakat">
            <div className="px-4 pt-4 pb-2">
              <h2 id="rincian-zakat" className="font-semibold text-[17px] leading-tight">Harta yang dihitung</h2>
              <p className="text-xs text-muted-foreground">Digabung dalam {cur} untuk dibandingkan dengan nisab</p>
            </div>
            <div className="divide-y divide-border">
              {rows.map(({ key, icon: Icon, value, sub, toggle }) => (
                <div key={key} className="flex items-center gap-3 px-4 py-3">
                  <Icon className={`w-4 h-4 shrink-0 ${key === "utang" ? "text-expense" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{ZAKAT_GROUP_LABEL[key]}</p>
                    {sub && <p className="text-[11px] text-muted-foreground">{sub}{z.goldPrice ? ` × ${formatMoneyShort(z.goldPrice, cur)}/gr` : ""}</p>}
                    {key === "utang" && <p className="text-[11px] text-muted-foreground">Jatuh tempo ≤ 12 bulan, dikurangkan</p>}
                  </div>
                  {toggle && (
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground mr-1 cursor-pointer">
                      <input type="checkbox" checked={z.includeReceivables} disabled={savingPref}
                        onChange={(e) => savePrefs({ zakat_include_receivables: e.target.checked }, e.target.checked ? "Piutang lancar dihitung" : "Piutang tidak dihitung")}
                        className="w-4 h-4 accent-[hsl(var(--primary))]" aria-label="Hitung piutang lancar" />
                      Hitung
                    </label>
                  )}
                  {key === "emas" && z.needsGoldPrice && z.goldGrams > 0
                    ? <p className="text-xs font-semibold text-warning">Butuh harga emas</p>
                    : <p className={`text-sm font-semibold tabular-nums ${value < 0 ? "text-expense" : ""}`}>{value < 0 ? "−" : ""}{formatMoney(Math.abs(value), cur)}</p>}
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/40 rounded-b-3xl">
                <p className="text-sm font-semibold">Harta bersih</p>
                <p className="text-sm font-bold tabular-nums">{formatMoney(z.net, cur)}</p>
              </div>
            </div>
          </section>

          {z.goldPending.length > 0 && (
            <section className="surface rounded-3xl mb-5" aria-labelledby="emas-belum-haul">
              <div className="px-4 pt-4 pb-2">
                <h2 id="emas-belum-haul" className="font-semibold text-[15px] flex items-center gap-2"><CalendarClock className="w-4 h-4 text-muted-foreground" /> Emas belum genap haul</h2>
                <p className="text-xs text-muted-foreground">Dihitung dari tanggal beli di data aset; belum masuk zakat periode ini.</p>
              </div>
              <div className="divide-y divide-border">
                {z.goldPending.map((g) => (
                  <div key={g.id} className="flex items-center gap-3 px-4 py-3">
                    <Coins className="w-4 h-4 text-gold shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{g.name} · {formatNumber(g.grams)} gr</p>
                      <p className="text-[11px] text-muted-foreground">
                        {g.dateSource === "purchase" ? "Dibeli" : "Dicatat"} {formatDate(g.acquired, "d MMM yyyy")} · haul {formatDate(g.due, "d MMM yyyy")} ({formatHijri(g.due)})
                      </p>
                    </div>
                    <span className="text-xs font-semibold rounded-full bg-gold/20 px-2.5 py-1 shrink-0">{g.daysLeft} hari lagi</span>
                  </div>
                ))}
              </div>
              {z.goldPending.some((g) => g.dateSource === "recorded") && (
                <p className="text-[11px] text-muted-foreground px-4 pb-3">Sebagian memakai tanggal aset dicatat karena tanggal beli kosong. Isi tanggal beli di menu Aset agar haul lebih tepat.</p>
              )}
            </section>
          )}

          {(z.excluded.length > 0 || z.unconverted.length > 0) && (
            <section className="surface rounded-3xl p-4 mb-5" aria-labelledby="tidak-dihitung">
              <h2 id="tidak-dihitung" className="font-semibold text-[15px] flex items-center gap-2"><Ban className="w-4 h-4 text-muted-foreground" /> Tidak dihitung</h2>
              <p className="text-xs text-muted-foreground mb-2.5">Rumah tinggal, tanah, kendaraan & barang pakai bukan objek zakat mal, kecuali dimiliki untuk diperjualbelikan.</p>
              <div className="flex flex-wrap gap-1.5">
                {z.excluded.map((a) => (
                  <span key={a.id} className="text-xs rounded-full bg-muted px-2.5 py-1">{a.name} · {assetTypeLabels[a.type]?.label || a.type}</span>
                ))}
              </div>
              {z.unconverted.length > 0 && <p className="text-xs text-warning mt-2">Aset dalam {z.unconverted.join(", ")} belum dihitung karena kursnya belum tersedia.</p>}
            </section>
          )}

          {/* Harga emas: kartu bersama, berlaku untuk seluruh aplikasi */}
          <GoldPriceCard title="Harga emas untuk nisab" grams={z.goldGrams + z.goldGramsPending} />

          {/* Haul */}
          <section className="surface rounded-3xl p-4 mb-5" aria-labelledby="haul">
            <h2 id="haul" className="font-semibold text-[17px] leading-tight flex items-center gap-2"><CalendarClock className="w-4 h-4" /> Haul</h2>
            <p className="text-xs text-muted-foreground mb-3">Zakat mal wajib setelah harta mencapai nisab selama 1 tahun hijriah (±{HAUL_DAYS} hari).</p>
            {z.period.due ? (
              <div className={`rounded-2xl p-3 mb-3 ${z.period.isDue ? "card-pastel card-pastel-butter" : "card-pastel card-pastel-mint"}`}>
                <p className="text-sm font-semibold">Jatuh tempo {formatDate(z.period.due, "d MMMM yyyy")}</p>
                <p className="text-xs opacity-80">{formatHijri(z.period.due)} · {z.period.daysLeft > 0 ? `${z.period.daysLeft} hari lagi` : "sudah jatuh tempo"}</p>
              </div>
            ) : (
              <p className="text-xs rounded-2xl bg-muted/60 p-3 mb-3">Tanggal haul belum diatur. Pembayaran dicatat per tahun hijriah berjalan ({z.period.hijriYear} H).</p>
            )}
            <label htmlFor="zakat-haul-date" className="block text-xs text-muted-foreground mb-1.5">Harta mencapai nisab sejak</label>
            <div className="flex gap-2 items-center">
              <input id="zakat-haul-date" type="date" value={haulDraft ?? z.me?.zakat_haul_date ?? ""} onChange={(e) => setHaulDraft(e.target.value)} className="flex-1 min-w-0 h-10 rounded-xl border border-border px-3 text-sm outline-none focus:ring-2 ring-primary/30" />
              <button onClick={() => savePrefs({ zakat_haul_date: haulDraft || null }, "Tanggal haul disimpan").then(() => setHaulDraft(null))} disabled={haulDraft == null || savingPref} className="btn-secondary btn-sm">Simpan</button>
            </div>
          </section>

          {/* Riwayat pembayaran */}
          <section className="mb-5" aria-labelledby="riwayat-zakat">
            <div className="flex items-end justify-between mb-2.5">
              <div>
                <h2 id="riwayat-zakat" className="font-semibold text-[17px] leading-tight">Riwayat pembayaran</h2>
                <p className="text-xs text-muted-foreground">Tercatat juga sebagai transaksi sedekah kategori Zakat</p>
              </div>
            </div>
            <div className="surface rounded-3xl divide-y divide-border">
              {z.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Belum ada pembayaran tercatat</p>
              ) : [...z.payments].sort((a, b) => String(b.paid_date).localeCompare(String(a.paid_date))).map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{p.zakat_type === "mal" ? "Zakat mal" : p.zakat_type === "emas" ? "Zakat emas (data lama)" : "Zakat simpanan (data lama)"}</p>
                    <p className="text-[11px] text-muted-foreground">{p.paid_date ? formatDate(p.paid_date, "d MMM yyyy") : "—"}{p.notes ? ` · ${p.notes}` : ""}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">{formatMoney(p.amount || 0, p.currency || "IDR")}</p>
                    {(p.currency || "IDR") !== "IDR" && p.amount_idr > 0 && <p className="text-[11px] text-muted-foreground tabular-nums">≈ {formatMoney(p.amount_idr, "IDR")}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <button onClick={handleEmailReminder} disabled={sending} className="w-full btn-secondary mb-6">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Kirim pengingat ke email
          </button>

          <div className="flex items-start gap-2 rounded-2xl bg-muted/60 p-3 mb-6 text-xs text-muted-foreground leading-snug">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            Angka di atas perkiraan dari data yang tercatat, bukan fatwa. Untuk kepastian, konsultasikan dengan amil zakat atau BAZNAS setempat.
          </div>
        </>
      )}

      {payOpen && <PayZakatSheet z={z} onClose={() => setPayOpen(false)} onSaved={() => { setPayOpen(false); refresh(); }} />}
    </div>
  );
}

function PayZakatSheet({ z, onClose, onSaved }) {
  const { data: assets = [] } = useAssets();
  // Zakat dihitung dalam IDR, tetapi boleh dibayar dengan mata uang lain
  // (mis. SAR dari dompet Riyal). Nominal disimpan dalam mata uang bayar
  // beserta setara IDR-nya saat itu.
  const userCurrencies = useUserCurrencies();
  const payable = userCurrencies.filter((c) => canConvert(c.code, z.currency, z.rateMap));
  const [payCur, setPayCur] = useState(z.currency);
  const toPay = (v) => convertTo(v, z.currency, payCur, z.rateMap);
  const moneyAssets = assets.filter((a) => isMoneyAsset(a) && (a.currency || "IDR") === payCur && a.created_by_id === z.me?.id);
  const [amount, setAmount] = useState(String(Math.round(z.remaining)));
  const switchCur = (c) => {
    if (c === payCur) return;
    const inZakat = convertTo(Number(amount) || 0, payCur, z.currency, z.rateMap);
    const next = convertTo(inZakat, z.currency, c, z.rateMap);
    setPayCur(c);
    setAssetId("");
    setAmount(String(c === "IDR" ? Math.round(next) : Math.round(next * 100) / 100));
  };
  const amountIdr = payCur === z.currency ? Number(amount) || 0 : convertTo(Number(amount) || 0, payCur, z.currency, z.rateMap);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [recipient, setRecipient] = useState("");
  const [assetId, setAssetId] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Masukkan nominal zakat");
    setSaving(true);
    try {
      const res = await saveTransactionWithAsset({
        type: "sedekah", amount: amt, currency: payCur, category: "Zakat",
        date: new Date(`${date}T10:00:00`).toISOString(), merchant: recipient || "Zakat mal",
        notes: `Zakat mal · ${z.period.label}`, visibility: "shared",
        input_by_name: z.me?.full_name || z.me?.email || "Keluarga", tags: ["zakat"],
        linked_asset_id: assetId || undefined,
      });
      await base44.entities.ZakatPayment.create({
        year: z.period.hijriYear, zakat_type: "mal", amount: amt, currency: payCur, amount_idr: Math.round(amountIdr), status: "paid",
        paid_date: date, period_key: z.period.key, transaction_id: res?.transaction?.id || res?.id || "",
        notes: recipient || "",
      });
      toast.success("Pembayaran zakat dicatat", { description: "Jazakumullahu khairan, semoga berkah." });
      onSaved();
    } catch {
      toast.error("Gagal mencatat pembayaran");
    }
    setSaving(false);
  };

  return (
    <FormSheet title="Catat pembayaran zakat" subtitle={`${z.period.label} · sisa ${formatMoney(z.remaining, z.currency)}`} onClose={onClose}
      footer={<button onClick={save} disabled={saving} className="w-full btn-primary">{saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Simpan pembayaran</button>}>
      <section className="card-gradient-primary rounded-[24px] p-4">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="zakat-pay-amount" className="text-xs opacity-80">Nominal dibayar</label>
          {payable.length > 1 && (
            <div role="radiogroup" aria-label="Mata uang pembayaran" className="flex gap-1">
              {payable.map((c) => (
                <button key={c.code} type="button" role="radio" aria-checked={payCur === c.code} onClick={() => switchCur(c.code)}
                  className={`h-7 px-2.5 rounded-full text-[11px] font-bold border transition-colors ${payCur === c.code ? "bg-white text-[hsl(var(--hero-from))] border-white" : "border-white/25 text-white/75"}`}>{c.code}</button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-lg font-semibold opacity-70">{currencySymbol(payCur)}</span>
          <input id="zakat-pay-amount" type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className="flex-1 min-w-0 bg-transparent outline-none font-heading text-[30px] leading-none font-extrabold tabular-nums text-[hsl(var(--hero-foreground))]" />
        </div>
        {payCur !== z.currency && <p className="text-xs opacity-85 mt-1 tabular-nums">≈ {formatMoneyPlain(Math.round(amountIdr), z.currency)} · sisa {formatMoneyPlain(toPay(z.remaining), payCur)}</p>}
        <p className="text-[11px] opacity-75 mt-1">Boleh dicicil; sisa tetap terlihat di halaman Zakat.</p>
      </section>
      <FieldGroup>
        <FieldRow icon={CalendarDays} label="Tanggal bayar" htmlFor="zakat-pay-date">
          <input id="zakat-pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldInput} />
        </FieldRow>
        <FieldRow icon={Building2} label="Disalurkan ke" htmlFor="zakat-pay-recipient">
          <input id="zakat-pay-recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Mis. BAZNAS, LAZ, masjid" className={fieldInput} />
        </FieldRow>
        {moneyAssets.length > 0 && (
          <FieldRow icon={Wallet} label="Dibayar dari (opsional)" htmlFor="zakat-pay-asset">
            <select id="zakat-pay-asset" value={assetId} onChange={(e) => setAssetId(e.target.value)} className={fieldInput}>
              <option value="">Tidak dipilih, saldo rekening tetap</option>
              {moneyAssets.map((a) => <option key={a.id} value={a.id}>{assetLabel(a)} ({formatMoneyPlain(a.value, a.currency)})</option>)}
            </select>
          </FieldRow>
        )}
        <FieldRow icon={NotebookPen} label="Tercatat sebagai">
          <p className="text-sm">Transaksi sedekah · kategori Zakat</p>
        </FieldRow>
      </FieldGroup>
      <p className="text-xs text-muted-foreground px-1">Ingin melihat transaksi zakat? Buka <Link to="/riwayat" className="text-primary font-semibold">Riwayat</Link> dan pilih filter Sedekah.</p>
    </FormSheet>
  );
}
