import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useCategories } from "./useFinance";
import { defaultCategories } from "@/lib/finance";

/**
 * Seeds the app's default categories for users who have none yet
 * (e.g. new users). Runs once when the category list is loaded and empty.
 */
export function useSeedCategories() {
  const { data: categories, isLoading } = useCategories();
  const qc = useQueryClient();
  const done = useRef(false);

  useEffect(() => {
    if (isLoading || done.current || !categories) return;
    if (categories.length === 0) {
      done.current = true;
      base44.entities.Category.bulkCreate(defaultCategories)
        .then(() => qc.invalidateQueries({ queryKey: ["categories"] }))
        .catch(() => { done.current = false; });
    } else {
      done.current = true;
    }
  }, [isLoading, categories, qc]);
}