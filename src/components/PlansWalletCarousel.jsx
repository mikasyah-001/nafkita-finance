import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, GraduationCap, Home as HomeIcon, Plane, Target, Plus, CalendarDays } from "lucide-react";
import { useSavingsGoals, useAssets, useMe } from "@/hooks/useFinance";
import { useGoalProgress } from "@/hooks/useGoalProgress";
import { walletAccounts, walletCandidates } from "@/lib/wallet";
import { formatDate } from "@/lib/finance";
import Money from "@/components/Money";
import { WalletCard, toneMap, saveSelected } from "@/components/AccountWallet";

// Beranda "Rencana kita": kartu target tabungan bergaya kartu saldo (hijau
// tua), lalu bila digeser ke samping berlanjut ke kartu rekening (Dompet).
// Gulir horizontal bawaan browser + scroll-snap → mulus, tanpa animasi JS.
// Data: target = SavingsGoal (progres dari useGoalProgress), rekening = sama
// dengan halaman Dompet (termasuk pilihan "Atur").
const TYPE_ICON = { darurat: ShieldCheck, pendidikan: GraduationCap, rumah: HomeIcon, perjalanan: Plane, lainnya: Target };
const CARD = "snap-center shrink-0 w-[86%] max-w-[360px] h-[176px] rounded-[26px]";

export default function PlansWalletCarousel({ scope = "shared" }) {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: goals = [], isLoading } = useSavingsGoals();
  const { data: assets = [] } = useAssets();
  const progressOf = useGoalProgress();
  const track = useRef(null);
  const [section, setSection] = useState("rencana");

  const active = goals.filter((g) => (g.status || "active") === "active");
  const hiddenIds = Array.isArray(me?.wallet_hidden_ids) ? me.wallet_hidden_ids : [];
  const candidates = useMemo(() => walletCandidates(assets, { scope, meId: me?.id }), [assets, scope, me?.id]);
  const tones = useMemo(() => toneMap(candidates), [candidates]);
  const accounts = useMemo(() => walletAccounts(assets, { scope, meId: me?.id, hiddenIds }), [assets, scope, me?.id, hiddenIds]);

  if (isLoading) return null;

  // Bagian aktif mengikuti kartu yang sedang berada di tengah layar.
  const onScroll = () => {
    const el = track.current;
    const first = el?.querySelector("[data-section='dompet']");
    if (!el || !first) return;
    const next = el.scrollLeft + el.clientWidth / 2 >= first.offsetLeft ? "dompet" : "rencana";
    if (next !== section) setSection(next);
  };
  const jump = (name) => {
    const el = track.current;
    const target = el?.querySelector(`[data-section='${name}']`);
    if (el && target) el.scrollTo({ left: target.offsetLeft - (el.clientWidth - target.clientWidth) / 2, behavior: "smooth" });
  };
  const openAccount = (id) => { saveSelected(id); navigate("/dompet"); };

  return (
    <section className="mb-6" aria-labelledby="rencana-title">
      <div className="flex items-end justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <h2 id="rencana-title" className="font-semibold text-[17px] leading-tight">{section === "rencana" ? "Rencana kita" : "Dompet"}</h2>
          <p className="text-xs text-muted-foreground truncate">{section === "rencana" ? "Geser untuk lihat rekening" : "Ketuk kartu untuk detail rekening"}</p>
        </div>
        {accounts.length > 0 && (
          <div role="tablist" aria-label="Bagian" className="flex p-0.5 rounded-full bg-muted shrink-0">
            {[["rencana", "Rencana"], ["dompet", "Dompet"]].map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={section === key} onClick={() => jump(key)}
                className={`h-7 px-3 rounded-full text-xs font-semibold transition-colors ${section === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={track} onScroll={onScroll} className="relative -mx-5 px-5 flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-3">
        {active.map((g, i) => {
          const Icon = TYPE_ICON[g.type] || Target;
          const { target, current, pct, remaining } = progressOf(g);
          const cur = g.currency || "IDR";
          return (
            <Link key={g.id} to="/target-tabungan" data-section={i === 0 ? "rencana" : undefined}
              className={`${CARD} card-gradient-primary p-5 relative overflow-hidden flex flex-col active:scale-[0.99] transition-transform`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0"><Icon className="w-[18px] h-[18px]" /></span>
                  <p className="font-heading font-bold text-[16px] leading-tight truncate">{g.name}</p>
                </div>
                {g.target_date && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-1 border border-gold/50 text-gold shrink-0">
                    <CalendarDays className="w-3 h-3" /> {formatDate(g.target_date, "MMM yyyy")}
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
            </Link>
          );
        })}

        <Link to="/target-tabungan" data-section={active.length ? undefined : "rencana"}
          className={`snap-center shrink-0 ${active.length ? "w-[38%] max-w-[150px]" : "w-[86%] max-w-[360px]"} h-[176px] rounded-[26px] border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground p-4 text-center`}>
          <span className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><Plus className="w-5 h-5" /></span>
          <span className="text-xs font-semibold">{active.length ? "Tambah rencana" : "Buat rencana pertama, mis. Umrah keluarga"}</span>
        </Link>

        {accounts.map((a, i) => (
          <button key={a.id} type="button" onClick={() => openAccount(a.id)} data-section={i === 0 ? "dompet" : undefined}
            aria-label={`Buka rekening ${a.name}`} className={`${CARD} relative text-left shadow-[0_18px_36px_-22px_rgba(0,0,0,0.55)] active:scale-[0.99] transition-transform`}>
            <WalletCard account={a} meId={me?.id} tone={tones[a.id] ?? 0} />
          </button>
        ))}
      </div>
    </section>
  );
}
