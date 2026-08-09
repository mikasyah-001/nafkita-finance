import { useState } from "react";
import { X, Plus } from "lucide-react";

const SUGGESTIONS = ["keperluan sekolah", "dana darurat", "liburan"];

export default function TagInput({ tags = [], onChange }) {
  const [input, setInput] = useState("");

  const add = (val) => {
    const v = (val || "").trim();
    if (!v || tags.includes(v)) return;
    onChange([...tags, v]);
    setInput("");
  };

  const remove = (t) => onChange(tags.filter((x) => x !== t));

  return (
    <div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              {t}
              <button onClick={() => remove(t)} className="active:scale-90"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center rounded-2xl border border-border px-4 focus-within:ring-2 ring-primary/30">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(input);
            }
          }}
          placeholder="Tambah tag lalu Enter..."
          className="flex-1 py-3 text-sm outline-none bg-transparent"
        />
        <button onClick={() => add(input)} className="text-muted-foreground active:scale-90">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-1.5 flex-wrap mt-2">
        {SUGGESTIONS.filter((s) => !tags.includes(s)).map((s) => (
          <button key={s} onClick={() => add(s)} className="px-2.5 py-1 rounded-full bg-muted text-xs text-muted-foreground active:scale-95 transition-transform">
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}