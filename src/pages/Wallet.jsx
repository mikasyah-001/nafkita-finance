import { useScope } from "@/lib/ScopeContext";
import PageHeader from "@/components/PageHeader";
import ScopeToggle from "@/components/ScopeToggle";
import AccountWallet from "@/components/AccountWallet";

// Halaman Dompet: rekening bank & uang tunai sebagai kartu, untuk aktivitas
// harian per rekening (saldo, catat masuk/keluar, transfer, transaksi terakhir).
// Halaman Aset tetap untuk kekayaan keseluruhan (emas, investasi, properti).
export default function Wallet() {
  const { scope } = useScope();
  return (
    <div className="px-5 pt-6 pb-6">
      <PageHeader title="Dompet" subtitle="Saldo & transaksi per rekening" back />
      <ScopeToggle className="mb-4" />
      <AccountWallet scope={scope} recent={8} />
    </div>
  );
}
