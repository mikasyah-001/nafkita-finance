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
          <p className="text-[11px] opacity-75 leading-snug">Ketuk untuk melihat cara hitung & rujukannya.</p>
        </div>
        <ChevronDown className={`w-4 h-4 opacity-70 mt-2 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-3 pl-[3.25rem] pr-1 text-[11px] opacity-80 list-disc space-y-1 leading-snug">
          <li>Nisab: setara 85 gram emas, dinilai dengan harga emas saat dihitung. Kadar 2,5%.</li>
          <li>Uang tunai, tabungan, emas (nilai pasar), investasi, dan piutang lancar digabung, termasuk yang dalam mata uang asing (dikonversi ke Rupiah).</li>
          <li>Utang yang jatuh tempo dalam 12 bulan dikurangkan sebelum dibandingkan dengan nisab.</li>
          <li>Rumah tinggal, tanah, kendaraan & barang pakai tidak dihitung, kecuali untuk diperjualbelikan.</li>
          <li>Haul 1 tahun hijriah (±354 hari) dari tanggal harta mencapai nisab; atur tanggalnya di bagian Haul.</li>
          <li>Semua emas tercatat ikut dihitung. Untuk perhiasan yang dipakai wajar ada perbedaan pendapat ulama.</li>
          <li>Rujukan: praktik BAZNAS & PMA 52/2014 jo. PMA 31/2019. Konsultasikan ke amil resmi sebelum membayar.</li>
        </ul>
      )}
    </div>
  );
}