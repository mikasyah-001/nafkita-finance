import { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useRefresh, useMe, useUserCurrencies } from "@/hooks/useFinance";
import { assetTypeLabels, formatRupiah, currencySymbol, isGoldType } from "@/lib/finance";
import { Image as SmartImage } from "@/components/ui/image";
import { toast } from "sonner";
import { Loader2, Upload, Check, Trash2, Users, Lock, Tag, Building2, UserRound, CalendarDays, Receipt, Image as ImageIcon, NotebookPen } from "lucide-react";
import FormSheet, { FieldGroup, FieldRow, ChipChoice, fieldInput } from "@/components/FormSheet";
import CategoryIcon from "@/components/CategoryIcon";

const types = ["bank", "tunai", "emas", "emas_digital", "investasi", "properti", "tanah", "lainnya"];

const digitalGoldBrokers = {
  SAR: ["Bank Al Rajhi", "Bank Aljazira", "SNB"],
  IDR: ["Bank BSI", "BCA", "Pegadaian"],
  USD: ["BullionStar", "Goldmoney"],
};

const empty = {
  name: "", type: "bank", value: "", quantity: "", unit: "", broker: "",
  purchase_date: "", purchase_price: "", purchase_proof_url: "",
  owner: "", notes: "", visibility: "shared", currency: "IDR",
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
  const { data: me } = useMe();
  const userCurrencies = useUserCurrencies();
  useEffect(() => {
    if (!isEdit && me?.default_currency) setForm((f) => (f.currency ? f : { ...f, currency: me.default_currency }));
  }, [me, isEdit]);
  const sym = currencySymbol(form.currency);

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
    if (!form.value && !isGoldType(form.type)) return toast.error("Isi nilai aset");
    if (isGoldType(form.type) && !form.quantity) return toast.error("Isi jumlah gram emas");
    if (form.type === "tanah" && !form.quantity) return toast.error("Isi luas tanah");
    if (form.type === "tanah" && !form.purchase_price) return toast.error("Isi harga beli per m²");
    setSaving(true);
    try {
      const value =
        isGoldType(form.type) && form.quantity && form.purchase_price
          ? Number(form.quantity) * Number(form.purchase_price)
          : Number(form.value);
      const payload = {
        name: form.name,
        type: form.type,
        value,
        quantity: form.quantity ? Number(form.quantity) : 0,
        unit: isGoldType(form.type) ? "gram" : form.type === "tanah" ? "m²" : form.unit,
        purchase_date: form.purchase_date || "",
        purchase_price: form.purchase_price ? Number(form.purchase_price) : 0,
        purchase_proof_url: form.purchase_proof_url || "",
        owner: form.owner,
        notes: form.notes,
        broker: form.broker || "",
        currency: form.currency || "IDR",
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

  const showCurrency = (!isGoldType(form.type) && form.type !== "tanah") || form.type === "emas_digital";
  const brokerSuggestions = form.type === "bank" ? ["BCA", "Mandiri", "BSI", "BNI", "BRI"] : form.type === "emas_digital" ? (digitalGoldBrokers[form.currency] || []) : [];
  const brokerLabel = form.type === "bank" ? "Bank / tempat simpan" : form.type === "investasi" ? "Broker / aplikasi" : "Tempat beli / simpan";
  const showBroker = ["bank", "investasi", "emas_digital"].includes(form.type);
  const goldTotal = isGoldType(form.type) && form.quantity && form.purchase_price ? Number(form.quantity) * Number(form.purchase_price) : 0;

  return (
    <FormSheet
      title={isEdit ? "Edit aset" : "Tambah aset"}
      subtitle="Catat tabungan, dompet tunai, emas, investasi, dan properti keluarga."
      onClose={onClose}
      footer={
        <button onClick={handleSave} disabled={saving} className="w-full btn-primary">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {saving ? "Menyimpan..." : isEdit ? "Simpan perubahan" : "Simpan aset"}
        </button>
      }
    >
      {/* Jenis */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Jenis aset</p>
        <div role="radiogroup" aria-label="Jenis aset" className="grid grid-cols-4 gap-2">
          {types.map((t) => {
            const meta = assetTypeLabels[t];
            const on = form.type === t;
            return (
              <button key={t} type="button" role="radio" aria-checked={on}
                onClick={() => setForm({ ...form, type: t, unit: isGoldType(t) ? "gram" : t === "tanah" ? "m²" : form.unit })}
                className={`flex flex-col items-center gap-1.5 pt-2.5 pb-2 rounded-2xl border transition-all ${on ? "border-primary bg-primary/[0.07] ring-1 ring-primary" : "border-border bg-card"}`}>
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <CategoryIcon name={meta.icon} className="w-4 h-4" />
                </span>
                <span className={`text-[11px] leading-tight text-center px-0.5 ${on ? "font-semibold" : ""}`}>{meta.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <FieldGroup label="Identitas">
        <FieldRow icon={Tag} label="Nama aset" htmlFor="asset-name">
          <input id="asset-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.type === "tunai" ? "Mis. Dompet tunai, Riyal umrah" : "Mis. Tabungan BCA, Emas Antam"} className={fieldInput} />
        </FieldRow>
        {showBroker && (
          <FieldRow icon={Building2} label={brokerLabel} htmlFor="asset-broker">
            <input id="asset-broker" value={form.broker} onChange={(e) => setForm({ ...form, broker: e.target.value })} placeholder="Opsional" className={fieldInput} />
            {brokerSuggestions.length > 0 && (
              <div className="mt-2"><ChipChoice size="sm" ariaLabel="Saran" options={brokerSuggestions} value={form.broker} onChange={(b) => setForm({ ...form, broker: b })} /></div>
            )}
          </FieldRow>
        )}
        <FieldRow icon={UserRound} label="Pemilik (opsional)" htmlFor="asset-owner">
          <input id="asset-owner" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="Mis. Suami / Istri" className={fieldInput} />
        </FieldRow>
      </FieldGroup>

      {/* Nilai */}
      <section className="card-gradient-primary rounded-[24px] p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs opacity-80">
            {isGoldType(form.type) ? "Jumlah & harga emas" : form.type === "tanah" ? "Luas & harga tanah" : "Nilai saat ini"}
          </p>
          {showCurrency && userCurrencies.length > 1 && (
            <div role="radiogroup" aria-label="Mata uang" className="flex gap-1">
              {userCurrencies.map((c) => (
                <button key={c.code} type="button" role="radio" aria-checked={form.currency === c.code} onClick={() => setForm({ ...form, currency: c.code })}
                  className={`h-7 px-2.5 rounded-full text-[11px] font-bold border transition-colors ${form.currency === c.code ? "bg-white text-[hsl(var(--hero-from))] border-white" : "border-white/25 text-white/75"}`}>{c.code}</button>
              ))}
            </div>
          )}
        </div>
        {isGoldType(form.type) || form.type === "tanah" ? (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <HeroInput id={isGoldType(form.type) ? "asset-gold-quantity" : "asset-land-quantity"} label={isGoldType(form.type) ? "Gram" : "Luas (m²)"} value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} />
            <HeroInput id={isGoldType(form.type) ? "asset-gold-purchase-price" : "asset-land-purchase-price"} label={`Harga beli / ${isGoldType(form.type) ? "gr" : "m²"} (${isGoldType(form.type) && form.type === "emas_digital" ? sym : "Rp"})`}
              value={form.purchase_price}
              onChange={(v) => setForm({ ...form, purchase_price: v, value: isGoldType(form.type) && v && form.quantity ? String(Number(v) * Number(form.quantity)) : form.value })} />
            {form.type === "tanah" && (
              <div className="col-span-2"><HeroInput id="asset-land-value" label="Perkiraan harga sekarang (Rp)" value={form.value} onChange={(v) => setForm({ ...form, value: v })} /></div>
            )}
          </div>
        ) : (
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-lg font-semibold opacity-70">{sym}</span>
            <input id="asset-value" aria-label={`Nilai saat ini (${sym})`} type="number" inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="0"
              className="flex-1 min-w-0 bg-transparent outline-none font-heading text-[32px] leading-none font-extrabold tabular-nums placeholder:text-white/30 text-[hsl(var(--hero-foreground))]" />
          </div>
        )}
        {(goldTotal > 0 || (form.type === "tanah" && form.quantity && form.purchase_price)) && (
          <p className="text-xs opacity-80 mt-2">Total harga beli: <span className="font-semibold">{formatRupiah(goldTotal || Number(form.purchase_price) * Number(form.quantity))}</span></p>
        )}
      </section>

      <FieldGroup label="Pembelian (opsional)">
        <FieldRow icon={CalendarDays} label="Tanggal beli" htmlFor="asset-purchase-date">
          <input id="asset-purchase-date" type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} className={fieldInput} />
        </FieldRow>
        {!isGoldType(form.type) && form.type !== "tanah" && (
          <FieldRow icon={Receipt} label={`Harga beli (${sym})`} htmlFor="asset-purchase-price" hint="Untuk menghitung pertumbuhan nilai aset.">
            <input id="asset-purchase-price" type="number" inputMode="decimal" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} placeholder="0" className={`${fieldInput} tabular-nums`} />
          </FieldRow>
        )}
        <FieldRow icon={ImageIcon} label="Bukti pembelian">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          {form.purchase_proof_url ? (
            <div className="relative w-fit mt-1">
              <SmartImage src={form.purchase_proof_url} alt="Bukti pembelian" className="w-24 h-24 rounded-xl object-cover" fittingType="fill" />
              <button onClick={() => setForm({ ...form, purchase_proof_url: "" })} aria-label="Hapus bukti" className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-1 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-dashed border-border text-xs font-semibold text-muted-foreground disabled:opacity-60">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {uploading ? "Mengunggah..." : "Unggah foto"}
            </button>
          )}
        </FieldRow>
      </FieldGroup>

      <FieldGroup label="Lainnya">
        <FieldRow icon={form.visibility === "private" ? Lock : Users} label="Jangkauan"
          trailing={
            <div role="radiogroup" aria-label="Jangkauan" className="flex gap-1 p-0.5 rounded-full bg-muted shrink-0 self-center">
              {[["shared", "Bersama"], ["private", "Pribadi"]].map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={(form.visibility || "shared") === v} onClick={() => setForm({ ...form, visibility: v })}
                  className={`h-7 px-3 rounded-full text-xs font-semibold transition-colors ${(form.visibility || "shared") === v ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>{l}</button>
              ))}
            </div>
          }>
          <p className="text-sm">{form.visibility === "private" ? "Hanya Anda" : "Terlihat pasangan"}</p>
        </FieldRow>
        <FieldRow icon={NotebookPen} label="Catatan" htmlFor="asset-notes">
          <input id="asset-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opsional" className={fieldInput} />
        </FieldRow>
      </FieldGroup>
    </FormSheet>
  );
}

function HeroInput({ id, label, value, onChange }) {
  return (
    <div className="rounded-2xl bg-white/[0.08] border border-white/10 px-3 py-2">
      <label htmlFor={id} className="block text-[11px] opacity-75">{label}</label>
      <input id={id} type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0"
        className="w-full bg-transparent outline-none text-lg font-bold tabular-nums placeholder:text-white/30 text-[hsl(var(--hero-foreground))]" />
    </div>
  );
}
