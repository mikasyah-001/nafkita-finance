import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { formatRupiah } from "@/lib/finance";
import { Users, TrendingUp, TrendingDown } from "lucide-react";

export default function UserContributionChart({ transactions }) {
  const [view, setView] = useState("expense");

  const userData = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      const name = t.input_by_name || "Keluarga";
      if (!map[name]) map[name] = { name, income: 0, expense: 0 };
      if (t.type === "income") map[name].income += t.amount;
      else if (t.type === "expense") map[name].expense += t.amount;
    });
    return Object.values(map);
  }, [transactions]);

  if (userData.length === 0) return null;

  const data = userData.map((u) => ({ name: u.name, value: view === "expense" ? u.expense : u.income }));
  const total = data.reduce((s, d) => s + d.value, 0);
  const top = data.slice().sort((a, b) => b.value - a.value)[0];
  const color = view === "expense" ? "#ef4444" : "#10b981";

  const tickFmt = (v) =>
    v >= 1000000 ? `${(v / 1000000).toFixed(1).replace(".0", "")}jt` : v >= 1000 ? `${Math.round(v / 1000)}rb` : v;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500" /> Kontribusi Pasangan
        </h2>
        <div className="flex gap-1 bg-muted p-1 rounded-xl">
          <button
            onClick={() => setView("expense")}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${view === "expense" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            <TrendingDown className="w-3 h-3" /> Pengeluaran
          </button>
          <button
            onClick={() => setView("income")}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${view === "income" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            <TrendingUp className="w-3 h-3" /> Pemasukan
          </button>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={tickFmt} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              formatter={(v) => formatRupiah(v)}
              contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 12 }}
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {total > 0 && (
        <p className="text-xs text-muted-foreground mt-3 text-center">
          {view === "expense" ? "Pengeluaran terbanyak" : "Pemasukan terbesar"} dicatat oleh{" "}
          <span className="font-medium text-foreground">{top.name}</span> ({Math.round((top.value / total) * 100)}% dari total {formatRupiah(total)}).
        </p>
      )}
    </div>
  );
}