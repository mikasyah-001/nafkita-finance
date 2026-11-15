import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Target, TrendingUp, CalendarDays, CheckCircle2, MoreVertical, Edit2, Trash2, ShieldCheck, GraduationCap, Home as HomeIcon, Plane } from "lucide-react";
import { formatMoney, formatDate, formatMoneyPlain, isMoneyAsset } from "@/lib/finance";
import { ChipChoice } from "@/components/FormSheet";
import { toast } from "sonner";

// Kartu pastel serupa "Rencana kita" di Beranda; warna target dipetakan ke nada pastel.
const TYPE_ICON = { darurat: ShieldCheck, pendidikan: GraduationCap, rumah: HomeIcon, perjalanan: Plane, lainnya: Target };
const TYPE_LABEL = { darurat: "Dana darurat", pendidikan: "Pendidikan", rumah: "Rumah", perjalanan: "Perjalanan", lainnya: "Lainnya" };
const TONE = {
  green: "card-pastel-mint", teal: "card-pastel-sage", cyan: "card-pastel-lime", blue: "card-pastel-sage",
  amber: "card-pastel-butter", orange: "card-pastel-peach", pink: "card-pastel-peach", violet: "card-pastel-mint",
};
const panelInput = "w-full h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:ring-2 ring-primary/30";

export default function SavingsGoalCard({ goal, assets, onEdit, onDelete, onRefresh }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progressAmount, setProgressAmount] = useState("");
  const [progressMethod, setProgressMethod] = useState("manual");
  const [sourceAssetId, setSourceAssetId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const progress = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount)  * 100) : 0;
  const remaining = Math.max(0, (goal.target_amount || 0) - (goal.current_amount || 0));
  const isCompleted = goal.status === "completed";
  const Icon = isCompleted ? CheckCircle2 : (TYPE_ICON[goal.type] || Target);
  const tone = TONE[goal.color] || TONE.green;

  const handleAddProgress = async () => {
    const amt = Number(progressAmount);
    if (!amt || amt <= 0) return;
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("addSavingsProgress", {
        goal_id: goal.id,
        amount: amt,
        method: progressMethod,
        source_asset_id: progressMethod === "topup" ? sourceAssetId : undefined,
      });
      if (res.data?.ok) {
        toast.success("Progress ditambahkan");
        setShowProgress(false);
        setProgressAmount("");
        onRefresh();
      }
    } catch (e) {
      toast.error("Gagal", { description: e?.message });
    }
    setSubmitting(false);
  };

  return (
    <div className={`card-pastel ${tone} relative rounded-3xl p-4 overflow-hidden`}>
      <div className="absolute -right-6 -bottom-8 w-28 h-28 rounded-full bg-white/25 dark:bg-white/5 pointer-events-none" aria-hidden="true" />

      {/* Header */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <span className="w-10 h-10 rounded-2xl bg-white/60 dark:bg-white/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </span>
        <div className="flex items-center gap-1.5">
          {goal.target_date && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white/60 dark:bg-white/10 rounded-full px-2 py-1">
              <CalendarDays className="w-3 h-3" /> Target: {formatDate(goal.target_date, "dd MMM yyyy")}
            </span>
          )}
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} aria-label={`Menu target ${goal.name}`} aria-expanded={showMenu} aria-haspopup="menu"
              className="w-8 h-8 rounded-full bg-white/60 dark:bg-white/10 flex items-center justify-center">
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <div role="menu" className="absolute right-0 mt-1 w-32 rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg z-10 overflow-hidden">
                <button role="menuitem" onClick={() => { onEdit(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted">
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
                <button role="menuitem" onClick={() => { onDelete(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-muted">
                  <Trash2 className="w-3.5 h-3.5" /> Hapus
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative">
        <h3 className="font-heading font-bold text-lg leading-tight mt-3 truncate">{goal.name}</h3>
        <p className="text-xs opacity-75">{TYPE_LABEL[goal.type] || goal.type}</p>

        {/* Progress */}
        <div className="flex items-end justify-between gap-3 mt-3">
          <p className="font-heading font-extrabold text-3xl tabular-nums leading-none">{progress.toFixed(0)}<span className="text-base font-bold">%</span><span className="sr-only"> tercapai</span></p>
          <div className="text-right min-w-0">
            <p className="text-sm font-bold tabular-nums truncate">{formatMoney(goal.current_amount || 0, goal.currency)}</p>
            <p className="text-[11px] opacity-75 tabular-nums truncate">dari {formatMoney(goal.target_amount || 0, goal.currency)}</p>
          </div>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-[hsl(var(--pastel-ink))] transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-[11px] opacity-75 mt-1.5 tabular-nums">
          {isCompleted ? "Target tercapai" : remaining > 0 ? `Sisa ${formatMoney(remaining, goal.currency)}` : `${progress.toFixed(0)}% tercapai`}
        </p>

        {/* Action button */}
        {!isCompleted && (
          <button
            onClick={() => setShowProgress(!showProgress)}
            aria-expanded={showProgress}
            className="w-full mt-3 h-10 flex items-center justify-center gap-2 rounded-full bg-white/60 dark:bg-white/10 text-sm font-semibold active:scale-[0.99] transition-transform"
          >
            <TrendingUp className="w-4 h-4" /> Tambah Progress
          </button>
        )}

        {/* Progress form */}
        {showProgress && !isCompleted && (
          <div className="mt-3 p-3 rounded-2xl bg-background/85 text-foreground space-y-2.5">
            <ChipChoice
              size="sm"
              ariaLabel="Cara menambah progress"
              value={progressMethod}
              onChange={setProgressMethod}
              options={[{ value: "manual", label: "Manual" }, { value: "topup", label: "Top-up dari Aset" }]}
            />
            {progressMethod === "topup" && (
              <select
                aria-label="Aset sumber"
                value={sourceAssetId}
                onChange={(e) => setSourceAssetId(e.target.value)}
                className={panelInput}
              >
                <option value="">Pilih aset sumber ({goal.currency || "IDR"})...</option>
                {assets.filter(a => isMoneyAsset(a) && (a.currency || "IDR") === (goal.currency || "IDR")).map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({formatMoneyPlain(a.value || 0, a.currency)})</option>
                ))}
              </select>
            )}
            <input
              aria-label="Nominal"
              type="number"
              inputMode="decimal"
              value={progressAmount}
              onChange={(e) => setProgressAmount(e.target.value)}
              placeholder={`Nominal (${goal.currency || "IDR"})`}
              className={`${panelInput} tabular-nums`}
            />
            <button
              onClick={handleAddProgress}
              disabled={submitting || !progressAmount || (progressMethod === "topup" && !sourceAssetId)}
              className="w-full btn-primary btn-sm"
            >
              {submitting ? "Memproses..." : "Tambah"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
