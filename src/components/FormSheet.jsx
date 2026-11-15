import { useEffect } from "react";
import { X } from "lucide-react";

// Lembar formulir standar (bottom sheet di HP, dialog di desktop).
// Satu pola untuk semua form: header judul+subjudul, isi yang bisa digulir,
// footer aksi yang menempel. Escape & ketuk latar = tutup.
export default function FormSheet({ title, subtitle, onClose, footer, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-foreground/30 backdrop-blur-[2px] animate-in fade-in-0 duration-150" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? "md:max-w-lg" : "md:max-w-md"} max-h-[92vh] flex flex-col bg-background rounded-t-[28px] md:rounded-[28px] shadow-2xl animate-in slide-in-from-bottom-6 duration-200`}
      >
        <div className="md:hidden mx-auto mt-2.5 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        <header className="flex items-start justify-between gap-3 px-5 pt-3 md:pt-5 pb-3">
          <div className="min-w-0">
            <h2 className="font-heading text-xl font-extrabold leading-tight">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Tutup" className="btn-icon btn-icon-sm"><X className="w-4 h-4" /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">{children}</div>
        {footer && <div className="px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-border bg-background/95 rounded-b-[28px]">{footer}</div>}
      </div>
    </div>
  );
}

// Grup baris berlabel dalam satu kartu (pola sama dengan form Catat transaksi).
export function FieldGroup({ children, label }) {
  return (
    <section>
      {label && <p className="text-xs font-semibold text-muted-foreground mb-2">{label}</p>}
      <div className="surface rounded-3xl divide-y divide-border">{children}</div>
    </section>
  );
}

export function FieldRow({ icon: Icon, label, htmlFor, hint, children, trailing }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
      <div className="flex-1 min-w-0">
        {label && <label htmlFor={htmlFor} className="block text-[11px] text-muted-foreground">{label}</label>}
        {children}
        {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      </div>
      {trailing}
    </div>
  );
}

export const fieldInput = "w-full bg-transparent text-sm outline-none py-1 placeholder:text-muted-foreground/70";

// Pilihan berbentuk chip (jenis, mata uang, saran).
export function ChipChoice({ options, value, onChange, ariaLabel, size = "md" }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        const on = value === v;
        return (
          <button key={v} type="button" role="radio" aria-checked={on} onClick={() => onChange(v)}
            className={`${size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-3.5 text-[13px]"} rounded-full font-semibold border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground/80 hover:bg-muted"}`}>
            {l}
          </button>
        );
      })}
    </div>
  );
}
