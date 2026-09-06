import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { colorMap, colorOptions } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";

const iconOptions = [
  "Wallet", "ShoppingCart", "Car", "ReceiptText", "HeartPulse", "GraduationCap",
  "Gamepad2", "Gift", "PiggyBank", "Landmark", "Coins", "Briefcase", "Utensils",
  "Bus", "Lightbulb", "Package", "Sparkles", "Home", "Heart",
];

export default function CategoryFormModal({ open, onClose, onSaved, initial, categories }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("expense");
  const [color, setColor] = useState("slate");
  const [icon, setIcon] = useState("Wallet");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name || "");
      setType(initial?.type || "expense");
      setColor(initial?.color || "slate");
      setIcon(initial?.icon || "Wallet");
    }
  }, [open, initial]);

  if (!open) return null;

  const isEdit = !!initial;

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return toast.error("Isi nama kategori");
    const dup = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.id !== initial?.id);
    if (dup) return toast.error("Nama kategori sudah ada");
    setSaving(true);
    try {
      if (isEdit) {
        const oldName = initial.name;
        await base44.entities.Category.update(initial.id, { name: trimmed, color, icon });
        // Cascade nama ke transaksi & anggaran milik sendiri (RLS owner-only).
        if (oldName && oldName !== trimmed) {
          try { await base44.entities.Transaction.updateMany({ category: oldName }, { $set: { category: trimmed } }); } catch {}
          try { await base44.entities.Budget.updateMany({ category: oldName }, { $set: { category: trimmed } }); } catch {}
        }
      } else {
        await base44.entities.Category.create({ name: trimmed, type, color, icon, is_default: false });
      }
      onSaved();
      toast.success(isEdit ? "Kategori diperbarui" : "Kategori ditambahkan");
      onClose();
    } catch {
      toast.error("Gagal menyimpan kategori");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">{isEdit ? "Edit Kategori" : "Kategori Baru"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">✕</button>
        </div>

        {!isEdit && (
          <div className="flex gap-2 bg-muted p-1 rounded-2xl mb-4">
            {[
              { k: "expense", l: "Pengeluaran" },
              { k: "income", l: "Pemasukan" },
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => setType(t.k)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${type === t.k ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                {t.l}
              </button>
            ))}
          </div>
        )}

        <label className="text-xs text-muted-foreground mb-1.5 block">Nama Kategori</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mis. Kopi, Hewan Peliharaan..."
          className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30 mb-4"
        />

        <label className="text-xs text-muted-foreground mb-2 block">Warna</label>
        <div className="flex gap-2 flex-wrap mb-4">
          {colorOptions.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-9 h-9 rounded-full ${colorMap[c].solid} ${color === c ? "ring-2 ring-offset-2 ring-foreground" : ""}`}
            />
          ))}
        </div>

        <label className="text-xs text-muted-foreground mb-2 block">Ikon</label>
        <div className="grid grid-cols-6 gap-2 mb-5">
          {iconOptions.map((ic) => (
            <button
              key={ic}
              onClick={() => setIcon(ic)}
              className={`aspect-square rounded-xl flex items-center justify-center border transition-all ${icon === ic ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <CategoryIcon name={ic} className="w-4 h-4" />
            </button>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </div>
  );
}