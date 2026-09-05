import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCategories, useRefresh, useTemplates, useTransactions } from "@/hooks/useFinance";
import { colorMap, formatRupiah, formatMoney, formatDate, currencies, currencySymbol } from "@/lib/finance";
import { findDuplicate, dedupeBatch, filterAgainstExisting } from "@/lib/duplicateDetect";
import { ensureCategories } from "@/lib/categoryAuto";
import CategoryIcon from "@/components/CategoryIcon";
import TagInput from "@/components/TagInput";
import { toast } from "sonner";
import { addPending } from "@/lib/offlineQueue";
import { scanReceipt } from "@/lib/scanReceipt";
import MultiTransactionPreview from "@/components/MultiTransactionPreview";
import { ArrowLeft, ScanLine, Loader2, Check, X, Users, Lock } from "lucide-react";

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
  const { data: transactions = [] } = useTransactions();
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
  const [photoUrls, setPhotoUrls] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState([]);
  const [visibility, setVisibility] = useState("shared");
  const [currency, setCurrency] = useState("IDR");
  const [multiTx, setMultiTx] = useState(null);
  const [savingMulti, setSavingMulti] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      if (u?.default_currency) setCurrency(u.default_currency);
    }).catch(() => {});
  }, []);

  const availableCategories = categories.filter((c) => c.type === type);

  const applyTemplate = (t) => {
    setType(t.type);
    setAmount(String(t.amount));
    setCategory(t.category || "");
    setMerchant(t.merchant || "");
    setNotes(t.notes || "");
    setCurrency(t.currency || "IDR");
    setVisibility(t.visibility || "shared");
    setSaveAsTemplate(false);
    toast.success(`Template "${t.name}" dimuat`, { description: "Periksa tanggal lalu simpan." });
  };

  const handleScan = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    if (!files.length) return;
    if (fileRef.current) fileRef.current.value = "";
    setScanning(true);
    try {
      const urls = [];
      const allTx = [];
      for (let i = 0; i < files.length; i++) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: files[i] });
        urls.push(file_url);
        setPhotoUrls([...urls]);
        setPhotoUrl(file_url);
        const { transactions } = await scanReceipt(file_url, categories);
        (transactions || []).forEach((t) => allTx.push({ ...t, photo_url: file_url }));
      }
      if (!allTx.length) {
        toast.error("Tidak ada transaksi terbaca", { description: "Silakan isi manual." });
        setScanning(false);
        return;
      }
      if (allTx.length === 1) {
        const p = allTx[0];
        if (p.photo_url) { setPhotoUrl(p.photo_url); setPhotoUrls([p.photo_url]); }
        if (p.amount) setAmount(String(p.amount));
        if (p.merchant && type !== "income") setMerchant(p.merchant);
        if (p.category && type === "expense") setCategory(p.category);
        if (p.notes) setNotes(p.notes);
        if (p.date) {
          const now = new Date();
          let d;
          if (p.time) {
            d = new Date(`${p.date}T${p.time}`);
          } else {
            d = new Date(p.date);
            if (!isNaN(d)) d.setHours(now.getHours(), now.getMinutes(), 0, 0);
          }
          if (!isNaN(d)) {
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            setDate(d.toISOString().slice(0, 16));
          }
        }
        if (p.category && p.category_new && type === "expense") {
          await ensureCategories([{ name: p.category, icon: p.category_icon, color: p.category_color }], categories, "expense");
          refresh();
        }
        toast.success("Bon berhasil dibaca!", { description: p.category && type === "expense" ? `Kategori: ${p.category}${p.category_new ? " (kategori baru)" : ""}` : "Periksa dan lengkapi data." });
      } else {
        setMultiTx(allTx);
        toast.success(`${allTx.length} transaksi terbaca dari ${urls.length} foto`, { description: "Periksa kategori lalu simpan semua." });
      }
    } catch (err) {
      toast.error("Gagal membaca bon", { description: err?.message || "Silakan isi manual." });
    }
    setScanning(false);
  };

  const updateMulti = (i, patch) => {
    setMultiTx((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  };

  const handleSaveAll = async () => {
    if (!multiTx || !multiTx.length) return;
    setSavingMulti(true);
    try {
      const proposals = multiTx.filter((t) => t.category).map((t) => ({ name: t.category, icon: t.category_icon, color: t.category_color }));
      await ensureCategories(proposals, categories, "expense");
      const now = new Date();
      const records = multiTx.map((t) => ({
        type: "expense",
        amount: t.amount,
        currency: t.currency || currency,
        category: t.category || "Lainnya",
        date: (() => {
          if (!t.date) return now.toISOString();
          const d = t.time ? new Date(`${t.date}T${t.time}`) : new Date(t.date);
          if (isNaN(d)) return now.toISOString();
          if (!t.time) d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
          return d.toISOString();
        })(),
        merchant: t.merchant || "",
        notes: t.notes || "",
        photo_url: t.photo_url || photoUrl || "",
        input_by_name: user?.full_name || user?.email || "Keluarga",
        tags: [],
        visibility,
      }));
      const unique = dedupeBatch(records);
      const { toSave, skipped } = filterAgainstExisting(unique, transactions);
      if (!toSave.length) {
        toast.error("Semua transaksi duplikat", { description: "Tidak ada transaksi baru untuk disimpan." });
        setSavingMulti(false);
        return;
      }
      await base44.entities.Transaction.bulkCreate(toSave);
      refresh();
      toast.success(`${toSave.length} transaksi tersimpan!`, skipped.length ? { description: `${skipped.length} transaksi duplikat dilewati.` } : undefined);
      navigate("/");
    } catch (err) {
      toast.error("Gagal menyimpan transaksi");
    }
    setSavingMulti(false);
  };

  const performSave = async () => {
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
        currency,
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
        currency,
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
            currency,
            category: type === "sedekah" ? "Sedekah & Infaq" : category,
            merchant: merchant || "",
            notes: notes || "",
            visibility,
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

  const handleSave = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Masukkan nominal terlebih dahulu");
    if (type !== "sedekah" && !category) return toast.error("Pilih kategori");
    const dup = findDuplicate(
      { type, amount: amt, currency, date: new Date(date).toISOString(), merchant, visibility },
      transactions
    );
    if (dup) {
      toast("Transaksi serupa sudah tercatat", {
        description: `${dup.merchant || dup.category || "Transaksi"} • ${formatRupiah(dup.amount)} • ${formatDate(dup.date, "dd MMM yyyy, HH:mm")}`,
        action: { label: "Tetap Simpan", onClick: performSave },
      });
      return;
    }
    performSave();
  };

  if (multiTx) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <button onClick={() => setMultiTx(null)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold">Pratinjau Transaksi</h1>
          <div className="w-9" />
        </header>
        <MultiTransactionPreview
          items={multiTx}
          categories={categories}
          onChange={updateMulti}
          onCancel={() => setMultiTx(null)}
          onSave={handleSaveAll}
          saving={savingMulti}
        />
      </div>
    );
  }

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
                if (t.key === "income") setMerchant("");
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

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Mata Uang</label>
          <div className="flex gap-2">
            {currencies.map((c) => (
              <button
                key={c.code}
                onClick={() => setCurrency(c.code)}
                className={`flex-1 py-2 rounded-2xl border text-sm font-medium transition-all ${
                  currency === c.code ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"
                }`}
              >
                {c.code}
              </button>
            ))}
          </div>
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
                      <p className="text-[10px] text-muted-foreground">{formatMoney(t.amount, t.currency)}</p>
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
                <p className="text-xs">{photoUrls.length || 1} foto sedang diproses</p>
              </>
            ) : photoUrls.length > 0 ? (
              <>
                <div className="flex gap-2 flex-wrap justify-center max-w-full">
                  {photoUrls.map((u, i) => (
                    <img key={i} src={u} alt={`bon ${i + 1}`} className="w-16 h-16 object-cover rounded-xl" />
                  ))}
                </div>
                <p className="text-xs flex items-center gap-1 text-emerald-600"><Check className="w-3.5 h-3.5" /> {photoUrls.length} bon terunggah</p>
              </>
            ) : (
              <>
                <ScanLine className="w-7 h-7" />
                <p className="text-sm font-medium">Scan Bon / Upload Foto</p>
                <p className="text-xs">Bisa pilih beberapa foto sekaligus (maks. 5)</p>
              </>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleScan} />
          {photoUrls.length > 0 && !scanning && (
            <button onClick={() => { setPhotoUrl(""); setPhotoUrls([]); if (fileRef.current) fileRef.current.value = ""; }} className="mt-2 text-xs text-red-500 flex items-center gap-1">
              <X className="w-3 h-3" /> Hapus semua foto
            </button>
          )}
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Nominal</label>
          <div className="flex items-center rounded-2xl border border-border px-4 focus-within:ring-2 ring-primary/30">
            <span className="text-lg text-muted-foreground mr-1">{currencySymbol(currency)}</span>
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

        {type !== "income" && (
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">{type === "sedekah" ? "Penerima / Tujuan" : "Merchant / Tempat"}</label>
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder={type === "sedekah" ? "Mis. Masjid, Yatim..." : "Mis. Indomaret, Toko A..."}
              className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30"
            />
          </div>
        )}

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