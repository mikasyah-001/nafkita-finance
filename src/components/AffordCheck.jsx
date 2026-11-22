import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight } from "lucide-react";
import { useBudgets, useCategories, useTransactions } from "@/hooks/useFinance";
import { useMonthPace } from "@/hooks/useMonthPace";
import { useScope } from "@/lib/ScopeContext";
import { spendingPace, isExpenseBudget, filterReportableTx, currencySymbol, effectiveLimit } from "@/lib/finance";
import FormSheet, { FieldGroup, FieldRow, fieldInput } from "@/components/FormSheet";
import NativeSelect from "@/components/NativeSelect";
import MoneyInput from "@/components/MoneyInput";
import Money from "@/components/Money";

// "Bisakah saya beli ini?" — simulasi dampak sebuah pembelian ke jatah
// harian & anggaran kategori SEBELUM dicatat. Tidak menyimpan apa pun.
export function AffordCheckSheet({ onClose }) {
  const { scope } = useScope();
  const { pace, currency, plan, summary, now } = useMonthPace({ scope });
  const { data: budgets = [] } = useBudgets();
  const { data: categories = [] } = useCategories();
  const { data: transactions = [] } = useTransactions();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const amt = Number(amount) || 0;

  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const catBudget = useMemo(() => {
    if (!category) return null;
    const b = budgets.find((x) => isExpenseBudget(x) && x.period === period && (x.visibility || "shared") === scope && (x.currency || "IDR") === currency && x.category === category && x.limit_amount > 0);
    if (!b) return null;
    const spent = transactions
      .filter((t) => {
        const d = new Date(t.date);
        const inScope = scope === "private" ? t.visibility === "private" : t.visibility !== "private";
        return inScope && t.type === "expense" && t.category === category && (t.currency || "IDR") === currency
          && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && filterReportableTx(t);
      })
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    return { limit: effectiveLimit(b), spent, after: effectiveLimit(b) - spent - amt };
  }, [category, budgets, transactions, period, scope, currency, amt, now]);

  const after = useMemo(() => spendingPace({
    income: summary.income, expense: summary.expense, sedekah: summary.sedekah,
    planIncome: plan.income, planSavings: plan.savings, now, extraSpend: amt,
  }), [summary, plan, now, amt]);

  let verdict = null;
  if (amt > 0 && after) {
    if (after.over) verdict = { kind: "no", icon: XCircle, title: "Melebihi anggaran bulan ini", tone: "bg-destructive/10 text-destructive border-destructive/25" };
    else if ((catBudget && catBudget.after < 0) || (pace && after.perDay < pace.perDay * 0.5)) verdict = { kind: "warn", icon: AlertTriangle, title: "Bisa, tapi hati-hati", tone: "bg-warning/10 text-warning border-warning/30" };
    else verdict = { kind: "ok", icon: CheckCircle2, title: "Aman", tone: "bg-success/10 text-success border-success/25" };
  }
  const expenseCats = categories.filter((c) => c.type === "expense");

  return (
    <FormSheet title="Bisakah saya beli ini?" subtitle="Simulasi saja — tidak ada yang dicatat." onClose={onClose}
      footer={<button onClick={onClose} className="w-full btn-secondary">Tutup</button>}>
      <section className="card-gradient-primary rounded-[24px] p-4">
        <label htmlFor="afford-amount" className="text-xs opacity-80">Harga barang</label>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-lg font-semibold opacity-70">{currencySymbol(currency)}</span>
          <MoneyInput id="afford-amount" currency={currency} value={amount} onChange={setAmount} placeholder="0" autoFocus
            className="flex-1 min-w-0 bg-transparent outline-none font-heading text-[32px] leading-none font-extrabold tabular-nums placeholder:text-white/30 text-[hsl(var(--hero-foreground))]" />
        </div>
      </section>

      <FieldGroup label="Kategori (opsional)">
        <FieldRow label="Untuk cek sisa anggaran kategori" htmlFor="afford-cat">
          <NativeSelect id="afford-cat" sheetTitle="Kategori" value={category} onChange={(e) => setCategory(e.target.value)} className={`${fieldInput} bg-background`}>
            <option value="">Tanpa kategori</option>
            {expenseCats.map((c) => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
          </NativeSelect>
        </FieldRow>
      </FieldGroup>

      {!pace ? (
        <div className="surface p-4 text-sm">
          Belum ada pemasukan atau rencana bulan ini untuk dijadikan patokan.{" "}
          <Link to="/anggaran" className="text-primary font-medium inline-flex items-center gap-1">Atur rencana <ArrowRight className="w-3 h-3" /></Link>
        </div>
      ) : (
        <>
          {verdict && (
            <div role="status" className={`rounded-2xl border p-3.5 flex items-center gap-3 ${verdict.tone}`}>
              <verdict.icon className="w-6 h-6 shrink-0" />
              <p className="font-semibold">{verdict.title}</p>
            </div>
          )}
          <div className="surface p-4 space-y-3 text-sm">
            <Compare label="Jatah per hari" before={pace.perDay} after={amt > 0 ? after.perDay : null} currency={currency} suffix={`· ${pace.daysLeft} hari lagi`} />
            <Compare label="Sisa anggaran bulan ini" before={pace.remaining} after={amt > 0 ? after.remaining : null} currency={currency} />
            {catBudget && <Compare label={`Sisa anggaran ${category}`} before={catBudget.limit - catBudget.spent} after={amt > 0 ? catBudget.after : null} currency={currency} />}
            {category && !catBudget && <p className="text-xs text-muted-foreground">Kategori {category} belum punya batas anggaran bulan ini.</p>}
            {pace.source === "income" && <p className="text-xs text-muted-foreground">Patokan: pemasukan nyata bulan ini (rencana pemasukan belum diatur).</p>}
          </div>
        </>
      )}
    </FormSheet>
  );
}

function Compare({ label, before, after, currency, suffix }) {
  const neg = (v) => v != null && v < 0;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label} {suffix && <span>{suffix}</span>}</p>
      <p className="font-semibold tabular-nums flex flex-wrap items-baseline gap-x-2">
        <span className={neg(before) ? "text-destructive" : ""}><Money value={before} currency={currency} /></span>
        {after != null && <>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground self-center" />
          <span className={neg(after) ? "text-destructive" : "text-foreground"}><Money value={after} currency={currency} /></span>
        </>}
      </p>
    </div>
  );
}
