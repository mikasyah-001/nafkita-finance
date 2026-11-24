import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { uploadFile, uploadErrorText } from "@/lib/upload";
import { toast } from "sonner";
import {
  Bug, Lightbulb, MessageSquare, MoreHorizontal, Send, Loader2, CheckCircle2, Type,
  NotebookPen, AtSign, ImagePlus, X, Smartphone, Inbox, MessageCircleReply,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { FieldRow, fieldInput } from "@/components/FormSheet";
import { useMe } from "@/hooks/useFinance";
import { FEEDBACK_TYPES, FEEDBACK_STATUS, collectContext, describeDevice } from "@/lib/feedback";
import { formatDate } from "@/lib/finance";

const TYPE_ICON = { bug: Bug, feature: Lightbulb, suggestion: MessageSquare, other: MoreHorizontal };

// Umpan balik: kirim laporan + pantau status & balasan admin ("Laporan saya").
export default function Feedback() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "saya" ? "saya" : "kirim";
  const setTab = (t) => setParams(t === "saya" ? { tab: "saya" } : {}, { replace: true });
  const { data: me } = useMe();
  const { data: mine = [], isLoading } = useQuery({
    queryKey: ["myFeedback", me?.id],
    enabled: !!me?.id,
    queryFn: () => base44.entities.Feedback.filter({ created_by_id: me.id }, "-created_date", 100),
  });
  // Titik merah hanya untuk balasan yang belum dilihat (disimpan per perangkat).
  const [seenAt, setSeenAt] = useState(() => { try { return localStorage.getItem("nafkita:feedbackSeenAt") || ""; } catch { return ""; } });
  const replies = mine.filter((f) => f.admin_reply && (!seenAt || String(f.replied_at || "") > seenAt)).length;
  useEffect(() => {
    if (tab !== "saya" || !mine.length) return;
    const now = new Date().toISOString();
    try { localStorage.setItem("nafkita:feedbackSeenAt", now); } catch { /* abaikan */ }
    setSeenAt(now);
  }, [tab, mine.length]);

  return (
    <div className="px-5 pt-6 pb-6">
      <PageHeader title="Umpan balik" subtitle="Langsung sampai ke tim pengembang" back />

      <div role="tablist" aria-label="Umpan balik" className="flex gap-1 p-1 rounded-2xl bg-muted mb-5">
        {[["kirim", "Kirim laporan"], ["saya", `Laporan saya${mine.length ? ` (${mine.length})` : ""}`]].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`relative flex-1 h-10 rounded-xl text-sm font-semibold transition-colors ${tab === k ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
            {label}
            {k === "saya" && replies > 0 && tab !== "saya" && <span className="absolute top-1.5 right-3 w-2 h-2 rounded-full bg-destructive" aria-label="Ada balasan" />}
          </button>
        ))}
      </div>

      {tab === "kirim" ? <SendForm onSent={() => setTab("saya")} /> : <MyReports items={mine} loading={isLoading} onNew={() => setTab("kirim")} />}
    </div>
  );
}

function SendForm({ onSent }) {
  const qc = useQueryClient();
  const [type, setType] = useState("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [shot, setShot] = useState("");
  const [uploading, setUploading] = useState(false);
  const [withDevice, setWithDevice] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const fileRef = useRef(null);
  const ctx = collectContext();

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await uploadFile(file, "image");
      setShot(file_url);
    } catch (err) {
      toast.error(uploadErrorText(err, "Gagal mengunggah gambar"));
    }
    setUploading(false);
  };

  const submit = async () => {
    if (!subject.trim()) return toast.error("Isi ringkasan singkat dulu");
    if (message.trim().length < 10) return toast.error("Ceritakan sedikit lebih detail (min. 10 karakter)");
    setSending(true);
    try {
      const res = await base44.functions.invoke("submitFeedback", {
        type, subject: subject.trim(), message: message.trim(), contact: contact.trim(),
        screenshot_url: shot || undefined, context: withDevice ? ctx : undefined,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      qc.invalidateQueries({ queryKey: ["myFeedback"] });
      setSent(true);
    } catch (e) {
      toast.error("Gagal mengirim", { description: e.message });
    }
    setSending(false);
  };

  if (sent) {
    return (
      <div className="text-center">
        <section className="card-gradient-primary rounded-[28px] p-6 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-gold text-gold-foreground flex items-center justify-center mb-3"><CheckCircle2 className="w-8 h-8" /></div>
          <h2 className="font-heading text-2xl font-extrabold">Terima kasih!</h2>
          <p className="text-sm opacity-80 mt-1.5 max-w-xs leading-relaxed">Laporan Anda sudah diterima tim pengembang. Status dan balasannya bisa Anda pantau di <b>Laporan saya</b>, dan kami beri notifikasi saat dibalas.</p>
        </section>
        <div className="mt-5 space-y-2.5">
          <button onClick={onSent} className="w-full btn-primary"><Inbox className="w-5 h-5" /> Lihat laporan saya</button>
          <button onClick={() => { setSent(false); setSubject(""); setMessage(""); setShot(""); setContact(""); }} className="w-full btn-secondary">Kirim laporan lain</button>
        </div>
      </div>
    );
  }

  const meta = FEEDBACK_TYPES[type];
  return (
    <div className="space-y-4">
      <section aria-labelledby="fb-type">
        <p id="fb-type" className="text-xs font-semibold text-muted-foreground mb-2">Jenis laporan</p>
        <div role="radiogroup" aria-labelledby="fb-type" className="grid grid-cols-4 gap-2">
          {Object.entries(FEEDBACK_TYPES).map(([k, t]) => {
            const Icon = TYPE_ICON[k];
            const on = type === k;
            return (
              <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setType(k)}
                className={`rounded-2xl border px-1 py-2.5 flex flex-col items-center gap-1.5 transition-colors ${on ? "border-primary ring-1 ring-primary bg-primary/[0.07]" : "border-border bg-card"}`}>
                <span className={`w-9 h-9 rounded-full flex items-center justify-center ${t.tone}`}><Icon className="w-4 h-4" /></span>
                <span className="text-[11px] font-semibold leading-tight text-center">{t.short}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">{meta.desc}</p>
      </section>

      <section aria-label="Isi laporan" className="surface rounded-3xl divide-y divide-border">
        <FieldRow icon={Type} label="Ringkasan" htmlFor="feedback-subject">
          <input id="feedback-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={type === "bug" ? "Mis. Halaman ter-zoom saat mengetik" : "Ringkasan singkat"} maxLength={120} className={fieldInput} />
        </FieldRow>
        <FieldRow icon={NotebookPen} label="Detail" htmlFor="feedback-message" hint={<span className="block text-right tabular-nums">{message.length}/2000</span>}>
          <textarea id="feedback-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={meta.placeholder} rows={5} maxLength={2000} className={`${fieldInput} resize-none`} />
        </FieldRow>
        <FieldRow icon={ImagePlus} label="Tangkapan layar (opsional)">
          {shot ? (
            <div className="relative mt-1.5 w-28">
              <img src={shot} alt="Tangkapan layar" className="w-28 h-40 object-cover rounded-xl border border-border" />
              <button type="button" onClick={() => setShot("")} aria-label="Hapus gambar" className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary btn-sm mt-1.5">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />} Lampirkan gambar
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />
        </FieldRow>
        <FieldRow icon={AtSign} label="Kontak lain (opsional)" htmlFor="feedback-contact" hint="Balasan selalu muncul di aplikasi; isi bila ingin dihubungi via WhatsApp.">
          <input id="feedback-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Nomor WhatsApp" maxLength={120} className={fieldInput} />
        </FieldRow>
      </section>

      <label className="surface rounded-2xl p-3.5 flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={withDevice} onChange={(e) => setWithDevice(e.target.checked)} className="mt-1 w-4 h-4 accent-[hsl(var(--primary))]" />
        <span className="min-w-0">
          <span className="text-sm font-medium flex items-center gap-1.5"><Smartphone className="w-4 h-4 text-muted-foreground" /> Sertakan info perangkat</span>
          <span className="block text-xs text-muted-foreground mt-0.5 truncate">{describeDevice(ctx?.user_agent) || "Perangkat"} · layar {ctx?.screen || "-"}</span>
          <span className="block text-[11px] text-muted-foreground">Membantu kami menelusuri error. Tidak berisi data keuangan.</span>
        </span>
      </label>

      <button onClick={submit} disabled={sending || uploading} className="w-full btn-primary">
        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} Kirim ke pengembang
      </button>
    </div>
  );
}

function MyReports({ items, loading, onNew }) {
  if (loading) return <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-28 rounded-3xl bg-muted animate-pulse" />)}</div>;
  if (!items.length) {
    return (
      <div className="surface p-4">
        <EmptyState icon={Inbox} title="Belum ada laporan" subtitle="Laporan yang Anda kirim akan muncul di sini beserta status & balasannya." />
        <button onClick={onNew} className="w-full btn-primary mt-2">Kirim laporan</button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((f) => {
        const t = FEEDBACK_TYPES[f.type] || FEEDBACK_TYPES.other;
        const st = FEEDBACK_STATUS[f.status] || FEEDBACK_STATUS.open;
        const Icon = TYPE_ICON[f.type] || MoreHorizontal;
        return (
          <article key={f.id} className="surface p-4">
            <div className="flex items-start gap-3">
              <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${t.tone}`}><Icon className="w-4 h-4" /></span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">{f.subject}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t.label} · {formatDate(f.created_date, "d MMM yyyy, HH:mm")}</p>
              </div>
              <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${st.tone}`}>{st.label}</span>
            </div>
            <p className="text-sm text-foreground/85 mt-2.5 whitespace-pre-line line-clamp-4">{f.message}</p>
            {f.screenshot_url && <img src={f.screenshot_url} alt="Lampiran" className="mt-2.5 h-24 rounded-xl border border-border object-cover" loading="lazy" />}
            {f.admin_reply && (
              <div className="mt-3 rounded-2xl bg-primary/[0.07] border border-primary/15 p-3">
                <p className="text-[11px] font-semibold text-primary flex items-center gap-1"><MessageCircleReply className="w-3.5 h-3.5" /> {f.replied_by_name || "Tim NAFKITA"} · {formatDate(f.replied_at, "d MMM, HH:mm")}</p>
                <p className="text-sm mt-1 whitespace-pre-line">{f.admin_reply}</p>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
