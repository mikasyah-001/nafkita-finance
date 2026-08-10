import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { formatRupiah } from "@/lib/finance";
import { Bell } from "lucide-react";

export default function TransactionNotifier() {
  const meRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then((u) => { meRef.current = u; }).catch(() => {});

    const handle = (event) => {
      if (!event || event.type !== "create") return;
      const tx = event.data;
      if (!tx) return;
      const me = meRef.current;
      if (!me || tx.created_by_id === me.id) return;
      if (tx.visibility !== "shared") return;
      const label = tx.merchant || tx.notes || (tx.type === "sedekah" ? "Sedekah & Infaq" : tx.category) || "Transaksi";
      const sign = tx.type === "income" ? "+" : "-";
      toast.info("Transaksi baru dari pasangan", {
        description: `${sign}${formatRupiah(tx.amount)} • ${label}`,
        duration: 5000,
        icon: <Bell className="w-4 h-4 text-primary" />,
      });
    };

    const unsub = base44.entities.Transaction.subscribe(handle);
    return () => { if (unsub) unsub(); };
  }, []);

  return null;
}