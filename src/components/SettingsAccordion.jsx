import { useState } from "react";
import { ChevronDown } from "lucide-react";

// Grup accordion untuk halaman Pengaturan — header bernomor yang bisa dilipat.
export default function SettingsAccordion({ number, title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-muted/50 active:bg-muted"
      >
        <span className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary grid place-items-center text-sm font-bold tabular-nums">
            {number}
          </span>
          <span className="text-lg font-semibold tracking-tight">{title}</span>
        </span>
        <ChevronDown
          className="w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-300 ease-out"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-border">{children}</div>
      )}
    </div>
  );
}