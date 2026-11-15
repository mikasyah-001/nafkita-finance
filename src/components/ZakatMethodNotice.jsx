import { useState } from "react";
import { Info, ChevronDown } from "lucide-react";

export default function ZakatMethodNotice() {
  const [open, setOpen] = useState(false);
  return (
    <div className="card-pastel card-pastel-butter rounded-3xl p-4 mb-5">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-start gap-3 text-left">
        <span className="w-8 h-8 rounded-full bg-white/60 dark:bg-white/10 flex items-center justify-center shrink-0"><Info className="w-4 h-4" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Angka ini perkiraan, bukan fatwa</p>
          <p className="text-[11px] opacity-75 leading-snug">Metode belum ditinjau peninjau syariah. Ketuk untuk melihat cara hitung.</p>
        </div>
        <ChevronDown className={`w-4 h-4 opacity-70 mt-2 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-3 pl-[3.25rem] pr-1 text-[11px] opacity-80 list-disc space-y-1 leading-snug">
          <li>Nisab: 85 gram emas, dihitung terpisah per mata uang.</li>
          <li>Tarif: 2,5% dari total harta yang mencapai nisab.</li>
          <li>Harga emas diambil dari sumber publik dan bisa berbeda dengan harga pasar saat ini.</li>
          <li>Belum memperhitungkan haul (kepemilikan 1 tahun), pengurang utang, dan pengecualian rumah tinggal atau aset pakai.</li>
          <li>Konsultasikan ke lembaga amil resmi (mis. BAZNAS) sebelum membayar.</li>
        </ul>
      )}
    </div>
  );
}