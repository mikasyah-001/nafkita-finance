import { useState } from "react";
import { Link } from "react-router-dom";
import { usePartnership } from "@/hooks/usePartnership";
import { User as UserIcon, Heart, Clock, CheckCircle2, Users, X, Loader2 } from "lucide-react";
import { Image as SmartImage } from "@/components/ui/image";

export default function FamilyMembers() {
  const {
    me, users, partners, hasPartner, sentInvites, incomingRequests,
    acceptRequest, declineRequest, loading,
  } = usePartnership();
  const [busy, setBusy] = useState(null);

  const run = async (key, fn) => {
    setBusy(key);
    await fn();
    setBusy(null);
  };

  const empty = !hasPartner && sentInvites.length === 0 && incomingRequests.length === 0;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Heart className="w-4 h-4 text-rose-500" />
        <h2 className="font-semibold text-sm">Keluarga Terkoneksi</h2>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">Memuat...</div>
      ) : empty ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Belum ada pasangan terhubung</p>
            <p className="text-xs text-muted-foreground">
              Undang pasangan dari menu{" "}
              <Link to="/pengaturan" className="text-primary">Pengaturan</Link> untuk mencatat bersama.
            </p>
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
                  <UserIcon className="w-5 h-5 text-muted-foreground" />
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

          {incomingRequests.map((p) => {
            const inviter = users.find((u) => u.id === p.inviter_id);
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
                  <UserIcon className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{inviter?.full_name || inviter?.email || "Pasangan"}</p>
                  <p className="text-xs text-muted-foreground">Mengundang Anda menjadi pasangan</p>
                </div>
                <button
                  onClick={() => run(`a-${p.id}`, () => acceptRequest(p))}
                  disabled={busy === `a-${p.id}`}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium disabled:opacity-60"
                >
                  {busy === `a-${p.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Terima"}
                </button>
                <button
                  onClick={() => run(`d-${p.id}`, () => declineRequest(p.id))}
                  disabled={busy === `d-${p.id}`}
                  className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center disabled:opacity-60"
                  title="Tolak"
                >
                  {busy === `d-${p.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })}

          {sentInvites.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.invitee_email}</p>
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