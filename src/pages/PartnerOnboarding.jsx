import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useMe } from "@/hooks/useFinance";
import { currencies } from "@/lib/finance";
import PartnerManager from "@/components/PartnerManager";
import { usePartnership } from "@/hooks/usePartnership";
import { toast } from "sonner";
import { Heart, ArrowRight, Wallet, Loader2 } from "lucide-react";

export default function PartnerOnboarding() {
  const navigate = useNavigate();
  const { hasPartner } = usePartnership();
  const { data: me } = useMe();
  const [cur, setCur] = useState(me?.default_currency || "IDR");
  const [savingCur, setSavingCur] = useState(false);

  const pickCurrency = async (code) => {
    setCur(code);
    setSavingCur(true);
    try {
      await base44.auth.updateMe({ default_currency: code });
    } catch {
      toast.error("Gagal menyimpan mata uang");
    }
    setSavingCur(false);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col px-5 pt-12 pb-8 max-w-md mx-auto">
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center mb-4">
          <Heart className="w-8 h-8 text-rose-600" />
        </div>
        <h1 className="text-2xl font-semibold">Sambungkan Pasangan</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs">
          NAFKITA dirancang untuk dikelola bersama suami/istri. Atur mata uang utama, lalu hubungkan akun pasangan sekarang.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Mata Uang Utama</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Pilih mata uang default untuk transaksi & aset baru. Total tetap dipisah per mata uang.</p>
        <div className="flex gap-2">
          {currencies.map((c) => (
            <button
              key={c.code}
              onClick={() => pickCurrency(c.code)}
              disabled={savingCur}
              className={`flex-1 py-2.5 rounded-2xl border text-sm font-medium transition-all disabled:opacity-60 ${
                cur === c.code ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"
              }`}
            >
              <span className="block">{c.code}</span>
              <span className="block text-[10px] font-normal text-muted-foreground">{c.label}</span>
            </button>
          ))}
        </div>
        {savingCur && <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Menyimpan...</p>}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <PartnerManager />
      </div>

      <button
        onClick={() => navigate("/")}
        className="mt-5 w-full py-3.5 rounded-2xl border border-border bg-card text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
      >
        {hasPartner ? "Selesai" : "Lewati, nanti saja"}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}