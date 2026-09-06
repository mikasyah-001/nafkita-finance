import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMe } from "@/hooks/useFinance";
import { Clock, Globe } from "lucide-react";
import { toast } from "sonner";

const HOUR_OPTIONS = [18, 19, 20, 21, 22, 23];

const fmtHour = (h) => `${String(h).padStart(2, "0")}:00`;

export default function ReminderTimeSetting() {
  const { data: me } = useMe();
  const [hour, setHour] = useState(me?.reminder_hour ?? 20);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof me?.reminder_hour === "number") setHour(me.reminder_hour);
  }, [me?.reminder_hour]);

  const save = async (h) => {
    setHour(h);
    setSaving(true);
    try {
      await base44.auth.updateMe({ reminder_hour: h });
      toast.success("Jam pengingat diperbarui");
    } catch {
      toast.error("Gagal menyimpan jam pengingat");
    }
    setSaving(false);
  };

  const tz = me?.timezone || "—";

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        Pengingat email dikirim setiap hari pada jam ini, waktu lokal Anda.
      </p>
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex gap-1.5 flex-wrap">
          {HOUR_OPTIONS.map((h) => (
            <button
              key={h}
              onClick={() => save(h)}
              disabled={saving}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all disabled:opacity-60 ${
                hour === h ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"
              }`}
            >
              {fmtHour(h)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Globe className="w-3.5 h-3.5 shrink-0" />
        <span>Zona waktu terdeteksi: <span className="font-medium text-foreground">{tz}</span></span>
      </div>
    </div>
  );
}