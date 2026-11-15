import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { ArrowRight, Camera, Loader2, Check, User, MessageSquareHeart, Hash, Copy, Heart } from "lucide-react";
import { Image as SmartImage } from "@/components/ui/image";
import PartnerManager from "@/components/PartnerManager";
import UserAuditLog from "@/components/UserAuditLog";
import { deriveRefCode } from "@/lib/refCode";
import PageHeader from "@/components/PageHeader";
import { FieldRow, fieldInput } from "@/components/FormSheet";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);

  const myCode = deriveRefCode(user?.id);

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

  useEffect(() => {
    base44.auth
      .me()
      .then((u) => {
        setUser(u);
        setName(u?.full_name || "");
        setPhotoUrl(u?.photo_url || "");
      })
      .catch(() => {});
  }, []);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrl(file_url);
    } catch {
      toast.error("Gagal mengunggah foto");
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Nama tidak boleh kosong");
    setSaving(true);
    try {
      await base44.auth.updateMe({ full_name: name.trim(), photo_url: photoUrl });
      toast.success("Profil diperbarui");
      navigate(-1);
    } catch (e) {
      toast.error("Gagal memperbarui profil", { description: e.message });
    }
    setSaving(false);
  };

  return (
    <div className="px-5 pt-6">
      <PageHeader title="Profil" back />

      <section aria-label="Foto & identitas" className="card-gradient-primary rounded-[28px] p-5 mb-5 flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label="Ganti foto profil"
          className="relative w-24 h-24 rounded-full overflow-hidden ring-4 ring-white/15 shrink-0 active:scale-95 transition-transform disabled:opacity-60"
        >
          {photoUrl ? (
            <SmartImage src={photoUrl} alt="foto profil" className="w-full h-full" fittingType="fill" />
          ) : (
            <div className="w-full h-full bg-white/10 flex items-center justify-center">
              {uploading ? <Loader2 className="w-8 h-8 animate-spin opacity-80" /> : <User className="w-10 h-10 opacity-80" />}
            </div>
          )}
          <div className="absolute bottom-0 inset-x-0 bg-gold text-gold-foreground text-[11px] font-semibold py-1 flex items-center justify-center gap-1">
            <Camera className="w-3 h-3" /> Ganti
          </div>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        <div className="min-w-0">
          <p className="text-xs opacity-75">Akun Anda</p>
          <p className="font-heading text-2xl font-extrabold leading-tight tracking-tight truncate">{name || user?.full_name || "Tanpa nama"}</p>
          <p className="text-xs opacity-75 truncate mt-0.5">{user?.email}</p>
        </div>
      </section>

      <section aria-label="Data profil" className="surface rounded-3xl divide-y divide-border mb-4">
        <FieldRow icon={User} label="Nama" htmlFor="profile-name">
          <input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama lengkap"
            className={fieldInput}
          />
        </FieldRow>
      </section>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full btn-primary"
      >
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Simpan Profil
      </button>

      <section aria-labelledby="profile-ref-code" className="surface rounded-3xl p-4 mt-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-9 h-9 rounded-full bg-gold text-gold-foreground flex items-center justify-center shrink-0"><Hash className="w-4 h-4" /></span>
          <h2 id="profile-ref-code" className="font-semibold text-[17px] leading-tight">Kode referensi pasangan</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3 leading-snug">
          Bagikan kode ini ke pasangan. Pasangan memasukkannya di{" "}
          <span className="font-medium">Pengaturan → Undang Pasangan → Via Kode Referensi</span>{" "}
          untuk menghubungkan akun keduanya.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-2xl bg-muted px-4 py-3 text-center font-mono text-lg font-bold tracking-[0.15em]">
            {myCode || "—"}
          </div>
          <button
            onClick={copyCode}
            className="btn-primary"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Tersalin" : "Salin"}
          </button>
        </div>
      </section>

      <button
        onClick={() => navigate("/umpan-balik")}
        className="w-full mt-4 card-pastel card-pastel-sage rounded-3xl p-4 flex items-center gap-3 active:scale-[0.99] transition-transform text-left"
      >
        <div className="w-10 h-10 rounded-full bg-white/60 dark:bg-white/10 flex items-center justify-center shrink-0">
          <MessageSquareHeart className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Kirim Umpan Balik</p>
          <p className="text-xs opacity-75 mt-0.5">Laporan error, ide fitur, atau saran untuk pengembang</p>
        </div>
        <ArrowRight className="w-4 h-4 opacity-70" />
      </button>

      <div className="mt-6">
        <div className="mb-2.5">
          <h2 className="font-semibold text-[17px] leading-tight flex items-center gap-2"><Heart className="w-4 h-4 text-destructive" /> Keluarga terkoneksi</h2>
          <p className="text-xs text-muted-foreground">Akun yang berbagi catatan dengan Anda</p>
        </div>
        <PartnerManager />
      </div>

      <UserAuditLog userId={user?.id} />
    </div>
  );
}