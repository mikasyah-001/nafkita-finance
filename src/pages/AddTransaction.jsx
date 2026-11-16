import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCategories, useRefresh, useTemplates, useTransactions, useAssets, useUserCurrencies, useRateMap, useMe } from "@/hooks/useFinance";
import { colorMap, formatMoney, formatDate, currencySymbol, isMoneyAsset, EXTRAORDINARY_TAG, formatMoneyPlain, conversionPreview, amountCurrencyHint } from "@/lib/finance";
import { assetLabel } from "@/lib/bankAccount";
import { findDuplicate, dedupeBatch, filterAgainstExisting } from "@/lib/duplicateDetect";
import { ensureCategories } from "@/lib/categoryAuto";
import CategoryIcon from "@/components/CategoryIcon";
import TagInput from "@/components/TagInput";
import { toast } from "sonner";
import { addPending } from "@/lib/offlineQueue";
import { saveTransactionWithAsset, deleteTransactionWithAsset } from "@/lib/linkedAsset";
import { confirmAction } from "@/components/ConfirmHost";
import { scanReceipt } from "@/lib/scanReceipt";
import MultiTransactionPreview from "@/components/MultiTransactionPreview";
import { convertedFromLabel } from "@/components/CurrencySwitchNotice";
import { useCurrencySwitch } from "@/hooks/useCurrencySwitch";
import { ArrowLeft, ScanLine, Loader2, Check, X, Users, Lock, CalendarDays, Store, Wallet, NotebookPen, Sparkles, ChevronDown, Trash2, AlertCircle } from "lucide-react";

const typeTabs = [
  { key: "expense", label: "Pengeluaran" },
  { key: "income", label: "Pemasukan" },
  { key: "sedekah", label: "Sedekah" },
];

