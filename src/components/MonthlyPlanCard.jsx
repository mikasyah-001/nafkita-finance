import { useEffect, useMemo, useState } from "react";
import { useTransactions, useBudgets, useRateMap } from "@/hooks/useFinance";
import { useSavePlan } from "@/hooks/useSavePlan";
import { formatMoney, formatMoneyShort, monthlyPlan, planProgress, summarizeConsolidated, filterReportableTx, inScope, isInMonth } from "@/lib/finance";
import { toast } from "sonner";
import { TrendingUp, Vault, CheckCircle2 } from "lucide-react";
import MoneyInput from "@/components/MoneyInput";

// Rencana bulanan: target pemasukan & target menabung ("sisihkan dulu").
// Capaian memakai logika yang sama dengan Beranda: transaksi reportable,
// dikonversi ke mata uang tampilan. Menabung = pemasukan − pengeluaran − sedekah.
export default function MonthlyPlanCard({ period, year, month, scope, currency }) {
  const { data: transactions = [] } = useTransactions();
  const { data: budgets = [] } = useBudgets();
  const { map: rateMap } = useRateMap();

  const plan = monthlyPlan(budgets, { period, scope, currency });
  const actual = useMemo(() => {
    const list = transactions.filter((t) => filterReportableTx(t) && inScope(t, scope) && isInMonth(t, year, month));
    return summarizeConsolidated(list, currency, rateMap);
  }, [transactions, scope, year, month, currency, rateMap]);
  const saved = actual.balance;

  const [draft, setDraft] = useState({});
  useEffect(() => { setDraft({}); }, [period, scope, currency]);
  const value = (key) => (draft[key] !== undefined ? draft[key] : plan[key] || "");

  const savePlan = useSavePlan();
  const save = async (key) => {
    if (draft[key] === undefined) return;
    try {
      await savePlan({ key, amount: draft[key], plan, period, scope, currency });
      setDraft((d) => { const n = { ...d }; delete n[key]; return n; });
      toast.success("Rencana disimpan");
    } catch (e) {
      toast.error(e?.message === "Nominal rencana tidak valid" || e?.code === "not_owner" ? e.message : "Gagal menyimpan rencana");
      if (e?.code === "not_owner") setDraft((d) => { const n = { ...d }; delete n[key]; return n; });
    }
  };

  const rows = [
    { key: "income", icon: TrendingUp, label: "Target pemasukan", actual: actual.income, tone: "card-pastel-mint", hint: "Gaji, usaha, dan pemasukan lain bulan ini." },
    { key: "savings", icon: Vault, label: "Target menabung", actual: saved, tone: "card-pastel-butter", hint: "Sisa setelah pengeluaran & sedekah. Sisihkan di awal bulan." },
  ];

  return (
    <section className="surface rounded-3xl p-4 mb-5" aria-labelledby="rencana-bulan">
      <h2 id="rencana-bulan" className="font-semibold text-[17px] leading-tight">Rencana bulan ini</h2>
      <p className="text-xs text-muted-foreground mb-3">Tentukan target, NAFKITA memantau capaiannya.</p>
      <div className="space-y-3">
        {rows.map(({ key, icon: Icon, label, actual: act, tone, hint }) => {
          const target = plan[key];
          const p = planProgress(act, target);
          return (
            <div key={key} className={`card-pastel ${tone} rounded-2xl p-3.5`}>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={`plan-${key}`} className="flex items-center gap-2 text-sm font-semibold"><Icon className="w-4 h-4" /> {label}</label>
                <div className="flex items-center rounded-xl bg-white/70 dark:bg-white/10 px-2.5 w-[46%]">
                  <span className="text-xs opacity-70 mr-1">{currency}</span>
                  <MoneyInput currency={currency}
                    id={`plan-${key}`} placeholder="0"
                    value={value(key)}
                    onChange={(v) => setDraft((d) => ({ ...d, [key]: v }))}
                    onBlur={() => save(key)}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    className="w-full py-1.5 text-sm font-bold bg-transparent outline-none tabular-nums text-right"
                  />
                </div>
              </div>
              {target > 0 ? (
                <>
                  <div className="mt-2.5 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-[hsl(var(--pastel-ink))]" style={{ width: `${p.pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] mt-1.5 opacity-80 tabular-nums">
                    <span>Tercapai {formatMoneyShort(Math.max(0, act), currency)} ({Math.round(p.pct)}%)</span>
                    <span className="inline-flex items-center gap-1 font-semibold">{p.reached ? <><CheckCircle2 className="w-3 h-3" /> Tercapai</> : `Kurang ${formatMoney(p.remaining, currency)}`}</span>
                  </div>
                </>
              ) : (
                <p className="text-[11px] opacity-75 mt-1.5">{hint}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
