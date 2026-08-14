import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { ArrowLeft, Camera, Loader2, Check, User, MessageSquareHeart, Hash, Copy } from "lucide-react";
import { Image as SmartImage } from "@/components/ui/image";
import FamilyMembers from "@/components/FamilyMembers";
import { deriveRefCode } from "@/lib/refCode";

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
    <div className="px-5 pt-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold">Profil</h1>
      </div>

      <div className="flex flex-col items-center mb-6">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-border active:scale-95 transition-transform disabled:opacity-60"
        >
          {photoUrl ? (
            <SmartImage src={photoUrl} alt="foto profil" className="w-full h-full" fittingType="fill" />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              {uploading ? <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /> : <User className="w-10 h-10 text-muted-foreground" />}
            </div>
          )}
          <div className="absolute bottom-0 inset-x-0 bg-primary/80 text-primary-foreground text-[10px] py-1 flex items-center justify-center gap-1">
            <Camera className="w-3 h-3" /> Ganti
          </div>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        <p className="text-xs text-muted-foreground mt-2">{user?.email}</p>
      </div>

      <div className="mb-5">
        <label className="text-xs text-muted-foreground mb-1.5 block">Nama</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama lengkap"
          className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Simpan Profil
      </button>

      <div className="rounded-2xl border border-border bg-card p-4 mt-5">
        <div className="flex items-center gap-2 mb-1">
          <Hash className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">Kode Referensi Pasangan</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Bagikan kode ini ke pasangan. Pasangan memasukkannya di{" "}
          <span className="font-medium">Pengaturan → Undang Pasangan → Via Kode Referensi</span>{" "}
          untuk menghubungkan akun keduanya.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-xl bg-muted px-4 py-3 text-center font-mono text-lg font-bold tracking-[0.15em]">
            {myCode || "—"}
          </div>
          <button
            onClick={copyCode}
            className="px-4 py-3 rounded-xl bg-primary text-primary-foreground flex items-center gap-1.5 text-sm font-medium active:scale-95 transition-transform"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Tersalin" : "Salin"}
          </button>
        </div>
      </div>

      <button
        onClick={() => navigate("/umpan-balik")}
        className="w-full mt-5 rounded-2xl border border-border bg-card p-4 flex items-center gap-3 active:scale-[0.99] transition-transform text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <MessageSquareHeart className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Kirim Umpan Balik</p>
          <p className="text-xs text-muted-foreground mt-0.5">Laporan error, ide fitur, atau saran untuk pengembang</p>
        </div>
        <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
      </button>

      <FamilyMembers />
    </div>
  );
}