import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCategories, useRefresh, useTransactions, useAssets, useRateMap } from "@/hooks/useFinance";
import { formatMoney, formatDate, colorMap, conversionPreview, EXTRAORDINARY_TAG } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import ProofViewer from "@/components/ProofViewer";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { usePartnership } from "@/hooks/usePartnership";
import { Pencil, X, Loader2, User, Receipt, AlertCircle, Lock, Users, Clock, CalendarDays, Wallet, NotebookPen, Tag, Sparkles, Heart, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, ImagePlus, ImageOff, FileText, Maximize2, Trash2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { confirmAction } from "@/components/ConfirmHost";

const isPdfUrl = (u) => /\.pdf($|\?)/i.test(u || "");

const typeLabels = { income: "Pemasukan", expense: "Pengeluaran", sedekah: "Sedekah" };

export default function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: assets = [] } = useAssets();
  const { map: rateMap } = useRateMap();
  const { user } = useAuth();
  const { partners } = usePartnership();

  const [adminTx, setAdminTx] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const tx = transactions.find((t) => t.id === id) || adminTx;
  const inList = transactions.some((t) => t.id === id);
  const isOwner = !!tx && !!user && tx.created_by_id === user.id;
  const isAdmin = !!user && user.role === "admin";
  const canManage = isOwner || isAdmin;
  const isPending = !!tx && tx.approval_status === "pending";
  const partnerName = partners[0]?.full_name || "pasangan";

  const [viewPhoto, setViewPhoto] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imgFailed, setImgFailed] = useState(null);
  const proofRef = useRef(null);
  const [cancelling, setCancelling] = useState(false);

  // Admin fallback: bila transaksi tidak ada di daftar terlihat (milik user lain
  // yang bukan pasangan), admin dapat membuka detail lewat endpoint admin khusus.
  useEffect(() => {
    if (!transactions.find((t) => t.id === id) && user?.role === "admin" && id) {
      setAdminLoading(true);
      base44.functions.invoke("adminGetTransaction", { id })
        .then((res) => setAdminTx(res?.data?.transaction || null))
        .catch(() => setAdminTx(null))
        .finally(() => setAdminLoading(false));
    } else {
      setAdminTx(null);
      setAdminLoading(false);
    }
  }, [transactions, user, id]);

  if (!tx) {
    if (adminLoading) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return (
      <div className="px-5 pt-6">
        <PageHeader title="Detail Transaksi" back />
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

  const handleCancelApproval = async () => {
    if (cancelling || !tx?.approval_id) return;
    setCancelling(true);
    try {
      await base44.functions.invoke("cancelApproval", { approval_id: tx.approval_id });
      refresh();
      toast.success("Permintaan persetujuan dibatalkan");
      navigate(-1);
    } catch {
      toast.error("Gagal membatalkan permintaan");
    }
    setCancelling(false);
  };

  // Bukti bisa ditambah/diganti tanpa membuka form edit (hanya kolom photo_url,
  // tidak memengaruhi saldo). Tidak untuk transaksi yang menunggu persetujuan.
  const canEditProof = canManage && inList && !isPending;
  const uploadProof = async (e) => {
    const file = e.target.files?.[0];
    if (proofRef.current) proofRef.current.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("File terlalu besar", { description: "Maksimal 10 MB." });
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Transaction.update(id, { photo_url: file_url });
      refresh();
      toast.success("Bukti transaksi disimpan");
    } catch {
      toast.error("Gagal mengunggah bukti");
    }
    setUploading(false);
  };
  const removeProof = async () => {
    if (!(await confirmAction({ title: "Hapus bukti transaksi?", description: "Hanya lampiran yang dihapus, transaksinya tetap." }))) return;
    try {
      await base44.entities.Transaction.update(id, { photo_url: "" });
      refresh();
      toast.success("Bukti dihapus");
    } catch {
      toast.error("Gagal menghapus bukti");
    }
  };

  const setVisibility = async (next) => {
    if (toggling || next === (tx.visibility || "shared")) return;
    setToggling(true);
    try {
      await base44.entities.Transaction.update(id, { visibility: next });
      refresh();
      toast.success(next === "private" ? "Diubah menjadi Pribadi" : "Diubah menjadi Bersama keluarga");
    } catch {
      toast.error("Gagal mengubah jangkauan");
    } finally {
      setToggling(false);
    }
  };

  // Transfer & setoran target: tidak diedit satu sisi, hanya dihapus utuh.
  const deleteTransfer = async () => {
    const deposit = !!tx.savings_goal_id;
    if (!(await confirmAction(deposit ? {
      title: "Hapus setoran ini?",
      description: "Saldo rekening dikembalikan dan progres target tabungan dikurangi sebesar setoran ini.",
      confirmText: "Hapus setoran",
    } : {
      title: "Hapus transfer ini?",
      description: "Kedua sisi transfer dihapus dan saldo kedua rekening dikembalikan seperti sebelum transfer.",
      confirmText: "Hapus transfer",
    }))) return;
    setDeleting(true);
    try {
      await base44.functions.invoke(deposit ? "deleteTransactionWithAsset" : "deleteTransferPair", { transaction_id: tx.id });
      refresh();
      toast.success(deposit ? "Setoran dihapus" : "Transfer dihapus");
      navigate("/riwayat", { replace: true });
    } catch (e) {
      toast.error(e?.response?.data?.message || "Gagal menghapus");
      setDeleting(false);
    }
  };

  const cur = (tx.currency || "IDR").toUpperCase();
  const idrEquivalent = cur !== "IDR" ? conversionPreview(tx.amount, cur, "IDR", rateMap) : "";
  const linkedAsset = tx.linked_asset_id ? assets.find((a) => a.id === tx.linked_asset_id) : null;
  const isTransfer = !!tx.transfer_pair_id;
  const isDeposit = !!tx.savings_goal_id; // setoran target tabungan
  const isExtra = (tx.tags || []).includes(EXTRAORDINARY_TAG);
  const tags = (tx.tags || []).filter((t) => t !== EXTRAORDINARY_TAG);
  const tone = TYPE_TONE[tx.type] || TYPE_TONE.expense;
  const categoryName = tx.type === "sedekah" ? "Sedekah & Infaq" : tx.category || "Tanpa kategori";
  const title = tx.merchant || categoryName;
  const subtitle = tx.merchant ? categoryName : typeLabels[tx.type];
  const showActions = canManage && inList && !isPending;
  const sign = isIncome ? "+" : "−";

  return (
    <div className={`px-5 pt-6 ${showActions ? "pb-20 md:pb-10" : "pb-4"}`}>
      <PageHeader title="Detail transaksi" back />

      {/* Ringkasan */}
      <section aria-label="Ringkasan transaksi" className="card-gradient-primary relative rounded-[28px] p-5 overflow-hidden mb-4">
        <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full bg-white/10 pointer-events-none" aria-hidden="true" />
        <div className="relative">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-bold ${tone.chip}`}>
              {isTransfer ? <ArrowLeftRight className="w-3.5 h-3.5" /> : <tone.icon className="w-3.5 h-3.5" />}
              {isTransfer ? "Transfer" : tx.is_adjustment ? "Penyesuaian saldo" : typeLabels[tx.type]}
            </span>
            {tx.visibility === "private" && <Badge icon={Lock}>Pribadi</Badge>}
            {isExtra && <Badge icon={Sparkles}>Luar biasa</Badge>}
            {isPending && <Badge icon={Clock}>Menunggu</Badge>}
          </div>
          <p className="font-heading text-[38px] leading-none font-extrabold tracking-tight tabular-nums mt-4 break-all">
            {sign}{formatMoney(tx.amount, cur)}
          </p>
          {idrEquivalent && <p className="text-sm opacity-80 mt-1.5 tabular-nums">{idrEquivalent}</p>}
          <div className="flex items-center gap-3 mt-4">
            <span className="w-11 h-11 rounded-2xl bg-white/90 flex items-center justify-center shrink-0">
              <CategoryIcon name={icon} className={`w-5 h-5 ${cm.text}`} />
            </span>
            <div className="min-w-0">
              <p className="font-semibold truncate">{title}</p>
              <p className="text-xs opacity-80 truncate">{subtitle}</p>
            </div>
          </div>
        </div>
      </section>

      {isPending && (
        <section className="card-pastel card-pastel-butter rounded-3xl p-4 mb-4 flex items-start gap-3">
          <span className="w-9 h-9 rounded-2xl bg-white/60 dark:bg-white/10 flex items-center justify-center shrink-0"><Clock className="w-[18px] h-[18px]" /></span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Menunggu persetujuan {partnerName}</p>
            <p className="text-xs opacity-80 mt-0.5 leading-snug">Belum mengubah saldo. Bisa diedit setelah disetujui atau dibatalkan.</p>
            {isOwner && tx.approval_id && (
              <button onClick={handleCancelApproval} disabled={cancelling}
                className="mt-2.5 h-8 px-3.5 rounded-full bg-white/70 dark:bg-white/10 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
                {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Batalkan permintaan
              </button>
            )}
          </div>
        </section>
      )}

      {/* Rincian */}
      <section aria-label="Rincian" className="surface rounded-3xl divide-y divide-border mb-4">
        <DetailRow icon={<CalendarDays className="w-4 h-4" />} label="Tanggal & jam" value={formatDate(tx.date, "EEEE, d MMMM yyyy · HH:mm")} />
        <DetailRow icon={<Wallet className="w-4 h-4" />} label={isIncome ? "Masuk ke" : "Dibayar dari"}
          value={linkedAsset ? linkedAsset.name : tx.linked_asset_id ? "Rekening tidak terlihat" : "Tidak terhubung ke rekening"}
          muted={!linkedAsset} />
        <DetailRow icon={<User className="w-4 h-4" />} label="Dicatat oleh" value={tx.input_by_name || "Keluarga"} />
        {tx.notes && <DetailRow icon={<NotebookPen className="w-4 h-4" />} label="Catatan" value={tx.notes} />}
        {tags.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3">
            <span className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0"><Tag className="w-4 h-4" /></span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground">Tag</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {tags.map((t) => <span key={t} className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">#{t}</span>)}
              </div>
            </div>
          </div>
        )}
        {/* Jangkauan: satu kontrol saja (dulu ada ikon mata di header + tombol di bawah) */}
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
            {tx.visibility === "private" ? <Lock className="w-4 h-4" /> : <Users className="w-4 h-4" />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground">Jangkauan</p>
            <p className="text-sm font-medium">{tx.visibility === "private" ? "Pribadi, hanya Anda" : "Bersama keluarga"}</p>
          </div>
          {isOwner && !isPending && (
            <div role="radiogroup" aria-label="Jangkauan" className="flex gap-1 p-0.5 rounded-full bg-muted shrink-0">
              {[["shared", "Bersama"], ["private", "Pribadi"]].map(([v, l]) => (
                <button key={v} role="radio" aria-checked={(tx.visibility || "shared") === v} disabled={toggling} onClick={() => setVisibility(v)}
                  className={`h-7 px-3 rounded-full text-xs font-semibold transition-colors disabled:opacity-60 ${(tx.visibility || "shared") === v ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>{l}</button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Bukti transaksi (foto bon/struk/transfer, atau PDF) */}
      <section aria-label="Bukti transaksi" className="surface rounded-3xl p-3 mb-4">
        <div className="flex items-center justify-between gap-2 px-1 mb-2">
          <p className="text-sm font-semibold flex items-center gap-1.5"><Receipt className="w-4 h-4 text-muted-foreground" /> Bukti transaksi</p>
          {tx.photo_url && canEditProof && (
            <div className="flex items-center gap-3">
              <button onClick={() => proofRef.current?.click()} disabled={uploading} className="text-xs font-semibold text-primary disabled:opacity-60">Ganti</button>
              <button onClick={removeProof} disabled={uploading} className="text-xs font-semibold text-destructive disabled:opacity-60">Hapus</button>
            </div>
          )}
        </div>
        {uploading ? (
          <div className="h-40 rounded-2xl bg-muted flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" /><span className="text-xs">Mengunggah bukti…</span>
          </div>
        ) : tx.photo_url ? (
          <button type="button" onClick={() => setViewPhoto(true)} aria-label="Lihat bukti layar penuh" className="relative block w-full rounded-2xl overflow-hidden bg-muted">
            {isPdfUrl(tx.photo_url) ? (
              <span className="h-32 flex flex-col items-center justify-center gap-1.5 text-muted-foreground"><FileText className="w-8 h-8" /><span className="text-xs font-medium">Dokumen PDF · ketuk untuk membuka</span></span>
            ) : (
              imgFailed === tx.photo_url ? (
              <span className="h-32 flex flex-col items-center justify-center gap-1.5 text-muted-foreground"><ImageOff className="w-7 h-7" /><span className="text-xs font-medium">Pratinjau tidak bisa dimuat · ketuk untuk membuka</span></span>
            ) : (
              <img src={tx.photo_url} alt="Bukti transaksi" className="w-full max-h-80 object-contain" onError={() => setImgFailed(tx.photo_url)} />
            )
            )}
            <span className="absolute bottom-2 right-2 h-7 px-2.5 rounded-full bg-black/55 text-white text-[11px] font-semibold inline-flex items-center gap-1"><Maximize2 className="w-3 h-3" /> Lihat penuh</span>
          </button>
        ) : canEditProof ? (
          <button onClick={() => proofRef.current?.click()} className="w-full h-28 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-muted-foreground active:scale-[0.99] transition-transform">
            <ImagePlus className="w-6 h-6" />
            <span className="text-sm font-medium">Tambah foto bukti</span>
            <span className="text-[11px]">Bon, struk, atau bukti transfer (gambar/PDF)</span>
          </button>
        ) : (
          <p className="text-xs text-muted-foreground px-1 pb-1">Belum ada bukti terlampir.</p>
        )}
        <input ref={proofRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={uploadProof} />
      </section>
      {viewPhoto && tx.photo_url && <ProofViewer url={tx.photo_url} title="Bukti transaksi" onClose={() => setViewPhoto(false)} />}

      {!isOwner && !isAdmin && (
        <p className="text-xs text-muted-foreground text-center px-6 leading-snug">Transaksi ini dicatat oleh {tx.input_by_name || "pasangan"}. Anda hanya dapat melihatnya.</p>
      )}
      {isTransfer && (
        <p className="text-xs text-muted-foreground text-center px-6 leading-snug">Transfer antar rekening tidak dihitung sebagai pemasukan atau pengeluaran.</p>
      )}
      {isDeposit && (
        <p className="text-xs text-muted-foreground text-center px-6 leading-snug">Setoran ke target tabungan: uang keluar dari rekening, tapi tidak dihitung sebagai pengeluaran.</p>
      )}
      {tx.is_adjustment && (
        <p className="text-xs text-muted-foreground text-center px-6 leading-snug">Penyesuaian rekonsiliasi: koreksi saldo, tidak dihitung sebagai pemasukan atau pengeluaran.</p>
      )}

      {/* Aksi */}
      {showActions && (
        <div className="fixed bottom-0 inset-x-0 z-40 md:static md:mt-6 px-5 pt-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:p-0 bg-gradient-to-t from-background via-background/95 to-background/0 md:bg-none">
          <div className="max-w-md mx-auto">
            {isTransfer || isDeposit ? (
              // Transfer = dua transaksi berpasangan: tidak diedit satu sisi,
              // dihapus sekaligus agar saldo kedua rekening tetap seimbang.
              <button onClick={deleteTransfer} disabled={deleting} className="w-full btn-secondary text-destructive">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} {isDeposit ? "Hapus setoran" : "Hapus transfer (kedua sisi)"}
              </button>
            ) : (
              <button
                onClick={() => navigate(`/transaksi/${id}/edit`)}
                className="w-full btn-primary"
              >
                <Pencil className="w-4 h-4" /> Edit atau hapus
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const TYPE_TONE = {
  expense: { icon: ArrowUpRight, chip: "bg-expense text-expense-foreground" },
  income: { icon: ArrowDownLeft, chip: "bg-income text-income-foreground" },
  sedekah: { icon: Heart, chip: "bg-sedekah text-sedekah-foreground" },
};

function Badge({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-white/15 border border-white/20 text-[11px] font-semibold">
      <Icon className="w-3 h-3" /> {children}
    </span>
  );
}

function DetailRow({ icon, iconBg = "bg-muted text-muted-foreground", label, value, muted = false }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={`text-sm break-words ${muted ? "text-muted-foreground" : "font-medium"}`}>{value}</p>
      </div>
    </div>
  );
}
