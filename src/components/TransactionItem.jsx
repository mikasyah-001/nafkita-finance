import { Link } from "react-router-dom";
import { Lock, Clock, X } from "lucide-react";
import { formatDate, colorMap } from "@/lib/finance";
import Money from "./Money";
import CategoryIcon from "./CategoryIcon";

export default function TransactionItem({ tx, categories }) {
  const isIncome = tx.type === "income";
  const isSedekah = tx.type === "sedekah";
  const category = categories?.find((c) => c.name === tx.category);
  const color = isSedekah ? "teal" : category?.color || "slate";
  const icon = isSedekah ? "Heart" : category?.icon || "Wallet";
  const c = colorMap[color] || colorMap.slate;

  return (
    <Link to={`/transaksi/${tx.id}`} className="flex items-center gap-3 py-3 active:bg-muted/50 -mx-1 px-1 rounded-lg transition-colors">
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${c.bg}`}>
        <CategoryIcon name={icon} className={`w-5 h-5 ${c.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate flex items-center gap-1">
          {tx.visibility === "private" && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
          {tx.merchant || tx.notes || (isSedekah ? "Sedekah & Infaq" : category?.name || "Transaksi")}
          {tx.approval_status === "pending" && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-warning/15 text-warning text-[9px] font-medium shrink-0">
              <Clock className="w-2.5 h-2.5" /> Menunggu
            </span>
          )}
          {tx.approval_status === "rejected" && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 text-[9px] font-medium shrink-0">
              <X className="w-2.5 h-2.5" /> Ditolak
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {tx.input_by_name || "Keluarga"} • {formatDate(tx.date, "dd MMM, HH:mm")}
        </p>
        {tx.tags?.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-1">
            {tx.tags.map((t) => (
              <span key={t} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-medium">{t}</span>
            ))}
          </div>
        )}
      </div>
      <div className={`text-sm font-semibold whitespace-nowrap shrink-0 tabular-nums ${isIncome ? "text-income" : isSedekah ? "text-sedekah" : "text-expense"} ${tx.approval_status === "rejected" ? "opacity-40 line-through" : ""} ${tx.approval_status === "pending" ? "opacity-60" : ""}`}>
        {isIncome ? "+" : "-"}<Money value={tx.amount} currency={tx.currency} />
      </div>
    </Link>
  );
}