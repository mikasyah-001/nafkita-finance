import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, BookOpen } from "lucide-react";
import { panduanCategories } from "@/lib/panduanData";
import PanduanCard from "@/components/PanduanCard";

export default function Panduan() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const allItems = useMemo(
    () => panduanCategories.flatMap((c) => c.items.map((it) => ({ ...it, catTitle: c.title, catColor: c.color, catBg: c.bg }))),
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return allItems.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.short.toLowerCase().includes(q) ||
        it.description.toLowerCase().includes(q)
    );
  }, [query, allItems]);

  return (
    <div className="px-5 pt-8 pb-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" /> Panduan Tools
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Pelajari setiap fitur NAFKITA — fungsi, cara kerja & langkah pemakaian</p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari fitur atau tool..."
          className="w-full rounded-xl border border-border pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary/30 bg-transparent"
        />
      </div>

      {filtered ? (
        <div>
          <p className="text-xs text-muted-foreground mb-3">
            {filtered.length} hasil untuk "{query}"
          </p>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Tidak ada tool yang cocok dengan pencarian Anda.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((it) => (
                <PanduanCard key={it.to} item={it} accentClass={it.catBg + " " + it.catColor} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {panduanCategories.map((cat) => (
            <div key={cat.title}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-1 h-5 rounded-full ${cat.color.replace("text-", "bg-")}`} />
                <h2 className="font-semibold text-sm">{cat.title}</h2>
                <span className="text-xs text-muted-foreground">({cat.items.length})</span>
              </div>
              <div className="space-y-3">
                {cat.items.map((item) => (
                  <PanduanCard key={item.to} item={item} accentClass={cat.bg + " " + cat.color} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}