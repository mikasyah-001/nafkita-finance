import { useState } from "react";
import { useColorPrefs } from "@/lib/ColorPrefsContext";
import { PRESETS, DEFAULT_PRIMARY, DEFAULT_SCOPE_SHARED, DEFAULT_SCOPE_PRIVATE } from "@/lib/colorPrefs";
import { toast } from "sonner";
import { Loader2, Check, RotateCcw } from "lucide-react";

export default function ColorPreferenceManager() {
  const { primary, shared, privateColor, saveColorPrefs } = useColorPrefs();
  const [saving, setSaving] = useState(null);

  const handlePick = async (key, value) => {
    setSaving(key);
    try {
      await saveColorPrefs({ [key]: value });
      toast.success("Warna diperbarui");
    } catch {
      toast.error("Gagal menyimpan warna");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-5">
      <SwatchRow
        title="Warna Primer Brand"
        desc="Warna utama tombol, navigasi aktif, aksen & gradient kartu."
        current={primary}
        defaultVal={DEFAULT_PRIMARY}
        saving={saving === "theme_primary"}
        onPick={(v) => handlePick("theme_primary", v)}
      />
      <SwatchRow
        title="Warna Mode Bersama"
        desc="Tint background & tombol saat mode Bersama aktif."
        current={shared}
        defaultVal={DEFAULT_SCOPE_SHARED}
        saving={saving === "scope_shared_color"}
        onPick={(v) => handlePick("scope_shared_color", v)}
      />
      <SwatchRow
        title="Warna Mode Pribadi"
        desc="Tint background & tombol saat mode Pribadi aktif."
        current={privateColor}
        defaultVal={DEFAULT_SCOPE_PRIVATE}
        saving={saving === "scope_private_color"}
        onPick={(v) => handlePick("scope_private_color", v)}
      />
    </div>
  );
}

function SwatchRow({ title, desc, current, defaultVal, saving, onPick }) {
  const isDefault = current === defaultVal;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium">{title}</p>
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-xs text-muted-foreground mb-2.5">{desc}</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onPick(defaultVal)}
          className={`w-8 h-8 rounded-full border-2 border-dashed flex items-center justify-center transition-colors ${isDefault ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-foreground/40"}`}
          title="Kembalikan ke default"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        {PRESETS.map((p) => {
          const selected = current === p.hsl;
          return (
            <button
              key={p.hsl}
              onClick={() => onPick(p.hsl)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90 ${selected ? "ring-2 ring-offset-2 ring-offset-background ring-foreground/40" : ""}`}
              style={{ backgroundColor: `hsl(${p.hsl})` }}
              title={p.name}
              aria-label={p.name}
            >
              {selected && <Check className="w-4 h-4 text-white drop-shadow" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}