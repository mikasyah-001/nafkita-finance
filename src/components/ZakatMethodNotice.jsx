import { useState } from "react";
import { Info, ChevronDown } from "lucide-react";

export default function ZakatMethodNotice() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-warning/30 bg-warning/10 p-3 mb-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-start gap-2 text-left">
        <Info className="w-4 h-4 text-warning shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold">Angka ini perkiraan, bukan fatwa</p>
          <p className="text-[11px] text-muted-foreground">Metode belum ditinjau peninjau syariah. Ketuk untuk melihat cara hitung.</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-2 pl-6 text-[11px] text-muted-foreground list-disc space-y-1">
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