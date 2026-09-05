import { useMemo, useState } from "react";
import { useTransactions, useMe } from "@/hooks/useFinance";
import { summarizeByCurrency, formatMoneyShort, CURRENCY_CODES, activeCurrencies } from "@/lib/finance";
import { base44 } from "@/api/base44Client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { TrendingUp, SlidersHorizontal, Loader2 } from "lucide-react";
import CurrencyTabs from "@/components/CurrencyTabs";
import { toast } from "sonner";

const MONTH_LABEL = (d) => d.toLocaleString("id-ID", { month: "short" });

export default function ProjectionPanel() {
  const { data: transactions = [] } = useTransactions();
  const { data: me } = useMe();
  const assumptions = me?.projection_assumptions || {};
  const monthsAhead = Number(assumptions.months_ahead ?? 6);
  const incGrowth = (Number(assumptions.monthly_income_growth) || 0) / 100;
  const expGrowth = (Number(assumptions.monthly_expense_growth) || 0) / 100;
  const defaultCur = me?.default_currency || "IDR";

  const [currency, setCurrency] = useState(defaultCur);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    monthly_income_growth: assumptions.monthly_income_growth ?? 0,
    monthly_expense_growth: assumptions.monthly_expense_growth ?? 0,
    months_ahead: monthsAhead,
  });

  const scoped = useMemo(
    () => transactions.filter((t) => (t.currency || "IDR") === currency),
    [transactions, currency]
  );

  const { chartData, avgIncome, avgExpense, forecastEnd } = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ y: d.getFullYear(), m: d.getMonth(), label: MONTH_LABEL(d) });
    }
    const hist = months.map((mo) => {
      const txs = scoped.filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === mo.y && d.getMonth() === mo.m;
      });
      const s = summarizeByCurrency(txs)[currency];
      return { label: mo.label, Riil: Math.round(s.balance), income: s.income, expense: s.expense };
    });
    const avgIncome = hist.reduce((s, h) => s + h.income, 0) / (hist.length || 1);
    const avgExpense = hist.reduce((s, h) => s + h.expense, 0) / (hist.length || 1);

    const forecast = [];
    let cumRealist = 0, cumOptimist = 0, cumPessimist = 0;
    const lastLabel = hist.length ? hist[hist.length - 1].label : "";
    for (let i = 1; i <= monthsAhead; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const incR = avgIncome * Math.pow(1 + incGrowth, i);
      const expR = avgExpense * Math.pow(1 + expGrowth, i);
      const realist = incR - expR;
      const optimist = incR * 1.1 - expR * 0.9;
      const pessimist = incR * 0.9 - expR * 1.1;
      cumRealist += realist;
      cumOptimist += optimist;
      cumPessimist += pessimist;
      forecast.push({
        label: MONTH_LABEL(d),
        Realist: Math.round(cumRealist),
        Optimis: Math.round(cumOptimist),
        Pesimis: Math.round(cumPessimist),
      });
    }
    return {
      chartData: [...hist.map((h) => ({ label: h.label, Riil: h.Riil })), ...forecast],
      avgIncome,
      avgExpense,
      forecastEnd: cumRealist,
    };
  }, [scoped, currency, monthsAhead, incGrowth, expGrowth]);

  const activeCurs = activeCurrencies(summarizeByCurrency(scoped));
  const cur = activeCurs.includes(currency) || activeCurs.length === 0 ? currency : (activeCurs[0] || defaultCur);

  const saveAssumptions = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        projection_assumptions: {
          monthly_income_growth: Number(draft.monthly_income_growth) || 0,
          monthly_expense_growth: Number(draft.monthly_expense_growth) || 0,
          months_ahead: Number(draft.months_ahead) || 6,
        },
      });
      toast.success("Asumsi proyeksi disimpan");
      setOpen(false);
    } catch {
      toast.error("Gagal menyimpan asumsi");
    }
    setSaving(false);
  };

  const hasData = avgIncome > 0 || avgExpense > 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-500" /> Proyeksi Cash Flow</h2>
          <p className="text-xs text-muted-foreground">Perkiraan {monthsAhead} bulan ke depan ({cur})</p>
        </div>
        <button onClick={() => setOpen(!open)} className="text-xs text-muted-foreground flex items-center gap-1">
          <SlidersHorizontal className="w-3.5 h-3.5" /> Asumsi
        </button>
      </div>

      <div className="mb-3">
        <CurrencyTabs currencies={activeCurs.length ? activeCurs : CURRENCY_CODES} value={cur} onChange={setCurrency} />
      </div>

      {open && (
        <div className="rounded-xl border border-border p-3 mb-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Tumbuh pemasukan (%/bln)</label>
              <input type="number" value={draft.monthly_income_growth} onChange={(e) => setDraft({ ...draft, monthly_income_growth: e.target.value })} className="w-full rounded-lg border border-border px-2 py-1.5 text-xs outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Tumbuh pengeluaran (%/bln)</label>
              <input type="number" value={draft.monthly_expense_growth} onChange={(e) => setDraft({ ...draft, monthly_expense_growth: e.target.value })} className="w-full rounded-lg border border-border px-2 py-1.5 text-xs outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Bulan ke depan</label>
              <input type="number" min="1" max="12" value={draft.months_ahead} onChange={(e) => setDraft({ ...draft, months_ahead: e.target.value })} className="w-full rounded-lg border border-border px-2 py-1.5 text-xs outline-none" />
            </div>
          </div>
          <button onClick={saveAssumptions} disabled={saving} className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-60">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Simpan Asumsi
          </button>
        </div>
      )}

      {!hasData ? (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground mb-1">Belum cukup data</p>
          <p className="text-xs text-muted-foreground">Catat beberapa transaksi {cur} untuk melihat proyeksi cash flow.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
            <div className="rounded-xl bg-muted/50 p-2">
              <p className="text-muted-foreground text-[10px]">Rata-rata pemasukan</p>
              <p className="font-semibold tabular-nums truncate">{formatMoneyShort(avgIncome, cur)}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-2">
              <p className="text-muted-foreground text-[10px]">Rata-rata pengeluaran</p>
              <p className="font-semibold tabular-nums truncate">{formatMoneyShort(avgExpense, cur)}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-2">
              <p className="text-muted-foreground text-[10px]">Saldo proyeksi</p>
              <p className={`font-semibold tabular-nums truncate ${forecastEnd >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatMoneyShort(forecastEnd, cur)}</p>
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => formatMoneyShort(v, cur)} />
                <Tooltip formatter={(v) => formatMoneyShort(v, cur)} contentStyle={{ borderRadius: 12, border: "none", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="Riil" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="Realist" stroke="#10b981" strokeWidth={2} strokeDasharray="5 3" dot={false} />
                <Line type="monotone" dataKey="Optimis" stroke="#0d9488" strokeWidth={1.5} strokeDasharray="2 4" dot={false} />
                <Line type="monotone" dataKey="Pesimis" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="2 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Rentang optimis/pesimis mengasumsikan variasi ±10% pemasukan & pengeluaran. Bukan jaminan finansial.</p>
        </>
      )}
    </div>
  );
}