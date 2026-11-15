import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ArrowRight, Lightbulb, Workflow, ListChecks } from "lucide-react";

export default function PanduanCard({ item, accentClass }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const Icon = item.icon;

  return (
    <article className="surface rounded-3xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors"
        aria-expanded={open}
      >
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${accentClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground truncate">{item.short}</p>
        </div>
        <ChevronDown className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border">
          <p className="text-sm text-muted-foreground leading-relaxed pt-3">{item.description}</p>

          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
              <Workflow className="w-3.5 h-3.5 text-primary" /> Cara kerja
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.howItWorks}</p>
          </div>

          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-2">
              <ListChecks className="w-3.5 h-3.5 text-primary" /> Langkah pemakaian
            </h4>
            <ol className="space-y-2">
              {item.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <span className="w-5 h-5 rounded-full bg-gold text-gold-foreground text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="card-pastel card-pastel-butter rounded-2xl p-3 flex items-start gap-2">
            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{item.tips}</p>
          </div>

          <button
            onClick={() => navigate(item.to)}
            className="w-full btn-primary btn-sm"
          >
            Buka {item.name} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </article>
  );
}