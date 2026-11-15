import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCategories, useRefresh, useTransactions } from "@/hooks/useFinance";
import { formatMoney, formatDate, colorMap } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import ProofViewer from "@/components/ProofViewer";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { usePartnership } from "@/hooks/usePartnership";
import { Pencil, X, Loader2, Calendar, User, Receipt, AlertCircle, Lock, Users, Eye, EyeOff, Clock } from "lucide-react";
import PageHeader from "@/components/PageHeader";

const typeLabels = { income: "Pemasukan", expense: "Pengeluaran", sedekah: "Sedekah" };

export default function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
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

  const handleToggleVisibility = async () => {
    if (toggling) return;
    const next = tx.visibility === "private" ? "shared" : "private";
    setToggling(true);
    try {
      await base44.entities.Transaction.update(id, { visibility: next });
      refresh();
      toast.success(next === "private" ? "Diubah menjadi Pribadi" : "Diubah menjadi Bersama Keluarga");
    } catch {
      toast.error("Gagal mengubah jangkauan");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="px-5 pt-6">
      <PageHeader
        title="Detail Transaksi"
        back
        actions={<>
          {isOwner ? (
            <button
              onClick={handleToggleVisibility}
              disabled={toggling}
              title={tx.visibility === "private" ? "Jadikan Bersama Keluarga" : "Jadikan Pribadi"}
              className="disabled:opacity-60 btn-icon btn-icon-sm"
            >
              {toggling ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : tx.visibility === "private" ? (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Eye className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          ) : null}
          {canManage ? (
            <button
              onClick={() => navigate(`/transaksi/${id}/edit`)}
              disabled={isPending || !inList}
              aria-label="Edit transaksi"
              title={isPending ? "Menunggu persetujuan pasangan" : "Edit"}
              className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform ${isPending ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground"}`}
            >
              <Pencil className="w-4 h-4" />
            </button>
          ) : !isOwner ? (
            <span className="btn-icon btn-icon-sm" title="Transaksi milik pasangan — hanya bisa dilihat">
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            </span>
          ) : null}
        </>}
      />

      <div className="card-gradient-primary rounded-3xl p-5 shadow-lg mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs opacity-80">{typeLabels[tx.type]}</span>
        </div>
        <p className="text-3xl font-bold tracking-tight">{isIncome ? "+" : "-"}{formatMoney(tx.amount, tx.currency)}</p>
        <p className="text-sm opacity-90 mt-1 truncate">{tx.merchant || tx.notes || (tx.type === "sedekah" ? "Sedekah & Infaq" : tx.category)}</p>
      </div>

      {isPending && (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 mb-4">
          <div className="flex items-start gap-2.5">
            <Clock className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-warning">Menunggu persetujuan {partnerName}</p>
              <p className="text-xs text-warning mt-0.5">Transaksi ini belum mengubah saldo. Tunggu persetujuan, atau batalkan permintaan.</p>
              {isOwner && tx.approval_id && (
                <button
                  onClick={handleCancelApproval}
                  disabled={cancelling}
                  className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-warning/60 text-warning text-xs font-medium disabled:opacity-60"
                >
                  {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  Batalkan Permintaan
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {tx.photo_url && (
        <div className="surface p-3 mb-4">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> Bon / Struk</p>
          <button type="button" onClick={() => setViewPhoto(true)} aria-label="Lihat bon layar penuh" className="block w-full rounded-xl overflow-hidden bg-muted">
            <img src={tx.photo_url} alt="Bon transaksi" className="w-full max-h-80 object-contain" />
          </button>
        </div>
      )}
      {viewPhoto && tx.photo_url && <ProofViewer url={tx.photo_url} title="Bon / Struk" onClose={() => setViewPhoto(false)} />}

      <div className="surface divide-y divide-border">
        <DetailRow icon={CategoryIcon} iconName={icon} cm={cm} label="Kategori" value={tx.type === "sedekah" ? "Sedekah & Infaq" : tx.category || "-"} />
        <DetailRow icon={Calendar} label="Tanggal" value={formatDate(tx.date, "EEEE, dd MMMM yyyy • HH:mm")} />
        <DetailRow icon={User} label="Dicatat oleh" value={tx.input_by_name || "Keluarga"} />
        <DetailRow icon={tx.visibility === "private" ? Lock : Users} label="Jangkauan" value={tx.visibility === "private" ? "Pribadi (hanya Anda)" : "Bersama Keluarga"} />
        {tx.notes && <DetailRow icon={Receipt} label="Catatan" value={tx.notes} />}
      </div>

      {tx.tags?.length > 0 && (
        <div className="surface p-4 mt-4">
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
          className="w-full mt-4 py-3 surface text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
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