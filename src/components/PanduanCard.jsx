import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ArrowRight, Lightbulb, Workflow, ListChecks } from "lucide-react";

export default function PanduanCard({ item, accentClass }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const Icon = item.icon;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${accentClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground truncate">{item.short}</p>
        </div>
        <ChevronDown className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border/60">
          <p className="text-sm text-muted-foreground leading-relaxed pt-3">{item.description}</p>

          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
              <Workflow className="w-3.5 h-3.5 text-blue-500" /> Cara Kerja
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.howItWorks}</p>
          </div>

          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-2">
              <ListChecks className="w-3.5 h-3.5 text-emerald-500" /> Langkah Pemakaian
            </h4>
            <ol className="space-y-1.5">
              {item.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <span className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/50 p-3 flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">{item.tips}</p>
          </div>

          <button
            onClick={() => navigate(item.to)}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform"
          >
            Buka {item.name} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}