import { useNavigate } from "react-router-dom";
import {
  ArrowRight, ScanLine, Wallet, Coins, Users, Target, BarChart3,
  Layers, EyeOff, Cloud, Bell, Heart, ShieldCheck, Sparkles, Check,
} from "lucide-react";

// Daftar fitur aplikasi.
// CATATAN: Setiap kali ada fitur baru ditambahkan ke aplikasi,
// tambahkan juga entri di array `features` agar halaman sambutan selalu terupdate.
const features = [
  { icon: ScanLine, bg: "bg-violet-100 dark:bg-violet-950/40", text: "text-violet-600 dark:text-violet-400", title: "Scan Bon AI", desc: "Foto bon otomatis dibaca AI. Bisa 5 foto sekaligus — kategori & nominal terisi sendiri." },
  { icon: Wallet, bg: "bg-indigo-100 dark:bg-indigo-950/40", text: "text-indigo-600 dark:text-indigo-400", title: "Catat Transaksi", desc: "Pengeluaran, pemasukan, dan sedekah dengan kategori & tag yang rapi." },
  { icon: Coins, bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-600 dark:text-amber-400", title: "Aset & Zakat", desc: "Kelola emas, investasi, properti. Kalkulator zakat otomatis berbasis nisab emas." },
  { icon: Users, bg: "bg-teal-100 dark:bg-teal-950/40", text: "text-teal-600 dark:text-teal-400", title: "Kas Bersama & Pribadi", desc: "Catat keuangan keluarga bersama, sekaligus jaga privasi transaksi pribadi." },
  { icon: Target, bg: "bg-rose-100 dark:bg-rose-950/40", text: "text-rose-600 dark:text-rose-400", title: "Anggaran", desc: "Target pengeluaran per kategori dengan progress bar & peringatan batas." },
  { icon: BarChart3, bg: "bg-sky-100 dark:bg-sky-950/40", text: "text-sky-600 dark:text-sky-400", title: "Laporan & Ringkasan", desc: "Grafik bulanan, perbandingan bulan lalu, dan tren pertumbuhan aset." },
  { icon: Layers, bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", title: "DCA Investasi", desc: "Catat investasi berkala per aset, pantau rata-rata biaya & untung rugi." },
  { icon: EyeOff, bg: "bg-slate-100 dark:bg-slate-800/60", text: "text-slate-600 dark:text-slate-300", title: "Mode Privasi", desc: "Sembunyikan semua nominal dengan satu ketukan — aman dari mata orang lain." },
  { icon: Cloud, bg: "bg-blue-100 dark:bg-blue-950/40", text: "text-blue-600 dark:text-blue-400", title: "Cadangan Otomatis", desc: "Backup data transaksi & aset ke Google Drive setiap minggu secara otomatis." },
  { icon: Bell, bg: "bg-orange-100 dark:bg-orange-950/40", text: "text-orange-600 dark:text-orange-400", title: "Pengingat Harian", desc: "Email pengingat agar tidak lupa mencatat transaksi setiap hari." },
];

const advantages = [
  "Dirancang khusus untuk keluarga Muslim di Indonesia",
  "Antarmuka sederhana, mudah dipakai pemula",
  "Berjalan offline, sinkron otomatis saat online kembali",
  "Data aman dengan cadangan Google Drive",
  "Berkah dengan pelacakan sedekah & kalkulator zakat",
];

export default function Welcome() {
  const navigate = useNavigate();

  const start = () => {
    localStorage.setItem("nafkita_onboarded", "1");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background pb-24">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-white px-6 pt-14 pb-10 rounded-b-[2.5rem]">
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1 rounded-full text-xs font-medium mb-5">
            <Sparkles className="w-3.5 h-3.5" /> Selamat datang
          </div>
          <h1 className="text-4xl font-bold tracking-tight">NAFKITA</h1>
          <p className="text-sm opacity-90 mt-1.5 leading-relaxed">
            Nafkah Keluarga Tercinta — kelola keuangan keluarga jadi mudah, rapi, dan berkah.
          </p>
          <div className="flex items-center gap-2 mt-5 text-xs opacity-90">
            <Heart className="w-4 h-4" />
            <span>Catat, pantau, & tumbuhkan kekayaan bersama pasangan</span>
          </div>
        </div>
      </div>

      {/* Apa itu */}
      <section className="px-6 pt-7">
        <h2 className="text-base font-semibold mb-1.5">Apa itu NAFKITA?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          NAFKITA adalah aplikasi manajemen keuangan keluarga yang cerdas. Anda dan pasangan dapat mencatat pengeluaran, pemasukan, dan aset bersama atau pribadi, memindai struk dengan AI, melacak zakat & sedekah, hingga memantau anggaran — semua dalam satu genggaman.
        </p>
      </section>

      {/* Fitur */}
      <section className="px-6 pt-7">
        <h2 className="text-base font-semibold mb-3">Apa saja yang bisa dilakukan?</h2>
        <div className="grid grid-cols-2 gap-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2.5 ${f.bg}`}>
                  <Icon className={`w-5 h-5 ${f.text}`} />
                </div>
                <p className="text-sm font-medium leading-tight">{f.title}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Kelebihan */}
      <section className="px-6 pt-7">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200/60 dark:border-emerald-900/40 p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h2 className="text-base font-semibold">Kenapa memilih NAFKITA?</h2>
          </div>
          <ul className="space-y-2.5">
            {advantages.map((a) => (
              <li key={a} className="flex items-start gap-2.5 text-sm">
                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-emerald-600" />
                </span>
                <span className="text-foreground/90 leading-snug">{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Cara mulai */}
      <section className="px-6 pt-7">
        <h2 className="text-base font-semibold mb-3">Cara memulai</h2>
        <div className="space-y-2.5">
          {[
            { n: "1", t: "Tekan tombol + untuk catat transaksi pertama Anda" },
            { n: "2", t: "Coba scan bon belanja, biarkan AI mengisinya" },
            { n: "3", t: "Tambahkan aset seperti tabungan & emas di menu Aset" },
            { n: "4", t: "Pantau anggaran & ringkasan di Beranda setiap hari" },
          ].map((s) => (
            <div key={s.n} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">{s.n}</span>
              <p className="text-sm text-foreground/90">{s.t}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA sticky */}
      <div className="fixed bottom-0 inset-x-0 px-5 py-4 bg-gradient-to-t from-background via-background to-background/0 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={start}
          className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform shadow-lg"
        >
          Mulai Menggunakan <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}