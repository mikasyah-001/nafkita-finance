import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useTemplates, useCategories, useRefresh, useMe } from "@/hooks/useFinance";
import { colorMap, formatMoney, currencies, currencySymbol } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Users, Lock } from "lucide-react";

const typeOptions = [
  { k: "expense", l: "Pengeluaran" },
  { k: "income", l: "Pemasukan" },
  { k: "sedekah", l: "Sedekah" },
];

export default function TemplateManager() {
  const { data: templates = [] } = useTemplates();
  const { data: categories = [] } = useCategories();
  const { data: me } = useMe();
  const refresh = useRefresh();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tpl, setTpl] = useState({ name: "", type: "expense", amount: "", currency: "IDR", category: "", merchant: "", notes: "", visibility: "shared" });

  useEffect(() => {
    if (me?.default_currency) setTpl((p) => (p.currency && p.currency !== "IDR" ? p : { ...p, currency: me.default_currency }));
  }, [me]);

  const availableCategories = categories.filter((c) => c.type === tpl.type);

  const handleSave = async () => {
    if (!tpl.name) return toast.error("Isi nama template");
    const amt = Number(tpl.amount);
    if (!amt || amt <= 0) return toast.error("Masukkan nominal");
    setSaving(true);
    try {
      await base44.entities.TransactionTemplate.create({
        name: tpl.name,
        type: tpl.type,
        amount: amt,
        currency: tpl.currency,
        category: tpl.type === "sedekah" ? "Sedekah & Infaq" : tpl.category,
        merchant: tpl.merchant || "",
        notes: tpl.notes || "",
        visibility: tpl.visibility,
      });
      refresh();
      toast.success("Template ditambahkan");
      setTpl({ name: "", type: "expense", amount: "", currency: me?.default_currency || "IDR", category: "", merchant: "", notes: "", visibility: "shared" });
      setShowForm(false);
    } catch {
      toast.error("Gagal menambah template");
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.TransactionTemplate.delete(id);
      refresh();
      toast.success("Template dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">Pengeluaran rutin nominal tetap (listrik, air, internet)</p>
        <button onClick={() => setShowForm(!showForm)} className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border p-3 mb-3 space-y-3">
          <input value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} placeholder="Nama (mis. Listrik, Internet)" className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none" />
          <div className="flex gap-2">
            {typeOptions.map((t) => (
              <button key={t.k} onClick={() => setTpl({ ...tpl, type: t.k, category: "" })} className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${tpl.type === t.k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{t.l}</button>
            ))}
          </div>
          <div className="flex gap-1">
            {currencies.map((c) => (
              <button key={c.code} onClick={() => setTpl({ ...tpl, currency: c.code })} className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${tpl.currency === c.code ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{c.code}</button>
            ))}
          </div>
          <div className="flex items-center rounded-lg border border-border px-3">
            <span className="text-xs text-muted-foreground mr-1">{currencySymbol(tpl.currency)}</span>
            <input type="number" value={tpl.amount} onChange={(e) => setTpl({ ...tpl, amount: e.target.value })} placeholder="Nominal" className="flex-1 py-2 text-sm outline-none bg-transparent" />
          </div>
          {tpl.type !== "sedekah" && (
            <select value={tpl.category} onChange={(e) => setTpl({ ...tpl, category: e.target.value })} className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none bg-background">
              <option value="">Pilih kategori</option>
              {availableCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          )}
          <input value={tpl.merchant} onChange={(e) => setTpl({ ...tpl, merchant: e.target.value })} placeholder="Merchant (opsional)" className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none" />
          <div className="flex gap-2">
            <button onClick={() => setTpl({ ...tpl, visibility: "shared" })} className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 ${tpl.visibility !== "private" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><Users className="w-3 h-3" /> Bersama</button>
            <button onClick={() => setTpl({ ...tpl, visibility: "private" })} className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 ${tpl.visibility === "private" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><Lock className="w-3 h-3" /> Pribadi</button>
          </div>
          <button onClick={handleSave} disabled={saving} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Template"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {templates.length === 0 && !showForm && (
          <p className="text-xs text-muted-foreground text-center py-2">Belum ada template. Tap + untuk membuat.</p>
        )}
        {templates.map((t) => {
          const cat = categories.find((c) => c.name === t.category);
          const cm = colorMap[cat?.color] || colorMap.slate;
          const icon = t.type === "sedekah" ? "Heart" : cat?.icon || "Wallet";
          return (
            <div key={t.id} className="flex items-center gap-3 py-1.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cm.bg}`}>
                <CategoryIcon name={icon} className={`w-4 h-4 ${cm.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground">{formatMoney(t.amount, t.currency)}{t.category ? ` • ${t.category}` : ""}{t.visibility === "private" ? " • Pribadi" : ""}</p>
              </div>
              <button onClick={() => handleDelete(t.id)} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          );
        })}
      </div>
    </>
  );
}