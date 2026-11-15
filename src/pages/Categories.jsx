import { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useCategories, useRefresh, useTransactions, useMe } from "@/hooks/useFinance";
import { colorMap } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import CategoryFormModal from "@/components/CategoryFormModal";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { confirmAction } from "@/components/ConfirmHost";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

const tabs = [
  { key: "expense", label: "Pengeluaran" },
  { key: "income", label: "Pemasukan" },
];

export default function Categories() {
  const refresh = useRefresh();
  const { data: categories = [] } = useCategories();
  const { data: transactions = [] } = useTransactions();
  const { data: me } = useMe();
  const [tab, setTab] = useState("expense");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const usage = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      // Transaksi shared pasangan boleh terlihat di riwayat, tetapi tidak boleh
      // memengaruhi statistik maupun pengelolaan kategori akun ini.
      if (t.created_by_id === me?.id && t.category) map[t.category] = (map[t.category] || 0) + 1;
    }
    return map;
  }, [transactions, me?.id]);

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
      ? `Dipakai ${count} transaksi. Transaksi lama tetap tersimpan, tapi tidak akan punya kategori aktif.`
      : undefined;
    if (!(await confirmAction({ title: `Hapus kategori "${c.name}"?`, description: msg }))) return;
    try {
      await base44.entities.Category.delete(c.id);
      refresh();
      toast.success("Kategori dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const customCount = list.filter((c) => !c.is_default).length;

  return (
    <div className="px-5 pt-6 pb-6">
      <PageHeader title="Kelola kategori" subtitle="Kelompokkan transaksi agar laporan lebih rapi" back />

      <div role="tablist" aria-label="Jenis kategori" className="flex gap-1 p-1 rounded-2xl bg-muted mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-colors ${tab === t.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-end justify-between mb-2.5">
        <div>
          <h2 className="font-semibold text-[17px] leading-tight">Kategori {tab === "expense" ? "pengeluaran" : "pemasukan"}</h2>
          <p className="text-xs text-muted-foreground">{list.length} kategori · {customCount} kustom</p>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Tag} title={`Belum ada kategori ${tab === "expense" ? "pengeluaran" : "pemasukan"}.`} />
      ) : (
        <div className="surface rounded-3xl divide-y divide-border mb-5">
          {list.map((c) => {
            const cm = colorMap[c.color] || colorMap.slate;
            const count = usage[c.name] || 0;
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cm.bg}`}>
                  <CategoryIcon name={c.icon} className={`w-5 h-5 ${cm.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.is_default ? "Bawaan" : "Kustom"}
                    {count > 0 && ` • ${count} transaksi`}
                  </p>
                </div>
                {c.is_default ? (
                  <span className="text-[11px] font-semibold text-primary bg-primary/10 rounded-full px-2.5 py-1">Tetap</span>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => openEdit(c)} aria-label={`Edit kategori ${c.name}`} className="btn-icon btn-icon-sm">
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleDelete(c)} aria-label={`Hapus kategori ${c.name}`} className="btn-icon btn-icon-sm">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={openAdd}
        className="w-full btn-primary"
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
