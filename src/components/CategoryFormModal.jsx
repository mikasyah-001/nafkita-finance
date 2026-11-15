import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { colorMap, colorOptions } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import FormSheet, { FieldGroup, FieldRow, fieldInput } from "@/components/FormSheet";

const iconOptions = [
  "Wallet", "ShoppingCart", "Car", "ReceiptText", "HeartPulse", "GraduationCap",
  "Gamepad2", "Gift", "PiggyBank", "Landmark", "Coins", "Briefcase", "Utensils",
  "Bus", "Lightbulb", "Package", "Sparkles", "Home", "Heart",
];

const colorNames = {
  orange: "oranye", blue: "biru", pink: "merah muda", red: "merah", teal: "toska", indigo: "nila",
  violet: "ungu", green: "hijau", amber: "kuning", cyan: "sian", rose: "mawar", slate: "abu-abu",
};

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

  const cm = colorMap[color] || colorMap.slate;

  return (
    <FormSheet
      title={isEdit ? "Edit kategori" : "Kategori baru"}
      subtitle="Atur nama, warna, dan ikon agar mudah dikenali."
      onClose={onClose}
      footer={
        <button onClick={handleSave} disabled={saving} className="w-full btn-primary">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
      }
    >
      {!isEdit && (
        <div role="tablist" aria-label="Jenis kategori" className="flex gap-1 p-1 rounded-2xl bg-muted">
          {[
            { k: "expense", l: "Pengeluaran" },
            { k: "income", l: "Pemasukan" },
          ].map((t) => (
            <button
              key={t.k}
              type="button"
              role="tab"
              aria-selected={type === t.k}
              onClick={() => setType(t.k)}
              className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-colors ${type === t.k ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.l}
            </button>
          ))}
        </div>
      )}

      <FieldGroup label="Identitas">
        <FieldRow
          label="Nama kategori"
          htmlFor="category-name"
          trailing={
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 self-center ${cm.bg}`} aria-hidden="true">
              <CategoryIcon name={icon} className={`w-5 h-5 ${cm.text}`} />
            </span>
          }
        >
          <input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mis. Kopi, Hewan peliharaan..."
            className={fieldInput}
          />
        </FieldRow>
      </FieldGroup>

      <section>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Warna</p>
        <div role="radiogroup" aria-label="Warna" className="surface rounded-3xl p-4 flex gap-2.5 flex-wrap">
          {colorOptions.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={`Warna ${colorNames[c] || c}`}
              onClick={() => setColor(c)}
              className={`w-9 h-9 rounded-full ${colorMap[c].solid} ${color === c ? "ring-2 ring-offset-2 ring-offset-card ring-foreground" : ""}`}
            />
          ))}
        </div>
      </section>

      <section>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Ikon</p>
        <div role="radiogroup" aria-label="Ikon" className="grid grid-cols-6 gap-2">
          {iconOptions.map((ic) => {
            const on = icon === ic;
            return (
              <button
                key={ic}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`Ikon ${ic}`}
                onClick={() => setIcon(ic)}
                className={`aspect-square rounded-2xl flex items-center justify-center border transition-all ${on ? "border-primary bg-primary text-primary-foreground ring-1 ring-primary" : "border-border bg-card text-muted-foreground"}`}
              >
                <CategoryIcon name={ic} className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      </section>
    </FormSheet>
  );
}