export default function AddTransaction() {
  const navigate = useNavigate();
  const refresh = useRefresh();
  // Mode edit (/transaksi/:id/edit): layar & logika yang sama dengan catat baru,
  // sehingga tampilan, validasi, dan sinkron saldo aset tidak bercabang.
  const { id: editId } = useParams();
  const isEdit = !!editId;
  const { data: categories = [] } = useCategories();
  const { data: templates = [] } = useTemplates();
  const { data: transactions = [], isLoading: txLoading } = useTransactions();
  const editTx = isEdit ? transactions.find((t) => t.id === editId) : null;
  const [editLoaded, setEditLoaded] = useState(false);
  const { data: assets = [] } = useAssets();
  // Profil dari cache login (useMe) — tidak mengambil ulang, tidak berkedip.
  const { data: user = null } = useMe();
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [type, setType] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("type");
    return ["expense", "income", "sedekah"].includes(t) ? t : "expense";
  });
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
  const [currency, setCurrency] = useState(() => (!isEdit && user?.default_currency) || "IDR");
  const [linkedAssetId, setLinkedAssetId] = useState(() => new URLSearchParams(window.location.search).get("asset") || "");
  const userCurrencies = useUserCurrencies();
  const { map: rateMap } = useRateMap();
  // Ganti mata uang setelah nominal terisi → tawarkan konversi, bukan ganti label diam-diam.
  const curGuard = useCurrencySwitch({
    currency, amounts: { amount }, rateMap,
    setCurrency: (c) => { setCurrency(c); setLinkedAssetId(""); },
    setAmounts: (a) => setAmount(a.amount),
  });
  const [multiTx, setMultiTx] = useState(null);
  const [savingMulti, setSavingMulti] = useState(false);
  const fileRef = useRef(null);
  const scanBtnRef = useRef(null);
  // Dibuka dari aksi "Scan struk" di Beranda: sorot tombol scan.
  // (Pemilih file tidak bisa dibuka otomatis tanpa ketukan pengguna.)
  const [highlightScan] = useState(() => new URLSearchParams(window.location.search).get("scan") === "1");
  useEffect(() => {
    if (highlightScan) scanBtnRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightScan]);

  useEffect(() => {
    if (user?.default_currency && !isEdit) setCurrency(user.default_currency);
  }, [user?.default_currency, isEdit]);

  // Isi form dari transaksi yang diedit (sekali saja).
  useEffect(() => {
    if (!editTx || editLoaded) return;
    const d = new Date(editTx.date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setType(editTx.type || "expense");
    setAmount(String(editTx.amount ?? ""));
    setCategory(editTx.type === "sedekah" ? "" : editTx.category || "");
    setDate(d.toISOString().slice(0, 16));
    setMerchant(editTx.merchant || "");
    setNotes(editTx.notes || "");
    setPhotoUrl(editTx.photo_url || "");
    setPhotoUrls(editTx.photo_url ? [editTx.photo_url] : []);
    setTags(editTx.tags || []);
    setVisibility(editTx.visibility || "shared");
    setCurrency((editTx.currency || "IDR").toUpperCase());
    setLinkedAssetId(editTx.linked_asset_id || "");
    setEditLoaded(true);
  }, [editTx, editLoaded]);

  const availableCategories = categories.filter((c) => c.type === type);
  const bankAssets = assets.filter((a) => isMoneyAsset(a) && (a.currency || "IDR") === currency && a.created_by_id === user?.id);

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
      // Mode edit: satu transaksi saja → pakai hasil pertama.
      if (allTx.length === 1 || isEdit) {
        const p = allTx[0];
        if (p.photo_url) { setPhotoUrl(p.photo_url); setPhotoUrls([p.photo_url]); }
        if (p.amount) setAmount(String(p.amount));
        if (p.currency) setCurrency(p.currency);
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
      const batchId = "scan-" + Date.now();
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
        notif_batch_id: batchId,
      }));
      const unique = dedupeBatch(records);
      const { toSave, skipped } = filterAgainstExisting(unique, transactions);
      if (!toSave.length) {
        toast.error("Semua transaksi duplikat", { description: "Tidak ada transaksi baru untuk disimpan." });
        setSavingMulti(false);
        return;
      }
      const { data: res } = await base44.functions.invoke("saveTransactionBatch", { transactions: toSave });
      if (visibility === "shared" && res.saved > 0) {
        try { await base44.functions.invoke("notifyPartnerBulk", { batch_id: batchId, count: res.saved }); } catch {}
      }
      refresh();
      const notes = [res.pending ? `${res.pending} menunggu persetujuan pasangan.` : "", skipped.length ? `${skipped.length} duplikat dilewati.` : ""].filter(Boolean).join(" ");
      toast.success(`${res.saved + res.pending} transaksi tersimpan!`, notes ? { description: notes } : undefined);
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
    if (isEdit) {
      try {
        await saveTransactionWithAsset({
          type,
          amount: amt,
          currency,
          category: type === "sedekah" ? "Sedekah & Infaq" : category,
          date: new Date(date).toISOString(),
          merchant: type === "income" ? "" : merchant || "",
          notes: notes || "",
          photo_url: photoUrl || "",
          tags,
          visibility,
          linked_asset_id: linkedAssetId || undefined,
        }, editId);
        refresh();
        toast.success("Transaksi diperbarui");
        navigate(`/transaksi/${editId}`, { replace: true });
      } catch {
        toast.error("Gagal memperbarui", { description: navigator.onLine ? undefined : "Periksa koneksi internet." });
      }
      setSaving(false);
      return;
    }
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
        linked_asset_id: linkedAssetId || undefined,
      }, user?.id);
      toast.success("Tersimpan offline", { description: "Akan otomatis disinkron saat koneksi kembali." });
      navigate("/");
      setSaving(false);
      return;
    }
    try {
      await saveTransactionWithAsset({
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
        linked_asset_id: linkedAssetId || undefined,
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
    if (isEdit) return performSave();
    const dup = findDuplicate(
      { type, amount: amt, currency, date: new Date(date).toISOString(), merchant, visibility },
      transactions
    );
    if (dup) {
      toast("Transaksi serupa sudah tercatat", {
        description: `${dup.merchant || dup.category || "Transaksi"} • ${formatMoneyPlain(dup.amount, dup.currency)} • ${formatDate(dup.date, "dd MMM yyyy, HH:mm")}`,
        action: { label: "Tetap Simpan", onClick: performSave },
      });
      return;
    }
    performSave();
  };

  const typeTone = {
    expense: { active: "bg-expense text-expense-foreground", soft: "text-expense", label: "Pengeluaran" },
    income: { active: "bg-income text-income-foreground", soft: "text-income", label: "Pemasukan" },
    sedekah: { active: "bg-sedekah text-sedekah-foreground", soft: "text-sedekah", label: "Sedekah" },
  }[type];
  const amountNum = Number(amount) || 0;
  const amountHint = amountCurrencyHint(amountNum, currency, rateMap);
  const quickAmounts = currency === "IDR" ? [10000, 25000, 50000, 100000] : [10, 25, 50, 100];
  const linkedAsset = bankAssets.find((a) => a.id === linkedAssetId);
  const chosenCategory = type === "sedekah" ? "Sedekah & Infaq" : category;
  const isExtra = tags.includes(EXTRAORDINARY_TAG);
  const toggleExtra = (on) => setTags(on ? [...tags.filter((t) => t !== EXTRAORDINARY_TAG), EXTRAORDINARY_TAG] : tags.filter((t) => t !== EXTRAORDINARY_TAG));
  const fieldCls = "w-full bg-transparent text-sm outline-none py-1";

  const isOwner = !isEdit || (!!editTx && !!user && editTx.created_by_id === user.id);
  const canDelete = isEdit && !!editTx && (isOwner || user?.role === "admin") && editTx.approval_status !== "pending";
  const handleDelete = async () => {
    if (!(await confirmAction({ title: "Hapus transaksi ini?", description: "Transaksi dihapus permanen. Bila terhubung ke aset, saldo aset ikut disesuaikan." }))) return;
    try {
      await deleteTransactionWithAsset(editId);
      refresh();
      toast.success("Transaksi dihapus");
      navigate("/riwayat", { replace: true });
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  if (isEdit && !editLoaded) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-5 text-center">
        {txLoading || !user ? (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <AlertCircle className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Transaksi tidak ditemukan.</p>
            <button onClick={() => navigate(-1)} className="btn-secondary btn-sm">Kembali</button>
          </>
        )}
      </div>
    );
  }

  if (multiTx) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="flex items-center gap-3 px-5 pt-6 pb-3">
          <button onClick={() => setMultiTx(null)} aria-label="Kembali" className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center shrink-0 active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight">Tinjau hasil scan</h1>
            <p className="text-sm text-muted-foreground">Periksa sebelum disimpan</p>
          </div>
        </header>
        <MultiTransactionPreview
          items={multiTx}
          categories={categories}
          onChange={updateMulti}
          onCancel={() => setMultiTx(null)}
          onSave={handleSaveAll}
          saving={savingMulti}
          existingTransactions={transactions}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center gap-3 px-5 pt-6 pb-3">
        <button onClick={() => navigate(-1)} aria-label="Kembali" className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center shrink-0 active:scale-95 transition-transform">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold leading-tight">{isEdit ? "Edit transaksi" : "Catat transaksi"}</h1>
          <p className="text-sm text-muted-foreground">{formatDate(new Date(date), "EEEE, d MMMM")}</p>
        </div>
      </header>

      <div className="flex-1 px-5 pb-6 space-y-5">
        {/* 1 · Jenis */}
        <div role="tablist" aria-label="Jenis transaksi" className="flex gap-1 p-1 rounded-2xl bg-muted">
          {typeTabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={type === t.key}
              onClick={() => { setType(t.key); setCategory(""); if (t.key === "income") setMerchant(""); if (t.key !== "expense") toggleExtra(false); }}
              className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-colors ${type === t.key ? `${typeTone.active} shadow-sm` : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 2 · Nominal (fokus utama) */}
        <section aria-label="Nominal" className="card-gradient-primary rounded-[28px] p-5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="add-tx-amount" className="text-xs opacity-80">Berapa {typeTone.label.toLowerCase()}nya?</label>
            {userCurrencies.length > 1 && (
              <div role="radiogroup" aria-label="Mata uang" className="flex gap-1">
                {userCurrencies.map((c) => (
                  <button
                    key={c.code}
                    role="radio"
                    aria-checked={currency === c.code}
                    onClick={() => curGuard.change(c.code)}
                    className={`h-7 px-2.5 rounded-full text-[11px] font-bold border transition-colors ${currency === c.code ? "bg-white text-[hsl(var(--hero-from))] border-white" : "border-white/25 text-white/75"}`}
                  >
                    {c.code}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xl font-semibold opacity-70">{currencySymbol(currency)}</span>
            <input
              id="add-tx-amount"
              // Rupiah: tampil berpemisah ribuan saat diketik (150.000); nilai
              // yang disimpan tetap angka murni. Mata uang lain boleh desimal.
              type={currency === "IDR" ? "text" : "number"}
              inputMode={currency === "IDR" ? "numeric" : "decimal"}
              value={currency === "IDR" ? (amount ? Number(amount).toLocaleString("id-ID") : "") : amount}
              onChange={(e) => setAmount(currency === "IDR" ? e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "") : e.target.value)}
              placeholder="0"
              autoFocus={!highlightScan}
              className="flex-1 min-w-0 bg-transparent outline-none font-heading text-[40px] leading-none font-extrabold tracking-tight tabular-nums placeholder:text-white/30 text-[hsl(var(--hero-foreground))]"
            />
          </div>
          <p className="text-xs opacity-70 mt-1 tabular-nums h-4">{curGuard.origin ? convertedFromLabel(curGuard) : amountNum > 0 && currency !== "IDR" ? `${formatMoney(amountNum, currency)} ${conversionPreview(amountNum, currency, "IDR", rateMap)}`.trim() : ""}</p>
          {amountHint && userCurrencies.some((c) => c.code === "IDR") && (
            <div role="alert" className="mt-2 rounded-2xl bg-white/12 border border-white/25 px-3 py-2 text-xs flex items-center gap-2">
              <span className="flex-1 min-w-0 opacity-90">{amountHint.message}</span>
              <button type="button" onClick={() => { setCurrency("IDR"); setLinkedAssetId(""); setAmount(String(Math.round(amountNum))); }}
                className="shrink-0 h-7 px-3 rounded-full bg-white text-[hsl(var(--hero-from))] font-bold">Jadikan IDR</button>
            </div>
          )}
          <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar">
            {quickAmounts.map((q) => (
              <button key={q} onClick={() => setAmount(String(amountNum + q))} className="shrink-0 h-8 px-3 rounded-full bg-white/10 border border-white/15 text-xs font-semibold active:scale-95 transition-transform">
                +{currency === "IDR" ? `${q / 1000} rb` : q}
              </button>
            ))}
            {amountNum > 0 && (
              <button onClick={() => setAmount("")} aria-label="Kosongkan nominal" className="shrink-0 h-8 w-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
            )}
          </div>
        </section>

        {/* 3 · Scan struk (jalan pintas) */}
        <div>
          <button
            ref={scanBtnRef}
            onClick={() => fileRef.current?.click()}
            disabled={scanning}
            className={`w-full card-pastel card-pastel-butter rounded-2xl p-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition-transform disabled:opacity-70 ${highlightScan ? "ring-2 ring-gold ring-offset-2 ring-offset-background" : ""}`}
          >
            <span className="w-10 h-10 rounded-xl bg-white/60 dark:bg-white/10 flex items-center justify-center shrink-0">
              {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <ScanLine className="w-5 h-5" />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold">
                {scanning ? "AI sedang membaca bon…" : photoUrls.length > 0 ? (isEdit ? "Bon terpasang · ketuk untuk ganti" : `${photoUrls.length} bon terunggah`) : isEdit ? "Tambah / scan bon dengan AI" : "Punya struk? Scan dengan AI"}
              </span>
              <span className="block text-xs opacity-75">
                {scanning ? `${photoUrls.length || 1} foto sedang diproses` : isEdit ? "Isian terbaca otomatis, periksa sebelum simpan" : "Hingga 5 foto, tinjau dulu sebelum disimpan"}
              </span>
            </span>
            {photoUrls.length > 0 && !scanning && (
              <span className="flex -space-x-2">
                {photoUrls.slice(0, 3).map((u, i) => <img key={i} src={u} alt={`bon ${i + 1}`} className="w-9 h-9 object-cover rounded-lg border-2 border-[hsl(var(--pastel-butter))]" />)}
              </span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple={!isEdit} className="hidden" onChange={handleScan} />
          {photoUrls.length > 0 && !scanning && (
            <button onClick={() => { setPhotoUrl(""); setPhotoUrls([]); if (fileRef.current) fileRef.current.value = ""; }} className="mt-2 text-xs text-destructive flex items-center gap-1">
              <X className="w-3 h-3" /> {isEdit ? "Lepas bon" : "Hapus semua foto"}
            </button>
          )}
        </div>

        {/* 4 · Template & kategori */}
        {!isEdit && templates.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Pakai template</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
              {templates.map((t) => {
                const cat = categories.find((c) => c.name === t.category);
                const cm = colorMap[cat?.color] || colorMap.slate;
                const icon = t.type === "sedekah" ? "Heart" : cat?.icon || "Wallet";
                return (
                  <button key={t.id} onClick={() => applyTemplate(t)} className="shrink-0 flex items-center gap-2 rounded-full border border-border bg-card pl-1.5 pr-3.5 h-11 active:scale-95 transition-transform">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center ${cm.bg}`}><CategoryIcon name={icon} className={`w-4 h-4 ${cm.text}`} /></span>
                    <span className="text-left">
                      <span className="block text-xs font-semibold leading-tight">{t.name}</span>
                      <span className="block text-[11px] text-muted-foreground tabular-nums">{formatMoney(t.amount, t.currency)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {type !== "sedekah" && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Kategori</p>
            <div className="grid grid-cols-4 gap-2">
              {availableCategories.map((c) => {
                const cm = colorMap[c.color] || colorMap.slate;
                const selected = category === c.name;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.name)}
                    aria-pressed={selected}
                    className={`relative flex flex-col items-center gap-1.5 pt-3 pb-2.5 rounded-2xl border transition-all ${selected ? "border-primary bg-primary/[0.07] ring-1 ring-primary" : "border-border bg-card"}`}
                  >
                    {selected && <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Check className="w-2.5 h-2.5" strokeWidth={3} /></span>}
                    <span className={`w-10 h-10 rounded-2xl flex items-center justify-center ${cm.bg}`}><CategoryIcon name={c.icon} className={`w-5 h-5 ${cm.text}`} /></span>
                    <span className={`text-[11px] leading-tight text-center px-1 ${selected ? "font-semibold" : ""}`}>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 5 · Detail */}
        <section aria-label="Detail transaksi" className="surface rounded-3xl divide-y divide-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <label htmlFor="add-tx-date" className="block text-[11px] text-muted-foreground">Tanggal & jam</label>
              <input id="add-tx-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={fieldCls} />
            </div>
          </div>

          {type !== "income" && (
            <div className="flex items-center gap-3 px-4 py-3">
              <Store className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <label htmlFor="add-tx-merchant" className="block text-[11px] text-muted-foreground">{type === "sedekah" ? "Penerima / tujuan" : "Tempat / merchant"}</label>
                <input id="add-tx-merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder={type === "sedekah" ? "Mis. Masjid, yatim…" : "Mis. Indomaret, pasar…"} className={fieldCls} />
              </div>
            </div>
          )}

          {bankAssets.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3">
              <Wallet className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <label htmlFor="add-tx-linked-asset" className="block text-[11px] text-muted-foreground">{type === "income" ? "Masuk ke" : "Dibayar dari"} (opsional)</label>
                <select id="add-tx-linked-asset" value={linkedAssetId} onChange={(e) => setLinkedAssetId(e.target.value)} className={`${fieldCls} -ml-0.5`}>
                  <option value="">Tidak dipilih, saldo rekening tetap</option>
                  {bankAssets.map((a) => <option key={a.id} value={a.id}>{assetLabel(a)} ({formatMoneyPlain(a.value, a.currency)})</option>)}
                </select>
              </div>
            </div>
          )}

          {isOwner && <div className="flex items-center gap-3 px-4 py-3">
            {visibility === "private" ? <Lock className="w-4 h-4 text-muted-foreground shrink-0" /> : <Users className="w-4 h-4 text-muted-foreground shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground">Jangkauan</p>
              <p className="text-sm">{visibility === "private" ? "Pribadi, hanya Anda yang melihat" : "Bersama keluarga"}</p>
            </div>
            <div role="radiogroup" aria-label="Jangkauan" className="flex gap-1 p-0.5 rounded-full bg-muted shrink-0">
              {[["shared", "Bersama"], ["private", "Pribadi"]].map(([v, l]) => (
                <button key={v} role="radio" aria-checked={visibility === v} onClick={() => setVisibility(v)} className={`h-7 px-3 rounded-full text-xs font-semibold transition-colors ${visibility === v ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>{l}</button>
              ))}
            </div>
          </div>}

          <div className="flex items-start gap-3 px-4 py-3">
            <NotebookPen className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
            <div className="flex-1 min-w-0">
              <label htmlFor="add-tx-notes" className="block text-[11px] text-muted-foreground">Catatan</label>
              <textarea id="add-tx-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Opsional" className={`${fieldCls} resize-none`} />
            </div>
          </div>

          {type === "expense" && (
            <label htmlFor="add-tx-extraordinary" className="flex items-center gap-3 px-4 py-3 cursor-pointer">
              <Sparkles className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">Pengeluaran luar biasa</span>
                <span className="block text-[11px] text-muted-foreground leading-snug">Tidak rutin, mis. kendaraan atau renovasi. Tidak ikut rata-rata harian.</span>
              </span>
              <input id="add-tx-extraordinary" type="checkbox" checked={isExtra} onChange={(e) => toggleExtra(e.target.checked)} className="peer sr-only" />
              <span aria-hidden="true" className="w-10 h-6 rounded-full bg-muted border border-border relative transition-colors peer-checked:bg-primary peer-checked:border-primary after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-[18px] after:h-[18px] after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-ring" />
            </label>
          )}
        </section>

        {/* 6 · Opsi lanjutan */}
        <details className="group surface rounded-3xl">
          <summary className="flex items-center justify-between px-4 py-3.5 cursor-pointer list-none">
            <span className="text-sm font-semibold">Opsi lanjutan</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">{isEdit ? "Tag" : "Tag & template"} <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" /></span>
          </summary>
          <div className="px-4 pb-4 space-y-3">
            <div>
              <p className="text-[11px] text-muted-foreground mb-1.5">Tag</p>
              <TagInput tags={tags.filter((t) => t !== EXTRAORDINARY_TAG)} onChange={(next) => setTags(isExtra ? [...next, EXTRAORDINARY_TAG] : next)} />
            </div>
            {!isEdit && <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} className="w-4 h-4 accent-[hsl(var(--primary))]" />
              <span className="text-sm">Simpan sebagai template rutin</span>
            </label>}
          </div>
        </details>

        {canDelete && (
          <button onClick={handleDelete} className="w-full h-11 rounded-full border border-destructive/30 text-destructive text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform">
            <Trash2 className="w-4 h-4" /> Hapus transaksi
          </button>
        )}
      </div>

      {/* 7 · Simpan (menempel) */}
      <div className="sticky bottom-0 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-background/90 backdrop-blur-xl border-t border-border">
        <p className="text-xs text-muted-foreground mb-2 truncate" aria-live="polite">
          <span className={`font-semibold ${typeTone.soft}`}>{typeTone.label}</span>
          {chosenCategory ? ` · ${chosenCategory}` : " · pilih kategori"}
          {linkedAsset ? ` · dari ${linkedAsset.name}` : ""}
          {amountNum > 0 ? ` · ${formatMoney(amountNum, currency)}` : ""}
        </p>
        <button onClick={handleSave} disabled={saving} className="w-full btn-primary">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Transaksi"}
        </button>
      </div>
    </div>
  );
}