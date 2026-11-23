import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Target, TrendingUp, CalendarDays, CheckCircle2, MoreVertical, Edit2, Trash2, ShieldCheck, GraduationCap, Home as HomeIcon, Plane, Wallet } from "lucide-react";
import { formatMoney, formatDate, formatMoneyPlain, isMoneyAsset, formatMoneyShort } from "@/lib/finance";

const formatMoneyShortSafe = (v, c) => formatMoneyShort(v, c).replace(/^Rp\s?/, "");
import { toast } from "sonner";
import MoneyInput from "@/components/MoneyInput";
import { useGoalProgress } from "@/hooks/useGoalProgress";
import { useMe } from "@/hooks/useFinance";
import { assetLabel } from "@/lib/bankAccount";
import { goalProjection, quickDepositAmounts } from "@/lib/savingsGoal";

// Kartu pastel serupa "Rencana kita" di Beranda; warna target dipetakan ke nada pastel.
const TYPE_ICON = { darurat: ShieldCheck, pendidikan: GraduationCap, rumah: HomeIcon, perjalanan: Plane, lainnya: Target };
const TYPE_LABEL = { darurat: "Dana darurat", pendidikan: "Pendidikan", rumah: "Rumah", perjalanan: "Perjalanan", lainnya: "Lainnya" };
const TONE = {
  green: "card-pastel-mint", teal: "card-pastel-sage", cyan: "card-pastel-lime", blue: "card-pastel-sage",
  amber: "card-pastel-butter", orange: "card-pastel-peach", pink: "card-pastel-peach", violet: "card-pastel-mint",
};
const panelInput = "w-full h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:ring-2 ring-primary/30";

