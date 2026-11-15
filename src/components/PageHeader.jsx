import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

// Header halaman yang seragam: [kembali] Judul / subjudul ........ [aksi]
// back: true → navigate(-1); string → path tujuan; false → tanpa tombol kembali.
export default function PageHeader({ title, subtitle, back = false, actions, className = "mb-5" }) {
  const navigate = useNavigate();
  const goBack = () => {
    if (typeof back === "string") navigate(back);
    else if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };
  return (
    <header className={`flex items-center gap-3 ${className}`}>
      {back && (
        <button
          type="button"
          onClick={goBack}
          aria-label="Kembali"
          className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center shrink-0 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
