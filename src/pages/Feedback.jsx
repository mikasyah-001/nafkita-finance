import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  ArrowLeft, Bug, Lightbulb, MessageSquare, MoreHorizontal, Send,
  Loader2, CheckCircle2, Heart,
} from "lucide-react";

const types = [
  { key: "bug", label: "Laporan Error", icon: Bug, bg: "bg-rose-100 dark:bg-rose-950/40", text: "text-rose-600 dark:text-rose-400", desc: "Aplikasi error/ngebug" },
  { key: "feature", label: "Permintaan Fitur", icon: Lightbulb, bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-600 dark:text-amber-400", desc: "Ide fitur baru" },
  { key: "suggestion", label: "Saran", icon: MessageSquare, bg: "bg-sky-100 dark:bg-sky-950/40", text: "text-sky-600 dark:text-sky-400", desc: "Masukan & perbaikan" },
  { key: "other", label: "Lainnya", icon: MoreHorizontal, bg: "bg-slate-100 dark:bg-slate-800/60", text: "text-slate-600 dark:text-slate-300", desc: "Pertanyaan dll" },
];

export default function Feedback() {
  const navigate = useNavigate();
  const [type, setType] = useState("suggestion");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim()) return toast.error("Subjek wajib diisi");
    if (!message.trim()) return toast.error("Pesan wajib diisi");
    setSending(true);
    try {
      await base44.functions.invoke("submitFeedback", {
        type, subject: subject.trim(), message: message.trim(), contact: contact.trim(),
      });
      setSent(true);
    } catch (e) {
      toast.error("Gagal mengirim umpan balik", { description: e.message });
    }
    setSending(false);
  };

  const reset = () => {
    setType("suggestion");
    setSubject("");
    setMessage("");
    setContact("");
    setSent(false);
  };

  return (
    <div className="px-5 pt-8 pb-10">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold">Umpan Balik</h1>
      </div>

      {sent ? (
        <div className="flex flex-col items-center text-center pt-10">
          <div className="w-20 h-20 rounded-3xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-lg font-semibold">Terima kasih!</h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
            Umpan balik Anda telah terkirim ke pengembang. Kami sangat menghargai masukan Anda untuk menyempurnakan NAFKITA.
          </p>
          <div className="flex items-center gap-1.5 mt-3 text-xs text-emerald-600">
            <Heart className="w-3.5 h-3.5" /> Pesan diterima pengembang
          </div>
          <div className="w-full mt-8 space-y-2.5">
            <button onClick={reset} className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold active:scale-[0.99] transition-transform">
              Kirim Umpan Balik Lain
            </button>
            <button onClick={() => navigate(-1)} className="w-full py-3 rounded-2xl border border-border text-foreground font-medium text-sm active:scale-[0.99] transition-transform">
              Kembali
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground leading-relaxed mb-5">
            Bantu kami menyempurnakan NAFKITA. Sampaikan laporan error, ide fitur, atau saran — pesan Anda langsung sampai ke pengembang.
          </p>

          <label className="text-xs text-muted-foreground mb-2.5 block">Jenis umpan balik</label>
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            {types.map((t) => {
              const Icon = t.icon;
              const active = type === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setType(t.key)}
                  className={`rounded-2xl border p-3 text-left transition-all ${active ? "border-primary ring-2 ring-primary/20 bg-card" : "border-border bg-card"}`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${t.bg}`}>
                    <Icon className={`w-4.5 h-4.5 ${t.text}`} />
                  </div>
                  <p className="text-sm font-semibold leading-tight">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{t.desc}</p>
                </button>
              );
            })}
          </div>

          <div className="mb-4">
            <label className="text-xs text-muted-foreground mb-1.5 block">Subjek</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ringkasan singkat"
              maxLength={120}
              className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30"
            />
          </div>

          <div className="mb-4">
            <label className="text-xs text-muted-foreground mb-1.5 block">Pesan</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Jelaskan secara detail…"
              rows={5}
              maxLength={2000}
              className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30 resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right mt-1">{message.length}/2000</p>
          </div>

          <div className="mb-6">
            <label className="text-xs text-muted-foreground mb-1.5 block">Kontak balasan (opsional)</label>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Email atau WhatsApp"
              maxLength={120}
              className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={sending}
            className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-60"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} Kirim ke Pengembang
          </button>
        </>
      )}
    </div>
  );
}