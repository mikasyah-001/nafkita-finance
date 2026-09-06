import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { BellOff, Mail, Inbox, Layers, EyeOff, Clock, Filter } from "lucide-react";

// Panel preferensi notifikasi antar-pasangan.
// Disimpan di entity NotificationPreference (satu record per user).
export default function NotificationPreferences() {
  const [pref, setPref] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.NotificationPreference.list("-created_date", 1)
      .then((list) => setPref((list && list[0]) || null))
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
          mute: field === "mute" ? value : false,
          min_amount: field === "min_amount" ? value : 0,
          daily_digest: field === "daily_digest" ? value : false,
          hide_amount: field === "hide_amount" ? value : false,
          channel: field === "channel" ? value : "in_app",
        });
        setPref(created);
      }
    } catch {
      toast.error("Gagal menyimpan preferensi");
      setPref(prev);
    }
    setSaving(false);
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
          value={pref?.min_amount || 0}
          disabled={saving}
          onChange={(e) => update("min_amount", Number(e.target.value) || 0)}
          className="w-full rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary/30 bg-transparent"
        />
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
        onClick={() => onChange(!value)}
        disabled={disabled}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-60 ${
          value ? "bg-primary" : "bg-muted border border-border"
        }`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}