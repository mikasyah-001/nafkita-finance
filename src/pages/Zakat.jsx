import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAssets, useZakatPayments, useRefresh } from "@/hooks/useFinance";
import { formatRupiah, formatNumber, computeZakat, NISAB_GRAM } from "@/lib/finance";
import { fetchGoldPriceStandard } from "@/lib/goldPrice";
import GoldPriceCompare from "@/components/GoldPriceCompare";
import Money from "@/components/Money";
import { useScope } from "@/lib/ScopeContext";
import { toast } from "sonner";
import { ArrowLeft, Coins, Wallet, Bell, CheckCircle2, AlertCircle, Loader2, Mail, Users, Lock, Scale } from "lucide-react";

export default function Zakat() {
  const navigate = useNavigate();
  const { scope, setScope } = useScope();
  const { data: assets = [] } = useAssets();
  const { data: zakatPayments = [] } = useZakatPayments();
  const refresh = useRefresh();
  const [user, setUser] = useState(null);
  const [goldPrice, setGoldPrice] = useState("");
  const [goldLoading, setGoldLoading] = useState(false);
  const [paying, setPaying] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  useEffect(() => {
    setGoldLoading(true);
    fetchGoldPriceStandard()
      .then((src) => { if (src) setGoldPrice(String(Math.round(src.price_per_gram))); })
      .catch(() => {})
      .finally(() => setGoldLoading(false));
  }, []);

  const year = new Date().getFullYear();
  const goldPriceNum = Number(goldPrice) || 0;
  const scopedAssets = assets.filter((a) => (scope === "private" ? a.visibility === "private" : a.visibility !== "private"));

  const emasAssets = scopedAssets.filter((a) => a.type === "emas");
  const emasGrams = emasAssets.reduce((s, a) => s + (a.quantity || 0), 0);
  const emasValue = goldPriceNum > 0 ? emasGrams * goldPriceNum : emasAssets.reduce((s, a) => s + (a.value || 0), 0);
  const otherAssetsIDR = scopedAssets.filter((a) => a.type !== "emas" && (a.currency || "IDR") === "IDR");
  const nonIDRAssets = scopedAssets.filter((a) => a.type !== "emas" && (a.currency || "IDR") !== "IDR");
  const otherValue = otherAssetsIDR.reduce((s, a) => s + (a.value || 0), 0);
  const totalHarta = emasValue + otherValue;

  const { nisab, emasReached, simpananReached, zakatEmas, zakatSimpanan } =
    computeZakat({ emasGrams, emasValue, nonEmasValue: otherValue, goldPrice: goldPriceNum });

  const earliestEmasDate = emasAssets.reduce((d, a) => {
    if (!a.purchase_date) return d;
    const t = new Date(a.purchase_date).getTime();
    return d === null || t < d ? t : d;
  }, null);
  const hasReachedHaul = earliestEmasDate != null && (Date.now() - earliestEmasDate) >= 354 * 24 * 3600 * 1000;

  const myPayments = zakatPayments.filter((z) => z.created_by_id === user?.id);
  const isPaid = (type) => myPayments.some((z) => z.year === year && z.zakat_type === type && z.status === "paid");

  const obligations = [];
  if (emasReached && !isPaid("emas")) {
    obligations.push({ type: "emas", label: "Zakat Emas", icon: Coins, amount: zakatEmas, detail: `${formatNumber(emasGrams)} gram • nisab ${NISAB_GRAM} gr` });
  }
  if (simpananReached && !isPaid("simpanan")) {
    obligations.push({ type: "simpanan", label: "Zakat Simpanan", icon: Wallet, amount: zakatSimpanan, detail: <>Simpanan <Money value={otherValue} /> ≥ nisab</> });
  }

  const handlePay = async (ob) => {
    setPaying(ob.type);
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
      const totalZakat = zakatEmas + zakatSimpanan;
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: "Pengingat: Zakat Mal Anda 🕌",
        body: `Assalamu'alaikum ${user.full_name || user.email},\n\nBerikut pengingat kewajiban zakat mal Anda tahun ${year}:\n\n- Total emas: ${formatNumber(emasGrams)} gram (nilai ${formatRupiah(emasValue)})\n- Simpanan/aset lain (IDR): ${formatRupiah(otherValue)}\n- Total harta: ${formatRupiah(totalHarta)}\n- Nisab: ${formatRupiah(nisab)}\n\nZakat Emas (2,5%): ${emasReached ? formatRupiah(zakatEmas) : "Belum wajib"}\nZakat Simpanan (2,5%): ${simpananReached ? formatRupiah(zakatSimpanan) : "Belum wajib"}\n\n${obligations.length > 0 ? `Total zakat jatuh tempo: ${formatRupiah(totalZakat)}` : "Belum ada zakat jatuh tempo saat ini."}\n\nSemoga Allah memberkahi harta Anda.\n\nNAFKITA`,
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
          <p className="text-xs text-muted-foreground mt-0.5">Kalkulator nisab, pengingat & pembayaran</p>
        </div>
      </div>

      {/* Scope toggle */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setScope("shared")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "shared" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Users className="w-4 h-4" /> Bersama
        </button>
        <button onClick={() => setScope("private")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "private" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Lock className="w-4 h-4" /> Pribadi
        </button>
      </div>

      {/* Summary card */}
      <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 mb-4 shadow-lg">
        <p className="text-xs opacity-80">Total Harta (IDR)</p>
        <p className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums break-words">{formatRupiah(totalHarta)}</p>
        <div className="flex gap-3 mt-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs opacity-80"><Coins className="w-3.5 h-3.5" /> Emas</div>
            <p className="font-semibold text-sm mt-0.5 tabular-nums truncate">{formatNumber(emasGrams)} gr</p>
          </div>
          <div className="w-px bg-white/20" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs opacity-80"><Wallet className="w-3.5 h-3.5" /> Simpanan</div>
            <p className="font-semibold text-sm mt-0.5 tabular-nums truncate">{formatRupiah(otherValue)}</p>
          </div>
          <div className="w-px bg-white/20" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs opacity-80"><Scale className="w-3.5 h-3.5" /> Nisab</div>
            <p className="font-semibold text-sm mt-0.5 tabular-nums truncate">{goldPriceNum > 0 ? formatRupiah(nisab) : "—"}</p>
          </div>
        </div>
      </div>

      {/* Gold price input */}
      <div className="rounded-2xl border border-border bg-card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm flex items-center gap-2"><Coins className="w-4 h-4 text-amber-500" /> Harga Emas per Gram</h2>
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
        <p className="text-[10px] text-muted-foreground">Nisab simpanan = {NISAB_GRAM} gr × harga emas</p>
      </div>

      {/* Zakat status detail */}
      {goldPriceNum > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 mb-4 space-y-3">
          <h2 className="font-semibold text-sm mb-1">Status Kewajiban Zakat</h2>
          <div className={`rounded-xl p-3 ${emasReached ? "bg-amber-50 dark:bg-amber-950/30" : "bg-muted/50"}`}>
            <div className="flex items-center gap-2 mb-1">
              {emasReached ? <AlertCircle className="w-4 h-4 text-amber-600" /> : <CheckCircle2 className="w-4 h-4 text-muted-foreground" />}
              <span className="text-xs font-medium">Zakat Emas</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {emasReached ? `Wajib zakat (≥${NISAB_GRAM} gr). Zakat 2,5% = ${formatRupiah(zakatEmas)}` : `Belum wajib (${formatNumber(emasGrams)} gr < ${NISAB_GRAM} gr)`}
            </p>
            {earliestEmasDate != null && (
              <p className="text-[11px] text-muted-foreground mt-1">Haul: {hasReachedHaul ? "sudah genap 1 tahun" : "belum genap 1 tahun"}</p>
            )}
          </div>
          <div className={`rounded-xl p-3 ${simpananReached ? "bg-amber-50 dark:bg-amber-950/30" : "bg-muted/50"}`}>
            <div className="flex items-center gap-2 mb-1">
              {simpananReached ? <AlertCircle className="w-4 h-4 text-amber-600" /> : <CheckCircle2 className="w-4 h-4 text-muted-foreground" />}
              <span className="text-xs font-medium">Zakat Simpanan/Uang</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {simpananReached ? `Wajib zakat (≥nisab). Zakat 2,5% = ${formatRupiah(zakatSimpanan)}` : "Belum wajib (simpanan < nisab)"}
            </p>
          </div>
          {nonIDRAssets.length > 0 && (
            <p className="text-[10px] text-muted-foreground italic">
              {nonIDRAssets.length} aset non-IDR ({nonIDRAssets.map((a) => `${a.name} (${a.currency})`).join(", ")}) tidak dihitung karena nisab dalam IDR.
            </p>
          )}
        </div>
      )}

      {/* Pengingat & bayar */}
      {obligations.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-medium">Pengingat Zakat</p>
          </div>
          <div className="space-y-2">
            {obligations.map((ob) => {
              const Icon = ob.icon;
              return (
                <div key={ob.type} className="rounded-xl bg-background border border-border p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{ob.label}</p>
                      <p className="text-[11px] text-muted-foreground">{ob.detail}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">Zakat 2,5%</p>
                      <p className="text-sm font-semibold text-emerald-600"><Money value={ob.amount} /></p>
                    </div>
                  </div>
                  <button onClick={() => handlePay(ob)} disabled={paying === ob.type} className="w-full mt-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-60 active:scale-[0.99] transition-transform">
                    {paying === ob.type ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {paying === ob.type ? "Memproses..." : "Bayarkan Zakat"}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Setelah dibayar, pengingat ini akan otomatis tersembunyi.
          </p>
        </div>
      )}

      {/* Gold price compare */}
      <div className="mb-4">
        <GoldPriceCompare value={goldPrice} onChange={setGoldPrice} grams={emasGrams} />
      </div>

      {/* Email reminder */}
      <button onClick={handleEmailReminder} disabled={sending} className="w-full py-3 rounded-2xl border border-border bg-card text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99] transition-transform">
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
        {sending ? "Mengirim..." : "Kirim Pengingat Zakat ke Email"}
      </button>
    </div>
  );
}