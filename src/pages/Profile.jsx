import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { uploadFile, uploadErrorText } from "@/lib/upload";
import { toast } from "sonner";
import {
  Camera, Loader2, Check, User, Hash, Copy, Heart, ChevronRight, Settings, Bell,
  MessageSquareHeart, BookOpen, CalendarHeart, Mail,
} from "lucide-react";
import { Image as SmartImage } from "@/components/ui/image";
import Avatar from "@/components/Avatar";
import PartnerManager from "@/components/PartnerManager";
import UserAuditLog from "@/components/UserAuditLog";
import { deriveRefCode } from "@/lib/refCode";
import PageHeader from "@/components/PageHeader";
import { FieldRow, fieldInput } from "@/components/FormSheet";
import { useMe } from "@/hooks/useFinance";
import { usePartnership } from "@/hooks/usePartnership";
import { formatDate } from "@/lib/finance";
import { connectionDuration, lastActiveLabel, ROLE_LABEL } from "@/lib/partner";

// Profil: identitas saya, pasangan (ringkas → halaman profil pasangan),
// pengaturan terkait, dan riwayat aktivitas. Simpan tidak lagi menutup
// halaman; tombol hanya aktif bila ada perubahan.
export default function Profile() {
  const qc = useQueryClient();
  const { data: user } = useMe();
  const { hasPartner, partners, connection, myRole, loading: partnerLoading } = usePartnership();
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    setName(user.full_name || "");
    setPhotoUrl(user.photo_url || "");
  }, [user]);

  const myCode = deriveRefCode(user?.id);
  const dirty = !!user && (name.trim() !== (user.full_name || "") || photoUrl !== (user.photo_url || ""));
  const partner = partners?.[0];

  const copyCode = async () => {
    if (!myCode) return;
    try {
      await navigator.clipboard.writeText(myCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Gagal menyalin kode");
    }
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await uploadFile(file, "image");
      setPhotoUrl(file_url);
    } catch (err) {
      toast.error(uploadErrorText(err, "Gagal mengunggah foto"));
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Nama tidak boleh kosong");
    setSaving(true);
    try {
      await base44.auth.updateMe({ full_name: name.trim(), photo_url: photoUrl });
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Profil diperbarui");
    } catch (e) {
      toast.error("Gagal memperbarui profil", { description: e.message });
    }
    setSaving(false);
  };

  return (
    <div className="px-5 pt-6 pb-6">
      <PageHeader title="Profil" back />

      {/* Identitas */}
      <section aria-label="Foto & identitas" className="card-gradient-primary rounded-[28px] p-5 mb-4 flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label="Ganti foto profil"
          className="relative w-20 h-20 rounded-full overflow-hidden ring-4 ring-white/15 shrink-0 active:scale-95 transition-transform disabled:opacity-60"
        >
          {photoUrl ? (
            <SmartImage src={photoUrl} alt="foto profil" className="w-full h-full" fittingType="fill" />
          ) : (
            <div className="w-full h-full bg-white/10 flex items-center justify-center">
              {uploading ? <Loader2 className="w-7 h-7 animate-spin opacity-80" /> : <User className="w-9 h-9 opacity-80" />}
            </div>
          )}
          <div className="absolute bottom-0 inset-x-0 bg-gold text-gold-foreground text-[10px] font-semibold py-0.5 flex items-center justify-center gap-1">
            <Camera className="w-3 h-3" /> Ganti
          </div>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        <div className="min-w-0">
          <p className="font-heading text-[22px] font-extrabold leading-tight tracking-tight truncate">{name || user?.full_name || "Tanpa nama"}</p>
          <p className="text-xs opacity-75 truncate mt-0.5">{user?.email}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {myRole && <span className="text-[11px] font-semibold rounded-full px-2.5 py-0.5 bg-white/15">{ROLE_LABEL[myRole]}</span>}
            {user?.created_date && <span className="text-[11px] rounded-full px-2.5 py-0.5 bg-white/[0.08]">Anggota sejak {formatDate(user.created_date, "MMM yyyy")}</span>}
          </div>
        </div>
      </section>

      {/* Data diri */}
      <section aria-label="Data diri" className="surface rounded-3xl divide-y divide-border mb-3">
        <FieldRow icon={User} label="Nama" htmlFor="profile-name">
          <input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" className={fieldInput} />
        </FieldRow>
        <FieldRow icon={Mail} label="Email (tidak bisa diubah)">
          <p className="text-sm py-1 truncate text-muted-foreground">{user?.email || "—"}</p>
        </FieldRow>
      </section>
      {dirty && (
        <button onClick={handleSave} disabled={saving} className="w-full btn-primary mb-3">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Simpan perubahan
        </button>
      )}

      {/* Pasangan */}
      <h2 className="text-xs font-semibold text-muted-foreground mt-5 mb-2 px-1 flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 text-destructive" /> Pasangan</h2>
      {partnerLoading ? (
        <div className="surface h-20 animate-pulse" />
      ) : hasPartner ? (
        <Link to="/profil/pasangan" className="surface p-4 flex items-center gap-3 active:scale-[0.99] transition-transform">
          <Avatar url={partner?.photo_url} name={partner?.full_name} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[15px] leading-tight truncate">{partner?.full_name || partner?.email || "Pasangan"}</p>
            <p className="text-xs text-muted-foreground truncate">
              {connection?.partner_role ? ROLE_LABEL[connection.partner_role] : "Pasangan"}
              {partner?.last_active_at ? ` · aktif ${lastActiveLabel(partner.last_active_at)}` : ""}
            </p>
            {connection?.connected_at && (
              <p className="text-xs text-primary font-medium mt-0.5 flex items-center gap-1">
                <CalendarHeart className="w-3.5 h-3.5" />
                {connection.connected_exact ? "" : "±"}Terhubung {connectionDuration(connection.connected_at)}
              </p>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </Link>
      ) : (
        <div className="space-y-3">
          <section aria-labelledby="profile-ref-code" className="surface rounded-3xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Hash className="w-4 h-4 text-muted-foreground" />
              <h3 id="profile-ref-code" className="font-semibold text-sm">Kode referensi Anda</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3 leading-snug">Pasangan cukup memasukkan kode ini untuk terhubung dengan Anda.</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-2xl bg-muted px-4 py-3 text-center font-mono text-lg font-bold tracking-[0.15em]">{myCode || "—"}</div>
              <button onClick={copyCode} className="btn-primary">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Tersalin" : "Salin"}
              </button>
            </div>
          </section>
          {/* Undangan masuk/terkirim tetap dikelola di sini */}
          <div className="surface rounded-3xl p-4"><PartnerManager /></div>
        </div>
      )}

      {/* Pengaturan lainnya */}
      <h2 className="text-xs font-semibold text-muted-foreground mt-5 mb-2 px-1">Pengaturan</h2>
      <div className="surface overflow-hidden divide-y divide-border">
        <Row to="/pengaturan" icon={Settings} label="Pengaturan aplikasi" desc="Tampilan, mata uang, bank, cadangan data" />
        <Row to="/pengaturan" icon={Bell} label="Notifikasi" desc="Pemberitahuan dari pasangan & pengingat" />
        <Row to="/panduan" icon={BookOpen} label="Panduan" desc="Cara memakai setiap fitur" />
        <Row to="/umpan-balik" icon={MessageSquareHeart} label="Umpan balik" desc="Laporkan masalah atau usulkan fitur" />
      </div>

      <UserAuditLog userId={user?.id} />
    </div>
  );
}

function Row({ to, icon: Icon, label, desc }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-3.5 py-3 active:bg-muted transition-colors">
      <span className="w-10 h-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold leading-tight">{label}</span>
        <span className="block text-xs text-muted-foreground truncate">{desc}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </Link>
  );
}
