import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Bug, Lightbulb, MessageSquare, MoreHorizontal, Image as ImageIcon, MessageCircleReply, Loader2, Send, Smartphone, MapPin, Phone, Mail, Inbox } from "lucide-react";
import FormSheet from "@/components/FormSheet";
import EmptyState from "@/components/EmptyState";
import { FEEDBACK_TYPES, FEEDBACK_STATUS, describeDevice } from "@/lib/feedback";
import { formatDate } from "@/lib/finance";
import { lastActiveLabel } from "@/lib/partner";

const TYPE_ICON = { bug: Bug, feature: Lightbulb, suggestion: MessageSquare, other: MoreHorizontal };
const FILTERS = [["open", "Baru"], ["in_progress", "Diproses"], ["resolved", "Selesai"], ["closed", "Ditutup"], ["all", "Semua"]];

// Kotak masuk laporan pengguna untuk admin: saring status/jenis, buka detail,
// ubah status, balas (balasan terlihat oleh pengirim + notifikasi).
export function useFeedbackInbox(enabled = true) {
  return useQuery({
    queryKey: ["adminFeedback"],
    enabled,
    queryFn: () => base44.entities.Feedback.list("-created_date", 300),
  });
}

export default function AdminFeedback({ initialId = null }) {
  const { data: items = [], isLoading } = useFeedbackInbox();
  const [status, setStatus] = useState("open");
  const [type, setType] = useState("all");
  const [openId, setOpenId] = useState(initialId);
  useEffect(() => { if (initialId) setOpenId(initialId); }, [initialId]);

  const counts = useMemo(() => {
    const c = { all: items.length };
    items.forEach((f) => { c[f.status || "open"] = (c[f.status || "open"] || 0) + 1; });
    return c;
  }, [items]);
  const shown = items.filter((f) => (status === "all" || (f.status || "open") === status) && (type === "all" || f.type === type));
  const current = items.find((f) => f.id === openId) || null;

  return (
    <div>
      <div className="-mx-5 px-5 flex gap-1.5 overflow-x-auto no-scrollbar mb-2">
        {FILTERS.map(([k, label]) => (
          <button key={k} onClick={() => setStatus(k)}
            className={`shrink-0 h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${status === k ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground/75"}`}>
            {label}{counts[k] ? ` · ${counts[k]}` : ""}
          </button>
        ))}
      </div>
      <div className="-mx-5 px-5 flex gap-1.5 overflow-x-auto no-scrollbar mb-3">
        {[["all", "Semua jenis"], ...Object.entries(FEEDBACK_TYPES).map(([k, t]) => [k, t.short])].map(([k, label]) => (
          <button key={k} onClick={() => setType(k)}
            className={`shrink-0 h-7 px-2.5 rounded-full text-[11px] font-semibold border ${type === k ? "bg-foreground text-background border-foreground" : "bg-transparent border-border text-muted-foreground"}`}>{label}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : shown.length === 0 ? (
        <div className="surface p-4"><EmptyState icon={Inbox} title={status === "open" ? "Tidak ada laporan baru" : "Tidak ada laporan"} subtitle="Laporan dari pengguna akan muncul di sini." /></div>
      ) : (
        <div className="surface overflow-hidden divide-y divide-border">
          {shown.map((f) => {
            const t = FEEDBACK_TYPES[f.type] || FEEDBACK_TYPES.other;
            const st = FEEDBACK_STATUS[f.status] || FEEDBACK_STATUS.open;
            const Icon = TYPE_ICON[f.type] || MoreHorizontal;
            return (
              <button key={f.id} onClick={() => setOpenId(f.id)} className="w-full text-left flex items-start gap-3 px-3.5 py-3 active:bg-muted">
                <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${t.tone}`}><Icon className="w-4 h-4" /></span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm leading-tight truncate ${(f.status || "open") === "open" ? "font-bold" : "font-medium"}`}>{f.subject}</span>
                  <span className="block text-xs text-muted-foreground truncate">{f.sender_name || f.sender_email || f.created_by || "Pengguna"} · {lastActiveLabel(f.created_date)}</span>
                  <span className="block text-xs text-muted-foreground/90 truncate mt-0.5">{f.message}</span>
                </span>
                <span className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${st.tone}`}>{st.adminLabel}</span>
                  <span className="flex gap-1 text-muted-foreground">
                    {f.screenshot_url && <ImageIcon className="w-3.5 h-3.5" aria-label="Ada lampiran" />}
                    {f.admin_reply && <MessageCircleReply className="w-3.5 h-3.5" aria-label="Sudah dibalas" />}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {current && <FeedbackDetail fb={current} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function FeedbackDetail({ fb, onClose }) {
  const qc = useQueryClient();
  const [reply, setReply] = useState(fb.admin_reply || "");
  const [markDone, setMarkDone] = useState(true);
  const [busy, setBusy] = useState(null);
  const t = FEEDBACK_TYPES[fb.type] || FEEDBACK_TYPES.other;
  const Icon = TYPE_ICON[fb.type] || MoreHorizontal;
  const ctx = fb.context || null;
  const phone = (fb.contact || "").replace(/[^\d+]/g, "");

  const respond = async (payload, key) => {
    setBusy(key);
    try {
      const res = await base44.functions.invoke("respondFeedback", { feedback_id: fb.id, ...payload });
      if (res?.data?.error) throw new Error(res.data.error);
      const updated = res?.data?.feedback;
      qc.setQueryData(["adminFeedback"], (old = []) => old.map((x) => (x.id === fb.id ? { ...x, ...(updated || payload) } : x)));
      qc.invalidateQueries({ queryKey: ["adminFeedback"] });
      toast.success(payload.reply ? "Balasan terkirim ke pengguna" : "Status diperbarui");
      if (payload.reply) onClose();
    } catch (e) {
      toast.error("Gagal menyimpan", { description: e.message });
    }
    setBusy(null);
  };

  return (
    <FormSheet title={fb.subject} subtitle={`${t.label} · ${formatDate(fb.created_date, "d MMM yyyy, HH:mm")}`} onClose={onClose} wide
      footer={
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={markDone} onChange={(e) => setMarkDone(e.target.checked)} className="w-4 h-4 accent-[hsl(var(--primary))]" /> Tandai selesai setelah dibalas
          </label>
          <button disabled={!reply.trim() || busy} onClick={() => respond({ reply: reply.trim(), ...(markDone ? { status: "resolved" } : {}) }, "reply")} className="w-full btn-primary">
            {busy === "reply" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} {fb.admin_reply ? "Perbarui balasan" : "Kirim balasan"}
          </button>
        </div>
      }>
      {/* Pengirim */}
      <section className="surface p-3.5 flex items-center gap-3">
        <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${t.tone}`}><Icon className="w-5 h-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{fb.sender_name || "Pengguna"}</p>
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><Mail className="w-3 h-3" /> {fb.sender_email || fb.created_by || "-"}</p>
        </div>
        {phone.length >= 8 && (
          <a href={`https://wa.me/${phone.replace(/^\+/, "").replace(/^0/, "62")}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm shrink-0"><Phone className="w-4 h-4" /> WA</a>
        )}
      </section>

      {/* Pesan */}
      <section className="surface p-4">
        <p className="text-sm whitespace-pre-line leading-relaxed">{fb.message}</p>
        {fb.screenshot_url && (
          <a href={fb.screenshot_url} target="_blank" rel="noreferrer" className="block mt-3">
            <img src={fb.screenshot_url} alt="Tangkapan layar" className="max-h-72 rounded-xl border border-border object-contain" />
          </a>
        )}
        {fb.contact && <p className="text-xs text-muted-foreground mt-3">Kontak lain: {fb.contact}</p>}
      </section>

      {ctx && (
        <section className="rounded-2xl bg-muted/60 px-3.5 py-3 text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> {describeDevice(ctx.user_agent) || ctx.platform || "-"} · layar {ctx.screen || "-"}{ctx.standalone ? " · aplikasi terpasang" : " · browser"}{ctx.online === false ? " · offline" : ""}</p>
          {ctx.path && <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Halaman: <code className="text-foreground/80">{ctx.path}</code></p>}
        </section>
      )}

      {/* Status */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Status</p>
        <div role="radiogroup" aria-label="Status laporan" className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-muted">
          {Object.entries(FEEDBACK_STATUS).map(([k, s]) => {
            const on = (fb.status || "open") === k;
            return (
              <button key={k} type="button" role="radio" aria-checked={on} disabled={!!busy || on} onClick={() => respond({ status: k }, `st-${k}`)}
                className={`h-9 rounded-xl text-xs font-semibold transition-colors ${on ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                {busy === `st-${k}` ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : s.adminLabel}
              </button>
            );
          })}
        </div>
        {fb.status_updated_at && <p className="text-[11px] text-muted-foreground mt-1">Diubah {lastActiveLabel(fb.status_updated_at)}</p>}
      </section>

      {/* Balasan */}
      <section>
        <label htmlFor="fb-reply" className="text-xs font-semibold text-muted-foreground mb-2 block">Balasan untuk pengguna</label>
        {fb.admin_reply && <p className="text-[11px] text-muted-foreground mb-1.5">Terkirim {formatDate(fb.replied_at, "d MMM, HH:mm")} oleh {fb.replied_by_name || "admin"}</p>}
        <textarea id="fb-reply" value={reply} onChange={(e) => setReply(e.target.value)} rows={4} maxLength={2000}
          placeholder="Terima kasih atas laporannya… (terlihat oleh pengirim & dikirim sebagai notifikasi)"
          className="w-full rounded-2xl border border-border bg-card px-3.5 py-3 text-sm outline-none focus:ring-2 ring-primary/30 resize-none" />
      </section>
    </FormSheet>
  );
}