export default function SavingsGoalCard({ goal, assets, onEdit, onDelete, onRefresh, closest = false }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progressAmount, setProgressAmount] = useState("");
  // Rekening sumber default dari data lama (field "Rekening sumber setoran" yang dulu ada di form).
  const [sourceAssetId, setSourceAssetId] = useState(goal.linked_asset_id || "");
  const [submitting, setSubmitting] = useState(false);

  // Satu sumber hitung (lib/savingsGoal): nilai aset "Disimpan di" atau setoran manual.
  const gp = useGoalProgress()(goal);
  const progress = gp.pct;
  const remaining = gp.remaining;
  const byAssets = gp.mode === "assets";
  const isCompleted = goal.status === "completed";
  const Icon = isCompleted ? CheckCircle2 : (TYPE_ICON[goal.type] || Target);
  const tone = TONE[goal.color] || TONE.green;
  const proj = isCompleted ? null : goalProjection(goal, gp.current);
  const { data: me } = useMe();
  // Target "Disimpan di": setoran = transfer dari rekening lain ke rekening
  // target (total aset tetap). Target manual: hanya mencatat angka.
  const destOptions = byAssets ? gp.assets.filter((a) => a.created_by_id === me?.id) : [];
  const [destAssetId, setDestAssetId] = useState("");
  const dest = destOptions.find((a) => a.id === destAssetId) || (destOptions.length === 1 ? destOptions[0] : null);
  const allocatedSet = new Set(gp.assets.map((a) => a.id));
  const sourceOptions = dest
    ? assets.filter((a) => isMoneyAsset(a) && a.created_by_id === me?.id && !allocatedSet.has(a.id) && (a.currency || "IDR") === (dest.currency || "IDR"))
    : [];
  const progressMethod = byAssets ? "topup" : "manual";

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
        dest_asset_id: progressMethod === "topup" ? dest?.id : undefined,
      });
      if (res.data?.error) throw new Error(res.data.message || (res.data.error === "saldo_tidak_cukup" ? "Saldo rekening sumber tidak cukup" : res.data.error));
      if (res.data?.ok) {
        toast.success(progressMethod === "topup" ? `Dipindahkan ke ${dest?.name || "rekening target"}` : "Setoran dicatat");
        setShowProgress(false);
        setProgressAmount("");
        onRefresh();
      }
    } catch (e) {
      toast.error("Gagal", { description: e?.response?.data?.message || e?.message });
    }
    setSubmitting(false);
  };

  return (
    <div className={`card-pastel ${tone} relative rounded-3xl p-4 overflow-hidden`}>
      <div className="absolute -right-6 -bottom-8 w-28 h-28 rounded-full bg-white/25 dark:bg-white/5 pointer-events-none" aria-hidden="true" />

      {/* Foto sampul (opsional): target terasa nyata, mis. Ka'bah untuk Umrah */}
      {goal.cover_url && (
        <div className="relative -mx-4 -mt-4 mb-3 h-32 overflow-hidden">
          <img src={goal.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" aria-hidden="true" />
        </div>
      )}
      {closest && !isCompleted && (
        <span className={`${goal.cover_url ? "absolute top-3 left-3" : "relative inline-flex mb-2"} z-10 items-center text-[11px] font-semibold bg-white/85 dark:bg-black/50 rounded-full px-2.5 py-1`}>Hampir tercapai</span>
      )}

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
            <p className="text-sm font-bold tabular-nums truncate">{formatMoney(gp.current, goal.currency)}</p>
            <p className="text-[11px] opacity-75 tabular-nums truncate">dari {formatMoney(goal.target_amount || 0, goal.currency)}</p>
          </div>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-[hsl(var(--pastel-ink))] transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-[11px] opacity-75 mt-1.5 tabular-nums">
          {isCompleted ? "Target tercapai" : remaining > 0 ? `Sisa ${formatMoney(remaining, goal.currency)}` : `${progress.toFixed(0)}% tercapai`}
        </p>

        {/* Proyeksi dari laju setoran 90 hari terakhir */}
        {proj && (proj.eta || proj.neededPerMonth) && (
          <p className="text-[11px] mt-1 leading-snug">
            {proj.eta ? (
              <>
                Laju {formatMoney(proj.perMonth, goal.currency)}/bln → tercapai ±{formatDate(proj.eta, "MMM yyyy")}
                {proj.onTrack === true && <span className="font-semibold"> · tepat waktu ✓</span>}
                {proj.onTrack === false && <span className="font-semibold text-destructive"> · lewat target</span>}
              </>
            ) : "Belum ada setoran 3 bulan terakhir"}
            {proj.neededPerMonth && proj.onTrack !== true && (
              <span className="block opacity-80">Perlu {formatMoney(proj.neededPerMonth, goal.currency)}/bln agar tepat waktu</span>
            )}
          </p>
        )}

        {/* Disimpan di beberapa aset → progres otomatis, tanpa setoran manual */}
        {byAssets && (
          <div className="mt-3 rounded-2xl bg-white/50 dark:bg-white/10 px-3 py-2.5 text-xs">
            <p className="font-semibold flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Disimpan di {gp.assets.length} aset · otomatis</p>
            <ul className="mt-1 space-y-0.5 opacity-85">
              {gp.assets.map((a) => (
                <li key={a.id} className="flex justify-between gap-2"><span className="truncate">{assetLabel(a)}</span><span className="tabular-nums shrink-0">{formatMoneyPlain(a.value || 0, a.currency)}</span></li>
              ))}
            </ul>
            {(gp.missing > 0 || gp.unconverted.length > 0) && (
              <p className="mt-1 text-warning font-semibold">{gp.missing > 0 ? `${gp.missing} aset sudah tidak ada. ` : ""}{gp.unconverted.length ? `${gp.unconverted.length} aset belum ada kurs — belum dihitung.` : ""}</p>
            )}
          </div>
        )}

        {/* Action button */}
        {!isCompleted && (
          <button
            onClick={() => setShowProgress(!showProgress)}
            aria-expanded={showProgress}
            className="w-full mt-3 h-10 flex items-center justify-center gap-2 rounded-full bg-white/60 dark:bg-white/10 text-sm font-semibold active:scale-[0.99] transition-transform"
          >
            <TrendingUp className="w-4 h-4" /> {byAssets ? "Setor ke target" : "Catat setoran"}
          </button>
        )}

        {/* Progress form */}
        {showProgress && !isCompleted && (
          <div className="mt-3 p-3 rounded-2xl bg-background/85 text-foreground space-y-2.5">
            {byAssets ? (
              <>
                {destOptions.length > 1 && (
                  <select aria-label="Ke rekening target" value={dest?.id || ""} onChange={(e) => setDestAssetId(e.target.value)} className={panelInput}>
                    <option value="">Ke rekening target…</option>
                    {destOptions.map((a) => <option key={a.id} value={a.id}>{assetLabel(a)}</option>)}
                  </select>
                )}
                {destOptions.length === 0 && <p className="text-xs text-warning">Rekening target milik pasangan — setoran dicatat oleh pemiliknya.</p>}
                {dest && (
                  <select aria-label="Dari rekening" value={sourceAssetId} onChange={(e) => setSourceAssetId(e.target.value)} className={panelInput}>
                    <option value="">Dari rekening ({dest.currency || "IDR"})…</option>
                    {sourceOptions.map((a) => <option key={a.id} value={a.id}>{assetLabel(a)} ({formatMoneyPlain(a.value || 0, a.currency)})</option>)}
                  </select>
                )}
                {dest && <p className="text-[11px] text-muted-foreground">Saldo dipindahkan ke <b>{assetLabel(dest)}</b>. Total aset tetap — uangnya hanya pindah rekening.</p>}
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground leading-snug">Hanya mencatat angka setoran. Agar uangnya benar-benar dipindah & terlacak di aset, atur <b>"Disimpan di"</b> lewat menu Edit target.</p>
            )}
            <div className="flex gap-1.5" role="group" aria-label="Setoran cepat">
              {quickDepositAmounts(goal.currency).map((v) => (
                <button key={v} type="button" onClick={() => setProgressAmount(String(v))}
                  className={`flex-1 h-9 rounded-full border text-xs font-semibold tabular-nums ${Number(progressAmount) === v ? "bg-foreground text-background border-foreground" : "bg-card border-border"}`}>
                  +{formatMoneyShortSafe(v, goal.currency)}
                </button>
              ))}
            </div>
            <MoneyInput currency={goal.currency || "IDR"}
              aria-label="Nominal"
              value={progressAmount}
              onChange={(v) => setProgressAmount(v)}
              placeholder={`Nominal (${goal.currency || "IDR"})`}
              className={`${panelInput} tabular-nums`}
            />
            <button
              onClick={handleAddProgress}
              disabled={submitting || !progressAmount || (progressMethod === "topup" && (!sourceAssetId || !dest))}
              className="w-full btn-primary btn-sm"
            >
              {submitting ? "Memproses..." : byAssets ? "Pindahkan ke target" : "Catat"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
