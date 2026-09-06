import { useEffect, useState } from "react";
import { useZakatPayments, useRefresh } from "@/hooks/useFinance";
import { formatNumber, computeZakat, NISAB_GRAM } from "@/lib/finance";
import Money from "@/components/Money";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Coins, Wallet, CheckCircle2, Bell, Loader2, Sparkles, AlertTriangle, Info } from "lucide-react";

export default function ZakatStatus({ emasGrams = 0, emasValue = 0, nonEmasValue = 0, goldPrice = 0 }) {
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
      detail: <>Simpanan <Money value={nonEmasValue} /> ≥ nisab</>,
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

  return (
    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 p-4 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
          <Bell className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Status Zakat {year}</p>
          <p className="text-[11px] text-muted-foreground">Nisab emas = {NISAB_GRAM} gram</p>
        </div>
      </div>

      {/* Status Emas */}
      <div className="rounded-xl bg-background border border-border p-3 mb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-medium">Zakat Emas</p>
          </div>
          {emasPaid ? (
            <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Lunas {year}
            </span>
          ) : emasReachedNisab ? (
            <span className="text-[10px] font-medium text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Wajib Zakat
            </span>
          ) : (
            <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
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
                className={`h-full rounded-full transition-all ${emasReachedNisab ? "bg-amber-500" : "bg-amber-300"}`}
                style={{ width: `${emasProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {emasReachedNisab
                ? `Melebihi nisab • zakat 2,5% = `
                : `Kurang ${formatNumber(NISAB_GRAM - emasGrams)} gr menuju nisab`}
              {emasReachedNisab && <span className="font-semibold text-amber-600"><Money value={zakatEmas} /></span>}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Belum ada aset emas tercatat.</p>
        )}
      </div>

      {/* Status Simpanan */}
      {goldPrice > 0 && (
        <div className="rounded-xl bg-background border border-border p-3 mb-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-indigo-500" />
              <p className="text-sm font-medium">Zakat Simpanan</p>
            </div>
            {simpananPaid ? (
              <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Lunas {year}
              </span>
            ) : simpananReachedNisab ? (
              <span className="text-[10px] font-medium text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Wajib Zakat
              </span>
            ) : (
              <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Belum Nisab
              </span>
            )}
          </div>
          <div className="flex items-end justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Simpanan <Money value={nonEmasValue} /></span>
            <span className="text-xs text-muted-foreground">Nisab <Money value={simpananNisabValue} /></span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${simpananReachedNisab ? "bg-indigo-500" : "bg-indigo-300"}`}
              style={{ width: `${Math.min(100, (nonEmasValue / simpananNisabValue) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            {simpananReachedNisab ? (
              <>Melebihi nisab • zakat 2,5% = <span className="font-semibold text-indigo-600"><Money value={zakatSimpanan} /></span></>
            ) : (
              <>Kurang <Money value={simpananNisabValue - nonEmasValue} /> menuju nisab</>
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
              <div key={ob.type} className="rounded-xl bg-background border border-border p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{ob.label}</p>
                    <p className="text-[11px] text-muted-foreground">{ob.detail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">2,5%</p>
                    <p className="text-sm font-semibold text-emerald-600"><Money value={ob.amount} /></p>
                  </div>
                </div>
                <button
                  onClick={() => handlePay(ob)}
                  disabled={paying === ob.type}
                  className="w-full py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-60 active:scale-[0.99] transition-transform"
                >
                  {paying === ob.type ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {paying === ob.type ? "Memproses..." : "Bayarkan Zakat"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Notifikasi nisab emas tercapai */}
      {emasReachedNisab && obligations.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-100 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 p-2.5">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
            Simpanan emas Anda telah mencapai nisab ({NISAB_GRAM} gram). Saatnya menunaikan zakat emas sebesar 2,5% dari total nilai emas.
          </p>
        </div>
      )}

      {goldPrice === 0 && emasGrams > 0 && !emasReachedNisab && (
        <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
          <Info className="w-3 h-3" /> Masukkan harga emas untuk mengecek nisab zakat simpanan.
        </p>
      )}
    </div>
  );
}