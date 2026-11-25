import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, ScanLine, Wallet, Coins, Users, Target, BarChart3, EyeOff, Cloud, Heart,
  ShieldCheck, Sparkles, Check, Landmark, Link2, Smartphone, LineChart, MailCheck,
  RefreshCw, BellRing, CheckCheck, History, Activity, FileSpreadsheet, Copy,
  CalendarClock, HandCoins, Share2, ClipboardCheck, ArrowLeftRight, Scale, Receipt,
  Gem, Vault, TrendingUp, ChevronRight, Zap, CreditCard, Lock, MessageSquareText,
  KeyRound, UserX, FileLock2, Inbox, X, Maximize2,
} from "lucide-react";
import { SAR_SIGN } from "@/lib/finance";

// ─────────────────────────────────────────────────────────────
// HALAMAN SAMBUTAN (sebelum login).
// Isi di bawah HARUS sinkron dengan fitur yang benar-benar ada.
// Gambar contoh tampilan = screenshot ASLI aplikasi dengan data contoh,
// dibuat ulang lewat `npm run qa:welcome-shots` (public/welcome/*.jpg)
// setiap kali tampilan aplikasi berubah.
// ─────────────────────────────────────────────────────────────

const shot = (name) => `/welcome/${name}.jpg`;

const pillars = [
  { icon: Zap, title: "Tercatat sendiri", desc: "SMS bank, Apple Pay & scan struk", tone: "card-pastel-butter" },
  { icon: Users, title: "Terbuka berdua", desc: "Kas bersama, ruang pribadi tetap ada", tone: "card-pastel-mint" },
  { icon: Heart, title: "Terjaga & berkah", desc: "Aset, sedekah & zakat mal", tone: "card-pastel-peach" },
];

