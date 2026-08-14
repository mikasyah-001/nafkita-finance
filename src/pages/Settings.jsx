import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import InvitationManager from "@/components/InvitationManager";
import { Link } from "react-router-dom";
import { ArrowLeft, Tag, LogOut, User, Upload, Sparkles } from "lucide-react";
import TemplateManager from "@/components/TemplateManager";
import LocalBackupRestore from "@/components/LocalBackupRestore";

export default function Settings() {
  const navigate = useNavigate();

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

      <Section title="Undang Pasangan">
        <InvitationManager />
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

      <Section title="Template Rutin">
        <TemplateManager />
      </Section>

      <button onClick={handleLogout} className="w-full py-3 rounded-2xl border border-border text-red-500 font-medium text-sm flex items-center justify-center gap-2 mt-5">
        <LogOut className="w-4 h-4" /> Keluar
      </button>
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