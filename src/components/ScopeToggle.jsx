import { Users, Lock } from "lucide-react";
import { useScope } from "@/lib/ScopeContext";

// Satu kontrol "Bersama / Pribadi" untuk semua halaman (sebelumnya markup
// disalin di 7 halaman). Bentuk segmented control: satu wadah, satu pil aktif.
export default function ScopeToggle({ className = "mb-4" }) {
  const { scope, setScope } = useScope();
  const opt = (value, Icon, label) => {
    const active = scope === value;
    const tone = value === "private"
      ? "bg-scope-private text-scope-private-foreground"
      : "bg-scope-shared text-scope-shared-foreground";
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={() => setScope(value)}
        className={`flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors ${active ? `${tone} shadow-sm` : "text-muted-foreground hover:text-foreground"}`}
      >
        <Icon className="w-4 h-4" /> {label}
      </button>
    );
  };
  return (
    <div role="radiogroup" aria-label="Cakupan data" className={`flex gap-1 p-1 rounded-2xl bg-muted ${className}`}>
      {opt("shared", Users, "Bersama")}
      {opt("private", Lock, "Pribadi")}
    </div>
  );
}