// Bab-bab utama: setiap bab = satu fungsi inti + contoh tampilan aslinya.
const chapters = [
  {
    key: "catat",
    tone: "card-pastel-butter",
    icon: ScanLine,
    eyebrow: "Mencatat",
    title: "Catat dalam hitungan detik — atau biarkan tercatat sendiri",
    desc: "Ketik nominal, foto struk, atau sambungkan iPhone. Notifikasi SMS bank dan pembayaran Apple Pay masuk ke Kotak Masuk; Anda cukup memilih kategori lalu simpan.",
    points: [
      "Scan hingga 5 struk sekaligus dengan AI",
      "Catat Otomatis dari SMS bank & Apple Pay, kategori diingat per merchant",
      "Deteksi transaksi ganda, template rutin, tetap jalan saat offline",
    ],
    shots: [{ src: shot("catat"), alt: "Layar Catat transaksi" }, { src: shot("catat-otomatis"), alt: "Kotak Masuk Catat Otomatis" }],
  },
  {
    key: "kartu",
    tone: "card-pastel-sage",
    icon: CreditCard,
    eyebrow: "Rekening & kartu",
    title: "Rekening dan kartu dalam satu alur",
    desc: "Tambahkan kartu debit, kredit, atau e-money dan hubungkan ke rekeningnya. Belum ada rekeningnya? Buat langsung dari form kartu. Dari rekening pun bisa langsung menambah kartu.",
    points: [
      "Hanya 4 digit terakhir yang disimpan, tidak pernah nomor lengkap atau CVC",
      "Detail kartu terkunci PIN NAFKITA",
      "Rekening harian & tabungan dibedakan, saldo selalu ikut transaksi",
    ],
    shots: [{ src: shot("kartu"), alt: "Halaman Kartu dikelompokkan per rekening" }],
  },
  {
    key: "rencana",
    tone: "card-pastel-lime",
    icon: Target,
    eyebrow: "Rencana",
    title: "Anggaran, target, dan tagihan yang tidak terlewat",
    desc: "Tetapkan rencana bulan ini, batas per kategori, dan target tabungan seperti dana umrah atau pendidikan. Tagihan rutin tercatat otomatis sesuai jadwalnya.",
    points: [
      "Peringatan batas anggaran, sisa bisa dibawa ke bulan depan",
      "Target tabungan dengan foto, setoran cepat & proyeksi tercapai",
      "Ringkasan tagihan 30 hari ke depan & pengingat jatuh tempo",
    ],
    shots: [{ src: shot("target"), alt: "Target tabungan Umrah keluarga" }, { src: shot("tagihan"), alt: "Tagihan berulang 30 hari ke depan" }],
  },
  {
    key: "berdua",
    tone: "card-pastel-mint",
    icon: Users,
    eyebrow: "Suami & istri",
    title: "Satu kas keluarga, tetap ada ruang pribadi",
    desc: "Hubungkan akun dengan pasangan lewat kode unik. Catatan bersama tersinkron; catatan pribadi tidak pernah terlihat. Pengeluaran besar menunggu persetujuan pasangan sebelum saldo berubah.",
    points: [
      "Profil pasangan: terhubung sejak kapan & catatan bersama bulan ini",
      "Ambang persetujuan ditentukan berdua, yang lebih ketat yang dipakai",
      "Notifikasi saat pasangan mencatat, bisa diatur per nominal",
    ],
    shots: [{ src: shot("pasangan"), alt: "Profil pasangan" }, { src: shot("persetujuan"), alt: "Persetujuan transaksi pasangan" }],
  },
  {
    key: "aset",
    tone: "card-pastel-sage",
    icon: Landmark,
    eyebrow: "Aset & kekayaan bersih",
    title: "Lihat kekayaan bersih, bukan sekadar saldo",
    desc: "Rekening, tunai, emas fisik & digital, investasi, hingga properti dalam satu tempat. Kekayaan bersih dihitung dari aset ditambah piutang dikurangi utang, lintas Rupiah dan Riyal.",
    points: [
      "Satu harga emas acuan untuk aset, laporan & zakat",
      "Impor portofolio dari tangkapan layar broker, riwayat DCA",
      "Audit kas & rekonsiliasi: cocokkan saldo nyata dengan catatan",
    ],
    shots: [{ src: shot("aset"), alt: "Halaman Aset dengan kekayaan bersih" }],
  },
  {
    key: "zakat",
    tone: "card-pastel-peach",
    icon: Coins,
    eyebrow: "Zakat mal",
    title: "Zakat dihitung sesuai ketentuan",
    desc: "Uang, tabungan, emas, investasi, dan piutang lancar digabung lintas mata uang. Nisab 85 gram emas, kadar 2,5%, haul satu tahun hijriah — lengkap dengan cara hitung dan rujukannya.",
    points: [
      "Haul emas dihitung dari tanggal beli tiap aset",
      "Utang jatuh tempo dikurangkan, rumah tinggal tidak dihitung",
      "Bayar bisa dicicil, riwayat & pengingat menjelang haul",
    ],
    shots: [{ src: shot("zakat"), alt: "Halaman Zakat mal" }],
  },
  {
    key: "laporan",
    tone: "card-pastel-butter",
    icon: BarChart3,
    eyebrow: "Laporan",
    title: "Laporan yang enak dibaca berdua",
    desc: "Lihat ke mana uang pergi bulan ini dibanding bulan lalu. Bagikan ringkasan sebagai gambar ke pasangan, atau ekspor ke PDF, CSV, dan Excel.",
    points: [
      `Gabungkan IDR, ${SAR_SIGN} SAR & mata uang lain dengan kurs otomatis`,
      "Tren, perbandingan & proyeksi per kategori",
      "Ringkasan bulanan dikirim ke email",
    ],
    shots: [{ src: shot("laporan"), alt: "Laporan bulanan" }, { src: shot("anggaran"), alt: "Anggaran bulanan" }],
  },
];

