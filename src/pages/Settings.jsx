import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { ArrowRight, LogOut, User, ShieldCheck } from "lucide-react";
import { Image as SmartImage } from "@/components/ui/image";
import PartnerManager from "@/components/PartnerManager";
import CurrencyManager from "@/components/CurrencyManager";
import TemplateManager from "@/components/TemplateManager";
import LocalBackupRestore from "@/components/LocalBackupRestore";
import DriveBackup from "@/components/DriveBackup";
import NotificationPreferences from "@/components/NotificationPreferences";
import NotificationRuleManager from "@/components/NotificationRuleManager";
import ThemeToggle from "@/components/ThemeToggle";
import SettingsAccordion from "@/components/SettingsAccordion";
import { usePartnership } from "@/hooks/usePartnership";
import PageHeader from "@/components/PageHeader";
import DeleteAccountSection from "@/components/DeleteAccountSection";

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { hasPartner } = usePartnership();

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  return (
    <div className="px-5 pt-6">
      <PageHeader title="Pengaturan" back />

      {/* Pintasan */}
      <Link to="/profil" className="card-pastel card-pastel-mint rounded-3xl p-4 mb-3 flex items-center gap-3 active:scale-[0.99] transition-transform">
        <div className="w-14 h-14 rounded-full overflow-hidden bg-primary text-primary-foreground flex items-center justify-center shrink-0 ring-4 ring-white/50 dark:ring-white/10">
          {user?.photo_url ? (
            <SmartImage src={user.photo_url} alt="foto profil" className="w-full h-full" fittingType="fill" />
          ) : (
            <User className="w-6 h-6" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[15px] leading-tight truncate">{user?.full_name || "Profil Saya"}</p>
          <p className="text-xs opacity-75 truncate">{user?.full_name ? "Profil Saya · edit foto & nama" : "Edit foto & nama"}</p>
        </div>
        <ArrowRight className="w-4 h-4 opacity-70" />
      </Link>


      <div className="mb-2.5">
        <h2 className="font-semibold text-[17px] leading-tight">Atur aplikasi</h2>
        <p className="text-xs text-muted-foreground">Ketuk grup untuk membuka atau menutup</p>
      </div>

      {/* Grup accordion */}
      <div className="grid md:grid-cols-2 gap-3 items-start">
        <SettingsAccordion number="01" title="Tampilan" subtitle="Terang, gelap, atau ikuti perangkat" defaultOpen>
          <p className="text-xs text-muted-foreground">"Sistem" mengikuti pengaturan gelap/terang perangkat Anda.</p>
          <ThemeToggle />
        </SettingsAccordion>

        <SettingsAccordion number="02" title="Pasangan & Notifikasi" subtitle="Hubungkan pasangan, atur pemberitahuan" defaultOpen={!hasPartner}>
          <PartnerManager />
          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground mb-3">Atur bagaimana notifikasi dari pasangan diterima — bisukan, ambang nominal, ringkasan harian, dan saluran.</p>
            <NotificationPreferences />
          </div>
          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground mb-3">Buat aturan per kategori untuk mengontrol kapan notifikasi dikirim berdasarkan nominal dan kategori.</p>
            <NotificationRuleManager />
          </div>
        </SettingsAccordion>

        <SettingsAccordion number="03" title="Mata Uang" subtitle="Mata uang yang aktif">
          <p className="text-xs text-muted-foreground">Aktifkan/nonaktifkan mata uang sesuai kebutuhan Anda. Tambahkan mata uang kustom bila tidak tersedia di daftar.</p>
          <CurrencyManager />
        </SettingsAccordion>

        <SettingsAccordion number="04" title="Data & Cadangan" subtitle="Cadangan lokal, Google Drive, template transaksi">
          <LocalBackupRestore />
          <div className="border-t border-border pt-4">
            <DriveBackup />
          </div>
          <div className="border-t border-border pt-4">
            <TemplateManager />
          </div>
        </SettingsAccordion>

        {/* Menu Kategori/Impor/Catat dihapus dari sini: sudah ada di menu Lainnya & tombol Catat. */}
        {isAdmin && (
          <SettingsAccordion number="05" title="Admin" subtitle="Khusus pengelola aplikasi">
            <Link to="/admin" className="-mx-4 -my-4 flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted/50 active:bg-muted transition-colors">
              <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"><ShieldCheck className="w-4 h-4" /></span>
              <span className="flex-1 min-w-0">Panel Admin</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          </SettingsAccordion>
        )}
      </div>

      <button onClick={handleLogout} className="w-full btn-secondary text-destructive border-destructive/25 hover:bg-destructive/5 mt-6 mb-4">
        <LogOut className="w-4 h-4" /> Keluar
      </button>

      <div className="mb-6">
        <DeleteAccountSection />
      </div>
    </div>
  );
}