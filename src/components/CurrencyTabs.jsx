// Chip pemilih mata uang untuk tampilan multi-currency (tanpa konversi).
// Hanya tampil bila ada lebih dari satu mata uang aktif.
export default function CurrencyTabs({ currencies, value, onChange, className }) {
  const list = (currencies || []).filter(Boolean);
  if (list.length <= 1) return null;
  return (
    <div className={`flex gap-1.5 ${className || ""}`}>
      {list.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
            value === c ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}