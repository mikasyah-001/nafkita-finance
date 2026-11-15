// Logo NAFKITA: ikon dompet + wordmark. Satu komponen untuk semua tempat
// (sidebar, auth, welcome) agar branding konsisten.
// variant: "mark" (ikon saja) | "full" (ikon + wordmark) | "wordmark".
// tone: "auto" (ikut tema) | "light" (untuk latar gelap, mis. hero).
export default function BrandLogo({ variant = "full", tone = "auto", className = "", markClassName = "h-9 w-9", wordClassName = "h-5" }) {
  const mark = <img src="/brand/mark.png" alt={variant === "mark" ? "NAFKITA" : ""} className={`${markClassName} object-contain shrink-0`} draggable={false} />;
  const word = (
    <>
      {tone !== "light" && <img src="/brand/wordmark.png" alt="NAFKITA" className={`${wordClassName} w-auto object-contain ${tone === "auto" ? "dark:hidden" : ""}`} draggable={false} />}
      <img src="/brand/wordmark-light.png" alt="NAFKITA" className={`${wordClassName} w-auto object-contain ${tone === "auto" ? "hidden dark:block" : ""}`} draggable={false} />
    </>
  );
  if (variant === "mark") return <span className={className}>{mark}</span>;
  if (variant === "wordmark") return <span className={`inline-flex ${className}`}>{word}</span>;
  return <span className={`inline-flex items-center gap-2 ${className}`}>{mark}{word}</span>;
}
