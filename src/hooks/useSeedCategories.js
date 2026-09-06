import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useCategories } from "./useFinance";
import { defaultCategories } from "@/lib/finance";

/**
 * Memastikan setiap akun memiliki kategori dasar miliknya sendiri.
 * Kategori dicek per nama + tipe, sehingga kategori dasar yang terhapus
 * dipulihkan tanpa menyentuh kategori kustom atau kategori milik user lain.
 */
export function useSeedCategories() {
  const { data: categories, isLoading } = useCategories();
  const qc = useQueryClient();
  const done = useRef(false);

  useEffect(() => {
    if (isLoading || done.current || !categories) return;
    const norm = (value) => String(value || "").trim().toLowerCase();
    const existing = new Set(categories.map((c) => `${c.type}:${norm(c.name)}`));
    const missing = defaultCategories.filter((c) => !existing.has(`${c.type}:${norm(c.name)}`));

    done.current = true;
    if (missing.length > 0) {
      base44.entities.Category.bulkCreate(missing)
        .then(() => qc.invalidateQueries({ queryKey: ["categories"] }))
        .catch(() => { done.current = false; });
    }
  }, [isLoading, categories, qc]);
}