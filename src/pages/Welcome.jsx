import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, ScanLine, Wallet, Coins, Users, Target, BarChart3, EyeOff, Cloud, Heart,
  ShieldCheck, Sparkles, Check, Landmark, Link2, Smartphone, LineChart, MailCheck,
  RefreshCw, BellRing, CheckCheck, History, Activity, FileSpreadsheet, Copy,
  CalendarClock, HandCoins, Share2, ClipboardCheck, ArrowLeftRight, Scale, Receipt,
  CalendarDays, Gem, Vault, Plus, TrendingUp, ChevronRight,
} from "lucide-react";
import { SAR_SIGN } from "@/lib/finance";

// ─────────────────────────────────────────────────────────────
// HALAMAN SAMBUTAN (sebelum login).
// Data fitur di bawah HARUS sinkron dengan fitur yang benar-benar ada.
// Tambah/ubah entri di sini setiap kali fitur aplikasi berubah.
// ─────────────────────────────────────────────────────────────

const pillars = [
  { icon: Sparkles, title: "Rapi", desc: "Catat dalam detik, scan bon dengan AI", tone: "card-pastel-butter" },
  { icon: Users, title: "Berdua", desc: "Kas bersama & ruang pribadi", tone: "card-pastel-mint" },
  { icon: Heart, title: "Berkah", desc: "Sedekah & zakat mal sesuai syariat", tone: "card-pastel-peach" },
];

// Sorotan utama — ditampilkan sebagai kartu besar bergantian.
const highlights = [
  {
    key: "catat",
    tone: "card-pastel-butter",
    icon: ScanLine,
    eyebrow: "Pencatatan",
    title: "Catat dalam hitungan detik",
    desc: "Ketik nominal atau foto struk. AI membaca nominal, toko, tanggal, dan kategori, hingga 5 bon sekaligus. Anda tinggal memeriksa, lalu simpan.",
    points: ["Template transaksi rutin", "Deteksi transaksi ganda", "Tetap bisa mencatat saat offline"],
  },
  {
    key: "berdua",
    tone: "card-pastel-mint",
    icon: Users,
    eyebrow: "Suami & istri",
    title: "Satu kas keluarga, tetap ada ruang pribadi",
    desc: "Hubungkan akun dengan pasangan lewat kode unik. Transaksi bersama tersinkron otomatis, sementara catatan pribadi tetap milik Anda.",
    points: ["Persetujuan pasangan untuk transaksi besar", "Notifikasi saat pasangan mencatat", "Mode sembunyi nominal satu ketuk"],
  },
  {
    key: "zakat",
    tone: "card-pastel-peach",
    icon: Coins,
    eyebrow: "Zakat mal",
    title: "Zakat dihitung sesuai ketentuan",
    desc: "Uang, tabungan, emas, investasi, dan piutang lancar digabung lintas mata uang. Nisab 85 gram emas dengan harga terkini, kadar 2,5%, haul 1 tahun hijriah.",
    points: ["Haul emas dihitung dari tanggal beli tiap aset", "Utang jatuh tempo dikurangkan, rumah tinggal tidak dihitung", "Bayar bisa dicicil, dalam Rupiah atau Riyal"],
  },
  {
    key: "kurs",
    tone: "card-pastel-sage",
    icon: ArrowLeftRight,
    eyebrow: "Rupiah & Riyal",
    title: "Untuk keluarga Indonesia–Saudi",
    desc: `Catat dalam IDR, SAR (${SAR_SIGN} simbol resmi), atau mata uang lain tanpa tercampur. Laporan bisa digabung ke satu mata uang dengan kurs otomatis.`,
    points: ["Pratinjau setara Rupiah saat mengetik", "Peringatan bila nominal tampak salah mata uang", "Target tabungan dalam mata uang mana pun"],
  },
  {
    key: "aset",
    tone: "card-pastel-lime",
    icon: Landmark,
    eyebrow: "Aset & emas",
    title: "Lihat kekayaan tumbuh, bukan sekadar saldo",
    desc: "Rekening, uang tunai, emas fisik & digital, investasi, properti, dan tanah dalam satu tempat. Satu harga emas acuan dipakai untuk aset, laporan, dan zakat.",
    points: ["Untung/rugi emas per gram", "Investasi DCA & riwayat mutasi aset", "Audit kas tunai: cocokkan dompet dengan catatan"],
  },
];

