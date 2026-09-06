import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, ScanLine, Wallet, Coins, Users, Target, BarChart3,
  EyeOff, Cloud, Heart, ShieldCheck, Sparkles, Check,
  PiggyBank, Landmark, TrendingUp, Zap,
  Home as HomeIcon, Moon, Plus,
  MessageSquare, Link2, Smartphone, Globe, LineChart, FileText,
  MailCheck, RefreshCw, BellRing,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// DATA FITUR — sinkron dengan fungsi aplikasi yang ada.
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
  { icon: ScanLine, bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-600 dark:text-violet-400", title: "Scan Bon AI", desc: "Foto bon otomatis dibaca AI. Bisa 5 foto sekaligus — kategori, nominal & merchant terisi sendiri." },
  { icon: MessageSquare, bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-600 dark:text-violet-400", title: "Asisten Struk AI", desc: "Ngobrol dengan asisten AI untuk catat transaksi, tanya pengeluaran, dan ringkas keuangan." },
  { icon: Wallet, bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-600 dark:text-indigo-400", title: "Catat Transaksi", desc: "Pengeluaran, pemasukan, dan sedekah dengan kategori & tag yang rapi." },
  { icon: Users, bg: "bg-teal-50 dark:bg-teal-950/30", text: "text-teal-600 dark:text-teal-400", title: "Kas Bersama & Pribadi", desc: "Catat keuangan keluarga bersama, sekaligus jaga privasi transaksi pribadi." },
  { icon: Link2, bg: "bg-teal-50 dark:bg-teal-950/30", text: "text-teal-600 dark:text-teal-400", title: "Koneksi Pasangan", desc: "Hubungkan suami-istri lewat kode referensi unik. Transaksi bersama tersinkron otomatis." },
  { icon: BellRing, bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-600 dark:text-orange-400", title: "Notifikasi Pasangan", desc: "Notifikasi real-time saat pasangan mencatat transaksi bersama." },
  { icon: Landmark, bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-600 dark:text-amber-400", title: "Aset & Investasi", desc: "Kelola emas, investasi DCA, properti, & tanah dengan mata uang masing-masing." },
  { icon: LineChart, bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-600 dark:text-emerald-400", title: "Dasbor Aset", desc: "Grafik pertumbuhan aset & emas, snapshot bulanan, dan distribusi portofolio." },
  { icon: Coins, bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-600 dark:text-amber-400", title: "Kalkulator Zakat", desc: "Zakat emas & simpanan otomatis berbasis nisab 85 gr + harga emas real-time." },
  { icon: Target, bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-600 dark:text-rose-400", title: "Anggaran", desc: "Target pengeluaran per kategori dengan progress bar & peringatan batas." },
  { icon: BarChart3, bg: "bg-sky-50 dark:bg-sky-950/30", text: "text-sky-600 dark:text-sky-400", title: "Laporan & Ringkasan", desc: "Grafik bulanan, perbandingan bulan lalu, tren, dan ekspor PDF lengkap dengan bukti." },
  { icon: Globe, bg: "bg-sky-50 dark:bg-sky-950/30", text: "text-sky-600 dark:text-sky-400", title: "Multi-Mata Uang", desc: "Aktifkan/nonaktifkan mata uang sesuai kebutuhan, atau tambah mata uang kustom. Catat tanpa mencampur nominal antar-mata uang." },
  { icon: EyeOff, bg: "bg-slate-100 dark:bg-slate-800/40", text: "text-slate-600 dark:text-slate-300", title: "Mode Privasi", desc: "Sembunyikan semua nominal dengan satu ketukan — aman dari mata orang lain." },
  { icon: RefreshCw, bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-600 dark:text-indigo-400", title: "Sinkron Offline", desc: "Tetap bisa mencatat tanpa internet. Data tersinkron otomatis saat online kembali." },
  { icon: Cloud, bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-600 dark:text-blue-400", title: "Cadangan Google Drive", desc: "Backup data transaksi & aset ke Google Drive setiap minggu secara otomatis." },
  { icon: MailCheck, bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-600 dark:text-orange-400", title: "Pengingat & Ringkasan Email", desc: "Email pengingat harian & ringkasan laporan bulanan otomatis ke kotak masuk Anda." },
  { icon: Smartphone, bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-600 dark:text-violet-400", title: "Pasang di HP (PWA)", desc: "Instal NAFKITA di layar utama seperti aplikasi native — cepat & ringan." },
  { icon: FileText, bg: "bg-slate-100 dark:bg-slate-800/40", text: "text-slate-600 dark:text-slate-300", title: "Umpan Balik", desc: "Kirim saran atau lapor bug langsung dari aplikasi untuk bantu kami berkembang." },
];

const personas = [
  { icon: Users, title: "Pasangan Suami Istri", desc: "Kelola kas bersama transparan, tetap punya ruang pribadi masing-masing." },
  { icon: Moon, title: "Keluarga Muslim", desc: "Sedekah, zakat, dan nisab emas terintegrasi dalam satu aplikasi." },
  { icon: TrendingUp, title: "Pemula Investasi", desc: "Catat DCA emas & investasi, pantau pertumbuhan kekayaan dari waktu ke waktu." },
];

const advantages = [
  "Dirancang untuk pengelolaan keuangan keluarga Muslim",
  "Antarmuka sederhana yang mudah dipahami",
  "Pencatatan offline dengan sinkronisasi saat kembali online",
  "Cadangan lokal dan Google Drive untuk membantu pemulihan data",
  "Pelacakan sedekah dan kalkulator zakat berbasis nisab emas",
  "Mata uang dapat diaktifkan & dikustom sesuai kebutuhan, tanpa mencampur nominal antar-mata uang",
  "Dapat dipasang di layar utama sebagai PWA",
  "Ruang kas bersama dan pribadi dengan kontrol visibilitas",
];

const startSteps = [
  { icon: HomeIcon, t: "Daftar akun", d: "Buat akun dengan email, verifikasi sekali, langsung masuk." },
  { icon: Plus, t: "Catat transaksi pertama", d: "Tekan tombol + atau scan bon belanja Anda." },
  { icon: Landmark, t: "Tambahkan aset", d: "Masukkan tabungan, emas, atau investasi di menu Aset." },
  { icon: BarChart3, t: "Pantau pertumbuhan", d: "Lihat ringkasan, anggaran, dan tren di Beranda setiap hari." },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/40 via-background to-background dark:from-emerald-950/10 pb-28">
      {/* ───────── HERO ───────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-800 text-white px-6 pt-14 pb-20 rounded-b-[3rem]">
        {/* Decorative orbs */}
        <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-amber-300/15 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 w-56 h-56 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute top-28 right-12 w-24 h-24 rounded-full bg-white/5 blur-xl" />

        <div className="relative">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-medium mb-5 border border-white/20"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200" /> Selamat datang di
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-[3rem] leading-none font-bold tracking-tight"
          >
            NAFKITA
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-[15px] opacity-95 mt-2.5 leading-relaxed max-w-[21rem]"
          >
            Nafkah Keluarga Tercinta — kelola keuangan keluarga jadi mudah, rapi, dan penuh berkah.
          </motion.p>

          {/* Phone mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
            className="mt-8 flex justify-center"
          >
            <div className="relative w-[210px]">
              <div className="absolute inset-0 bg-amber-300/20 blur-2xl rounded-[2.5rem]" />
              <div className="relative rounded-[2.5rem] border-[7px] border-white/25 bg-white shadow-2xl overflow-hidden">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-slate-900 rounded-b-2xl z-10" />
                {/* Header */}
                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-4 pt-6 text-white">
                  <p className="text-[9px] opacity-80">Saldo bersama • Sep 2026</p>
                  <p className="text-2xl font-bold tracking-tight tabular-nums">Rp 4,2 jt</p>
                  <div className="flex gap-2 mt-3 text-[8px]">
                    <div className="flex-1 bg-white/15 backdrop-blur rounded-xl p-2">
                      <p className="opacity-70">Masuk</p>
                      <p className="font-semibold tabular-nums text-[11px]">8,5 jt</p>
                    </div>
                    <div className="flex-1 bg-white/15 backdrop-blur rounded-xl p-2">
                      <p className="opacity-70">Keluar</p>
                      <p className="font-semibold tabular-nums text-[11px]">4,3 jt</p>
                    </div>
                  </div>
                </div>
                {/* Transaction list */}
                <div className="p-3 space-y-2 bg-white">
                  {[
                    { i: "🛒", n: "Indomaret", a: "−32 rb", c: "text-rose-500" },
                    { i: "💰", n: "Gaji", a: "+8,5 jt", c: "text-emerald-500" },
                    { i: "🕌", n: "Sedekah", a: "−50 rb", c: "text-teal-500" },
                  ].map((r) => (
                    <div key={r.n} className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-sm">{r.i}</div>
                      <p className="text-[10px] font-medium text-slate-700 flex-1">{r.n}</p>
                      <p className={`text-[10px] font-semibold tabular-nums ${r.c}`}>{r.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex items-center justify-center gap-2 mt-6 text-xs opacity-90"
          >
            <Heart className="w-4 h-4 text-amber-200" />
            <span>Catat, pantau, & tumbuhkan kekayaan bersama pasangan</span>
          </motion.div>
        </div>
      </div>

      {/* ───────── TRUST STRIP ───────── */}
      <div className="px-6 -mt-7 relative z-10 max-w-3xl mx-auto w-full">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card/90 backdrop-blur shadow-lg shadow-emerald-950/5 p-3.5 text-center"
        >
          {[
            { n: "18+", l: "Fitur aktif" },
            { n: "12+", l: "Mata uang" },
            { n: "2", l: "Ruang kas" },
          ].map((s) => (
            <motion.div key={s.l} variants={fadeUp}>
              <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{s.n}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.l}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ───────── APA ITU ───────── */}
      <Section className="pt-9">
        <SectionLabel>Perkenalan</SectionLabel>
        <h2 className="text-xl font-bold mt-2 mb-3 tracking-tight">Apa itu NAFKITA?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          NAFKITA menyatukan pencatatan pemasukan, pengeluaran, sedekah, aset, investasi, anggaran, dan laporan keluarga. Hubungkan akun dengan pasangan, pilih ruang bersama atau pribadi, atur mata uang sesuai kebutuhan Anda, lalu pantau kondisi keuangan dari satu tempat.
        </p>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-3 gap-2.5 mt-5"
        >
          {valuePillars.map((p) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.title}
                variants={fadeUp}
                className="rounded-2xl border border-border bg-card p-3.5 text-center shadow-sm hover:shadow-md hover:border-emerald-300/50 dark:hover:border-emerald-800/50 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-950/40 dark:to-teal-950/40 flex items-center justify-center mx-auto mb-2.5">
                  <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-xs font-semibold">{p.title}</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{p.desc}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </Section>

      {/* ───────── FLAGSHIP: SCAN BON AI ───────── */}
      <Section className="pt-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white p-6 overflow-hidden relative shadow-xl shadow-violet-950/20"
        >
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-300/15 blur-3xl" />
          <div className="absolute -bottom-12 -left-8 w-32 h-32 rounded-full bg-fuchsia-400/15 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-medium mb-3 border border-white/20">
              <Sparkles className="w-3 h-3 text-amber-200" /> Unggulan
            </div>
            <h2 className="text-lg font-bold leading-tight">Scan Bon dengan AI</h2>
            <p className="text-xs opacity-90 mt-2 leading-relaxed">
              Tidak perlu input manual. Foto bon belanja Anda, biarkan AI membaca nominal, nama toko, dan kategorinya secara otomatis. Bisa scan hingga 5 bon sekaligus.
            </p>
            <div className="mt-4 space-y-2">
              {flagshipSteps.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className="flex items-center gap-3 bg-white/10 backdrop-blur rounded-xl px-3.5 py-2.5 border border-white/10">
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-medium">{s.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </Section>

      {/* ───────── FITUR ───────── */}
      <Section className="pt-9">
        <SectionLabel>Fitur</SectionLabel>
        <h2 className="text-xl font-bold mt-2 mb-1 tracking-tight">Apa saja yang bisa dilakukan?</h2>
        <p className="text-xs text-muted-foreground mb-5">Semua yang Anda butuhkan untuk mengelola keuangan keluarga, dalam satu aplikasi.</p>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                variants={fadeUp}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-3 ${f.bg}`}>
                  <Icon className={`w-5 h-5 ${f.text}`} />
                </div>
                <p className="text-sm font-semibold leading-tight">{f.title}</p>
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{f.desc}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </Section>

      {/* ───────── UNTUK SIAPA ───────── */}
      <Section className="pt-9">
        <SectionLabel>Pengguna</SectionLabel>
        <h2 className="text-xl font-bold mt-2 mb-4 tracking-tight">Untuk siapa NAFKITA?</h2>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
          className="space-y-3"
        >
          {personas.map((p) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.title}
                variants={fadeUp}
                className="flex items-start gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-950/40 dark:to-teal-950/40 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{p.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">{p.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </Section>

      {/* ───────── CARA MULAI ───────── */}
      <Section className="pt-9">
        <SectionLabel>Mulai</SectionLabel>
        <h2 className="text-xl font-bold mt-2 mb-5 tracking-tight">Cara memulai dalam 4 langkah</h2>
        <div className="relative pl-2">
          <div className="absolute left-[1.55rem] top-3 bottom-3 w-px bg-gradient-to-b from-emerald-300 via-border to-transparent dark:from-emerald-800" />
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="space-y-4"
          >
            {startSteps.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div key={i} variants={fadeUp} className="relative flex items-start gap-3.5">
                  <div className="relative z-10 w-12 h-12 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-950/20 ring-4 ring-background">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 pt-2">
                    <p className="text-sm font-semibold">{s.t}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{s.d}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </Section>

      {/* ───────── KELEBIHAN ───────── */}
      <Section className="pt-9">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200/50 dark:border-emerald-900/40 p-5"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-950/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold tracking-tight">Kenapa memilih NAFKITA?</h2>
          </div>
          <ul className="space-y-3">
            {advantages.map((a) => (
              <li key={a} className="flex items-start gap-3 text-sm">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Check className="w-3 h-3" />
                </span>
                <span className="text-foreground/90 leading-snug">{a}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </Section>

      {/* ───────── FINAL CTA ───────── */}
      <Section className="pt-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-800 text-white p-7 text-center overflow-hidden relative shadow-xl shadow-emerald-950/20"
        >
          <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-amber-300/15 blur-3xl" />
          <div className="absolute -bottom-14 -left-10 w-32 h-32 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center mx-auto mb-4 border border-white/20">
              <PiggyBank className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold tracking-tight">Siap mengelola keuangan dengan berkah?</h2>
            <p className="text-xs opacity-90 mt-2 leading-relaxed max-w-[16rem] mx-auto">
              Buat akun dan mulai mencatat keuangan keluarga secara rapi bersama NAFKITA.
            </p>
          </div>
        </motion.div>
      </Section>

      {/* ───────── CTA STICKY ───────── */}
      <div className="fixed bottom-0 inset-x-0 px-5 py-4 bg-gradient-to-t from-background via-background to-background/0 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2.5">
        <button
          onClick={() => navigate("/register")}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform shadow-lg shadow-emerald-950/20"
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

function Section({ children, className = "" }) {
  return <section className={`px-6 w-full max-w-5xl mx-auto ${className}`}>{children}</section>;
}

function SectionLabel({ children }) {
  return (
    <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
      <span className="w-5 h-px bg-emerald-600/40" />
      {children}
    </div>
  );
}