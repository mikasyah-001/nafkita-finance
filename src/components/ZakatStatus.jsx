import { useEffect, useState } from "react";
import { useZakatPayments, useRefresh } from "@/hooks/useFinance";
import { formatNumber, computeZakat, NISAB_GRAM } from "@/lib/finance";
import Money from "@/components/Money";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Coins, Wallet, CheckCircle2, Bell, Loader2, Sparkles, AlertTriangle, Info } from "lucide-react";

// Zakat selalu dihitung dalam IDR (nisab emas berbasis harga emas Rupiah).
const ZK = "IDR";

export default function ZakatStatus({ emasGrams = 0, emasValue = 0, nonEmasValue = 0, goldPrice = 0, displayCurrency = "IDR" }) {
  const { data: zakatPayments = [] } = useZakatPayments();
  const refresh = useRefresh();
  const [user, setUser] = useState(null);
  const [paying, setPaying] = useState(null);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const year = new Date().getFullYear();
  const myPayments = zakatPayments.filter((z) => z.created_by_id === user?.id);
  const isPaid = (type) => myPayments.some((z) => z.year === year && z.zakat_type === type && z.status === "paid");

  const { emasReached: emasReachedNisab, simpananReached: simpananReachedNisab, nisab: simpananNisabValue, zakatEmas, zakatSimpanan } =
    computeZakat({ emasGrams, emasValue, nonEmasValue, goldPrice });

  const obligations = [];
  if (emasReachedNisab && !isPaid("emas")) {
    obligations.push({
      type: "emas",
      label: "Zakat Emas",
      icon: Coins,
      amount: zakatEmas,
      detail: `${formatNumber(emasGrams)} gram • nisab ${NISAB_GRAM} gr`,
    });
  }
  if (simpananReachedNisab && !isPaid("simpanan")) {
    obligations.push({
      type: "simpanan",
      label: "Zakat Simpanan",
      icon: Wallet,
      amount: zakatSimpanan,
      detail: <>Simpanan <Money value={nonEmasValue} currency={ZK} /> ≥ nisab</>,
    });
  }

  const emasPaid = isPaid("emas");
  const simpananPaid = isPaid("simpanan");

  const handlePay = async (ob) => {
    setPaying(ob.type);
    try {
      await base44.entities.ZakatPayment.create({
        year,
        zakat_type: ob.type,
        amount: Math.round(ob.amount),
        status: "paid",
        paid_date: new Date().toISOString().slice(0, 10),
      });
      refresh();
      toast.success(`${ob.label} ditandai terbayar`, { description: "Jazakallah, semoga berkah." });
    } catch {
      toast.error("Gagal mencatat pembayaran");
    }
    setPaying(null);
  };

  const hasAnyAsset = emasGrams > 0 || nonEmasValue > 0;
  if (!hasAnyAsset) return null;

  const emasProgress = Math.min(100, (emasGrams / NISAB_GRAM) * 100);
  const showIdrNote = displayCurrency !== "IDR";

  return (
    <section aria-label={`Status zakat ${year}`} className="surface rounded-3xl p-4 mb-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-gold text-gold-foreground flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[17px] leading-tight">Status zakat {year}</p>
          <p className="text-[11px] text-muted-foreground">Nisab emas = {NISAB_GRAM} gram</p>
        </div>
        {showIdrNote && (
          <span className="text-[11px] font-semibold text-primary bg-primary/10 rounded-full px-2.5 py-1 flex items-center gap-1 shrink-0">
            <Info className="w-3 h-3" /> Dihitung dalam IDR
          </span>
        )}
      </div>

      {/* Status Emas */}
      <div className="rounded-2xl border border-border p-3 mb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-gold" />
            <p className="text-sm font-semibold">Zakat emas</p>
          </div>
          {emasPaid ? (
            <span className="text-[11px] font-medium text-success flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Lunas {year}
            </span>
          ) : emasReachedNisab ? (
            <span className="text-[11px] font-medium text-warning flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Wajib Zakat
            </span>
          ) : (
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Info className="w-3.5 h-3.5" /> Belum Nisab
            </span>
          )}
        </div>

        {emasGrams > 0 ? (
          <>
            <div className="flex items-end justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">{formatNumber(emasGrams)} gr</span>
              <span className="text-xs text-muted-foreground">{NISAB_GRAM} gr nisab</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${emasReachedNisab ? "bg-gold" : "bg-gold/40"}`}
                style={{ width: `${emasProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {emasReachedNisab
                ? `Melebihi nisab • zakat 2,5% = `
                : `Kurang ${formatNumber(NISAB_GRAM - emasGrams)} gr menuju nisab`}
              {emasReachedNisab && <span className="font-semibold text-foreground"><Money value={zakatEmas} currency={ZK} /></span>}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Belum ada aset emas tercatat.</p>
        )}
      </div>

      {/* Status Simpanan */}
      {goldPrice > 0 && (
        <div className="rounded-2xl border border-border p-3 mb-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Zakat simpanan</p>
            </div>
            {simpananPaid ? (
              <span className="text-[11px] font-medium text-success flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Lunas {year}
              </span>
            ) : simpananReachedNisab ? (
              <span className="text-[11px] font-medium text-warning flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Wajib Zakat
              </span>
            ) : (
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Belum Nisab
              </span>
            )}
          </div>
          <div className="flex items-end justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Simpanan <Money value={nonEmasValue} currency={ZK} /></span>
            <span className="text-xs text-muted-foreground">Nisab <Money value={simpananNisabValue} currency={ZK} /></span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${simpananReachedNisab ? "bg-primary" : "bg-primary/40"}`}
              style={{ width: `${Math.min(100, (nonEmasValue / simpananNisabValue) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {simpananReachedNisab ? (
              <>Melebihi nisab • zakat 2,5% = <span className="font-semibold text-primary"><Money value={zakatSimpanan} currency={ZK} /></span></>
            ) : (
              <>Kurang <Money value={simpananNisabValue - nonEmasValue} currency={ZK} /> menuju nisab</>
            )}
          </p>
        </div>
      )}

      {/* Obligasi pembayaran */}
      {obligations.length > 0 && (
        <div className="space-y-2 mt-3">
          {obligations.map((ob) => {
            const Icon = ob.icon;
            return (
              <div key={ob.type} className="card-pastel card-pastel-mint rounded-2xl p-3">
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="w-9 h-9 rounded-full bg-white/60 dark:bg-white/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{ob.label}</p>
                    <p className="text-[11px] opacity-75">{ob.detail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] opacity-75">2,5%</p>
                    <p className="font-heading text-base font-extrabold tabular-nums"><Money value={ob.amount} currency={ZK} /></p>
                  </div>
                </div>
                <button
                  onClick={() => handlePay(ob)}
                  disabled={paying === ob.type}
                  className="w-full btn-primary btn-sm"
                >
                  {paying === ob.type ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {paying === ob.type ? "Memproses..." : "Bayarkan Zakat"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Notifikasi nisab emas tercapai */}
      {emasReachedNisab && obligations.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-warning/10 border border-warning/30 p-3">
          <Sparkles className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <p className="text-[11px] text-foreground/80 leading-relaxed">
            Simpanan emas Anda telah mencapai nisab ({NISAB_GRAM} gram). Saatnya menunaikan zakat emas sebesar 2,5% dari total nilai emas.
          </p>
        </div>
      )}

      {goldPrice === 0 && emasGrams > 0 && !emasReachedNisab && (
        <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
          <Info className="w-3 h-3" /> Masukkan harga emas untuk mengecek nisab zakat simpanan.
        </p>
      )}
    </section>
  );
}