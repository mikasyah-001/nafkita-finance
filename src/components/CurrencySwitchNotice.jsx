import { formatMoneyPlain, conversionPreview } from "@/lib/finance";

/**
 * Pilihan setelah mata uang diganti padahal sudah ada angka.
 * `guard` = hasil useCurrencySwitch; `amounts` = isian nominal saat ini;
 * `tone` "hero" (di atas kartu gradien) atau "plain".
 */
export default function CurrencySwitchNotice({ guard, amounts = {}, tone = "hero" }) {
  const p = guard?.pending;
  if (!p) return null;
  const firstKey = Object.keys(amounts).find((k) => Number(amounts[k]) > 0);
  const n = firstKey ? Number(amounts[firstKey]) : 0;
  const nowReads = formatMoneyPlain(n, p.to);
  const wasReads = formatMoneyPlain(n, p.from);
  const approx = p.to !== "IDR" ? conversionPreview(n, p.to, "IDR", guard.rateMap || {}) : "";
  const conv = guard.converted && firstKey ? formatMoneyPlain(Number(guard.converted[firstKey]), p.to) : "";
  const hero = tone === "hero";
  const box = hero ? "bg-white/12 border-white/25" : "bg-warning/10 border-warning/30 text-foreground";
  const primary = hero ? "bg-white text-[hsl(var(--hero-from))]" : "bg-primary text-primary-foreground";
  const ghost = hero ? "bg-white/10 border border-white/25" : "bg-card border border-border";
  return (
    <div ref={guard.noticeRef} tabIndex={-1} role="alert" aria-label="Periksa mata uang" className={`mt-3 rounded-2xl border p-3 text-xs outline-none ${box}`}>
      <p className="font-semibold">Mata uang diganti {p.from} → {p.to}</p>
      <p className={`mt-0.5 leading-snug ${hero ? "opacity-85" : "text-muted-foreground"}`}>
        Angka belum dikonversi: {wasReads} kini terbaca <b>{nowReads}</b>{approx ? ` (${approx})` : ""}.
        {guard.strict ? " Pilih salah satu sebelum menyimpan." : ""}
      </p>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {guard.converted ? (
          <button type="button" onClick={guard.convert} className={`h-8 px-3 rounded-full font-bold ${primary}`}>Konversi → {conv}</button>
        ) : (
          <span className={`h-8 px-1 inline-flex items-center ${hero ? "opacity-80" : "text-muted-foreground"}`}>Kurs {p.from}→{p.to} belum tersedia.</span>
        )}
        <button type="button" onClick={guard.keep} className={`h-8 px-3 rounded-full font-semibold ${ghost}`}>Angka sudah {p.to}</button>
        <button type="button" onClick={guard.revert} className={`h-8 px-3 rounded-full font-semibold ${ghost}`}>Kembali ke {p.from}</button>
      </div>
    </div>
  );
}
