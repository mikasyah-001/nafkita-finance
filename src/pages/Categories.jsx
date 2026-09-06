import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCategories, useRefresh, useTransactions } from "@/hooks/useFinance";
import { colorMap } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import CategoryFormModal from "@/components/CategoryFormModal";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, Tag } from "lucide-react";

const tabs = [
  { key: "expense", label: "Pengeluaran" },
  { key: "income", label: "Pemasukan" },
];

export default function Categories() {
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data: categories = [] } = useCategories();
  const { data: transactions = [] } = useTransactions();
  const [tab, setTab] = useState("expense");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const usage = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      if (t.category) map[t.category] = (map[t.category] || 0) + 1;
    }
    return map;
  }, [transactions]);

  const list = categories.filter((c) => c.type === tab);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (c) => {
    if (c.is_default) return toast.info("Kategori bawaan tetap dipertahankan", { description: "Tambahkan kategori kustom bila membutuhkan variasi lain." });
    setEditing(c);
    setModalOpen(true);
  };

  const handleDelete = async (c) => {
    if (c.is_default) return toast.info("Kategori bawaan tidak dapat dihapus", { description: "Kategori ini tersedia untuk setiap akun." });
    const count = usage[c.name] || 0;
    const msg = count > 0
      ? `Kategori "${c.name}" dipakai ${count} transaksi. Transaksi lama tetap tersimpan, tapi tidak akan punya kategori aktif. Lanjut hapus?`
      : `Hapus kategori "${c.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      await base44.entities.Category.delete(c.id);
      refresh();
      toast.success("Kategori dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  return (
    <div className="px-5 pt-8 pb-8 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold">Kelola Kategori</h1>
      </div>

      <div className="flex gap-2 bg-muted p-1 rounded-2xl mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 mb-4">
        {list.map((c) => {
          const cm = colorMap[c.color] || colorMap.slate;
          const count = usage[c.name] || 0;
          return (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cm.bg}`}>
                <CategoryIcon name={c.icon} className={`w-5 h-5 ${cm.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.is_default ? "Bawaan" : "Kustom"}
                  {count > 0 && ` • ${count} transaksi`}
                </p>
              </div>
              {c.is_default ? (
                <span className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-2.5 py-1">Tetap</span>
              ) : (
                <>
                  <button onClick={() => openEdit(c)} aria-label={`Edit kategori ${c.name}`} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => handleDelete(c)} aria-label={`Hapus kategori ${c.name}`} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </>
              )}
            </div>
          );
        })}
        {list.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Tag className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Belum ada kategori {tab === "expense" ? "pengeluaran" : "pemasukan"}.</p>
          </div>
        )}
      </div>

      <button
        onClick={openAdd}
        className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
      >
        <Plus className="w-5 h-5" /> Tambah Kategori
      </button>

      <CategoryFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={refresh}
        initial={editing}
        categories={categories}
      />
    </div>
  );
}