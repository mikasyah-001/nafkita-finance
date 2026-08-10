import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAssets, useZakatPayments, useRefresh } from "@/hooks/useFinance";
import { formatNumber } from "@/lib/finance";
import Money from "@/components/Money";
import { toast } from "sonner";
import { Coins, Wallet, CheckCircle2, Bell, Loader2 } from "lucide-react";

export default function ZakatNotifier() {
  const { data: assets = [] } = useAssets();
  const { data: zakatPayments = [] } = useZakatPayments();
  const refresh = useRefresh();
  const [user, setUser] = useState(null);
  const [goldPrice, setGoldPrice] = useState("");
  const [paying, setPaying] = useState(null);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const year = new Date().getFullYear();
  const goldPriceNum = Number(goldPrice) || 0;
  const sharedAssets = assets.filter((a) => a.visibility !== "private");
  const emasAssets = sharedAssets.filter((a) => a.type === "emas");
  const emasGrams = emasAssets.reduce((s, a) => s + (a.quantity || 0), 0);
  const emasValue = goldPriceNum > 0 ? emasGrams * goldPriceNum : emasAssets.reduce((s, a) => s + (a.value || 0), 0);
  const nonEmasValue = sharedAssets.filter((a) => a.type !== "emas").reduce((s, a) => s + (a.value || 0), 0);

  const myPayments = zakatPayments.filter((z) => z.created_by_id === user?.id);
  const isPaid = (type) => myPayments.some((z) => z.year === year && z.zakat_type === type && z.status === "paid");

  const obligations = [];
  if (emasGrams >= 85 && !isPaid("emas")) {
    obligations.push({ type: "emas", label: "Zakat Emas", icon: Coins, amount: emasValue * 0.025, detail: `${formatNumber(emasGrams)} gram • nisab 85 gr` });
  }
  if (goldPriceNum > 0 && nonEmasValue >= 85 * goldPriceNum && !isPaid("simpanan")) {
    obligations.push({ type: "simpanan", label: "Zakat Simpanan", icon: Wallet, amount: nonEmasValue * 0.025, detail: <>Simpanan <Money value={nonEmasValue} /> ≥ nisab</> });
  }

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

  if (obligations.length === 0 && !(emasGrams > 0 && emasGrams < 85) && nonEmasValue === 0) return null;

  const showCard = obligations.length > 0;

  return (
    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 p-4 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Bell className="w-4 h-4 text-emerald-600" />
        <p className="text-sm font-medium">Pengingat Zakat</p>
      </div>

      {showCard ? (
        <>
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
                  <button
                    onClick={() => handlePay(ob)}
                    disabled={paying === ob.type}
                    className="w-full mt-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-60 active:scale-[0.99] transition-transform"
                  >
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
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Belum mencapai nisab. Cek simpanan dengan memasukkan harga emas:</p>
      )}

      <div className="flex items-center gap-2 mt-2">
        <div className="flex items-center flex-1 rounded-lg bg-background border border-border px-3">
          <span className="text-[11px] text-muted-foreground">Rp</span>
          <input
            type="number"
            value={goldPrice}
            onChange={(e) => setGoldPrice(e.target.value)}
            placeholder="harga emas / gram"
            className="flex-1 px-2 py-2 text-xs outline-none bg-transparent"
          />
        </div>
        <span className="text-[10px] text-muted-foreground">Nisab simpanan = 85gr × harga</span>
      </div>
    </div>
  );
}