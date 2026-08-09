import { Link } from "react-router-dom";
import { formatRupiah, formatDate, colorMap } from "@/lib/finance";
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
        <p className="text-sm font-medium truncate">
          {tx.merchant || tx.notes || (isSedekah ? "Sedekah & Infaq" : category?.name || "Transaksi")}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {tx.input_by_name || "Keluarga"} • {formatDate(tx.date, "dd MMM, HH:mm")}
        </p>
      </div>
      <div className={`text-sm font-semibold whitespace-nowrap ${isIncome ? "text-emerald-600" : isSedekah ? "text-teal-600" : "text-foreground"}`}>
        {isIncome ? "+" : "-"}{formatRupiah(tx.amount)}
      </div>
    </Link>
  );
}