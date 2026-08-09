import { useMemo, useState } from "react";
import { formatDate } from "@/lib/finance";
import TransactionItem from "./TransactionItem";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEK_DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export default function CalendarView({ transactions, categories }) {
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(null);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const byDay = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      const key = formatDate(t.date, "yyyy-MM-dd");
      if (!map[key]) map[key] = { count: 0, items: [] };
      map[key].count++;
      map[key].items.push(t);
    });
    return map;
  }, [transactions]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayKey = formatDate(new Date(), "yyyy-MM-dd");
  const monthName = formatDate(new Date(year, month, 1), "MMMM yyyy");
  const selectedItems = selected ? byDay[selected]?.items || [] : [];

  return (
    <div>
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 mb-3">
        <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="font-medium text-sm">{monthName}</p>
        <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEK_DAYS.map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const key = formatDate(new Date(year, month, d), "yyyy-MM-dd");
            const dayData = byDay[key];
            const isToday = key === todayKey;
            const isSelected = key === selected;
            return (
              <button
                key={i}
                onClick={() => setSelected(isSelected ? null : key)}
                className={`relative aspect-square rounded-xl flex flex-col items-center justify-center transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isToday
                    ? "bg-primary/10 text-primary font-bold"
                    : dayData
                    ? "bg-muted/60"
                    : "active:bg-muted/40"
                }`}
              >
                <span className="text-xs">{d}</span>
                {dayData && (
                  <span className={`text-[9px] leading-none mt-0.5 ${isSelected ? "opacity-90" : "text-muted-foreground"}`}>
                    {dayData.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        {selected ? (
          <>
            <p className="text-xs text-muted-foreground mb-1 px-1">{formatDate(selected, "EEEE, dd MMMM yyyy")}</p>
            {selectedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Tidak ada transaksi pada tanggal ini.</p>
            ) : (
              <div className="rounded-2xl border border-border bg-card px-4">
                {selectedItems.map((t) => (
                  <TransactionItem key={t.id} tx={t} categories={categories} />
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">Pilih tanggal untuk melihat transaksi hari itu.</p>
        )}
      </div>
    </div>
  );
}