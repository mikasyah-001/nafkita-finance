import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

// Grup accordion untuk halaman Pengaturan — header bernomor yang bisa dilipat.
export default function SettingsAccordion({ number, title, subtitle, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <section className="surface rounded-3xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 active:bg-muted"
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className="w-8 h-8 rounded-full bg-gold text-gold-foreground grid place-items-center text-xs font-bold tabular-nums shrink-0">
            {number}
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-[15px] leading-tight">{title}</span>
            {subtitle && <span className="block text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</span>}
          </span>
        </span>
        <ChevronDown
          className="w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-300 ease-out"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>
      {open && (
        <div id={panelId} className="px-4 py-4 space-y-4 border-t border-border">{children}</div>
      )}
    </section>
  );
}
