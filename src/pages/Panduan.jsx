import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { panduanCategories } from "@/lib/panduanData";
import PanduanCard from "@/components/PanduanCard";
import PageHeader from "@/components/PageHeader";

// Aksen ikon per kategori memakai token pastel tema (bukan warna palet bawaan data).
const PASTELS = ["card-pastel card-pastel-mint", "card-pastel card-pastel-butter", "card-pastel card-pastel-sage", "card-pastel card-pastel-lime", "card-pastel card-pastel-peach"];
const pastelFor = (i) => PASTELS[i % PASTELS.length];

export default function Panduan() {
  const [query, setQuery] = useState("");

  const allItems = useMemo(
    () => panduanCategories.flatMap((c, ci) => c.items.map((it) => ({ ...it, catTitle: c.title, catAccent: pastelFor(ci) }))),
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
    <div className="px-5 pt-6">
      <PageHeader title="Panduan tools" subtitle="Pelajari setiap fitur NAFKITA — fungsi, cara kerja & langkah pemakaian" back />

      <div className="relative mb-4">
        <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          aria-label="Cari fitur atau tool"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari fitur atau tool..."
          className="w-full h-12 rounded-2xl border border-border bg-card pl-11 pr-4 text-sm outline-none focus:ring-2 ring-primary/30"
        />
      </div>

      {!filtered && (
        <nav aria-label="Kategori panduan" className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 mb-6">
          {panduanCategories.map((cat, ci) => (
            <a key={cat.title} href={`#panduan-cat-${ci}`} className="shrink-0 h-8 px-3.5 rounded-full border border-border bg-card text-xs font-semibold text-foreground/80 inline-flex items-center gap-1.5 hover:bg-muted transition-colors">
              {cat.title} <span className="text-muted-foreground tabular-nums">{cat.items.length}</span>
            </a>
          ))}
        </nav>
      )}

      {filtered ? (
        <section aria-live="polite" className="pb-4">
          <div className="mb-2.5">
            <h2 className="font-semibold text-[17px] leading-tight">Hasil pencarian</h2>
            <p className="text-xs text-muted-foreground">
              {filtered.length} hasil untuk "{query}"
            </p>
          </div>
          {filtered.length === 0 ? (
            <div className="surface rounded-3xl p-6 text-center text-sm text-muted-foreground">
              Tidak ada tool yang cocok dengan pencarian Anda.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((it) => (
                <PanduanCard key={it.to} item={it} accentClass={it.catAccent} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-8 pb-4">
          {panduanCategories.map((cat, ci) => (
            <section key={cat.title} id={`panduan-cat-${ci}`} aria-labelledby={`panduan-cat-h-${ci}`} className="scroll-mt-4">
              <div className="flex items-center gap-3 mb-2.5">
                <span className="w-8 h-8 rounded-full bg-gold text-gold-foreground text-sm font-bold flex items-center justify-center shrink-0">{ci + 1}</span>
                <div className="min-w-0">
                  <h2 id={`panduan-cat-h-${ci}`} className="font-semibold text-[17px] leading-tight">{cat.title}</h2>
                  <p className="text-xs text-muted-foreground">{cat.items.length} tool</p>
                </div>
              </div>
              <div className="space-y-3">
                {cat.items.map((item) => (
                  <PanduanCard key={item.to} item={item} accentClass={pastelFor(ci)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
