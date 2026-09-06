import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Target, TrendingUp, Calendar, CheckCircle2, MoreVertical, Edit2, Trash2, DollarSign } from "lucide-react";
import { formatMoney, formatDate, colorMap } from "@/lib/finance";
import { useToast } from "@/components/ui/use-toast";

export default function SavingsGoalCard({ goal, assets, onEdit, onDelete, onRefresh }) {
  const { toast } = useToast();
  const [showMenu, setShowMenu] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progressAmount, setProgressAmount] = useState("");
  const [progressMethod, setProgressMethod] = useState("manual");
  const [sourceAssetId, setSourceAssetId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const progress = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount)  * 100) : 0;
  const remaining = Math.max(0, (goal.target_amount || 0) - (goal.current_amount || 0));
  const colors = colorMap[goal.color] || colorMap.green;
  const isCompleted = goal.status === "completed";

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
        toast({ title: "Progress ditambahkan" });
        setShowProgress(false);
        setProgressAmount("");
        onRefresh();
      }
    } catch (e) {
      toast({ title: "Gagal", description: e?.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <div className="relative rounded-2xl border border-border bg-card p-5 shadow-sm">
      {/* Menu */}
      <div className="absolute top-4 right-4">
        <button onClick={() => setShowMenu(!showMenu)} className="p-1 rounded-lg hover:bg-muted">
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </button>
        {showMenu && (
          <div className="absolute right-0 mt-1 w-32 rounded-xl border border-border bg-popover shadow-lg z-10">
            <button onClick={() => { onEdit(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-t-xl">
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted rounded-b-xl">
              <Trash2 className="w-3.5 h-3.5" /> Hapus
            </button>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-start gap-3 mb-4 pr-8">
        <div className={`w-11 h-11 rounded-xl ${colors.bg} flex items-center justify-center shrink-0`}>
          {isCompleted ? <CheckCircle2 className={`w-5 h-5 ${colors.text}`} /> : <Target className={`w-5 h-5 ${colors.text}`} />}
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold truncate">{goal.name}</h3>
          <p className="text-xs text-muted-foreground capitalize">{goal.type}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-lg font-bold">{formatMoney(goal.current_amount || 0, goal.currency)}</span>
          <span className="text-sm text-muted-foreground">{formatMoney(goal.target_amount || 0, goal.currency)}</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div className={`h-full ${colors.solid} rounded-full transition-all duration-500`} style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-muted-foreground">{progress.toFixed(0)}% tercapai</span>
          {remaining > 0 && !isCompleted && (
            <span className="text-xs text-muted-foreground">Sisa {formatMoney(remaining, goal.currency)}</span>
          )}
        </div>
      </div>

      {/* Target date */}
      {goal.target_date && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
          <Calendar className="w-3.5 h-3.5" />
          Target: {formatDate(goal.target_date, "dd MMM yyyy")}
        </div>
      )}

      {/* Action button */}
      {!isCompleted && (
        <button
          onClick={() => setShowProgress(!showProgress)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
        >
          <TrendingUp className="w-4 h-4" /> Tambah Progress
        </button>
      )}

      {/* Progress form */}
      {showProgress && !isCompleted && (
        <div className="mt-3 p-3 rounded-xl border border-border bg-muted/50 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setProgressMethod("manual")}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium ${progressMethod === "manual" ? "bg-primary text-primary-foreground" : "bg-background border border-border"}`}
            >Manual</button>
            <button
              onClick={() => setProgressMethod("topup")}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium ${progressMethod === "topup" ? "bg-primary text-primary-foreground" : "bg-background border border-border"}`}
            >Top-up dari Aset</button>
          </div>
          {progressMethod === "topup" && (
            <select
              value={sourceAssetId}
              onChange={(e) => setSourceAssetId(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background"
            >
              <option value="">Pilih aset sumber...</option>
              {assets.filter(a => a.type === "bank").map(a => (
                <option key={a.id} value={a.id}>{a.name} ({formatMoney(a.value || 0, a.currency)})</option>
              ))}
            </select>
          )}
          <input
            type="number"
            value={progressAmount}
            onChange={(e) => setProgressAmount(e.target.value)}
            placeholder="Nominal"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background"
          />
          <button
            onClick={handleAddProgress}
            disabled={submitting || !progressAmount || (progressMethod === "topup" && !sourceAssetId)}
            className="w-full px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Memproses..." : "Tambah"}
          </button>
        </div>
      )}
    </div>
  );
}