import { useNavigate } from "react-router-dom";
import { Heart, ArrowRight } from "lucide-react";
import InvitationManager from "@/components/InvitationManager";
import { usePartnership } from "@/hooks/usePartnership";

export default function PartnerOnboarding() {
  const navigate = useNavigate();
  const { hasPartner } = usePartnership();

  return (
    <div className="min-h-[100dvh] flex flex-col px-5 pt-12 pb-8 max-w-md mx-auto">
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center mb-4">
          <Heart className="w-8 h-8 text-rose-600" />
        </div>
        <h1 className="text-2xl font-semibold">Sambungkan Pasangan</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs">
          NAFKITA dirancang untuk dikelola bersama suami/istri. Hubungkan akun pasangan sekarang,
          atau lewati dan atur nanti di menu Pengaturan.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <InvitationManager />
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