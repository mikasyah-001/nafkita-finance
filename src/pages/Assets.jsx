import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAssets, useRefresh } from "@/hooks/useFinance";
import { formatRupiah, formatNumber, colorMap, assetTypeLabels } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";
import { Landmark, Plus, Loader2, Trash2, X, Coins } from "lucide-react";

const types = ["bank", "emas", "investasi", "properti", "lainnya"];

export default function Assets() {
  const { data: assets = [] } = useAssets();
  const refresh = useRefresh();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", type: "bank", value: "", quantity: "", unit: "", owner: "", notes: "" });

  const total = assets.reduce((s, a) => s + (a.value || 0), 0);
  const emasGrams = assets.filter((a) => a.type === "emas").reduce((s, a) => s + (a.quantity || 0), 0);

  const handleSave = async () => {
    if (!form.name) return toast.error("Isi nama aset");
    if (!form.value) return toast.error("Isi nilai aset");
    setSaving(true);
    try {
      await base44.entities.Asset.create({
        name: form.name,
        type: form.type,
        value: Number(form.value),
        quantity: form.quantity ? Number(form.quantity) : 0,
        unit: form.type === "emas" ? "gram" : form.unit,
        owner: form.owner,
        notes: form.notes,
      });
      refresh();
      toast.success("Aset ditambahkan");
      setForm({ name: "", type: "bank", value: "", quantity: "", unit: "", owner: "", notes: "" });
      setShowForm(false);
    } catch {
      toast.error("Gagal menambah aset");
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.Asset.delete(id);
      refresh();
      toast.success("Aset dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  return (
    <div className="px-5 pt-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Aset Keluarga</h1>
        <button onClick={() => setShowForm(true)} className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white p-5 mb-5 shadow-lg">
        <p className="text-xs opacity-80">Total Nilai Aset</p>
        <p className="text-3xl font-bold tracking-tight">{formatRupiah(total)}</p>
        {emasGrams > 0 && <p className="text-xs opacity-80 mt-2 flex items-center gap-1"><Coins className="w-3.5 h-3.5" /> Emas: {formatNumber(emasGrams)} gram</p>}
      </div>

      {assets.length === 0 ? (
        <EmptyState icon={Landmark} title="Belum ada aset" subtitle="Catat tabungan, emas, investasi, dan aset lainnya untuk memantau kekayaan dan kewajiban zakat." />
      ) : (
        <div className="space-y-3">
          {assets.map((a) => {
            const meta = assetTypeLabels[a.type] || assetTypeLabels.lainnya;
            const cm = colorMap[meta.color] || colorMap.slate;
            return (
              <div key={a.id} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${cm.bg}`}>
                  <CategoryIcon name={meta.icon} className={`w-5 h-5 ${cm.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {meta.label}{a.owner ? ` • ${a.owner}` : ""}
                    {a.type === "emas" && a.quantity ? ` • ${formatNumber(a.quantity)} gr` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatRupiah(a.value)}</p>
                  <button onClick={() => handleDelete(a.id)} className="text-xs text-red-500 mt-1 flex items-center gap-1 ml-auto">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center max-w-md mx-auto">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative w-full bg-background rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Tambah Aset</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <Field label="Nama Aset">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mis. Tabungan BCA, Emas 10gr" className="input" />
              </Field>
              <Field label="Jenis">
                <div className="flex gap-2 flex-wrap">
                  {types.map((t) => (
                    <button key={t} onClick={() => setForm({ ...form, type: t, unit: t === "emas" ? "gram" : form.unit })} className={`px-3 py-1.5 rounded-full text-xs font-medium ${form.type === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {assetTypeLabels[t].label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Nilai (Rp)">
                <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="0" className="input" />
              </Field>
              {form.type === "emas" && (
                <Field label="Jumlah (gram)">
                  <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="0" className="input" />
                </Field>
              )}
              <Field label="Pemilik (opsional)">
                <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="Mis. Suami / Istri" className="input" />
              </Field>
              <Field label="Catatan (opsional)">
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" />
              </Field>
              <button onClick={handleSave} disabled={saving} className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Simpan Aset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}