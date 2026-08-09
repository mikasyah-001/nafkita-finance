import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCategories, useRefresh } from "@/hooks/useFinance";
import { colorMap, colorOptions, defaultCategories } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ArrowLeft, UserPlus, Plus, Tag, Loader2, LogOut, Trash2, User, Repeat, Upload } from "lucide-react";
import TemplateManager from "@/components/TemplateManager";

const iconOptions = ["Wallet", "ShoppingCart", "Car", "Lightbulb", "HeartPulse", "GraduationCap", "Gamepad2", "Gift", "Coins", "Briefcase", "Utensils", "Package"];

export default function Settings() {
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data: categories = [] } = useCategories();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [cat, setCat] = useState({ name: "", type: "expense", color: "slate", icon: "Wallet" });
  const [savingCat, setSavingCat] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail) return toast.error("Masukkan email pasangan");
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail, "user");
      toast.success("Undangan terkirim!", { description: `${inviteEmail} akan menerima email pendaftaran.` });
      setInviteEmail("");
    } catch (e) {
      toast.error("Gagal mengundang", { description: e.message || "Periksa email dan coba lagi." });
    }
    setInviting(false);
  };

  const handleAddCat = async () => {
    if (!cat.name) return toast.error("Isi nama kategori");
    setSavingCat(true);
    try {
      await base44.entities.Category.create({ ...cat, is_default: false });
      refresh();
      toast.success("Kategori ditambahkan");
      setCat({ name: "", type: "expense", color: "slate", icon: "Wallet" });
      setShowCatForm(false);
    } catch {
      toast.error("Gagal menambah kategori");
    }
    setSavingCat(false);
  };

  const handleDeleteCat = async (id) => {
    try {
      await base44.entities.Category.delete(id);
      refresh();
      toast.success("Kategori dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

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

      <div className="rounded-2xl border border-border bg-card p-4 mb-5 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <User className="w-6 h-6" />
        </div>
        <div>
          <p className="font-medium text-sm">KeluargaKu Finance</p>
          <p className="text-xs text-muted-foreground">Akses bersama suami & istri</p>
        </div>
      </div>

      <Section title="Undang Pasangan">
        <p className="text-xs text-muted-foreground mb-3">Buatkan akun untuk istri/suami agar dapat mencatat bersama.</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email pasangan"
            className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary/30"
          />
          <button onClick={handleInvite} disabled={inviting} className="px-4 rounded-xl bg-primary text-primary-foreground flex items-center gap-1.5 text-sm font-medium disabled:opacity-60">
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Undang
          </button>
        </div>
      </Section>

      <Section title="Kategori Transaksi">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground">Kelola kategori pengeluaran & pemasukan</p>
          <button onClick={() => setShowCatForm(!showCatForm)} className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {showCatForm && (
          <div className="rounded-xl border border-border p-3 mb-3 space-y-3">
            <input value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} placeholder="Nama kategori" className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none" />
            <div className="flex gap-2">
              {["expense", "income"].map((t) => (
                <button key={t} onClick={() => setCat({ ...cat, type: t })} className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${cat.type === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {t === "expense" ? "Pengeluaran" : "Pemasukan"}
                </button>
              ))}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Warna</p>
              <div className="flex gap-2 flex-wrap">
                {colorOptions.map((c) => (
                  <button key={c} onClick={() => setCat({ ...cat, color: c })} className={`w-7 h-7 rounded-full ${colorMap[c].solid} ${cat.color === c ? "ring-2 ring-offset-2 ring-foreground" : ""}`} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Ikon</p>
              <div className="flex gap-2 flex-wrap">
                {iconOptions.map((ic) => (
                  <button key={ic} onClick={() => setCat({ ...cat, icon: ic })} className={`w-9 h-9 rounded-lg flex items-center justify-center border ${cat.icon === ic ? "border-primary bg-primary/5" : "border-border"}`}>
                    <CategoryIcon name={ic} className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleAddCat} disabled={savingCat} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-60">
              {savingCat ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Kategori"}
            </button>
          </div>
        )}

        <div className="space-y-2">
          {categories.map((c) => {
            const cm = colorMap[c.color] || colorMap.slate;
            return (
              <div key={c.id} className="flex items-center gap-3 py-1.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cm.bg}`}>
                  <CategoryIcon name={c.icon} className={`w-4 h-4 ${cm.text}`} />
                </div>
                <span className="flex-1 text-sm">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.type === "expense" ? "Keluar" : "Masuk"}</span>
                {!c.is_default && (
                  <button onClick={() => handleDeleteCat(c.id)} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Impor Laporan Lama">
        <p className="text-xs text-muted-foreground mb-3">Impor transaksi dari file PDF atau Teks lama dengan pratinjau sebelum disimpan.</p>
        <Link to="/impor" className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5">
          <Upload className="w-4 h-4" /> Buka Impor Laporan
        </Link>
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