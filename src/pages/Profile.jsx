import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { ArrowLeft, Camera, Loader2, Check, User } from "lucide-react";
import { Image as SmartImage } from "@/components/ui/image";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

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
    </div>
  );
}