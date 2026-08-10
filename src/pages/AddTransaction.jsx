import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCategories, useRefresh, useTemplates } from "@/hooks/useFinance";
import { colorMap, formatRupiah } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import TagInput from "@/components/TagInput";
import { toast } from "sonner";
import { addPending } from "@/lib/offlineQueue";
import { scanReceipt } from "@/lib/scanReceipt";
import { ArrowLeft, Camera, ScanLine, Loader2, Check, X, Users, Lock } from "lucide-react";

const typeTabs = [
  { key: "expense", label: "Pengeluaran" },
  { key: "income", label: "Pemasukan" },
  { key: "sedekah", label: "Sedekah" },
];

export default function AddTransaction() {
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data: categories = [] } = useCategories();
  const { data: templates = [] } = useTemplates();
  const [user, setUser] = useState(null);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState([]);
  const [visibility, setVisibility] = useState("shared");
  const fileRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const availableCategories = categories.filter((c) => c.type === type);

  const applyTemplate = (t) => {
    setType(t.type);
    setAmount(String(t.amount));
    setCategory(t.category || "");
    setMerchant(t.merchant || "");
    setNotes(t.notes || "");
    setSaveAsTemplate(false);
    toast.success(`Template "${t.name}" dimuat`, { description: "Periksa tanggal lalu simpan." });
  };

  const handleScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrl(file_url);
      const parsed = await scanReceipt(file_url, categories);
      if (parsed.amount) setAmount(String(parsed.amount));
      if (parsed.merchant) setMerchant(parsed.merchant);
      if (parsed.category) setCategory(parsed.category);
      if (parsed.notes) setNotes(parsed.notes);
      if (parsed.date) {
        const d = new Date(parsed.date);
        if (!isNaN(d)) {
          d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
          setDate(d.toISOString().slice(0, 16));
        }
      }
      setType("expense");
      toast.success("Bon berhasil dibaca!", { description: parsed.category ? `Kategori: ${parsed.category}` : "Periksa dan lengkapi data." });
    } catch (err) {
      toast.error("Gagal membaca bon", { description: "Silakan isi manual." });
    }
    setScanning(false);
  };

  const handleSave = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Masukkan nominal terlebih dahulu");
      return;
    }
    if (type !== "sedekah" && !category) {
      toast.error("Pilih kategori");
      return;
    }
    setSaving(true);
    if (!navigator.onLine) {
      addPending({
        type,
        amount: amt,
        category: type === "sedekah" ? "Sedekah & Infaq" : category,
        date: new Date(date).toISOString(),
        merchant: merchant || "",
        notes: notes || "",
        photo_url: photoUrl || "",
        input_by_name: user?.full_name || user?.email || "Keluarga",
        tags,
        visibility,
      });
      toast.success("Tersimpan offline", { description: "Akan otomatis disinkron saat koneksi kembali." });
      navigate("/");
      setSaving(false);
      return;
    }
    try {
      await base44.entities.Transaction.create({
        type,
        amount: amt,
        category: type === "sedekah" ? "Sedekah & Infaq" : category,
        date: new Date(date).toISOString(),
        merchant: merchant || "",
        notes: notes || "",
        photo_url: photoUrl || "",
        input_by_name: user?.full_name || user?.email || "Keluarga",
        tags,
        visibility,
      });
      if (saveAsTemplate) {
        try {
          await base44.entities.TransactionTemplate.create({
            name: merchant || category || "Template",
            type,
            amount: amt,
            category: type === "sedekah" ? "Sedekah & Infaq" : category,
            merchant: merchant || "",
            notes: notes || "",
          });
        } catch {}
      }
      refresh();
      toast.success("Transaksi tersimpan!");
      navigate("/");
    } catch (err) {
      toast.error("Gagal menyimpan transaksi");
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-5 py-4 border-b border-border">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold">Catat Transaksi</h1>
        <div className="w-9" />
      </header>

      <div className="flex-1 px-5 py-5 space-y-5 overflow-y-auto">
        <div className="flex gap-2 bg-muted p-1 rounded-2xl">
          {typeTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setType(t.key);
                setCategory("");
              }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                type === t.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Jangkauan</label>
          <div className="flex gap-2">
            <button
              onClick={() => setVisibility("shared")}
              className={`flex-1 py-2.5 rounded-2xl border flex items-center justify-center gap-1.5 text-sm font-medium transition-all ${
                visibility === "shared" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"
              }`}
            >
              <Users className="w-4 h-4" /> Bersama Keluarga
            </button>
            <button
              onClick={() => setVisibility("private")}
              className={`flex-1 py-2.5 rounded-2xl border flex items-center justify-center gap-1.5 text-sm font-medium transition-all ${
                visibility === "private" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"
              }`}
            >
              <Lock className="w-4 h-4" /> Pribadi
            </button>
          </div>
          {visibility === "private" && (
            <p className="text-[10px] text-muted-foreground mt-1.5">Hanya Anda yang dapat melihat transaksi ini.</p>
          )}
        </div>

        {templates.length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Template Rutin</label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
              {templates.map((t) => {
                const cat = categories.find((c) => c.name === t.category);
                const cm = colorMap[cat?.color] || colorMap.slate;
                const icon = t.type === "sedekah" ? "Heart" : cat?.icon || "Wallet";
                return (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className="shrink-0 flex items-center gap-2 rounded-2xl border border-border bg-card pl-2 pr-3 py-2 active:scale-95 transition-transform"
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${cm.bg}`}>
                      <CategoryIcon name={icon} className={`w-4 h-4 ${cm.text}`} />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-medium leading-tight">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatRupiah(t.amount)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={scanning}
            className="w-full rounded-2xl border-2 border-dashed border-border py-6 flex flex-col items-center gap-2 text-muted-foreground active:scale-[0.99] transition-transform disabled:opacity-60"
          >
            {scanning ? (
              <>
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
                <p className="text-sm font-medium text-primary">AI sedang membaca bon...</p>
              </>
            ) : photoUrl ? (
              <>
                <img src={photoUrl} alt="bon" className="max-h-32 rounded-xl" />
                <p className="text-xs flex items-center gap-1 text-emerald-600"><Check className="w-3.5 h-3.5" /> Bon terunggah</p>
              </>
            ) : (
              <>
                <ScanLine className="w-7 h-7" />
                <p className="text-sm font-medium">Scan Bon / Upload Foto</p>
                <p className="text-xs">AI akan otomatis membaca nominal & kategori</p>
              </>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleScan} />
          {photoUrl && !scanning && (
            <button onClick={() => setPhotoUrl("")} className="mt-2 text-xs text-red-500 flex items-center gap-1">
              <X className="w-3 h-3" /> Hapus foto
            </button>
          )}
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Nominal</label>
          <div className="flex items-center rounded-2xl border border-border px-4 focus-within:ring-2 ring-primary/30">
            <span className="text-lg text-muted-foreground mr-1">Rp</span>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="flex-1 py-3 text-2xl font-bold outline-none bg-transparent"
            />
          </div>
        </div>

        {type !== "sedekah" && (
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Kategori</label>
            <div className="grid grid-cols-4 gap-2">
              {availableCategories.map((c) => {
                const cm = colorMap[c.color] || colorMap.slate;
                const selected = category === c.name;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.name)}
                    className={`flex flex-col items-center gap-1.5 py-2.5 rounded-2xl border transition-all ${
                      selected ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cm.bg}`}>
                      <CategoryIcon name={c.icon} className={`w-4 h-4 ${cm.text}`} />
                    </div>
                    <span className="text-[10px] leading-tight text-center">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Tanggal & Jam</label>
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">{type === "sedekah" ? "Penerima / Tujuan" : "Merchant / Tempat"}</label>
          <input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder={type === "sedekah" ? "Mis. Masjid, Yatim..." : "Mis. Indomaret, Toko A..."}
            className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Catatan</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Tambah catatan..."
            className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30 resize-none"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Tag</label>
          <TagInput tags={tags} onChange={setTags} />
        </div>
      </div>

      <div className="px-5 py-4 border-t border-border bg-background">
        <label className="flex items-center gap-2 mb-3 cursor-pointer">
          <input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} className="w-4 h-4 accent-primary" />
          <span className="text-xs text-muted-foreground">Simpan sebagai template rutin</span>
        </label>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {saving ? "Menyimpan..." : "Simpan Transaksi"}
        </button>
      </div>
    </div>
  );
}