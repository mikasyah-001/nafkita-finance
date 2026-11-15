import { useNavigate } from "react-router-dom";
import PartnerManager from "@/components/PartnerManager";
import { usePartnership } from "@/hooks/usePartnership";
import { ArrowRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";

export default function PartnerOnboarding() {
  const navigate = useNavigate();
  const { hasPartner } = usePartnership();

  return (
    <div className="px-5 pt-6">
      <PageHeader title="Sambungkan Pasangan" back className="mb-3" />
      <p className="text-sm text-muted-foreground mb-5">
        NAFKITA dirancang untuk dikelola bersama suami/istri. Hubungkan akun pasangan untuk mulai mengelola keuangan keluarga secara bersama.
      </p>

      <div className="surface p-4">
        <PartnerManager />
      </div>

      <button
        onClick={() => navigate("/")}
        className="mt-5 w-full py-3.5 surface text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
      >
        {hasPartner ? "Selesai" : "Lewati, nanti saja"}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}