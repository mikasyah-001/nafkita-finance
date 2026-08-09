import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { UserPlus, Loader2, CheckCircle2, Clock, RefreshCw } from "lucide-react";

const KEY = "keluargafin_invites";

function getInvites() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function saveInvites(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export default function InvitationManager() {
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState(getInvites);
  const [users, setUsers] = useState([]);
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(null);

  useEffect(() => {
    base44.entities.User.list().then(setUsers).catch(() => {});
  }, []);

  const persist = (list) => {
    setInvites(list);
    saveInvites(list);
  };

  const send = async (target) => {
    setSending(true);
    try {
      await base44.users.inviteUser(target, "admin");
      const list = getInvites();
      const existing = list.find((i) => i.email === target);
      if (existing) {
        existing.sentAt = Date.now();
      } else {
        list.push({ email: target, sentAt: Date.now() });
      }
      persist(list);
      toast.success("Undangan terkirim", { description: `Ke ${target}` });
      setEmail("");
      base44.entities.User.list().then(setUsers).catch(() => {});
    } catch (e) {
      toast.error("Gagal mengundang", { description: e.message || "Periksa email dan coba lagi." });
    }
    setSending(false);
  };

  const handleSend = () => {
    if (!email) return toast.error("Masukkan email pasangan");
    send(email.trim());
  };

  const resend = async (inv) => {
    setResending(inv.email);
    await send(inv.email);
    setResending(null);
  };

  const isAccepted = (inv) => users.some((u) => u.email === inv.email);

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">Buatkan akun untuk istri/suami agar dapat mencatat bersama.</p>
      <div className="flex gap-2 mb-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email pasangan"
          className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary/30"
        />
        <button onClick={handleSend} disabled={sending} className="px-4 rounded-xl bg-primary text-primary-foreground flex items-center gap-1.5 text-sm font-medium disabled:opacity-60">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Undang
        </button>
      </div>

      {invites.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Status Undangan</p>
          {invites.map((inv) => {
            const accepted = isAccepted(inv);
            return (
              <div key={inv.email} className="flex items-center gap-2 rounded-xl border border-border p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{inv.email}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Dikirim {new Date(inv.sentAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {accepted ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Diterima
                  </span>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[10px] font-medium">
                      <Clock className="w-3 h-3" /> Menunggu
                    </span>
                    <button
                      onClick={() => resend(inv)}
                      disabled={resending === inv.email}
                      className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center active:scale-95 disabled:opacity-60"
                      title="Kirim ulang undangan"
                    >
                      {resending === inv.email ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}