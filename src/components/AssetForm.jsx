import { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useRefresh } from "@/hooks/useFinance";
import { assetTypeLabels, formatRupiah } from "@/lib/finance";
import { Image as SmartImage } from "@/components/ui/image";
import { toast } from "sonner";
import { Loader2, X, Upload, Check, Trash2, Users, Lock } from "lucide-react";

const types = ["bank", "emas", "investasi", "properti", "tanah", "lainnya"];

const empty = {
  name: "", type: "bank", value: "", quantity: "", unit: "",
  purchase_date: "", purchase_price: "", purchase_proof_url: "",
  owner: "", notes: "", visibility: "shared",
};

export default function AssetForm({ asset, onClose }) {
  const refresh = useRefresh();
  const isEdit = !!asset;
  const [form, setForm] = useState(() =>
    asset
      ? {
          ...empty,
          ...asset,
          value: String(asset.value || ""),
          quantity: String(asset.quantity || ""),
          purchase_price: String(asset.purchase_price || ""),
        }
      : empty
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((f) => ({ ...f, purchase_proof_url: file_url }));
      toast.success("Bukti pembelian terunggah");
    } catch {
      toast.error("Gagal mengunggah bukti");
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.name) return toast.error("Isi nama aset");
    if (!form.value && form.type !== "emas") return toast.error("Isi nilai aset");
    if (form.type === "emas" && !form.quantity) return toast.error("Isi jumlah gram emas");
    if (form.type === "tanah" && !form.quantity) return toast.error("Isi luas tanah");
    if (form.type === "tanah" && !form.purchase_price) return toast.error("Isi harga beli per m²");
    setSaving(true);
    try {
      const value =
        form.type === "emas" && form.quantity && form.purchase_price
          ? Number(form.quantity) * Number(form.purchase_price)
          : Number(form.value);
      const payload = {
        name: form.name,
        type: form.type,
        value,
        quantity: form.quantity ? Number(form.quantity) : 0,
        unit: form.type === "emas" ? "gram" : form.type === "tanah" ? "m²" : form.unit,
        purchase_date: form.purchase_date || "",
        purchase_price: form.purchase_price ? Number(form.purchase_price) : 0,
        purchase_proof_url: form.purchase_proof_url || "",
        owner: form.owner,
        notes: form.notes,
        visibility: form.visibility,
      };
      if (isEdit) {
        await base44.entities.Asset.update(asset.id, payload);
        toast.success("Aset diperbarui");
      } else {
        await base44.entities.Asset.create(payload);
        toast.success("Aset ditambahkan");
      }
      refresh();
      onClose();
    } catch {
      toast.error(isEdit ? "Gagal memperbarui aset" : "Gagal menambah aset");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center max-w-md mx-auto">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-background rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto animate-in slide-in-from-bottom">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{isEdit ? "Edit Aset" : "Tambah Aset"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <Field label="Nama Aset">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mis. Tabungan BCA, Emas 10gr" className="input" />
          </Field>
          <Field label="Jenis">
            <div className="flex gap-2 flex-wrap">
              {types.map((t) => (
                <button key={t} onClick={() => setForm({ ...form, type: t, unit: t === "emas" ? "gram" : t === "tanah" ? "m²" : form.unit })} className={`px-3 py-1.5 rounded-full text-xs font-medium ${form.type === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {assetTypeLabels[t].label}
                </button>
              ))}
            </div>
          </Field>

          {form.type === "emas" ? (
            <>
              <Field label="Jumlah (gram)">
                <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="0" className="input" />
              </Field>
              <Field label="Harga Beli / gram (Rp)">
                <input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value, value: e.target.value && form.quantity ? String(Number(e.target.value) * Number(form.quantity)) : form.value })} placeholder="Mis. 1350000" className="input" />
              </Field>
            </>
          ) : form.type === "tanah" ? (
            <>
              <Field label="Luas Tanah (m²)">
                <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="Mis. 100" className="input" />
              </Field>
              <Field label="Harga Beli / m² (Rp)">
                <input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} placeholder="Mis. 500000" className="input" />
              </Field>
              {form.purchase_price && form.quantity ? (
                <p className="text-xs text-muted-foreground -mt-1">Total harga beli: <span className="font-medium text-foreground">{formatRupiah(Number(form.purchase_price) * Number(form.quantity))}</span></p>
              ) : null}
              <Field label="Perkiraan Harga Sekarang (Rp)">
                <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="0" className="input" />
              </Field>
            </>
          ) : (
            <Field label="Nilai Saat Ini (Rp)">
              <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="0" className="input" />
            </Field>
          )}

          <Field label="Tanggal Pembelian (opsional)">
            <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} className="input" />
          </Field>

          {form.type !== "emas" && form.type !== "tanah" && (
            <Field label="Harga Pembelian (Rp, opsional)">
              <input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} placeholder="0" className="input" />
            </Field>
          )}

          <Field label="Bukti Pembelian (opsional)">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            {form.purchase_proof_url ? (
              <div className="relative w-fit">
                <SmartImage src={form.purchase_proof_url} alt="Bukti pembelian" className="w-28 h-28 rounded-xl object-cover" fittingType="fill" />
                <button onClick={() => setForm({ ...form, purchase_proof_url: "" })} className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full rounded-2xl border-2 border-dashed border-border py-5 flex flex-col items-center gap-1.5 text-muted-foreground active:scale-[0.99] transition-transform disabled:opacity-60">
                {uploading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Upload className="w-6 h-6" />}
                <span className="text-xs">{uploading ? "Mengunggah..." : "Unggah foto bukti"}</span>
              </button>
            )}
          </Field>

          <Field label="Jangkauan">
            <div className="flex gap-2">
              <button onClick={() => setForm({ ...form, visibility: "shared" })} className={`flex-1 py-2 rounded-2xl border flex items-center justify-center gap-1.5 text-sm font-medium transition-all ${form.visibility !== "private" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>
                <Users className="w-4 h-4" /> Bersama
              </button>
              <button onClick={() => setForm({ ...form, visibility: "private" })} className={`flex-1 py-2 rounded-2xl border flex items-center justify-center gap-1.5 text-sm font-medium transition-all ${form.visibility === "private" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>
                <Lock className="w-4 h-4" /> Pribadi
              </button>
            </div>
          </Field>
          <Field label="Pemilik (opsional)">
            <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="Mis. Suami / Istri" className="input" />
          </Field>
          <Field label="Catatan (opsional)">
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" />
          </Field>
          <button onClick={handleSave} disabled={saving} className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Aset"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}