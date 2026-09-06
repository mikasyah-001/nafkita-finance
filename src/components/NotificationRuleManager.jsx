import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNotificationRules, useCategories, useRefresh } from "@/hooks/useFinance";
import { Bell, Plus, Trash2, X } from "lucide-react";
import { formatMoney } from "@/lib/finance";
import { useToast } from "@/components/ui/use-toast";
import EmptyState from "@/components/EmptyState";

export default function NotificationRuleManager() {
  const { toast } = useToast();
  const { data: rules = [], isLoading } = useNotificationRules();
  const { data: categories = [] } = useCategories();
  const refresh = useRefresh();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    category: "*",
    min_amount: "",
    max_amount: "",
    enabled: true,
    silent: false,
    channel: "in_app",
    priority: "normal",
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await base44.entities.NotificationRule.create({
        ...form,
        min_amount: Number(form.min_amount) || 0,
        max_amount: form.max_amount ? Number(form.max_amount) : undefined,
      });
      toast({ title: "Aturan dibuat" });
      setShowForm(false);
      setForm({ category: "*", min_amount: "", max_amount: "", enabled: true, silent: false, channel: "in_app", priority: "normal" });
      refresh();
    } catch (e) {
      toast({ title: "Gagal", description: e?.message, variant: "destructive" });
    }
  };

  const handleToggle = async (rule, field) => {
    await base44.entities.NotificationRule.update(rule.id, { [field]: !rule[field] });
    refresh();
  };

  const handleDelete = async (id) => {
    if (!confirm("Hapus aturan ini?")) return;
    await base44.entities.NotificationRule.delete(id);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4" /> Aturan Notifikasi
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Kontrol notifikasi per kategori & ambang nominal</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
          <Plus className="w-4 h-4" /> Tambah
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="p-4 rounded-xl border border-border bg-muted/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Aturan Baru</span>
            <button type="button" onClick={() => setShowForm(false)} className="w-7 h-7 rounded-full bg-background flex items-center justify-center">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Kategori</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input text-sm">
                <option value="*">Semua Kategori</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Channel</label>
              <select value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })} className="input text-sm">
                <option value="in_app">In-App</option>
                <option value="email">Email</option>
                <option value="both">Keduanya</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Min. Nominal</label>
              <input type="number" value={form.min_amount} onChange={e => setForm({ ...form, min_amount: e.target.value })} placeholder="0" className="input text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Max. Nominal</label>
              <input type="number" value={form.max_amount} onChange={e => setForm({ ...form, max_amount: e.target.value })} placeholder="Tanpa batas" className="input text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />
              Aktif
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.silent} onChange={e => setForm({ ...form, silent: e.target.checked })} />
              Silent (lewati semua)
            </label>
          </div>
          <button type="submit" className="w-full px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Simpan</button>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Memuat...</p>
      ) : rules.length === 0 ? (
        <EmptyState icon={Bell} title="Belum ada aturan" subtitle="Buat aturan untuk mengontrol notifikasi per kategori" />
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <div key={rule.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
              <div className="min-w-0">
                <p className="font-medium text-sm">{rule.category === "*" ? "Semua Kategori" : rule.category}</p>
                <p className="text-xs text-muted-foreground">
                  {rule.silent ? "Silent" : `Min: ${formatMoney(rule.min_amount || 0)}`}
                  {rule.max_amount ? ` · Max: ${formatMoney(rule.max_amount)}` : ""}
                  {` · ${rule.channel}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggle(rule, "enabled")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium ${rule.enabled ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                >
                  {rule.enabled ? "Aktif" : "Nonaktif"}
                </button>
                <button onClick={() => handleDelete(rule.id)} className="p-1.5 rounded-lg hover:bg-muted">
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}