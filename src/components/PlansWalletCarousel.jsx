import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, GraduationCap, Home as HomeIcon, Plane, Target, CalendarDays } from "lucide-react";
import { useSavingsGoals, useAssets, useMe } from "@/hooks/useFinance";
import { useGoalProgress } from "@/hooks/useGoalProgress";
import { walletAccounts, walletCandidates } from "@/lib/wallet";
import { formatDate } from "@/lib/finance";
import Money from "@/components/Money";
import { WalletCard, toneMap, saveSelected } from "@/components/AccountWallet";
import CardStack, { useCardStack } from "@/components/CardStack";

// Beranda "Rencana kita": satu tumpukan kartu yang digeser ke ATAS — kartu
// target tabungan (gaya kartu saldo) lalu kartu rekening (sama dengan Dompet,
// ikut pilihan "Atur"). Mekanisme geser = CardStack (sama dengan /dompet).
// Ketuk kartu: target → Target Tabungan; rekening → Dompet di rekening itu.
const TYPE_ICON = { darurat: ShieldCheck, pendidikan: GraduationCap, rumah: HomeIcon, perjalanan: Plane, lainnya: Target };
const STORE_KEY = "nafkita.home.stack";
const readSaved = () => { try { return localStorage.getItem(STORE_KEY); } catch { return null; } };
const save = (id) => { try { localStorage.setItem(STORE_KEY, id); } catch { /* penyimpanan diblokir */ } };

function GoalCard({ goal, progress }) {
  const Icon = TYPE_ICON[goal.type] || Target;
  const { target, current, pct, remaining } = progress;
  const cur = goal.currency || "IDR";
  return (
    <div className="absolute inset-0 card-gradient-primary rounded-[26px] p-5 flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0"><Icon className="w-[18px] h-[18px]" /></span>
          <div className="min-w-0">
            <p className="font-heading font-bold text-[16px] leading-tight truncate">{goal.name}</p>
            <p className="text-[11px] opacity-65">Rencana tabungan</p>
          </div>
        </div>
        {goal.target_date && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-1 border border-gold/50 text-gold shrink-0">
            <CalendarDays className="w-3 h-3" /> {formatDate(goal.target_date, "MMM yyyy")}
          </span>
        )}
      </div>
      <div className="mt-auto">
        <p className="text-[11px] opacity-65">Terkumpul dari <Money value={target} currency={cur} format="short" /></p>
        <div className="flex items-end justify-between gap-2">
          <p className="font-heading text-[26px] leading-[1.1] font-extrabold tabular-nums truncate"><Money value={current} currency={cur} /></p>
          <p className="font-heading font-extrabold text-lg tabular-nums shrink-0">{Math.round(pct)}%</p>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-white/15 overflow-hidden">
          <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] opacity-65 mt-1">Sisa <Money value={remaining} currency={cur} format="short" /></p>
      </div>
    </div>
  );
}

function EmptyGoalCard() {
  return (
    <div className="absolute inset-0 card-gradient-primary rounded-[26px] p-5 flex flex-col items-center justify-center gap-1.5 text-center">
      <Target className="w-6 h-6 text-gold" />
      <p className="font-heading font-bold">Belum ada rencana</p>
      <p className="text-xs opacity-70">Ketuk untuk membuat di Target Tabungan, mis. Umrah keluarga</p>
    </div>
  );
}

export default function PlansWalletCarousel({ scope = "shared" }) {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: goals = [], isLoading } = useSavingsGoals();
  const { data: assets = [] } = useAssets();
  const progressOf = useGoalProgress();
  const [activeId, setActiveId] = useState(readSaved);

  const hiddenIds = useMemo(() => (Array.isArray(me?.wallet_hidden_ids) ? me.wallet_hidden_ids : []), [me?.wallet_hidden_ids]);
  const candidates = useMemo(() => walletCandidates(assets, { scope, meId: me?.id }), [assets, scope, me?.id]);
  const tones = useMemo(() => toneMap(candidates), [candidates]);

  const items = useMemo(() => {
    const active = goals.filter((g) => (g.status || "active") === "active");
    const goalItems = active.length
      ? active.map((g) => ({ id: `g:${g.id}`, kind: "goal", goal: g, title: g.name }))
      : [{ id: "g:empty", kind: "empty", title: "Target Tabungan" }];
    const accountItems = walletAccounts(assets, { scope, meId: me?.id, hiddenIds })
      .map((a) => ({ id: `a:${a.id}`, kind: "account", account: a, title: a.name }));
    return [...goalItems, ...accountItems];
  }, [goals, assets, scope, me?.id, hiddenIds]);

  const choose = (id) => { setActiveId(id); save(id); };
  const stack = useCardStack(items, activeId, choose);
  const { n, idx, current } = stack;

  if (isLoading || !current) return null;

  const section = current.kind === "account" ? "dompet" : "rencana";
  const firstOf = (kind) => items.find((x) => (kind === "dompet" ? x.kind === "account" : x.kind !== "account"));
  const hasAccounts = items.some((x) => x.kind === "account");
  const open = (item) => {
    if (item.kind === "account") { saveSelected(item.account.id); navigate("/dompet"); }
    else navigate("/target-tabungan");
  };

  return (
    <section className="mb-6" aria-labelledby="rencana-title">
      <div className="flex items-end justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <h2 id="rencana-title" className="font-semibold text-[17px] leading-tight">{section === "rencana" ? "Rencana kita" : "Dompet"}</h2>
          <p className="text-xs text-muted-foreground truncate">{n > 1 ? `Geser ke atas · ${idx + 1}/${n}` : "Ketuk kartu untuk detail"}</p>
        </div>
        {hasAccounts && (
          <div role="tablist" aria-label="Bagian" className="flex p-0.5 rounded-full bg-muted shrink-0">
            {[["rencana", "Rencana"], ["dompet", "Dompet"]].map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={section === key}
                onClick={() => { const t = firstOf(key); if (t && section !== key) stack.jumpTo(t.id); }}
                className={`h-7 px-3 rounded-full text-xs font-semibold transition-colors ${section === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <CardStack
        stack={stack}
        items={items}
        ariaLabel={`${current.title}, kartu ${idx + 1} dari ${n}`}
        onTapFront={open}
        renderCard={(item) => (
          item.kind === "account" ? <WalletCard account={item.account} meId={me?.id} tone={tones[item.account.id] ?? 0} />
            : item.kind === "goal" ? <GoalCard goal={item.goal} progress={progressOf(item.goal)} />
              : <EmptyGoalCard />
        )}
      />
    </section>
  );
}