// Keamanan & privasi — semua benar-benar berjalan di aplikasi.
const safety = [
  { icon: FileLock2, title: "Bukti transaksi privat", desc: "Foto struk & bukti pembelian hanya bisa dibuka lewat aplikasi, dengan tautan sementara." },
  { icon: Lock, title: "Catatan pribadi tetap pribadi", desc: "Tidak terlihat oleh pasangan maupun admin." },
  { icon: KeyRound, title: "PIN untuk detail kartu", desc: "Hanya 4 digit terakhir disimpan; detail lain terkunci PIN." },
  { icon: EyeOff, title: "Sembunyikan angka", desc: "Satu ketuk mengaburkan semua nominal di semua layar." },
  { icon: ShieldCheck, title: "Verifikasi dua langkah", desc: "Lapisan keamanan tambahan saat masuk." },
  { icon: Cloud, title: "Cadangan terenkripsi", desc: "Backup ke Google Drive atau file, pulihkan kapan saja." },
  { icon: UserX, title: "Hapus akun kapan saja", desc: "Catatan bersama dipindahkan ke pasangan, sisanya dihapus." },
];

// Daftar lengkap fitur per kelompok.
const FEATURE_GROUPS = [
  {
    label: "Pencatatan",
    items: [
      { icon: ScanLine, title: "Scan struk AI", desc: "Hingga 5 foto sekaligus, ditinjau sebelum disimpan." },
      { icon: Inbox, title: "Catat Otomatis", desc: "SMS bank & Apple Pay masuk sendiri, Anda tinggal konfirmasi." },
      { icon: Copy, title: "Deteksi duplikat", desc: "Transaksi ganda ditandai saat catat, scan, dan impor." },
      { icon: FileSpreadsheet, title: "Impor mutasi", desc: "Unggah PDF/teks mutasi bank, AI menyusun transaksinya." },
      { icon: ArrowLeftRight, title: "Transfer antar rekening", desc: "Saldo berpindah tanpa dihitung sebagai belanja." },
      { icon: Sparkles, title: "Pengeluaran luar biasa", desc: "Belanja besar tak rutin ditandai agar rata-rata harian tetap jujur." },
    ],
  },
  {
    label: "Rekening, kartu & aset",
    items: [
      { icon: CreditCard, title: "Dompet kartu", desc: "Debit, kredit, e-money per rekening; detail terkunci PIN." },
      { icon: Wallet, title: "Rekening harian & tabungan", desc: "Dibedakan perannya, saldo ikut setiap transaksi." },
      { icon: LineChart, title: "Kekayaan bersih & dasbor aset", desc: "Pertumbuhan per jenis, snapshot bulanan, distribusi portofolio." },
      { icon: Gem, title: "Emas & investasi", desc: "Harga emas acuan, untung/rugi per gram, impor portofolio broker, DCA." },
      { icon: ClipboardCheck, title: "Audit kas & rekonsiliasi", desc: "Cocokkan saldo dompet atau rekening, selisih tercatat rapi." },
      { icon: History, title: "Riwayat mutasi aset", desc: "Setiap perubahan saldo tercatat sebagai jejak audit." },
    ],
  },
  {
    label: "Anggaran & rencana",
    items: [
      { icon: Target, title: "Anggaran per kategori", desc: "Progres & peringatan batas, sisa bisa dibawa ke bulan depan." },
      { icon: TrendingUp, title: "Rencana bulanan", desc: "Target pemasukan & menabung, progresnya tampil di Beranda." },
      { icon: Vault, title: "Target tabungan", desc: "Umrah, pendidikan, dana darurat — dengan proyeksi tercapai." },
      { icon: CalendarClock, title: "Tagihan rutin", desc: "Listrik, sekolah, cicilan tercatat otomatis tiap periode." },
      { icon: Scale, title: "Utang & piutang", desc: "Cicilan, jatuh tempo, dan pengingat sebelum tenggat." },
    ],
  },
  {
    label: "Laporan & zakat",
    items: [
      { icon: BarChart3, title: "Laporan & tren", desc: "Bulanan, mingguan, tahunan; perbandingan dan proyeksi." },
      { icon: Share2, title: "Bagikan sebagai gambar", desc: "Ringkasan bulan jadi gambar rapi untuk pasangan." },
      { icon: Receipt, title: "Ekspor PDF, CSV, Excel", desc: "Termasuk PDF lengkap dengan foto bukti transaksi." },
      { icon: MailCheck, title: "Ringkasan email", desc: "Pengingat harian & laporan bulanan ke kotak masuk." },
      { icon: HandCoins, title: "Zakat mal", desc: "Status nisab & haul, riwayat bayar, pengingat menjelang haul." },
    ],
  },
  {
    label: "Berdua & lainnya",
    items: [
      { icon: Link2, title: "Koneksi pasangan", desc: "Kode referensi unik, profil pasangan & peran suami/istri." },
      { icon: CheckCheck, title: "Persetujuan transaksi", desc: "Pengeluaran di atas ambang menunggu persetujuan pasangan." },
      { icon: BellRing, title: "Aturan notifikasi", desc: "Atur per kategori & ambang nominal, ringkasan harian." },
      { icon: Activity, title: "Kesehatan data", desc: "Temukan transaksi tanpa kategori, saldo negatif, mata uang keliru." },
      { icon: MessageSquareText, title: "Umpan balik langsung", desc: "Laporkan masalah atau usulkan fitur, balasan tim di aplikasi." },
      { icon: RefreshCw, title: "Offline & pasang di HP", desc: "Tambahkan ke layar utama, catat tanpa sinyal, sinkron saat online." },
    ],
  },
];
const featureCount = FEATURE_GROUPS.reduce((n, g) => n + g.items.length, 0);

