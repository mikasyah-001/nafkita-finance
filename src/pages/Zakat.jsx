import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useZakatPayments, useRefresh } from "@/hooks/useFinance";
import { formatRupiah, formatNumber, NISAB_GRAM } from "@/lib/finance";
import { fetchGoldPriceStandard } from "@/lib/goldPrice";
import GoldPriceCompare from "@/components/GoldPriceCompare";
import Money from "@/components/Money";
import ZakatMethodNotice from "@/components/ZakatMethodNotice";
import { useScope } from "@/lib/ScopeContext";
import { toast } from "sonner";
import { ArrowLeft, Coins, Wallet, Bell, CheckCircle2, AlertCircle, Loader2, Mail, Users, Lock, Scale, Globe } from "lucide-react";

export default function Zakat() {
  const navigate = useNavigate();
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
    <div className="px-4 pt-6 pb-10 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 hover:bg-muted/70 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4" />
            </span>
            Zakat Mal
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Nisab per mata uang • 85 gr emas</p>
        </div>
      </div>

      <ZakatMethodNotice />

      {/* Scope toggle */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setScope("shared")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "shared" ? "bg-scope-shared text-scope-shared-foreground" : "bg-muted text-muted-foreground"}`}>
          <Users className="w-4 h-4" /> Bersama
        </button>
        <button onClick={() => setScope("private")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "private" ? "bg-scope-private text-scope-private-foreground" : "bg-muted text-muted-foreground"}`}>
          <Lock className="w-4 h-4" /> Pribadi
        </button>
      </div>

      {/* Ringkasan total gabungan (konversi IDR) */}
      <div className="card-gradient-accent rounded-3xl p-5 mb-4 shadow-lg">
        <p className="text-xs opacity-80">Total Harta Gabungan (IDR)</p>
        <p className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums break-words">{formatRupiah(totalHartaIDR)}</p>
        <div className="flex gap-3 mt-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs opacity-80"><Coins className="w-3.5 h-3.5" /> Total Zakat</div>
            <p className="font-semibold text-sm mt-0.5 tabular-nums truncate">{formatRupiah(totalZakatIDR)}</p>
          </div>
          <div className="w-px bg-white/20" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs opacity-80"><Scale className="w-3.5 h-3.5" /> Nisab</div>
            <p className="font-semibold text-sm mt-0.5 tabular-nums truncate">85 gr emas/currency</p>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {statusLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Kartu per mata uang */}
      {!statusLoading && perCurrency.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Belum ada aset untuk dihitung zakatnya.
        </div>
      )}

      {!statusLoading && perCurrency.map((p) => {
        const emasPaid = isPaid("emas", p.currency);
        const simpananPaid = isPaid("simpanan", p.currency);
        const hasObligation = (p.wajibEmas && !emasPaid) || (p.wajibSimpanan && !simpananPaid);
        return (
          <div key={p.currency} className="rounded-2xl border border-border bg-card p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm flex-1">Mata Uang {p.currency}</h2>
              <span className="text-[10px] text-muted-foreground">Harga emas: {p.goldPrice > 0 ? formatRupiah(p.goldPrice) : "—"}</span>
            </div>

            {/* Ringkasan harta */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-xl bg-muted/50 p-2.5">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Coins className="w-3 h-3" /> Emas</p>
                <p className="text-sm font-semibold tabular-nums">{formatNumber(p.emasGrams)} gr</p>
                <p className="text-[10px] text-muted-foreground tabular-nums"><Money value={p.emasValue} currency={p.currency} /></p>
              </div>
              <div className="rounded-xl bg-muted/50 p-2.5">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Wallet className="w-3 h-3" /> Simpanan</p>
                <p className="text-sm font-semibold tabular-nums"><Money value={p.nonEmasValue} currency={p.currency} /></p>
                <p className="text-[10px] text-muted-foreground">Nisab: {p.goldPrice > 0 ? <Money value={p.nisab} currency={p.currency} /> : "—"}</p>
              </div>
            </div>

            {/* Status kewajiban */}
            <div className="space-y-2">
              <ObligationRow
                label="Zakat Emas"
                reached={p.wajibEmas}
                paid={emasPaid}
                detail={`${formatNumber(p.emasGrams)} gr ${p.wajibEmas ? `≥ ${NISAB_GRAM} gr` : `< ${NISAB_GRAM} gr`}`}
                amount={p.zakatEmas}
                currency={p.currency}
                onPay={() => handlePay({ key: `emas-${p.currency}`, type: "emas", label: `Zakat Emas ${p.currency}`, amount: p.zakatEmas })}
                paying={paying === `emas-${p.currency}`}
              />
              <ObligationRow
                label="Zakat Simpanan"
                reached={p.wajibSimpanan}
                paid={simpananPaid}
                detail={p.wajibSimpanan ? "Simpanan ≥ nisab" : "Simpanan < nisab"}
                amount={p.zakatSimpanan}
                currency={p.currency}
                onPay={() => handlePay({ key: `simpanan-${p.currency}`, type: "simpanan", label: `Zakat Simpanan ${p.currency}`, amount: p.zakatSimpanan })}
                paying={paying === `simpanan-${p.currency}`}
              />
            </div>
          </div>
        );
      })}

      {/* Gold price input (IDR, untuk referensi) */}
      <div className="rounded-2xl border border-border bg-card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm flex items-center gap-2"><Coins className="w-4 h-4 text-amber-500" /> Harga Emas per Gram (IDR)</h2>
          {goldLoading ? (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> memuat</span>
          ) : goldPriceNum > 0 ? (
            <span className="text-[10px] text-emerald-600 font-medium">real-time</span>
          ) : null}
        </div>
        <div className="flex items-center rounded-lg bg-muted/50 border border-border px-3 mb-1">
          <span className="text-xs text-muted-foreground">Rp</span>
          <input type="number" value={goldPrice} onChange={(e) => setGoldPrice(e.target.value)} placeholder="Mis. 1.500.000" className="flex-1 px-2 py-2.5 text-sm outline-none bg-transparent" />
        </div>
        <p className="text-[10px] text-muted-foreground">Referensi harga emas Indonesia. Nisab simpanan = {NISAB_GRAM} gr × harga emas.</p>
      </div>

      {/* Gold price compare */}
      <div className="mb-4">
        <GoldPriceCompare value={goldPrice} onChange={setGoldPrice} grams={perCurrency.find((p) => p.currency === "IDR")?.emasGrams || 0} />
      </div>

      {/* Email reminder */}
      <button onClick={handleEmailReminder} disabled={sending || perCurrency.length === 0} className="w-full py-3 rounded-2xl border border-border bg-card text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99] transition-transform">
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
        {sending ? "Mengirim..." : "Kirim Pengingat Zakat ke Email"}
      </button>
    </div>
  );
}

function ObligationRow({ label, reached, paid, detail, amount, currency, onPay, paying }) {
  return (
    <div className={`rounded-xl p-3 ${reached && !paid ? "bg-amber-50 dark:bg-amber-950/30" : "bg-muted/50"}`}>
      <div className="flex items-center gap-2 mb-1">
        {reached && !paid ? <AlertCircle className="w-4 h-4 text-amber-600" /> : <CheckCircle2 className="w-4 h-4 text-muted-foreground" />}
        <span className="text-xs font-medium flex-1">{label}</span>
        {paid && <span className="text-[9px] text-emerald-600 font-medium">✓ Terbayar</span>}
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        {reached ? `Wajib. Zakat 2,5% = ` : "Belum wajib. "}
        {reached && <Money value={amount} currency={currency} className="font-semibold" />}
        {" "}({detail})
      </p>
      {reached && !paid && (
        <button onClick={onPay} disabled={paying} className="w-full py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-60 active:scale-[0.99] transition-transform">
          {paying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          {paying ? "Memproses..." : "Bayarkan Zakat"}
        </button>
      )}
    </div>
  );
}