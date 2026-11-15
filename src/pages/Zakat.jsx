import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useZakatPayments, useRefresh } from "@/hooks/useFinance";
import { formatRupiah, formatNumber, NISAB_GRAM } from "@/lib/finance";
import { fetchGoldPriceStandard } from "@/lib/goldPrice";
import GoldPriceCompare from "@/components/GoldPriceCompare";
import Money from "@/components/Money";
import ZakatMethodNotice from "@/components/ZakatMethodNotice";
import { useScope } from "@/lib/ScopeContext";
import { toast } from "sonner";
import { Coins, Wallet, CheckCircle2, AlertCircle, Loader2, Mail, Scale, Globe } from "lucide-react";
import ScopeToggle from "@/components/ScopeToggle";
import PageHeader from "@/components/PageHeader";

export default function Zakat() {
  const { scope, setScope } = useScope();
  const { data: zakatPayments = [] } = useZakatPayments();
  const refresh = useRefresh();
  const [user, setUser] = useState(null);
  const [goldPrice, setGoldPrice] = useState("");
  const [goldLoading, setGoldLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [paying, setPaying] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  // Ambil harga emas IDR untuk input manual & GoldPriceCompare.
  useEffect(() => {
    setGoldLoading(true);
    fetchGoldPriceStandard()
      .then((src) => { if (src) setGoldPrice(String(Math.round(src.price_per_gram))); })
      .catch(() => {})
      .finally(() => setGoldLoading(false));
  }, []);

  // Ambil status zakat per mata uang dari backend (sumber kebenaran tunggal).
  const loadStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await base44.functions.invoke("getZakatStatus", {});
      const d = res?.data || res;
      if (d?.error) throw new Error(d.error);
      setStatus(d);
    } catch {
      toast.error("Gagal memuat status zakat");
    }
    setStatusLoading(false);
  };
  useEffect(() => { loadStatus(); }, [scope]);

  const year = new Date().getFullYear();
  const goldPriceNum = Number(goldPrice) || 0;
  const myPayments = zakatPayments.filter((z) => z.created_by_id === user?.id);
  const isPaid = (type, cur) => myPayments.some((z) => z.year === year && z.zakat_type === type && z.status === "paid");

  const perCurrency = status?.perCurrency || [];
  const totalHartaIDR = status?.totalHartaIDR || 0;
  const totalZakatIDR = status?.totalZakatIDR || 0;

  const handlePay = async (ob) => {
    setPaying(ob.key);
    try {
      await base44.entities.ZakatPayment.create({
        year, zakat_type: ob.type, amount: Math.round(ob.amount), status: "paid", paid_date: new Date().toISOString().slice(0, 10),
      });
      refresh();
      toast.success(`${ob.label} ditandai terbayar`, { description: "Jazakallah, semoga berkah." });
    } catch {
      toast.error("Gagal mencatat pembayaran");
    }
    setPaying(null);
  };

  const handleEmailReminder = async () => {
    if (!user?.email) { toast.error("Email tidak ditemukan"); return; }
    setSending(true);
    try {
      const lines = perCurrency.map((p) =>
        `- ${p.currency}: Emas ${formatNumber(p.emasGrams)} gr, Simpanan ${formatRupiah(p.nonEmasValue)}, Zakat ${formatRupiah(p.totalZakat)}`
      );
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: "Pengingat: Zakat Mal Anda 🕌",
        body: `Assalamu'alaikum ${user.full_name || user.email},\n\nBerikut pengingat kewajiban zakat mal Anda tahun ${year} (per mata uang):\n\n${lines.join("\n")}\n\nTotal zakat (konversi IDR): ${formatRupiah(totalZakatIDR)}\n\nSemoga Allah memberkahi harta Anda.\n\nNAFKITA`,
      });
      toast.success("Pengingat zakat dikirim", { description: `Ke ${user.email}` });
    } catch {
      toast.error("Gagal mengirim pengingat");
    }
    setSending(false);
  };

  return (
    <div className="px-5 pt-6">
      <PageHeader title="Zakat mal" subtitle="Nisab per mata uang • 85 gr emas" back />

      {/* Scope toggle */}
      <ScopeToggle className="mb-4" />

      {/* Ringkasan total gabungan (konversi IDR) */}
      <section aria-label="Ringkasan zakat" className="card-gradient-primary rounded-[28px] p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white/10 border border-white/10 rounded-full px-2.5 py-1">
            <Coins className="w-3 h-3" /> Zakat {year}
          </span>
          <span className="text-[11px] opacity-70">Konversi IDR</span>
        </div>
        <p className="text-xs opacity-75">Total harta gabungan</p>
        <p className="font-heading text-[30px] sm:text-[34px] leading-[1.1] font-extrabold tracking-tight tabular-nums break-words">{formatRupiah(totalHartaIDR)}</p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="rounded-2xl bg-white/[0.07] border border-white/10 px-3 py-2 min-w-0">
            <p className="text-[11px] opacity-75 flex items-center gap-1"><Coins className="w-3 h-3" /> Total zakat</p>
            <p className="font-semibold text-sm tabular-nums truncate">{formatRupiah(totalZakatIDR)}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.07] border border-white/10 px-3 py-2 min-w-0">
            <p className="text-[11px] opacity-75 flex items-center gap-1"><Scale className="w-3 h-3" /> Nisab</p>
            <p className="font-semibold text-sm tabular-nums truncate">85 gr emas/mata uang</p>
          </div>
        </div>
      </section>

      <ZakatMethodNotice />

      {/* Loading state */}
      {statusLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!statusLoading && (
        <div className="mb-2.5">
          <h2 className="font-semibold text-[17px] leading-tight">Kewajiban per mata uang</h2>
          <p className="text-xs text-muted-foreground">Dihitung terpisah untuk tiap mata uang aset</p>
        </div>
      )}

      {/* Kartu per mata uang */}
      {!statusLoading && perCurrency.length === 0 && (
        <div className="surface rounded-3xl p-6 mb-5 text-center text-sm text-muted-foreground">
          Belum ada aset untuk dihitung zakatnya.
        </div>
      )}

      {!statusLoading && perCurrency.map((p) => {
        const emasPaid = isPaid("emas", p.currency);
        const simpananPaid = isPaid("simpanan", p.currency);
        return (
          <section key={p.currency} className="surface rounded-3xl p-4 mb-4" aria-label={`Zakat mata uang ${p.currency}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0"><Globe className="w-4 h-4 text-muted-foreground" /></span>
              <h3 className="font-semibold text-[15px] flex-1">Mata uang {p.currency}</h3>
              <span className="text-[11px] text-muted-foreground tabular-nums">Emas: {p.goldPrice > 0 ? formatRupiah(p.goldPrice) : "—"}/gr</span>
            </div>

            {/* Ringkasan harta */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="card-pastel card-pastel-butter rounded-2xl p-3">
                <p className="text-[11px] opacity-75 flex items-center gap-1"><Coins className="w-3 h-3" /> Emas</p>
                <p className="text-sm font-semibold tabular-nums">{formatNumber(p.emasGrams)} gr</p>
                <p className="text-[11px] opacity-75 tabular-nums"><Money value={p.emasValue} currency={p.currency} /></p>
              </div>
              <div className="card-pastel card-pastel-mint rounded-2xl p-3">
                <p className="text-[11px] opacity-75 flex items-center gap-1"><Wallet className="w-3 h-3" /> Simpanan</p>
                <p className="text-sm font-semibold tabular-nums"><Money value={p.nonEmasValue} currency={p.currency} /></p>
                <p className="text-[11px] opacity-75">Nisab: {p.goldPrice > 0 ? <Money value={p.nisab} currency={p.currency} /> : "—"}</p>
              </div>
            </div>

            {/* Status kewajiban */}
            <div className="space-y-2">
              <ObligationRow
                label="Zakat emas"
                reached={p.wajibEmas}
                paid={emasPaid}
                detail={`${formatNumber(p.emasGrams)} gr ${p.wajibEmas ? `≥ ${NISAB_GRAM} gr` : `< ${NISAB_GRAM} gr`}`}
                amount={p.zakatEmas}
                currency={p.currency}
                onPay={() => handlePay({ key: `emas-${p.currency}`, type: "emas", label: `Zakat Emas ${p.currency}`, amount: p.zakatEmas })}
                paying={paying === `emas-${p.currency}`}
              />
              <ObligationRow
                label="Zakat simpanan"
                reached={p.wajibSimpanan}
                paid={simpananPaid}
                detail={p.wajibSimpanan ? "Simpanan ≥ nisab" : "Simpanan < nisab"}
                amount={p.zakatSimpanan}
                currency={p.currency}
                onPay={() => handlePay({ key: `simpanan-${p.currency}`, type: "simpanan", label: `Zakat Simpanan ${p.currency}`, amount: p.zakatSimpanan })}
                paying={paying === `simpanan-${p.currency}`}
              />
            </div>
          </section>
        );
      })}

      {/* Gold price input (IDR, untuk referensi) */}
      <div className="mb-2.5 mt-5">
        <h2 className="font-semibold text-[17px] leading-tight">Harga emas</h2>
        <p className="text-xs text-muted-foreground">Dasar perhitungan nisab simpanan</p>
      </div>
      <section aria-label="Harga emas per gram" className="surface rounded-3xl divide-y divide-border mb-4">
        <div className="flex items-start gap-3 px-4 py-3">
          <Coins className="w-4 h-4 text-gold shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="zakat-gold-price" className="block text-[11px] text-muted-foreground">Harga emas per gram (IDR)</label>
              {goldLoading ? (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> memuat</span>
              ) : goldPriceNum > 0 ? (
                <span className="text-[11px] text-success font-medium">real-time</span>
              ) : null}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-sm text-muted-foreground">Rp</span>
              <input id="zakat-gold-price" aria-label="Harga emas per gram" type="number" value={goldPrice} onChange={(e) => setGoldPrice(e.target.value)} placeholder="Mis. 1.500.000" className="w-full bg-transparent text-base font-semibold tabular-nums outline-none py-1 placeholder:text-muted-foreground/70 placeholder:font-normal" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Referensi harga emas Indonesia. Nisab simpanan = {NISAB_GRAM} gr × harga emas.</p>
          </div>
        </div>
      </section>

      {/* Gold price compare */}
      <div className="mb-4">
        <GoldPriceCompare value={goldPrice} onChange={setGoldPrice} grams={perCurrency.find((p) => p.currency === "IDR")?.emasGrams || 0} />
      </div>

      {/* Email reminder */}
      <button onClick={handleEmailReminder} disabled={sending || perCurrency.length === 0} className="w-full btn-secondary mb-4">
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
        {sending ? "Mengirim..." : "Kirim Pengingat Zakat ke Email"}
      </button>
    </div>
  );
}

function ObligationRow({ label, reached, paid, detail, amount, currency, onPay, paying }) {
  return (
    <div className={`rounded-2xl border p-3 ${reached && !paid ? "bg-warning/10 border-warning/30" : "bg-card border-border"}`}>
      <div className="flex items-center gap-2 mb-1">
        {reached && !paid ? <AlertCircle className="w-4 h-4 text-warning" /> : <CheckCircle2 className={`w-4 h-4 ${paid ? "text-success" : "text-muted-foreground"}`} />}
        <span className="text-sm font-semibold flex-1">{label}</span>
        {paid && <span className="text-[11px] text-success font-semibold bg-success/10 rounded-full px-2 py-0.5">Terbayar</span>}
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        {reached ? `Wajib. Zakat 2,5% = ` : "Belum wajib. "}
        {reached && <Money value={amount} currency={currency} className="font-semibold" />}
        {" "}({detail})
      </p>
      {reached && !paid && (
        <button onClick={onPay} disabled={paying} className="w-full btn-primary btn-sm">
          {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {paying ? "Memproses..." : "Bayarkan Zakat"}
        </button>
      )}
    </div>
  );
}