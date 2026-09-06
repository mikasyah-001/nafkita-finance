// Chip pemilih mata uang untuk tampilan multi-currency (tanpa konversi).
// Hanya tampil bila ada lebih dari satu mata uang aktif.
export default function CurrencyTabs({ currencies, value, onChange, className = "", variant = "default" }) {
  const list = [...new Set((currencies || []).filter(Boolean))];
  if (list.length <= 1) return null;
  const inverse = variant === "inverse";

  return (
    <div className={`flex flex-wrap gap-1.5 ${className || ""}`} role="group" aria-label="Pilih mata uang tampilan">
      {list.map((c) => {
        const selected = value === c;
        return (
          <button
            type="button"
            key={c}
            onClick={() => onChange(c)}
            aria-pressed={selected}
            aria-label={`${c}${selected ? ", sedang dipilih" : ""}`}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              inverse
                ? selected
                  ? "bg-white text-slate-950 border-white shadow-sm ring-2 ring-white/35"
                  : "bg-white/10 text-white/75 border-white/20 hover:bg-white/20"
                : selected
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-muted text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${selected ? (inverse ? "bg-emerald-500" : "bg-primary-foreground") : (inverse ? "bg-white/35" : "bg-muted-foreground/35")}`} />
            {c}
          </button>
        );
      })}
    </div>
  );
}