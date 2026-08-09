import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { User, Heart, Clock, CheckCircle2, Users } from "lucide-react";
import { Image as SmartImage } from "@/components/ui/image";

const KEY = "keluargafin_invites";
function getInvites() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export default function FamilyMembers() {
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState(getInvites);
  const [loading, setLoading] = useState(true);

  const load = () => {
    base44.auth.me().then(setMe).catch(() => {});
    base44.entities.User.list().then(setUsers).catch(() => setUsers([])).finally(() => setLoading(false));
    setInvites(getInvites());
  };

  useEffect(() => {
    load();
  }, []);

  const partners = users.filter((u) => u.id !== me?.id);
  const pending = invites.filter((inv) => !users.some((u) => u.email === inv.email));

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Heart className="w-4 h-4 text-rose-500" />
        <h2 className="font-semibold text-sm">Keluarga Terkoneksi</h2>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">Memuat...</div>
      ) : partners.length === 0 && pending.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Belum ada pasangan terhubung</p>
            <p className="text-xs text-muted-foreground">Undang pasangan dari menu Pengaturan untuk mencatat bersama.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {partners.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
                {u.photo_url ? (
                  <SmartImage src={u.photo_url} alt={u.full_name} className="w-full h-full" fittingType="fill" />
                ) : (
                  <User className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{u.full_name || "Tanpa nama"}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium shrink-0">
                <CheckCircle2 className="w-3 h-3" /> Aktif
              </span>
            </div>
          ))}

          {pending.map((inv) => (
            <div key={inv.email} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{inv.email}</p>
                <p className="text-xs text-muted-foreground">Undangan menunggu diterima</p>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[10px] font-medium shrink-0">
                <Clock className="w-3 h-3" /> Menunggu
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}