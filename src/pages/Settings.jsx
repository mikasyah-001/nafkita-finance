import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { ArrowLeft, ArrowRight, LogOut, User, BookOpen, Tag, Upload, Sparkles, ShieldCheck } from "lucide-react";
import { Image as SmartImage } from "@/components/ui/image";
import PartnerManager from "@/components/PartnerManager";
import CurrencyManager from "@/components/CurrencyManager";
import TemplateManager from "@/components/TemplateManager";
import LocalBackupRestore from "@/components/LocalBackupRestore";
import DriveBackup from "@/components/DriveBackup";
import NotificationPreferences from "@/components/NotificationPreferences";
import NotificationRuleManager from "@/components/NotificationRuleManager";
import ThemeToggle from "@/components/ThemeToggle";
import ColorPreferenceManager from "@/components/ColorPreferenceManager";
import SettingsAccordion from "@/components/SettingsAccordion";
import { usePartnership } from "@/hooks/usePartnership";

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { hasPartner } = usePartnership();

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  return (
    <div className="px-5 pt-8 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">Pengaturan</h1>
      </div>

      {/* Pintasan */}
      <Link to="/profil" className="rounded-2xl border border-border bg-card p-4 mb-3 flex items-center gap-3 active:scale-[0.99] transition-transform">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-primary text-primary-foreground flex items-center justify-center shrink-0">
          {user?.photo_url ? (
            <SmartImage src={user.photo_url} alt="foto profil" className="w-full h-full" fittingType="fill" />
          ) : (
            <User className="w-6 h-6" />
          )}
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">Profil Saya</p>
          <p className="text-xs text-muted-foreground">Edit foto & nama</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
      </Link>

      <Link to="/panduan" className="rounded-2xl border border-border bg-card p-4 mb-5 flex items-center gap-3 active:scale-[0.99] transition-transform">
        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <BookOpen className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">Panduan Tools</p>
          <p className="text-xs text-muted-foreground">Pelajari semua fitur & cara pemakaian</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
      </Link>

      {/* Grup accordion */}
      <div className="grid md:grid-cols-2 gap-4 items-start">
        <SettingsAccordion number="01" title="Tampilan & Warna" defaultOpen>
          <p className="text-xs text-muted-foreground">Pilih tema aplikasi. "Sistem" mengikuti pengaturan gelap/terang perangkat Anda.</p>
          <ThemeToggle />
          <div className="border-t border-border pt-4">
            <ColorPreferenceManager />
          </div>
        </SettingsAccordion>

        <SettingsAccordion number="02" title="Pasangan & Notifikasi" defaultOpen={!hasPartner}>
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

        <SettingsAccordion number="03" title="Data & Cadangan">
          <p className="text-xs text-muted-foreground">Aktifkan/nonaktifkan mata uang sesuai kebutuhan Anda. Tambahkan mata uang kustom bila tidak tersedia di daftar.</p>
          <CurrencyManager />
          <div className="border-t border-border pt-4">
            <LocalBackupRestore />
          </div>
          <div className="border-t border-border pt-4">
            <DriveBackup />
          </div>
          <div className="border-t border-border pt-4">
            <TemplateManager />
          </div>
        </SettingsAccordion>

        <SettingsAccordion number="04" title="Lanjutan">
          <Link to="/kategori" className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5">
            <Tag className="w-4 h-4" /> Kelola Kategori
          </Link>
          <Link to="/impor" className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5">
            <Upload className="w-4 h-4" /> Buka Impor Laporan
          </Link>
          <Link to="/add" className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Tambah Transaksi & Scan Struk
          </Link>
          {isAdmin && (
            <Link to="/admin" className="w-full py-2.5 rounded-xl border border-primary/30 bg-primary/5 text-primary text-sm font-medium flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Panel Admin
            </Link>
          )}
        </SettingsAccordion>
      </div>

      <button onClick={handleLogout} className="w-full py-3 rounded-2xl border border-destructive/20 text-destructive font-medium text-sm flex items-center justify-center gap-2 mt-5">
        <LogOut className="w-4 h-4" /> Keluar
      </button>
    </div>
  );
}