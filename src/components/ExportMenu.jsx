import { useState, useRef, useEffect } from "react";
import { FileText, Image, FileSpreadsheet, FileType, ChevronDown, Loader2 } from "lucide-react";

// Menu export terpadu: PDF ringkas (tanpa bukti), PDF lengkap (dengan bukti), CSV, XLSX.
// Menerima 4 handler: onPdfNoProof, onPdfWithProof, onCsv, onXlsx.
export default function ExportMenu({ onPdfNoProof, onPdfWithProof, onCsv, onXlsx, disabled, busy }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const options = [
    { key: "pdf-noproof", label: "PDF (Ringkas)", desc: "Tanpa foto bukti", icon: FileText, action: onPdfNoProof },
    { key: "pdf-proof", label: "PDF (Lengkap)", desc: "Termasuk foto bukti", icon: Image, action: onPdfWithProof },
    { key: "csv", label: "CSV", desc: "Untuk spreadsheet", icon: FileType, action: onCsv },
    { key: "xlsx", label: "Excel (XLSX)", desc: "Format Excel native", icon: FileSpreadsheet, action: onXlsx },
  ].filter((o) => o.action);

  if (options.length === 0) return null;

  const handleSelect = async (opt) => {
    setOpen(false);
    if (opt.action) await opt.action();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled || busy}
        className="w-full rounded-2xl border border-border bg-card py-2.5 text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        Unduh Laporan
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-2xl border border-border bg-popover shadow-lg z-50 overflow-hidden">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.key}
                onClick={() => handleSelect(opt)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors border-b border-border last:border-0"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}