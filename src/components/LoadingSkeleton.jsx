import { Skeleton } from "@/components/ui/skeleton";

// Kerangka saat data dimuat — mencegah layar sempat menampilkan
// "Belum ada data" / Rp 0 sebelum data sebenarnya tiba.

export function ListSkeleton({ rows = 5, className = "" }) {
  return (
    <div className={`surface px-4 ${className}`} aria-busy="true" aria-label="Memuat data">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3.5 border-b border-border last:border-0">
          <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className = "h-36" }) {
  return <Skeleton className={`w-full rounded-3xl ${className}`} aria-busy="true" aria-label="Memuat data" />;
}

export function GridSkeleton({ count = 4, className = "" }) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
    </div>
  );
}