const startSteps = [
  { icon: Smartphone, t: "Daftar & pasang di HP", d: "Buat akun dengan email, lalu tambahkan ke layar utama." },
  { icon: CreditCard, t: "Tambah rekening & kartu", d: "Sekaligus dalam satu form, lengkap dengan saldo awal." },
  { icon: Link2, t: "Hubungkan pasangan", d: "Bagikan kode unik agar kas keluarga tersinkron." },
  { icon: Zap, t: "Aktifkan Catat Otomatis", d: "SMS bank & Apple Pay masuk sendiri. Atau mulai dengan scan struk." },
];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const inView = { initial: "hidden", whileInView: "show", viewport: { once: true, margin: "-40px" } };

// Ketuk screenshot → tampil layar penuh (teks kecil di dalamnya jadi terbaca).
const ZoomContext = createContext(() => {});

export default function Welcome() {
  const navigate = useNavigate();
  const [zoom, setZoom] = useState(null); // { src, alt, returnFocus }
  const closeZoom = useCallback(() => setZoom(null), []);

  return (
    <ZoomContext.Provider value={setZoom}>
    <div className="min-h-screen bg-background pb-32 md:pb-16 overflow-x-hidden">
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
      <section className="px-5 pt-8 max-w-5xl mx-auto md:grid md:grid-cols-[1.1fr_0.9fr] md:gap-10 md:items-center">
        <motion.div initial="hidden" animate="show" variants={stagger}>
          <motion.p variants={fadeUp} className="inline-flex items-center gap-1.5 rounded-full card-pastel card-pastel-butter px-3 py-1.5 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Nafkah kita, berkah bersama
          </motion.p>
          <motion.h1 variants={fadeUp} className="font-heading text-[34px] md:text-[44px] leading-[1.08] font-extrabold tracking-tight mt-4">
            Nafkah keluarga <span className="text-primary">tercatat sendiri</span>, <span className="text-primary">terbuka berdua</span>, dan <span className="text-primary underline decoration-[hsl(var(--gold))] decoration-[5px] underline-offset-[6px]">berkah</span>.
          </motion.h1>
          <motion.p variants={fadeUp} className="text-[15px] text-muted-foreground leading-relaxed mt-3 max-w-md">
            NAFKITA mencatat belanja dari SMS bank, Apple Pay, dan struk; menyatukan kas suami-istri tanpa menghilangkan ruang pribadi; lalu merangkum rekening, kartu, aset, tabungan, dan zakat mal dalam satu aplikasi.
          </motion.p>
          <motion.ul variants={fadeUp} className="flex flex-wrap gap-1.5 mt-4">
            {["Rupiah & Riyal", "Untuk suami-istri", "Zakat sesuai nisab", "Bukti transaksi privat"].map((t) => (
              <li key={t} className="text-[11px] font-semibold rounded-full surface px-2.5 py-1 inline-flex items-center gap-1"><Check className="w-3 h-3 text-primary" strokeWidth={3} />{t}</li>
            ))}
          </motion.ul>
          <motion.div variants={fadeUp} className="hidden md:flex gap-3 mt-6">
            <button onClick={() => navigate("/register")} className="btn-gold">Daftar gratis <ArrowRight className="w-5 h-5" /></button>
            <button onClick={() => navigate("/login")} className="btn-secondary">Sudah punya akun</button>
          </motion.div>
        </motion.div>

        <HeroShowcase />
      </section>

      {/* ───────── PILAR ───────── */}
      <Section className="pt-10">
        <motion.div variants={stagger} {...inView} className="grid grid-cols-3 gap-2.5">
          {pillars.map((p) => (
            <motion.div key={p.title} variants={fadeUp} className={`card-pastel ${p.tone} rounded-3xl p-3.5`}>
              <span className="w-9 h-9 rounded-2xl bg-white/60 dark:bg-white/10 flex items-center justify-center"><p.icon className="w-[18px] h-[18px]" /></span>
              <p className="font-heading font-bold text-sm mt-2.5 leading-tight">{p.title}</p>
              <p className="text-[11px] opacity-80 leading-snug mt-0.5">{p.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </Section>

      {/* ───────── BAB FITUR + CONTOH TAMPILAN ───────── */}
      <Section className="pt-12">
        <SectionTitle eyebrow="Lihat di dalam aplikasi" title="Dibuat untuk cara keluarga Muslim mengelola nafkah"
          sub="Setiap gambar di bawah adalah tampilan asli NAFKITA dengan data contoh." />
        <div className="space-y-5 md:space-y-8">
          {chapters.map((c, i) => <Chapter key={c.key} c={c} flip={i % 2 === 1} />)}
        </div>
      </Section>

      {/* ───────── KEAMANAN ───────── */}
      <Section className="pt-12">
        <motion.div variants={fadeUp} {...inView} className="card-gradient-primary relative rounded-[28px] p-5 md:p-7 overflow-hidden">
          <div className="absolute -top-14 -right-10 w-44 h-44 rounded-full bg-[hsl(var(--gold))]/20 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <p className="text-xs font-semibold text-gold inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Keamanan & privasi</p>
            <h2 className="font-heading text-2xl font-extrabold tracking-tight leading-tight mt-1">Data keuangan keluarga Anda, tetap milik Anda</h2>
            <p className="text-sm opacity-85 leading-relaxed mt-1.5 max-w-xl">Yang pribadi tidak terlihat pasangan, yang sensitif tidak pernah disimpan, dan Anda bisa membawa atau menghapus data kapan saja.</p>
            <ul className="grid gap-2.5 sm:grid-cols-2 mt-4">
              {safety.map((s) => (
                <li key={s.title} className="flex items-start gap-3 rounded-2xl bg-white/[0.07] border border-white/10 p-3">
                  <span className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0"><s.icon className="w-4 h-4" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-tight">{s.title}</span>
                    <span className="block text-xs opacity-75 leading-snug mt-0.5">{s.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </Section>

      {/* ───────── SEMUA FITUR ───────── */}
      <Section className="pt-12">
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
      <Section className="pt-12">
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
      <Section className="pt-12">
        <motion.div variants={fadeUp} {...inView} className="card-pastel card-pastel-butter relative rounded-[28px] p-6 overflow-hidden text-center">
          <div className="absolute -bottom-12 -left-10 w-40 h-40 rounded-full bg-white/30 dark:bg-white/5" aria-hidden="true" />
          <div className="relative">
            <img src="/brand/mark.png" alt="" className="w-14 h-14 mx-auto" />
            <h2 className="font-heading text-xl font-extrabold mt-3">Mulai rapikan nafkah keluarga hari ini</h2>
            <p className="text-sm opacity-85 mt-2 max-w-sm mx-auto leading-relaxed">Gratis untuk dicoba. Cadangkan data ke Google Drive atau file kapan saja, dan hapus akun kapan pun Anda mau.</p>
            <div className="hidden md:flex gap-3 justify-center mt-5">
              <button onClick={() => navigate("/register")} className="btn-gold">Daftar gratis <ArrowRight className="w-5 h-5" /></button>
              <button onClick={() => navigate("/login")} className="btn-secondary">Masuk</button>
            </div>
          </div>
        </motion.div>
        <p className="text-[11px] text-muted-foreground text-center mt-4 leading-snug px-4">
          Perhitungan zakat di aplikasi adalah perkiraan berdasarkan data yang Anda catat, bukan fatwa. Untuk kepastian, konsultasikan dengan amil atau BAZNAS setempat.
        </p>
      </Section>

      {zoom && <ShotLightbox shot={zoom} onClose={closeZoom} />}

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
    </ZoomContext.Provider>
  );
}

// Bingkai HP berisi screenshot asli aplikasi.
function PhoneFrame({ src, alt, className = "", eager = false }) {
  const openZoom = useContext(ZoomContext);
  return (
    <figure className={`${/\babsolute\b/.test(className) ? "" : "relative "}rounded-[30px] bg-[#0f1f1a] p-[6px] shadow-[0_18px_40px_-18px_rgba(15,79,66,0.55)] ring-1 ring-black/10 ${className}`}>
      <button type="button" onClick={(e) => openZoom({ src, alt, returnFocus: e.currentTarget })}
        aria-label={`Perbesar: ${alt}`}
        className="group relative block w-full rounded-[24px] overflow-hidden focus-visible:outline-none focus-visible:ring-4 ring-[hsl(var(--gold))] cursor-zoom-in">
        <span className="absolute top-[5px] left-1/2 -translate-x-1/2 w-14 h-[5px] rounded-full bg-white/15 z-10" aria-hidden="true" />
        <img src={src} alt="" loading={eager ? "eager" : "lazy"} decoding="async" width={390} height={800}
          className="block w-full h-auto bg-muted aspect-[390/800] object-cover object-top" />
        <span className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center opacity-80 group-hover:opacity-100" aria-hidden="true">
          <Maximize2 className="w-3.5 h-3.5" />
        </span>
      </button>
    </figure>
  );
}

// Tampilan layar penuh satu screenshot. Tutup: tombol, Esc, atau ketuk latar;
// fokus kembali ke gambar yang dibuka.
function ShotLightbox({ shot, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") { e.preventDefault(); closeRef.current?.focus(); } // satu-satunya kontrol
    };
    window.addEventListener("keydown", onKey);
    const ret = shot.returnFocus;
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); ret?.focus?.(); };
  }, [shot, onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={shot.alt} onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button ref={closeRef} type="button" onClick={onClose} aria-label="Tutup"
        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 ring-white">
        <X className="w-5 h-5" />
      </button>
      <img src={shot.src} alt={shot.alt} onClick={(e) => e.stopPropagation()}
        className="mt-10 max-h-[80vh] w-auto max-w-full rounded-[22px] shadow-2xl" />
      <p className="mt-3 text-xs text-white/80 text-center">{shot.alt}</p>
    </div>
  );
}

// Hero: Beranda di depan, Catat Otomatis & Zakat mengintip di belakang.
function HeroShowcase() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
      className="relative mt-10 md:mt-0 mx-auto w-full max-w-[360px] h-[470px] md:h-[520px]"
    >
      <PhoneFrame src={shot("catat-otomatis")} alt="Kotak Masuk Catat Otomatis" className="absolute left-0 top-10 w-[46%] -rotate-6 opacity-95" />
      <PhoneFrame src={shot("zakat")} alt="Halaman Zakat mal" className="absolute right-0 top-10 w-[46%] rotate-6 opacity-95" />
      <PhoneFrame src={shot("beranda")} alt="Beranda NAFKITA" eager className="absolute left-1/2 -translate-x-1/2 top-0 w-[58%] z-10" />
      <span className="absolute z-20 left-0 bottom-6 md:bottom-10 inline-flex items-center gap-1.5 rounded-full surface shadow-lg px-3 py-2 text-[11px] font-semibold">
        <Zap className="w-3.5 h-3.5 text-primary" /> SMS bank tercatat otomatis
      </span>
      <span className="absolute z-20 right-0 bottom-0 md:bottom-3 inline-flex items-center gap-1.5 rounded-full card-pastel card-pastel-peach shadow-lg px-3 py-2 text-[11px] font-semibold">
        <Coins className="w-3.5 h-3.5" /> Zakat sesuai nisab
      </span>
    </motion.div>
  );
}

function Chapter({ c, flip }) {
  const two = c.shots.length > 1;
  return (
    <motion.article variants={fadeUp} {...inView}
      className={`card-pastel ${c.tone} relative rounded-[28px] p-5 md:p-7 overflow-hidden md:grid md:grid-cols-2 md:gap-8 md:items-center`}>
      <div className="absolute -right-10 -bottom-12 w-40 h-40 rounded-full bg-white/25 dark:bg-white/5 pointer-events-none" aria-hidden="true" />
      <div className={`relative ${flip ? "md:order-2" : ""}`}>
        <div className="flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-2xl bg-white/60 dark:bg-white/10 flex items-center justify-center"><c.icon className="w-5 h-5" /></span>
          <span className="text-xs font-semibold opacity-75">{c.eyebrow}</span>
        </div>
        <h3 className="font-heading font-extrabold text-xl md:text-2xl leading-tight mt-3">{c.title}</h3>
        <p className="text-sm opacity-85 leading-relaxed mt-2">{c.desc}</p>
        <ul className="mt-3 space-y-1.5">
          {c.points.map((pt) => (
            <li key={pt} className="flex items-start gap-2 text-[13px]">
              <span className="w-4 h-4 rounded-full bg-[hsl(var(--pastel-ink))] text-white dark:text-[hsl(var(--background))] flex items-center justify-center shrink-0 mt-0.5"><Check className="w-2.5 h-2.5" strokeWidth={3} /></span>
              <span className="leading-snug">{pt}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={`relative mt-5 md:mt-0 flex justify-center gap-3 ${flip ? "md:order-1" : ""}`}>
        {two ? (
          <>
            <PhoneFrame src={c.shots[0].src} alt={c.shots[0].alt} className="w-[46%] max-w-[210px] -rotate-2" />
            <PhoneFrame src={c.shots[1].src} alt={c.shots[1].alt} className="w-[46%] max-w-[210px] rotate-2 mt-8" />
          </>
        ) : (
          <PhoneFrame src={c.shots[0].src} alt={c.shots[0].alt} className="w-[62%] max-w-[250px]" />
        )}
      </div>
    </motion.article>
  );
}

function Section({ children, className = "" }) {
  return <section className={`px-5 w-full max-w-5xl mx-auto ${className}`}>{children}</section>;
}

function SectionTitle({ eyebrow, title, sub }) {
  return (
    <div className="mb-4 px-1">
      <p className="text-xs font-semibold text-primary">{eyebrow}</p>
      <h2 className="font-heading text-2xl md:text-3xl font-extrabold tracking-tight leading-tight mt-1">{title}</h2>
      {sub && <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">{sub}</p>}
    </div>
  );
}
