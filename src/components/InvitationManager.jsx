import { useState } from "react";
import { usePartnership } from "@/hooks/usePartnership";
import { toast } from "sonner";
import {
  UserPlus, Loader2, Clock, RefreshCw, Settings, ArrowLeft, X, Heart, User as UserIcon, Link2,
} from "lucide-react";

export default function InvitationManager() {
  const {
    me, users, partners, hasPartner, sentInvites, incomingRequests,
    invite, connectByCode, resend, cancelInvite, acceptRequest, declineRequest, disconnect, loading,
  } = usePartnership();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState("email");
  const [sending, setSending] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(null);
  const [showManage, setShowManage] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [reason, setReason] = useState("");

  const handleSend = async () => {
    const target = email.trim();
    setSending(true);
    await invite(target);
    setSending(false);
    setEmail("");
  };

  const handleConnect = async () => {
    const c = code.trim();
    if (!c) return;
    setConnecting(true);
    const ok = await connectByCode(c);
    setConnecting(false);
    if (ok) setCode("");
  };

  const run = async (key, fn) => {
    setBusy(key);
    await fn();
    setBusy(null);
  };

  if (loading) {
    return <div className="rounded-xl border border-border p-4 text-xs text-muted-foreground">Memuat...</div>;
  }

  if (hasPartner && !showManage) {
    return (
      <div>
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 p-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Terkoneksi dengan pasangan</p>
            <p className="text-xs text-muted-foreground truncate">
              {partners.map((p) => p.full_name || p.email).join(", ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button onClick={() => setShowManage(true)} className="text-xs text-primary flex items-center gap-1">
            <Settings className="w-3.5 h-3.5" /> Kelola undangan
          </button>
          <button
            onClick={() => { setShowDisconnect(true); setReason(""); }}
            className="text-xs text-red-500 flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> Putuskan koneksi
          </button>
        </div>
        {showDisconnect && (
          <div className="mt-3 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-3">
            <p className="text-xs text-muted-foreground mb-2">Alasan pemutusan (opsional) — dicatat untuk riwayat.</p>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="mis. tidak relevan lagi"
              className="w-full rounded-lg border border-border px-3 py-2 text-xs outline-none focus:ring-2 ring-primary/30 mb-2"
            />
            <div className="flex gap-2">
              <button
                onClick={() => run("disc", () => disconnect(reason).then(() => setShowDisconnect(false)))}
                disabled={busy === "disc"}
                className="flex-1 py-2 rounded-lg bg-red-500 text-white text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-60"
              >
                {busy === "disc" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Konfirmasi Putus
              </button>
              <button
                onClick={() => setShowDisconnect(false)}
                className="px-3 py-2 rounded-lg border border-border text-xs font-medium"
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {hasPartner && (
        <button onClick={() => setShowManage(false)} className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
          <ArrowLeft className="w-3.5 h-3.5" /> Sembunyikan kelola
        </button>
      )}

      {incomingRequests.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Permintaan Masuk</p>
          <div className="space-y-2">
            {incomingRequests.map((p) => {
              const inviter = users.find((u) => u.id === p.inviter_id);
              return (
                <div key={p.id} className="flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-3">
                  <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
                    <UserIcon className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{inviter?.full_name || inviter?.email || "Pasangan"}</p>
                    <p className="text-[10px] text-muted-foreground">Mengundang Anda menjadi pasangan</p>
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
          </div>
        </div>
      )}

      {!hasPartner && sentInvites.length === 0 && incomingRequests.length === 0 && (
        <>
          <div className="flex gap-1 bg-muted p-1 rounded-xl mb-3">
            <button
              onClick={() => setMode("email")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === "email" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              Via Email
            </button>
            <button
              onClick={() => setMode("code")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === "code" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              Via Kode Referensi
            </button>
          </div>

          {mode === "email" ? (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                Undang istri/suami lewat email. Pasangan menerima email undangan, register, lalu menyetujui koneksi.
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email pasangan"
                  className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary/30"
                />
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="px-4 rounded-xl bg-primary text-primary-foreground flex items-center gap-1.5 text-sm font-medium disabled:opacity-60"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Undang
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                Pasangan sudah register & login? Minta <strong>kode referensi</strong> dari halaman Profil pasangan, lalu masukkan di sini. Pasangan menyetujui koneksi setelahnya.
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="mis. NK1A2B3"
                  className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-mono uppercase tracking-wider outline-none focus:ring-2 ring-primary/30"
                />
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="px-4 rounded-xl bg-primary text-primary-foreground flex items-center gap-1.5 text-sm font-medium disabled:opacity-60"
                >
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Hubungkan
                </button>
              </div>
            </>
          )}
        </>
      )}

      {sentInvites.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Undangan Terkirim</p>
          {sentInvites.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-xl border border-border p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.invitee_email}</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Menunggu diterima
                </p>
              </div>
              <button
                onClick={() => run(`r-${p.id}`, () => resend(p))}
                disabled={busy === `r-${p.id}`}
                className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center active:scale-95 disabled:opacity-60"
                title="Kirim ulang"
              >
                {busy === `r-${p.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => run(`c-${p.id}`, () => cancelInvite(p.id))}
                disabled={busy === `c-${p.id}`}
                className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center active:scale-95 disabled:opacity-60"
                title="Batalkan undangan"
              >
                {busy === `c-${p.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}