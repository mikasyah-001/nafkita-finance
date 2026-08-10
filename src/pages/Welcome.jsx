import { useNavigate } from "react-router-dom";
import {
  ArrowRight, ScanLine, Wallet, Coins, Users, Target, BarChart3,
  Layers, EyeOff, Cloud, Bell, Heart, ShieldCheck, Sparkles, Check,
  PiggyBank, Landmark, TrendingUp, Star, Zap, Quote,
  Home as HomeIcon, Moon, Plus,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// DATA FITUR
// CATATAN: Setiap kali ada fitur baru di aplikasi, tambahkan entri
// di array di bawah agar halaman sambutan selalu terupdate.
// ─────────────────────────────────────────────────────────────

const valuePillars = [
  { icon: Zap, title: "Cepat", desc: "Catat transaksi dalam hitungan detik, atau biarkan AI membaca bon Anda." },
  { icon: ShieldCheck, title: "Privat", desc: "Mode sembunyi nominal & ruang kas pribadi yang aman dari mata orang." },
  { icon: Heart, title: "Berkah", desc: "Pelacakan sedekah & kalkulator zakat otomatis berbasis nisab emas." },
];

const flagshipSteps = [
  { icon: ScanLine, text: "Foto bon belanja Anda" },
  { icon: Sparkles, text: "AI membaca nominal, merchant & kategori" },
  { icon: Check, text: "Tinjau, lalu simpan — selesai!" },
];

const features = [
  { icon: ScanLine, bg: "bg-violet-100 dark:bg-violet-950/40", text: "text-violet-600 dark:text-violet-400", title: "Scan Bon AI", desc: "Foto bon otomatis dibaca AI. Bisa 5 foto sekaligus — kategori, nominal & merchant terisi sendiri." },
  { icon: Wallet, bg: "bg-indigo-100 dark:bg-indigo-950/40", text: "text-indigo-600 dark:text-indigo-400", title: "Catat Transaksi", desc: "Pengeluaran, pemasukan, dan sedekah dengan kategori & tag yang rapi." },
  { icon: Coins, bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-600 dark:text-amber-400", title: "Aset & Zakat", desc: "Kelola emas, investasi, properti. Kalkulator zakat otomatis berbasis nisab 85 gr." },
  { icon: Users, bg: "bg-teal-100 dark:bg-teal-950/40", text: "text-teal-600 dark:text-teal-400", title: "Kas Bersama & Pribadi", desc: "Catat keuangan keluarga bersama, sekaligus jaga privasi transaksi pribadi." },
  { icon: Target, bg: "bg-rose-100 dark:bg-rose-950/40", text: "text-rose-600 dark:text-rose-400", title: "Anggaran", desc: "Target pengeluaran per kategori dengan progress bar & peringatan batas." },
  { icon: BarChart3, bg: "bg-sky-100 dark:bg-sky-950/40", text: "text-sky-600 dark:text-sky-400", title: "Laporan & Ringkasan", desc: "Grafik bulanan, perbandingan bulan lalu, dan tren pertumbuhan aset." },
  { icon: Layers, bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", title: "DCA Investasi", desc: "Catat investasi berkala per aset, pantau rata-rata biaya & untung rugi." },
  { icon: EyeOff, bg: "bg-slate-100 dark:bg-slate-800/60", text: "text-slate-600 dark:text-slate-300", title: "Mode Privasi", desc: "Sembunyikan semua nominal dengan satu ketukan — aman dari mata orang lain." },
  { icon: Cloud, bg: "bg-blue-100 dark:bg-blue-950/40", text: "text-blue-600 dark:text-blue-400", title: "Cadangan Otomatis", desc: "Backup data transaksi & aset ke Google Drive setiap minggu secara otomatis." },
  { icon: Bell, bg: "bg-orange-100 dark:bg-orange-950/40", text: "text-orange-600 dark:text-orange-400", title: "Pengingat Harian", desc: "Email pengingat agar tidak lupa mencatat transaksi setiap hari." },
];

const personas = [
  { icon: Users, title: "Pasangan Suami Istri", desc: "Kelola kas bersama transparan, tetap punya ruang pribadi masing-masing." },
  { icon: Moon, title: "Keluarga Muslim", desc: "Sedekah, zakat, dan nisab emas terintegrasi dalam satu aplikasi." },
  { icon: TrendingUp, title: "Pemula Investasi", desc: "Catat DCA emas & investasi, pantau pertumbuhan kekayaan dari waktu ke waktu." },
];

const advantages = [
  "Dirancang khusus untuk keluarga Muslim di Indonesia",
  "Antarmuka sederhana, mudah dipakai pemula",
  "Berjalan offline, sinkron otomatis saat online kembali",
  "Data aman dengan cadangan Google Drive mingguan",
  "Berkah dengan pelacakan sedekah & kalkulator zakat",
  "Gratis digunakan, tanpa biaya langganan",
];

const startSteps = [
  { icon: HomeIcon, t: "Daftar akun", d: "Buat akun dengan email, verifikasi sekali, langsung masuk." },
  { icon: Plus, t: "Catat transaksi pertama", d: "Tekan tombol + atau scan bon belanja Anda." },
  { icon: Landmark, t: "Tambahkan aset", d: "Masukkan tabungan, emas, atau investasi di menu Aset." },
  { icon: BarChart3, t: "Pantau pertumbuhan", d: "Lihat ringkasan, anggaran, dan tren di Beranda setiap hari." },
];

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background pb-28">
      {/* ───────── HERO ───────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white px-6 pt-12 pb-16 rounded-b-[2.75rem]">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-12 w-52 h-52 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="absolute top-24 right-10 w-20 h-20 rounded-full bg-white/5 blur-xl" />

        <div className="relative">
          <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1 rounded-full text-xs font-medium mb-5">
            <Sparkles className="w-3.5 h-3.5" /> Selamat datang di
          </div>
          <h1 className="text-[2.75rem] leading-none font-bold tracking-tight">NAFKITA</h1>
          <p className="text-[15px] opacity-95 mt-2 leading-relaxed max-w-[20rem]">
            Nafkah Keluarga Tercinta — kelola keuangan keluarga jadi mudah, rapi, dan penuh berkah.
          </p>

          {/* Phone mockup */}
          <div className="mt-7 flex justify-center">
            <div className="relative w-[200px]">
              <div className="absolute inset-0 bg-white/10 blur-2xl rounded-[2rem]" />
              <div className="relative rounded-[2rem] border-[6px] border-white/20 bg-white shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-4 text-white">
                  <p className="text-[9px] opacity-80">Saldo bersama • Agt 2026</p>
                  <p className="text-xl font-bold tracking-tight tabular-nums">Rp 4,2 jt</p>
                  <div className="flex gap-2 mt-3 text-[8px]">
                    <div className="flex-1 bg-white/15 rounded-lg p-1.5">
                      <p className="opacity-70">Masuk</p>
                      <p className="font-semibold tabular-nums">8,5 jt</p>
                    </div>
                    <div className="flex-1 bg-white/15 rounded-lg p-1.5">
                      <p className="opacity-70">Keluar</p>
                      <p className="font-semibold tabular-nums">4,3 jt</p>
                    </div>
                  </div>
                </div>
                <div className="p-3 space-y-2 bg-white">
                  {[
                    { i: "🛒", n: "Indomaret", a: "−32 rb", c: "text-rose-500" },
                    { i: "💰", n: "Gaji", a: "+8,5 jt", c: "text-emerald-500" },
                    { i: "🕌", n: "Sedekah", a: "−50 rb", c: "text-rose-500" },
                  ].map((r) => (
                    <div key={r.n} className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs">{r.i}</div>
                      <p className="text-[10px] font-medium text-slate-700 flex-1">{r.n}</p>
                      <p className={`text-[10px] font-semibold tabular-nums ${r.c}`}>{r.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-6 text-xs opacity-90">
            <Heart className="w-4 h-4" />
            <span>Catat, pantau, & tumbuhkan kekayaan bersama pasangan</span>
          </div>
        </div>
      </div>

      {/* ───────── TRUST STRIP ───────── */}
      <div className="px-6 -mt-6">
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card shadow-sm p-3 text-center">
          {[
            { n: "10+", l: "Fitur" },
            { n: "100%", l: "Privat" },
            { n: "Gratis", l: "Selamanya" },
          ].map((s) => (
            <div key={s.l}>
              <p className="text-base font-bold tabular-nums">{s.n}</p>
              <p className="text-[10px] text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ───────── APA ITU ───────── */}
      <section className="px-6 pt-8">
        <SectionLabel>Perkenalan</SectionLabel>
        <h2 className="text-xl font-bold mt-1.5 mb-2.5">Apa itu NAFKITA?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          NAFKITA adalah aplikasi manajemen keuangan keluarga yang cerdas. Anda dan pasangan dapat mencatat pengeluaran, pemasukan, dan aset — bersama atau pribadi — memindai struk dengan AI, melacak zakat & sedekah, hingga memantau anggaran. Semua dalam satu genggaman, dirancang khusus untuk keluarga Muslim di Indonesia.
        </p>

        <div className="grid grid-cols-3 gap-2.5 mt-4">
          {valuePillars.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="rounded-2xl border border-border bg-card p-3 text-center">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <Icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <p className="text-xs font-semibold">{p.title}</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ───────── FLAGSHIP: SCAN BON AI ───────── */}
      <section className="px-6 pt-8">
        <div className="rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white p-5 overflow-hidden relative">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-2.5 py-0.5 rounded-full text-[10px] font-medium mb-3">
              <Sparkles className="w-3 h-3" /> Unggulan
            </div>
            <h2 className="text-lg font-bold leading-tight">Scan Bon dengan AI</h2>
            <p className="text-xs opacity-90 mt-1.5 leading-relaxed">
              Tidak perlu input manual. Foto bon belanja Anda, biarkan AI membaca nominal, nama toko, dan kategorinya secara otomatis. Bisa scan hingga 5 bon sekaligus.
            </p>
            <div className="mt-4 space-y-2">
              {flagshipSteps.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className="flex items-center gap-2.5 bg-white/10 rounded-xl px-3 py-2">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-medium">{s.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ───────── FITUR ───────── */}
      <section className="px-6 pt-8">
        <SectionLabel>Fitur</SectionLabel>
        <h2 className="text-xl font-bold mt-1.5 mb-1">Apa saja yang bisa dilakukan?</h2>
        <p className="text-xs text-muted-foreground mb-4">Semua yang Anda butuhkan untuk mengelola keuangan keluarga, dalam satu aplikasi.</p>
        <div className="grid grid-cols-2 gap-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2.5 ${f.bg}`}>
                  <Icon className={`w-5 h-5 ${f.text}`} />
                </div>
                <p className="text-sm font-semibold leading-tight">{f.title}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ───────── UNTUK SIAPA ───────── */}
      <section className="px-6 pt-8">
        <SectionLabel>Pengguna</SectionLabel>
        <h2 className="text-xl font-bold mt-1.5 mb-3.5">Untuk siapa NAFKITA?</h2>
        <div className="space-y-2.5">
          {personas.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{p.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{p.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ───────── CARA MULAI ───────── */}
      <section className="px-6 pt-8">
        <SectionLabel>Mulai</SectionLabel>
        <h2 className="text-xl font-bold mt-1.5 mb-4">Cara memulai dalam 4 langkah</h2>
        <div className="relative pl-2">
          <div className="absolute left-[1.35rem] top-2 bottom-2 w-px bg-border" />
          <div className="space-y-3">
            {startSteps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="relative flex items-start gap-3">
                  <div className="relative z-10 w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-md ring-4 ring-background">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 pt-1.5">
                    <p className="text-sm font-semibold">{s.t}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{s.d}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────── KELEBIHAN ───────── */}
      <section className="px-6 pt-8">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200/60 dark:border-emerald-900/40 p-5">
          <div className="flex items-center gap-2 mb-3.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold">Kenapa memilih NAFKITA?</h2>
          </div>
          <ul className="space-y-3">
            {advantages.map((a) => (
              <li key={a} className="flex items-start gap-2.5 text-sm">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3" />
                </span>
                <span className="text-foreground/90 leading-snug">{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── TESTIMONI / QUOTE ───────── */}
      <section className="px-6 pt-8">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <Quote className="w-6 h-6 text-primary/30 mb-2" />
          <p className="text-sm text-foreground/90 leading-relaxed italic">
            "Akhirnya bisa transparan sama pasangan soal keuangan, tapi tetap punya ruang pribadi. Scan bon-nya juga bikin catat pengeluaran jadi gampang banget."
          </p>
          <div className="flex items-center gap-2 mt-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500" />
            <div>
              <p className="text-xs font-semibold">Keluarga NAFKITA</p>
              <div className="flex gap-0.5 mt-0.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── FINAL CTA ───────── */}
      <section className="px-6 pt-8">
        <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-6 text-center overflow-hidden relative">
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-12 -left-8 w-28 h-28 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-3">
              <PiggyBank className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold">Siap mengelola keuangan dengan berkah?</h2>
            <p className="text-xs opacity-90 mt-1.5 leading-relaxed">
              Daftar gratis sekarang dan rasakan kemudahan mengelola nafkah keluarga bersama NAFKITA.
            </p>
          </div>
        </div>
      </section>

      {/* ───────── CTA STICKY ───────── */}
      <div className="fixed bottom-0 inset-x-0 px-5 py-4 bg-gradient-to-t from-background via-background to-background/0 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2.5">
        <button
          onClick={() => navigate("/register")}
          className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform shadow-lg"
        >
          Daftar Sekarang <ArrowRight className="w-5 h-5" />
        </button>
        <button
          onClick={() => navigate("/login")}
          className="w-full py-3 rounded-2xl border border-border bg-card text-foreground font-medium text-sm active:scale-[0.99] transition-transform"
        >
          Sudah punya akun? Masuk
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary/70">
      <span className="w-4 h-px bg-primary/40" />
      {children}
    </div>
  );
}