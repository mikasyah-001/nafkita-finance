import { useMemo, useState, useEffect } from "react";
import { useTransactions, useAssets, useMe } from "@/hooks/useFinance";
import { summarizeByCurrency, formatMoneyShort, CURRENCY_CODES, activeCurrencies } from "@/lib/finance";
import { base44 } from "@/api/base44Client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { TrendingUp, SlidersHorizontal, Loader2 } from "lucide-react";
import CurrencyTabs from "@/components/CurrencyTabs";
import { toast } from "sonner";

const MONTH_LABEL = (d) => d.toLocaleString("id-ID", { month: "short" });
const clamp = (v, min, max) => Math.min(Math.max(Number(v) || 0, min), max);

export default function ProjectionPanel({ scope = "shared" }) {
  const { data: transactions = [] } = useTransactions();
  const { data: assets = [] } = useAssets();
  const { data: me } = useMe();
  const assumptions = me?.projection_assumptions || {};
  const monthsAhead = clamp(Math.round(Number(assumptions.months_ahead ?? 6)), 1, 12);
  const incGrowth = clamp(assumptions.monthly_income_growth ?? 0, -50, 200) / 100;
  const expGrowth = clamp(assumptions.monthly_expense_growth ?? 0, -50, 200) / 100;
  const defaultCur = me?.default_currency || "IDR";

  const [currency, setCurrency] = useState(defaultCur);
  useEffect(() => { setCurrency(defaultCur); }, [defaultCur]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    monthly_income_growth: assumptions.monthly_income_growth ?? 0,
    monthly_expense_growth: assumptions.monthly_expense_growth ?? 0,
    months_ahead: monthsAhead,
  });

  // Currency tabs dihitung dari SELURUH transaksi terlihat (sebelum filter mata uang),
  // agar pengguna dapat berpindah ke mata uang lain yang memiliki data.
  const allActiveCurs = activeCurrencies(summarizeByCurrency(transactions));
  const cur = allActiveCurs.includes(currency) || allActiveCurs.length === 0 ? currency : (allActiveCurs[0] || defaultCur);

  // Filter transaksi sesuai scope (Bersama/Pribadi) + mata uang terpilih.
  const scoped = useMemo(
    () => transactions.filter((t) => {
      const scopeMatch = scope === "private" ? t.visibility === "private" : t.visibility !== "private";
      return scopeMatch && (t.currency || "IDR") === cur;
    }),
    [transactions, scope, cur]
  );

  const { chartData, avgIncome, avgOutflow, forecastEnd } = useMemo(() => {
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
      const s = summarizeByCurrency(txs)[cur] || { income: 0, expense: 0, sedekah: 0, balance: 0 };
      // Sedekah termasuk dalam arus keluar untuk baseline forecast.
      return { label: mo.label, net: Math.round(s.balance), income: s.income, outflow: s.expense + s.sedekah };
    });

    // Rata-rata hanya atas bulan yang punya data (skip bulan kosong).
    const monthsWithData = hist.filter((h) => h.income > 0 || h.outflow > 0);
    const denom = monthsWithData.length || 1;
    const avgIncome = monthsWithData.reduce((s, h) => s + h.income, 0) / denom;
    const avgOutflow = monthsWithData.reduce((s, h) => s + h.outflow, 0) / denom;

    // Saldo awal aktual: total aset bank mata uang terpilih sesuai scope.
    const startBalance = assets
      .filter((a) => a.type === "bank" && (a.currency || "IDR") === cur && (scope === "private" ? a.visibility === "private" : a.visibility !== "private"))
      .reduce((s, a) => s + (a.value || 0), 0);

    // Riil: cumulative net yang di-offset agar titik terakhir = saldo aktual saat ini,
    // sehingga garis riil terhubung mulus ke forecast yang dimulai dari saldo aktual.
    const net6 = hist.reduce((s, h) => s + h.net, 0);
    let cumHist = startBalance - net6;
    const histCum = hist.map((h) => {
      cumHist += h.net;
      return { label: h.label, Riil: Math.round(cumHist) };
    });

    // Forecast dimulai dari saldo aktual, lalu mengakumulasi arus kas masa depan.
    const forecast = [];
    let cumRealist = startBalance, cumOptimist = startBalance, cumPessimist = startBalance;
    for (let i = 1; i <= monthsAhead; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const incR = avgIncome * Math.pow(1 + incGrowth, i);
      const expR = avgOutflow * Math.pow(1 + expGrowth, i);
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
      chartData: [...histCum, ...forecast],
      avgIncome,
      avgOutflow,
      forecastEnd: cumRealist,
    };
  }, [scoped, cur, monthsAhead, incGrowth, expGrowth, assets, scope]);

  const saveAssumptions = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        projection_assumptions: {
          monthly_income_growth: clamp(draft.monthly_income_growth, -50, 200),
          monthly_expense_growth: clamp(draft.monthly_expense_growth, -50, 200),
          months_ahead: clamp(Math.round(Number(draft.months_ahead) || 6), 1, 12),
        },
      });
      toast.success("Asumsi proyeksi disimpan");
      setOpen(false);
    } catch {
      toast.error("Gagal menyimpan asumsi");
    }
    setSaving(false);
  };

  const hasData = avgIncome > 0 || avgOutflow > 0;
  const tabsList = allActiveCurs.length ? allActiveCurs : CURRENCY_CODES;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-500" /> Proyeksi Cash Flow</h2>
          <p className="text-xs text-muted-foreground">Perkiraan {monthsAhead} bulan ke depan ({cur}) • {scope === "private" ? "Pribadi" : "Bersama"}</p>
        </div>
        <button onClick={() => setOpen(!open)} className="text-xs text-muted-foreground flex items-center gap-1">
          <SlidersHorizontal className="w-3.5 h-3.5" /> Asumsi
        </button>
      </div>

      <div className="mb-3">
        <CurrencyTabs currencies={tabsList} value={cur} onChange={setCurrency} />
      </div>

      {open && (
        <div className="rounded-xl border border-border p-3 mb-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Tumbuh pemasukan (%/bln)</label>
              <input type="number" value={draft.monthly_income_growth} onChange={(e) => setDraft({ ...draft, monthly_income_growth: Number(e.target.value) || 0 })} className="w-full rounded-lg border border-border px-2 py-1.5 text-xs outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Tumbuh pengeluaran (%/bln)</label>
              <input type="number" value={draft.monthly_expense_growth} onChange={(e) => setDraft({ ...draft, monthly_expense_growth: Number(e.target.value) || 0 })} className="w-full rounded-lg border border-border px-2 py-1.5 text-xs outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Bulan ke depan</label>
              <input type="number" min="1" max="12" value={draft.months_ahead} onChange={(e) => setDraft({ ...draft, months_ahead: Number(e.target.value) || 6 })} className="w-full rounded-lg border border-border px-2 py-1.5 text-xs outline-none" />
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
              <p className="text-muted-foreground text-[10px]">Rata-rata arus keluar</p>
              <p className="font-semibold tabular-nums truncate">{formatMoneyShort(avgOutflow, cur)}</p>
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
          <p className="text-[10px] text-muted-foreground mt-2">Forecast dimulai dari saldo aset bank aktual, termasuk sedekah dalam arus keluar. Rentang optimis/pesimis ±10%. Bukan jaminan finansial.</p>
        </>
      )}
    </div>
  );
}