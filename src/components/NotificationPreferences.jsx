import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { BellOff, Mail, Inbox, Layers, EyeOff, Clock, Filter, ShieldCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Panel preferensi notifikasi antar-pasangan.
// Disimpan di entity NotificationPreference (satu record per user).
export default function NotificationPreferences() {
  const [pref, setPref] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [amountDraft, setAmountDraft] = useState("0");
  const [thresholdDraft, setThresholdDraft] = useState("10000");
  const [threshCurDraft, setThreshCurDraft] = useState("SAR");

  useEffect(() => {
    base44.entities.NotificationPreference.list("-created_date", 1)
      .then((list) => {
        const loaded = (list && list[0]) || null;
        setPref(loaded);
        setAmountDraft(String(loaded?.min_amount || 0));
        setThresholdDraft(String(loaded?.approval_threshold ?? 10000));
        setThreshCurDraft(loaded?.approval_threshold_currency || "SAR");
      })
      .catch(() => toast.error("Gagal memuat preferensi"))
      .finally(() => setLoading(false));
  }, []);

  const update = async (field, value) => {
    setSaving(true);
    const prev = pref;
    const next = { ...(prev || {}), [field]: value };
    setPref(next);
    try {
      if (prev?.id) {
        await base44.entities.NotificationPreference.update(prev.id, { [field]: value });
      } else {
        const created = await base44.entities.NotificationPreference.create({
          mute: !!next.mute,
          min_amount: Math.max(0, Number(next.min_amount) || 0),
          daily_digest: !!next.daily_digest,
          hide_amount: !!next.hide_amount,
          channel: next.channel || "in_app",
          approval_threshold: Math.max(0, Number(next.approval_threshold) || 0),
          approval_threshold_currency: next.approval_threshold_currency || "SAR",
        });
        setPref(created);
      }
    } catch {
      toast.error("Gagal menyimpan preferensi");
      setPref(prev);
    }
    setSaving(false);
  };

  const saveAmount = () => {
    const value = Math.max(0, Number(amountDraft) || 0);
    setAmountDraft(String(value));
    if (value !== (pref?.min_amount || 0)) update("min_amount", value);
  };

  const saveThreshold = () => {
    const value = Math.max(0, Number(thresholdDraft) || 0);
    setThresholdDraft(String(value));
    if (value !== (pref?.approval_threshold ?? 10000)) update("approval_threshold", value);
  };

  const saveThresholdCurrency = (cur) => {
    setThreshCurDraft(cur);
    if (cur !== (pref?.approval_threshold_currency || "SAR")) update("approval_threshold_currency", cur);
  };

  if (loading) {
    return <p className="text-xs text-muted-foreground">Memuat preferensi...</p>;
  }

  const channelOptions = [
    { value: "in_app", label: "Dalam aplikasi", icon: Inbox },
    { value: "email", label: "Email", icon: Mail },
    { value: "both", label: "Keduanya", icon: Layers },
  ];

  return (
    <div className="space-y-4">
      <ToggleRow
        icon={BellOff}
        label="Bisukan notifikasi"
        desc="Tidak ada notifikasi dari pasangan"
        value={!!pref?.mute}
        disabled={saving}
        onChange={(v) => update("mute", v)}
      />

      <ToggleRow
        icon={Clock}
        label="Ringkasan harian"
        desc="Kumpulkan jadi email ringkasan sekali sehari, bukan notifikasi instan"
        value={!!pref?.daily_digest}
        disabled={saving}
        onChange={(v) => update("daily_digest", v)}
      />

      <ToggleRow
        icon={EyeOff}
        label="Sembunyikan nominal"
        desc="Nominal transaksi & aset ditampilkan sebagai •••"
        value={!!pref?.hide_amount}
        disabled={saving}
        onChange={(v) => update("hide_amount", v)}
      />

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs font-medium">Ambang nominal minimum</p>
        </div>
        <p className="text-[11px] text-muted-foreground mb-2">Hanya kirim notifikasi transaksi bila nominal ≥ ambang ini (0 = semua).</p>
        <input
          type="number"
          inputMode="numeric"
          value={amountDraft}
          min="0"
          disabled={saving}
          onChange={(e) => setAmountDraft(e.target.value)}
          onBlur={saveAmount}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          className="w-full rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary/30 bg-transparent"
        />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs font-medium">Ambang persetujuan pasangan</p>
        </div>
        <p className="text-[11px] text-muted-foreground mb-2">Transaksi bersama dengan nominal ≥ ambang ini (dikonversi ke mata uang acuan) wajib disetujui pasangan sebelum saldo berubah.</p>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={thresholdDraft}
            min="0"
            disabled={saving}
            onChange={(e) => setThresholdDraft(e.target.value)}
            onBlur={saveThreshold}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary/30 bg-transparent"
          />
          <Select value={threshCurDraft} onValueChange={saveThresholdCurrency} disabled={saving}>
            <SelectTrigger className="rounded-xl border-border px-3 h-[42px] text-sm w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["SAR", "IDR", "USD", "EUR"].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs font-medium">Saluran notifikasi</p>
        </div>
        <div className="flex gap-2">
          {channelOptions.map((c) => {
            const Icon = c.icon;
            const active = (pref?.channel || "in_app") === c.value;
            return (
              <button
                key={c.value}
                onClick={() => update("channel", c.value)}
                disabled={saving}
                className={`flex-1 py-2.5 rounded-2xl border text-xs font-medium flex flex-col items-center gap-1 transition-all disabled:opacity-60 ${
                  active ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ icon: Icon, label, desc, value, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium">{label}</p>
          <p className="text-[11px] text-muted-foreground">{desc}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={`${label}: ${value ? "Aktif" : "Nonaktif"}`}
        onClick={() => onChange(!value)}
        disabled={disabled}
        className={`h-8 min-w-[82px] px-2.5 rounded-lg transition-colors shrink-0 text-[10px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60 ${
          value ? "bg-primary text-primary-foreground" : "bg-muted border border-border text-muted-foreground"
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${value ? "bg-primary-foreground" : "bg-muted-foreground/50"}`} />
        {value ? "Aktif" : "Nonaktif"}
      </button>
    </div>
  );
}