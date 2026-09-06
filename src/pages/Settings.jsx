import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import PartnerManager from "@/components/PartnerManager";
import { Link } from "react-router-dom";
import { ArrowLeft, Tag, LogOut, User, Upload, Sparkles, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useMe } from "@/hooks/useFinance";
import { currencies } from "@/lib/finance";
import TemplateManager from "@/components/TemplateManager";
import LocalBackupRestore from "@/components/LocalBackupRestore";
import DriveBackup from "@/components/DriveBackup";
import NotificationPreferences from "@/components/NotificationPreferences";
import { toast } from "sonner";

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  return (
    <div className="px-5 pt-8 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold">Pengaturan</h1>
      </div>

      <Link to="/profil" className="rounded-2xl border border-border bg-card p-4 mb-5 flex items-center gap-3 active:scale-[0.99] transition-transform">
        <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <User className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">Profil Saya</p>
          <p className="text-xs text-muted-foreground">Edit foto & nama</p>
        </div>
        <ArrowLeft className="w-4 h-4 rotate-180 text-muted-foreground" />
      </Link>

      <Section title="Mata Uang Utama">
        <p className="text-xs text-muted-foreground mb-3">Mata uang default untuk transaksi & aset baru. Total di dashboard tetap dipisah per mata uang (tanpa konversi).</p>
        <CurrencySetting />
      </Section>

      <Section title="Undang Pasangan">
        <PartnerManager />
      </Section>

      <Section title="Preferensi Notifikasi">
        <p className="text-xs text-muted-foreground mb-3">Atur bagaimana notifikasi dari pasangan diterima — bisukan, ambang nominal, ringkasan harian, dan saluran.</p>
        <NotificationPreferences />
      </Section>

      <Section title="Kategori Transaksi">
        <p className="text-xs text-muted-foreground mb-3">Kelola kategori pengeluaran & pemasukan — tambah, edit ikon/warna, dan hapus yang tidak terpakai.</p>
        <Link to="/kategori" className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5">
          <Tag className="w-4 h-4" /> Kelola Kategori
        </Link>
      </Section>

      <Section title="Impor Laporan Lama">
        <p className="text-xs text-muted-foreground mb-3">Impor transaksi dari file PDF atau Teks lama dengan pratinjau sebelum disimpan.</p>
        <Link to="/impor" className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5">
          <Upload className="w-4 h-4" /> Buka Impor Laporan
        </Link>
      </Section>

      <Section title="Asisten Struk AI">
        <p className="text-xs text-muted-foreground mb-3">Kirim foto bon, AI akan mengkategorikan transaksi & memperbarui aset terkait secara otomatis.</p>
        <Link to="/asisten-struk" className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5">
          <Sparkles className="w-4 h-4" /> Buka Asisten Struk
        </Link>
      </Section>

      <Section title="Cadangan Lokal">
        <LocalBackupRestore />
      </Section>

      <Section title="Cadangan ke Google Drive">
        <DriveBackup />
      </Section>

      <Section title="Template Rutin">
        <TemplateManager />
      </Section>

      {isAdmin && (
        <Link to="/admin" className="rounded-2xl border border-primary/30 bg-primary/5 p-4 mb-4 flex items-center gap-3 active:scale-[0.99] transition-transform">
          <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">Panel Admin</p>
            <p className="text-xs text-muted-foreground">Kelola pengguna, koneksi & transaksi</p>
          </div>
          <ArrowLeft className="w-4 h-4 rotate-180 text-muted-foreground" />
        </Link>
      )}

      <button onClick={handleLogout} className="w-full py-3 rounded-2xl border border-border text-red-500 font-medium text-sm flex items-center justify-center gap-2 mt-5">
        <LogOut className="w-4 h-4" /> Keluar
      </button>
    </div>
  );
}

function CurrencySetting() {
  const { data: me } = useMe();
  const [saving, setSaving] = useState(false);
  const current = me?.default_currency || "IDR";
  const [val, setVal] = useState(current);

  useEffect(() => { setVal(current); }, [current]);

  const save = async (code) => {
    setVal(code);
    setSaving(true);
    try {
      await base44.auth.updateMe({ default_currency: code });
      toast.success("Mata uang utama diperbarui");
    } catch {
      toast.error("Gagal menyimpan mata uang");
    }
    setSaving(false);
  };

  return (
    <div className="flex gap-2">
      {currencies.map((c) => (
        <button
          key={c.code}
          onClick={() => save(c.code)}
          disabled={saving}
          className={`flex-1 py-2.5 rounded-2xl border text-sm font-medium transition-all disabled:opacity-60 ${
            val === c.code ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"
          }`}
        >
          <span className="block">{c.code}</span>
          <span className="block text-[10px] font-normal text-muted-foreground">{c.label}</span>
        </button>
      ))}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 mb-4">
      <h2 className="font-semibold text-sm mb-3 flex items-center gap-2"><Tag className="w-4 h-4 text-muted-foreground" /> {title}</h2>
      {children}
    </div>
  );
}