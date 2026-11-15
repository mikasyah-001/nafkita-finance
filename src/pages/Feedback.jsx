import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Bug, Lightbulb, MessageSquare, MoreHorizontal, Send,
  Loader2, CheckCircle2, Heart, Type, NotebookPen, AtSign,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { FieldRow, fieldInput } from "@/components/FormSheet";

const types = [
  { key: "bug", label: "Laporan Error", icon: Bug, bg: "bg-destructive/15", text: "text-destructive", desc: "Aplikasi error/ngebug" },
  { key: "feature", label: "Permintaan Fitur", icon: Lightbulb, bg: "bg-warning/15", text: "text-warning", desc: "Ide fitur baru" },
  { key: "suggestion", label: "Saran", icon: MessageSquare, bg: "bg-primary/10", text: "text-primary", desc: "Masukan & perbaikan" },
  { key: "other", label: "Lainnya", icon: MoreHorizontal, bg: "bg-muted", text: "text-muted-foreground", desc: "Pertanyaan dll" },
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
    <div className="px-5 pt-6 pb-4">
      <PageHeader title="Umpan balik" subtitle="Pesan Anda langsung sampai ke pengembang" back />

      {sent ? (
        <div className="flex flex-col items-center text-center">
          <section className="card-gradient-primary rounded-[28px] p-6 w-full flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-gold text-gold-foreground flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="font-heading text-2xl font-extrabold">Terima kasih!</h2>
            <p className="text-sm opacity-80 mt-1.5 max-w-xs leading-relaxed">
              Umpan balik Anda telah terkirim ke pengembang. Kami sangat menghargai masukan Anda untuk menyempurnakan NAFKITA.
            </p>
            <div className="inline-flex items-center gap-1.5 mt-4 text-[11px] font-semibold bg-white/10 border border-white/10 rounded-full px-2.5 py-1">
              <Heart className="w-3 h-3" /> Pesan diterima pengembang
            </div>
          </section>
          <div className="w-full mt-5 space-y-2.5">
            <button onClick={reset} className="w-full btn-primary">
              Kirim Umpan Balik Lain
            </button>
            <button onClick={() => navigate(-1)} className="w-full btn-secondary">
              Kembali
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="card-pastel card-pastel-sage rounded-3xl p-4 text-sm leading-relaxed">
            Bantu kami menyempurnakan NAFKITA. Sampaikan laporan error, ide fitur, atau saran — pesan Anda langsung sampai ke pengembang.
          </div>

          <section aria-labelledby="feedback-type-label">
            <div className="mb-2.5">
              <h2 id="feedback-type-label" className="font-semibold text-[17px] leading-tight">Jenis umpan balik</h2>
              <p className="text-xs text-muted-foreground">Pilih yang paling sesuai</p>
            </div>
            <div role="radiogroup" aria-labelledby="feedback-type-label" className="grid grid-cols-2 gap-2.5">
              {types.map((t) => {
                const Icon = t.icon;
                const active = type === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setType(t.key)}
                    className={`rounded-2xl border p-3 text-left transition-all ${active ? "border-primary ring-1 ring-primary bg-primary/[0.07]" : "border-border bg-card"}`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-2 ${t.bg}`}>
                      <Icon className={`w-4 h-4 ${t.text}`} />
                    </div>
                    <p className="text-sm font-semibold leading-tight">{t.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{t.desc}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-label="Isi umpan balik" className="surface rounded-3xl divide-y divide-border">
            <FieldRow icon={Type} label="Subjek" htmlFor="feedback-subject">
              <input
                id="feedback-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ringkasan singkat"
                maxLength={120}
                className={fieldInput}
              />
            </FieldRow>
            <FieldRow icon={NotebookPen} label="Pesan" htmlFor="feedback-message" hint={<span className="block text-right tabular-nums">{message.length}/2000</span>}>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Jelaskan secara detail…"
                rows={5}
                maxLength={2000}
                className={`${fieldInput} resize-none`}
              />
            </FieldRow>
            <FieldRow icon={AtSign} label="Kontak balasan (opsional)" htmlFor="feedback-contact">
              <input
                id="feedback-contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Email atau WhatsApp"
                maxLength={120}
                className={fieldInput}
              />
            </FieldRow>
          </section>

          <button
            onClick={handleSubmit}
            disabled={sending}
            className="w-full btn-primary"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} Kirim ke Pengembang
          </button>
        </div>
      )}
    </div>
  );
}
