import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCategories, useRefresh, useTransactions, useAssets } from "@/hooks/useFinance";
import { formatRupiah, formatMoney, formatDate, colorMap } from "@/lib/finance";
import { adjustOnUpdate, adjustLinkedAsset, txEffect } from "@/lib/linkedAsset";
import CategoryIcon from "@/components/CategoryIcon";
import TagInput from "@/components/TagInput";
import { Image as SmartImage } from "@/components/ui/image";
import { scanReceipt } from "@/lib/scanReceipt";
import { ensureCategories } from "@/lib/categoryAuto";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { ArrowLeft, Pencil, Check, X, Loader2, Trash2, Calendar, User, Receipt, ScanLine, AlertCircle, Lock, Users, EyeOff } from "lucide-react";

const typeLabels = { income: "Pemasukan", expense: "Pengeluaran", sedekah: "Sedekah" };

export default function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: assets = [] } = useAssets();
  const { user } = useAuth();
  const fileRef = useRef(null);

  const tx = transactions.find((t) => t.id === id);
  const isOwner = !!tx && !!user && tx.created_by_id === user.id;
  const canManage = isOwner;

  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (tx && !form) {
      const d = new Date(tx.date);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      setForm({
        type: tx.type,
        amount: String(tx.amount),
        category: tx.category || "",
        date: d.toISOString().slice(0, 16),
        merchant: tx.merchant || "",
        notes: tx.notes || "",
        photo_url: tx.photo_url || "",
        tags: tx.tags || [],
        visibility: tx.visibility || "shared",
        currency: tx.currency || "IDR",
        linked_asset_id: tx.linked_asset_id || "",
      });
    }
  }, [tx, form]);

  if (!tx) {
    return (
      <div className="px-5 pt-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold">Detail Transaksi</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Transaksi tidak ditemukan.</p>
        </div>
      </div>
    );
  }

  const category = categories.find((c) => c.name === tx.category);
  const color = tx.type === "sedekah" ? "teal" : category?.color || "slate";
  const icon = tx.type === "sedekah" ? "Heart" : category?.icon || "Wallet";
  const cm = colorMap[color] || colorMap.slate;
  const isIncome = tx.type === "income";

  const handleScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((f) => ({ ...f, photo_url: file_url }));
      const { transactions } = await scanReceipt(file_url, categories);
      const p = transactions[0] || {};
      setForm((f) => {
        const next = {
          ...f,
          amount: p.amount ? String(p.amount) : f.amount,
          merchant: p.merchant || f.merchant,
          category: p.category || f.category,
          notes: p.notes || f.notes,
        };
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
            next.date = d.toISOString().slice(0, 16);
          }
        }
        return next;
      });
      if (p.category && p.category_new) {
        await ensureCategories([{ name: p.category, icon: p.category_icon, color: p.category_color }], categories, "expense");
        refresh();
      }
      toast.success("Bon dibaca ulang", { description: p.category ? `Kategori: ${p.category}${p.category_new ? " (kategori baru)" : ""}` : "Periksa data sebelum simpan." });
    } catch {
      toast.error("Gagal membaca bon");
    }
    setScanning(false);
  };

  const handleSave = async () => {
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return toast.error("Masukkan nominal");
    if (form.type !== "sedekah" && !form.category) return toast.error("Pilih kategori");
    setSaving(true);
    try {
      const newTx = { type: form.type, amount: amt, linked_asset_id: form.linked_asset_id || undefined };
      await base44.entities.Transaction.update(id, {
        type: form.type,
        amount: amt,
        currency: form.currency || "IDR",
        category: form.type === "sedekah" ? "Sedekah & Infaq" : form.category,
        date: new Date(form.date).toISOString(),
        merchant: form.merchant || "",
        notes: form.notes || "",
        photo_url: form.photo_url || "",
        tags: form.tags || [],
        visibility: form.visibility || "shared",
        linked_asset_id: form.linked_asset_id || undefined,
      });
      await adjustOnUpdate(tx, newTx);
      refresh();
      toast.success("Transaksi diperbarui");
      setEdit(false);
      setForm(null);
    } catch {
      toast.error("Gagal memperbarui");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    try {
      if (tx.linked_asset_id) await adjustLinkedAsset(tx.linked_asset_id, -txEffect(tx));
      await base44.entities.Transaction.delete(id);
      refresh();
      toast.success("Transaksi dihapus");
      navigate(-1);
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const handleToggleVisibility = async () => {
    const next = tx.visibility === "private" ? "shared" : "private";
    try {
      await base44.entities.Transaction.update(id, { visibility: next });
      refresh();
      toast.success(next === "private" ? "Diubah menjadi Pribadi" : "Diubah menjadi Bersama Keluarga");
    } catch {
      toast.error("Gagal mengubah jangkauan");
    }
  };

  if (edit && form) {
    const availableCategories = categories.filter((c) => c.type === form.type);
    const bankAssets = assets.filter((a) => a.type === "bank" && (a.currency || "IDR") === (form.currency || "IDR"));
    return (
      <div className="min-h-screen flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <button onClick={() => { setEdit(false); setForm(null); }} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
          <h1 className="font-semibold">Edit Transaksi</h1>
          <button onClick={handleSave} disabled={saving} className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-60">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          </button>
        </header>

        <div className="flex-1 px-5 py-5 space-y-5 overflow-y-auto">
          <div className="flex gap-2 bg-muted p-1 rounded-2xl">
            {Object.entries(typeLabels).map(([key, label]) => (
              <button key={key} onClick={() => setForm({ ...form, type: key, category: key === "sedekah" ? "" : form.category })} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${form.type === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
                {label}
              </button>
            ))}
          </div>

          {isOwner && (
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Jangkauan</label>
              <div className="flex gap-2">
                <button onClick={() => setForm({ ...form, visibility: "shared" })} className={`flex-1 py-2.5 rounded-2xl border flex items-center justify-center gap-1.5 text-sm font-medium transition-all ${form.visibility !== "private" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>
                  <Users className="w-4 h-4" /> Bersama
                </button>
                <button onClick={() => setForm({ ...form, visibility: "private" })} className={`flex-1 py-2.5 rounded-2xl border flex items-center justify-center gap-1.5 text-sm font-medium transition-all ${form.visibility === "private" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>
                  <Lock className="w-4 h-4" /> Pribadi
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Mata Uang</label>
            <div className="flex gap-2">
              {["IDR", "SAR", "USD"].map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, currency: c, linked_asset_id: "" })}
                  className={`flex-1 py-2 rounded-2xl border text-sm font-medium transition-all ${
                    form.currency === c ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {bankAssets.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Aset terkait (opsional)</label>
              <select
                value={form.linked_asset_id || ""}
                onChange={(e) => setForm({ ...form, linked_asset_id: e.target.value })}
                className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30 bg-background"
              >
                <option value="">Tidak ada — saldo tidak diubah</option>
                {bankAssets.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({formatMoney(a.value, a.currency)})</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1.5">Saldo aset disesuaikan otomatis sesuai jenis transaksi.</p>
            </div>
          )}

          <button onClick={() => fileRef.current?.click()} disabled={scanning} className="w-full rounded-2xl border-2 border-dashed border-border py-6 flex flex-col items-center gap-2 text-muted-foreground active:scale-[0.99] transition-transform disabled:opacity-60">
            {scanning ? (
              <>
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
                <p className="text-sm font-medium text-primary">Membaca bon...</p>
              </>
            ) : form.photo_url ? (
              <>
                <img src={form.photo_url} alt="bon" className="max-h-32 rounded-xl" />
                <p className="text-xs text-emerald-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Bon terpasang</p>
              </>
            ) : (
              <>
                <ScanLine className="w-7 h-7" />
                <p className="text-sm font-medium">Scan / Ganti Bon</p>
              </>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleScan} />
          {form.photo_url && !scanning && (
            <button onClick={() => setForm({ ...form, photo_url: "" })} className="text-xs text-red-500 flex items-center gap-1"><X className="w-3 h-3" /> Hapus bon</button>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Nominal</label>
            <div className="flex items-center rounded-2xl border border-border px-4 focus-within:ring-2 ring-primary/30">
              <span className="text-lg text-muted-foreground mr-1">Rp</span>
              <input type="number" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" className="flex-1 py-3 text-2xl font-bold outline-none bg-transparent" />
            </div>
          </div>

          {form.type !== "sedekah" && (
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Kategori</label>
              <div className="grid grid-cols-4 gap-2">
                {availableCategories.map((c) => {
                  const ccm = colorMap[c.color] || colorMap.slate;
                  const selected = form.category === c.name;
                  return (
                    <button key={c.id} onClick={() => setForm({ ...form, category: c.name })} className={`flex flex-col items-center gap-1.5 py-2.5 rounded-2xl border transition-all ${selected ? "border-primary bg-primary/5" : "border-border"}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${ccm.bg}`}><CategoryIcon name={c.icon} className={`w-4 h-4 ${ccm.text}`} /></div>
                      <span className="text-[10px] leading-tight text-center">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Tanggal & Jam</label>
            <input type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">{form.type === "sedekah" ? "Penerima / Tujuan" : "Merchant / Tempat"}</label>
            <input value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} placeholder="Mis. Indomaret, Masjid..." className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Catatan</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Tambah catatan..." className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30 resize-none" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Tag</label>
            <TagInput tags={form.tags || []} onChange={(t) => setForm({ ...form, tags: t })} />
          </div>

          <button onClick={handleDelete} className="w-full py-3 rounded-2xl border border-red-200 dark:border-red-900/40 text-red-500 font-medium text-sm flex items-center justify-center gap-2 mt-2">
            <Trash2 className="w-4 h-4" /> Hapus Transaksi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-8 pb-10">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold">Detail Transaksi</h1>
        {canManage ? (
          <button onClick={() => setEdit(true)} className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <Pencil className="w-4 h-4" />
          </button>
        ) : (
          <span className="w-9 h-9 rounded-full bg-muted flex items-center justify-center" title="Transaksi milik pasangan — hanya bisa dilihat">
            <EyeOff className="w-4 h-4 text-muted-foreground" />
          </span>
        )}
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-5 shadow-lg mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs opacity-80">{typeLabels[tx.type]}</span>
        </div>
        <p className="text-3xl font-bold tracking-tight">{isIncome ? "+" : "-"}{formatMoney(tx.amount, tx.currency)}</p>
        <p className="text-sm opacity-90 mt-1 truncate">{tx.merchant || tx.notes || (tx.type === "sedekah" ? "Sedekah & Infaq" : tx.category)}</p>
      </div>

      {tx.photo_url && (
        <div className="rounded-2xl border border-border bg-card p-3 mb-4">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> Bon / Struk</p>
          <div className="rounded-xl overflow-hidden">
            <SmartImage src={tx.photo_url} alt="Bon transaksi" className="w-full" fittingType="fit" />
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <DetailRow icon={CategoryIcon} iconName={icon} cm={cm} label="Kategori" value={tx.type === "sedekah" ? "Sedekah & Infaq" : tx.category || "-"} />
        <DetailRow icon={Calendar} label="Tanggal" value={formatDate(tx.date, "EEEE, dd MMMM yyyy • HH:mm")} />
        <DetailRow icon={User} label="Dicatat oleh" value={tx.input_by_name || "Keluarga"} />
        <DetailRow icon={tx.visibility === "private" ? Lock : Users} label="Jangkauan" value={tx.visibility === "private" ? "Pribadi (hanya Anda)" : "Bersama Keluarga"} />
        {tx.notes && <DetailRow icon={Receipt} label="Catatan" value={tx.notes} />}
      </div>

      {tx.tags?.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 mt-4">
          <p className="text-xs text-muted-foreground mb-2">Tag</p>
          <div className="flex flex-wrap gap-1.5">
            {tx.tags.map((t) => (
              <span key={t} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">{t}</span>
            ))}
          </div>
        </div>
      )}

      {isOwner && (
        <button
          onClick={handleToggleVisibility}
          className="w-full mt-4 py-3 rounded-2xl border border-border bg-card text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
        >
          {tx.visibility === "private" ? (
            <><Users className="w-4 h-4" /> Jadikan Bersama Keluarga</>
          ) : (
            <><Lock className="w-4 h-4" /> Jadikan Pribadi</>
          )}
        </button>
      )}
    </div>
  );
}

function DetailRow({ icon: Icon, iconName, cm, label, value }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cm ? cm.bg : "bg-muted"}`}>
        {iconName ? <CategoryIcon name={iconName} className={`w-4 h-4 ${cm?.text || "text-muted-foreground"}`} /> : <Icon className={`w-4 h-4 ${cm?.text || "text-muted-foreground"}`} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  );
}