// Daftar lengkap fitur per kelompok.
const FEATURE_GROUPS = [
  {
    label: "Pencatatan",
    items: [
      { icon: ScanLine, title: "Scan bon AI", desc: "Hingga 5 foto sekaligus, ditinjau sebelum disimpan." },
      { icon: Copy, title: "Deteksi duplikat", desc: "Transaksi ganda ditandai saat catat, scan, dan impor." },
      { icon: FileSpreadsheet, title: "Impor mutasi", desc: "Tempel teks mutasi bank, AI menyusun transaksinya." },
      { icon: ArrowLeftRight, title: "Transfer antar rekening", desc: "Saldo berpindah tanpa dihitung sebagai belanja." },
      { icon: CalendarClock, title: "Tagihan rutin", desc: "Listrik, sekolah, cicilan tercatat otomatis tiap periode." },
      { icon: Sparkles, title: "Pengeluaran luar biasa", desc: "Tandai belanja besar tak rutin agar rata-rata harian tetap jujur." },
    ],
  },
  {
    label: "Anggaran & rencana",
    items: [
      { icon: Target, title: "Anggaran per kategori", desc: "Progres & peringatan batas, sisa bisa dibawa ke bulan depan." },
      { icon: TrendingUp, title: "Rencana bulanan", desc: "Target pemasukan & menabung, progresnya tampil di Beranda." },
      { icon: Vault, title: "Target tabungan", desc: "Dana darurat, pendidikan, umrah, dalam mata uang aktif mana pun." },
      { icon: Scale, title: "Utang & piutang", desc: "Cicilan, jatuh tempo, dan pengingat sebelum tenggat." },
    ],
  },
  {
    label: "Laporan",
    items: [
      { icon: BarChart3, title: "Laporan & tren", desc: "Bulanan, mingguan, tahunan; perbandingan dan proyeksi." },
      { icon: Share2, title: "Bagikan sebagai gambar", desc: "Ringkasan bulan jadi gambar rapi untuk dikirim ke pasangan." },
      { icon: Receipt, title: "Ekspor PDF, CSV, Excel", desc: "Termasuk PDF lengkap dengan foto bukti transaksi." },
      { icon: MailCheck, title: "Ringkasan email", desc: "Pengingat harian & laporan bulanan ke kotak masuk." },
    ],
  },
  {
    label: "Aset, emas & zakat",
    items: [
      { icon: Gem, title: "Harga emas acuan", desc: "Satu harga untuk aset, laporan, dan nisab; bisa dibandingkan antar sumber." },
      { icon: LineChart, title: "Dasbor aset", desc: "Pertumbuhan per jenis, snapshot bulanan, distribusi portofolio." },
      { icon: ClipboardCheck, title: "Audit kas & rekonsiliasi", desc: "Cocokkan saldo dompet atau rekening, selisih tercatat rapi." },
      { icon: HandCoins, title: "Zakat mal", desc: "Status nisab & haul, riwayat bayar, pengingat menjelang haul." },
      { icon: History, title: "Riwayat mutasi aset", desc: "Setiap perubahan saldo tercatat sebagai jejak audit." },
    ],
  },
  {
    label: "Berdua & keamanan",
    items: [
      { icon: Link2, title: "Koneksi pasangan", desc: "Kode referensi unik, peran & akses diatur bersama." },
      { icon: CheckCheck, title: "Persetujuan transaksi", desc: "Transaksi di atas ambang menunggu persetujuan pasangan." },
      { icon: BellRing, title: "Aturan notifikasi", desc: "Atur per kategori & ambang nominal." },
      { icon: EyeOff, title: "Mode privasi", desc: "Sembunyikan semua nominal dengan satu ketuk." },
      { icon: ShieldCheck, title: "Verifikasi dua langkah", desc: "Lapisan keamanan tambahan untuk akun Anda." },
      { icon: Activity, title: "Kesehatan data", desc: "Temukan transaksi tanpa kategori, saldo negatif, mata uang keliru." },
      { icon: Cloud, title: "Cadangan Google Drive", desc: "Backup otomatis & pemulihan data." },
      { icon: RefreshCw, title: "Offline & PWA", desc: "Pasang di layar utama, catat tanpa sinyal, sinkron saat online." },
    ],
  },
];
const featureCount = FEATURE_GROUPS.reduce((n, g) => n + g.items.length, 0);

