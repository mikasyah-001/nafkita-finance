import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options = [
    { key: "light", label: "Terang", icon: Sun },
    { key: "dark", label: "Gelap", icon: Moon },
    { key: "system", label: "Sistem", icon: Monitor },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => setTheme(opt.key)}
            className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all ${
              active
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}