const startSteps = [
  { icon: Smartphone, t: "Daftar & pasang di HP", d: "Buat akun dengan email, lalu tambahkan ke layar utama." },
  { icon: Wallet, t: "Tambahkan rekening & dompet", d: "Saldo awal rekening, uang tunai, dan emas Anda." },
  { icon: Link2, t: "Hubungkan pasangan", d: "Bagikan kode unik agar kas keluarga tersinkron." },
  { icon: Plus, t: "Mulai mencatat", d: "Tekan tombol Catat atau scan struk belanja pertama." },
];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const inView = { initial: "hidden", whileInView: "show", viewport: { once: true, margin: "-40px" } };

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* ───────── TOP BAR ───────── */}
      <header className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/brand/mark.png" alt="" className="w-9 h-9" />
          <img src="/brand/wordmark.png" alt="NAFKITA" className="h-5 w-auto dark:hidden" />
          <img src="/brand/wordmark-light.png" alt="NAFKITA" className="h-5 w-auto hidden dark:block" />
        </div>
        <button onClick={() => navigate("/login")} className="h-10 px-4 rounded-full surface text-sm font-semibold active:scale-95 transition-transform">
          Masuk
        </button>
      </header>

      {/* ───────── HERO ───────── */}
      <section className="px-5 pt-8 max-w-5xl mx-auto md:grid md:grid-cols-2 md:gap-10 md:items-center">
        <motion.div initial="hidden" animate="show" variants={stagger}>
          <motion.p variants={fadeUp} className="inline-flex items-center gap-1.5 rounded-full card-pastel card-pastel-butter px-3 py-1.5 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Nafkah kita, berkah bersama
          </motion.p>
          <motion.h1 variants={fadeUp} className="font-heading text-[34px] leading-[1.1] font-extrabold tracking-tight mt-4">
            Keuangan keluarga yang <span className="text-primary">rapi</span>, <span className="text-primary">terbuka</span>, dan <span className="text-primary underline decoration-[hsl(var(--gold))] decoration-[5px] underline-offset-[6px]">berkah</span>.
          </motion.h1>
          <motion.p variants={fadeUp} className="text-[15px] text-muted-foreground leading-relaxed mt-3 max-w-md">
            Catat pemasukan, belanja, dan sedekah bersama pasangan. Pantau aset dan emas, rencanakan tabungan, dan hitung zakat mal dari satu aplikasi.
          </motion.p>
          <motion.div variants={fadeUp} className="hidden md:flex gap-3 mt-6">
            <button onClick={() => navigate("/register")} className="btn-gold">Daftar gratis <ArrowRight className="w-5 h-5" /></button>
            <button onClick={() => navigate("/login")} className="btn-secondary">Sudah punya akun</button>
          </motion.div>
        </motion.div>

        <HeroPreview />
      </section>

      {/* ───────── PILAR ───────── */}
      <Section className="pt-8">
        <motion.div variants={stagger} {...inView} className="grid grid-cols-3 gap-2.5">
          {pillars.map((p) => (
            <motion.div key={p.title} variants={fadeUp} className={`card-pastel ${p.tone} rounded-3xl p-3.5`}>
              <span className="w-9 h-9 rounded-2xl bg-white/60 dark:bg-white/10 flex items-center justify-center"><p.icon className="w-[18px] h-[18px]" /></span>
              <p className="font-heading font-bold text-sm mt-2.5">{p.title}</p>
              <p className="text-[11px] opacity-80 leading-snug mt-0.5">{p.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </Section>

      {/* ───────── SOROTAN ───────── */}
      <Section className="pt-10">
        <SectionTitle eyebrow="Kenapa NAFKITA" title="Dibuat untuk keluarga Muslim" sub="Bukan sekadar pencatat pengeluaran. Alurnya mengikuti cara keluarga mengelola nafkah." />
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          {highlights.map((h, i) => (
            <motion.article key={h.key} variants={fadeUp} {...inView}
              className={`card-pastel ${h.tone} relative rounded-[28px] p-5 overflow-hidden ${i === 0 ? "md:col-span-2" : ""}`}>
              <div className="absolute -right-8 -bottom-10 w-36 h-36 rounded-full bg-white/25 dark:bg-white/5 pointer-events-none" aria-hidden="true" />
              <div className="relative">
                <div className="flex items-center gap-2.5">
                  <span className="w-10 h-10 rounded-2xl bg-white/60 dark:bg-white/10 flex items-center justify-center"><h.icon className="w-5 h-5" /></span>
                  <span className="text-xs font-semibold opacity-75">{h.eyebrow}</span>
                </div>
                <h3 className="font-heading font-extrabold text-xl leading-tight mt-3">{h.title}</h3>
                <p className="text-sm opacity-85 leading-relaxed mt-2">{h.desc}</p>
                <ul className="mt-3 space-y-1.5">
                  {h.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2 text-[13px]">
                      <span className="w-4 h-4 rounded-full bg-[hsl(var(--pastel-ink))] text-white dark:text-[hsl(var(--background))] flex items-center justify-center shrink-0 mt-0.5"><Check className="w-2.5 h-2.5" strokeWidth={3} /></span>
                      <span className="leading-snug">{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.article>
          ))}
        </div>
      </Section>

      {/* ───────── SEMUA FITUR ───────── */}
      <Section className="pt-10">
        <SectionTitle eyebrow={`${featureCount} fitur`} title="Semua yang ada di dalamnya" />
        <div className="space-y-5">
          {FEATURE_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">{g.label}</p>
              <motion.ul variants={stagger} {...inView} className="surface rounded-3xl divide-y divide-border md:grid md:grid-cols-2 md:divide-y-0">
                {g.items.map((f) => (
                  <motion.li key={f.title} variants={fadeUp} className="flex items-start gap-3 px-4 py-3">
                    <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><f.icon className="w-[18px] h-[18px]" /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-tight">{f.title}</span>
                      <span className="block text-xs text-muted-foreground leading-snug mt-0.5">{f.desc}</span>
                    </span>
                  </motion.li>
                ))}
              </motion.ul>
            </div>
          ))}
        </div>
      </Section>

      {/* ───────── CARA MULAI ───────── */}
      <Section className="pt-10">
        <SectionTitle eyebrow="Mulai" title="Empat langkah, lalu terbiasa" />
        <motion.ol variants={stagger} {...inView} className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {startSteps.map((s, i) => (
            <motion.li key={s.t} variants={fadeUp} className="surface rounded-3xl p-4">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center"><s.icon className="w-[18px] h-[18px]" /></span>
                <span className="font-heading text-2xl font-extrabold text-muted-foreground/40 tabular-nums">{i + 1}</span>
              </div>
              <p className="text-sm font-semibold leading-tight mt-3">{s.t}</p>
              <p className="text-xs text-muted-foreground leading-snug mt-1">{s.d}</p>
            </motion.li>
          ))}
        </motion.ol>
      </Section>

      {/* ───────── CTA PENUTUP ───────── */}
      <Section className="pt-10">
        <motion.div variants={fadeUp} {...inView} className="card-gradient-primary relative rounded-[28px] p-6 overflow-hidden text-center">
          <div className="absolute -top-12 -right-10 w-40 h-40 rounded-full bg-[hsl(var(--gold))]/20 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <img src="/brand/mark.png" alt="" className="w-14 h-14 mx-auto" />
            <h2 className="font-heading text-xl font-extrabold mt-3">Mulai rapikan nafkah keluarga hari ini</h2>
            <p className="text-sm opacity-85 mt-2 max-w-xs mx-auto leading-relaxed">Gratis untuk dicoba. Data Anda bisa dicadangkan ke Google Drive kapan saja.</p>
          </div>
        </motion.div>
        <p className="text-[11px] text-muted-foreground text-center mt-4 leading-snug px-4">
          Perhitungan zakat di aplikasi adalah perkiraan berdasarkan data yang Anda catat. Untuk kepastian, konsultasikan dengan amil atau BAZNAS setempat.
        </p>
      </Section>

      {/* ───────── CTA MENEMPEL (mobile) ───────── */}
      <div className="fixed bottom-0 inset-x-0 z-20 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-background/90 backdrop-blur-xl border-t border-border md:hidden">
        <button onClick={() => navigate("/register")} className="w-full btn-gold">
          Daftar gratis <ArrowRight className="w-5 h-5" />
        </button>
        <button onClick={() => navigate("/login")} className="w-full mt-2 h-10 text-sm font-semibold text-muted-foreground inline-flex items-center justify-center gap-1">
          Sudah punya akun? <span className="text-primary">Masuk</span> <ChevronRight className="w-4 h-4 text-primary" />
        </button>
      </div>
    </div>
  );
}

// Pratinjau ringkas yang meniru Beranda asli (kartu saldo + rencana + jejak).
function HeroPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
      className="relative mt-8 md:mt-0"
      aria-label="Contoh tampilan Beranda NAFKITA"
      role="img"
    >
      <div className="card-gradient-primary relative rounded-[28px] p-5 overflow-hidden">
        <div className="absolute -right-6 -top-8 w-32 h-32 rounded-full bg-white/10" aria-hidden="true" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold"><Wallet className="w-3 h-3" /> Saldo bersama</span>
            <span className="text-[11px] opacity-75">Bulan ini</span>
          </div>
          <p className="text-xs opacity-80 mt-4">Sisa uang bulan ini</p>
          <p className="font-heading text-[32px] leading-none font-extrabold tracking-tight tabular-nums mt-1">Rp 9.080.000</p>
          <div className="flex gap-1.5 mt-3">
            <span className="h-6 px-2.5 rounded-full bg-white text-[hsl(var(--hero-from))] text-[11px] font-bold inline-flex items-center">IDR</span>
            <span className="h-6 px-2.5 rounded-full border border-white/25 text-[11px] font-bold inline-flex items-center opacity-80">{SAR_SIGN} SAR</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-[11px]">
            {[["Pemasukan", "Rp 15,0 jt"], ["Pengeluaran", "Rp 5,4 jt"], ["Menabung", "61%"]].map(([l, v]) => (
              <div key={l} className="rounded-2xl bg-white/10 border border-white/10 p-2.5">
                <p className="opacity-75">{l}</p>
                <p className="font-bold text-sm tabular-nums mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mt-2.5">
        <div className="card-pastel card-pastel-mint rounded-3xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="w-8 h-8 rounded-xl bg-white/60 dark:bg-white/10 flex items-center justify-center"><Vault className="w-4 h-4" /></span>
            <span className="text-[10px] font-semibold opacity-75">Umrah 2027</span>
          </div>
          <p className="font-heading font-extrabold text-2xl mt-2 tabular-nums">38<span className="text-sm">%</span></p>
          <div className="mt-1.5 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full w-[38%] rounded-full bg-[hsl(var(--pastel-ink))]" /></div>
        </div>
        <div className="card-pastel card-pastel-peach rounded-3xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="w-8 h-8 rounded-xl bg-white/60 dark:bg-white/10 flex items-center justify-center"><Coins className="w-4 h-4" /></span>
            <span className="text-[10px] font-semibold opacity-75">Zakat mal</span>
          </div>
          <p className="text-sm font-bold mt-2 leading-tight">Sudah capai nisab</p>
          <p className="text-[11px] opacity-80 mt-0.5 inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Haul 42 hari lagi</p>
        </div>
      </div>

      <div className="surface rounded-3xl mt-2.5 divide-y divide-border">
        {[
          { icon: ScanLine, n: "Struk Panda Market", s: "Dibaca AI · baru saja", a: `−${SAR_SIGN} 86.50`, c: "text-expense" },
          { icon: Heart, n: "Sedekah masjid", s: "Siti · hari ini", a: "−Rp 50.000", c: "text-sedekah" },
        ].map((r) => (
          <div key={r.n} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><r.icon className="w-4 h-4" /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-semibold truncate">{r.n}</span>
              <span className="block text-[11px] text-muted-foreground">{r.s}</span>
            </span>
            <span className={`text-[13px] font-bold tabular-nums ${r.c}`}>{r.a}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function Section({ children, className = "" }) {
  return <section className={`px-5 w-full max-w-5xl mx-auto ${className}`}>{children}</section>;
}

function SectionTitle({ eyebrow, title, sub }) {
  return (
    <div className="mb-4 px-1">
      <p className="text-xs font-semibold text-primary">{eyebrow}</p>
      <h2 className="font-heading text-2xl font-extrabold tracking-tight leading-tight mt-1">{title}</h2>
      {sub && <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">{sub}</p>}
    </div>
  );
}
