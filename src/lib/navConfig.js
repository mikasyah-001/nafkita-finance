// Sumber tunggal item navigasi untuk Sidebar (desktop) & BottomNav (mobile).
// Mencegah drift antar dua komponen dan memastikan konsistensi menu.
import {
  Home, ReceiptText, Landmark, BarChart3, Wallet,
  ArrowRightLeft, HandCoins, RefreshCw, Scale, Target, CheckCheck,
  Upload, Tags, Activity, Coins, User, Settings, MessageSquare,
  Shield, BookOpen, Banknote, Zap, CreditCard, IdCard,
} from "lucide-react";

// Item utama (Sidebar) — Beranda, Riwayat, Aset, Laporan (termasuk ringkasan bulanan), Anggaran.
export const mainItems = [
  { to: "/", icon: Home, label: "Beranda", end: true },
  { to: "/riwayat", icon: ReceiptText, label: "Riwayat" },
  { to: "/aset", icon: Landmark, label: "Aset" },
  { to: "/laporan", icon: BarChart3, label: "Laporan" },
  { to: "/anggaran", icon: Wallet, label: "Anggaran" },
];

// Item Alat — dipakai Sidebar (section "Alat") & BottomNav (menu "Lainnya").
export const toolItems = [
  { to: "/dompet", icon: CreditCard, label: "Dompet", color: "emerald" },
  { to: "/transfer", icon: ArrowRightLeft, label: "Transfer", color: "blue" },
  { to: "/audit-kas", icon: Banknote, label: "Audit Kas", color: "emerald" },
  { to: "/utang", icon: HandCoins, label: "Utang & Piutang", color: "rose" },
  { to: "/tagihan-berulang", icon: RefreshCw, label: "Tagihan Berulang", color: "amber" },
  { to: "/rekonsiliasi", icon: Scale, label: "Rekonsiliasi", color: "teal" },
  { to: "/target-tabungan", icon: Target, label: "Target Tabungan", color: "emerald" },
  { to: "/zakat", icon: Coins, label: "Zakat", color: "violet" },
  { to: "/persetujuan", icon: CheckCheck, label: "Persetujuan", color: "indigo" },
  { to: "/catat-otomatis", icon: Zap, label: "Catat Otomatis", color: "emerald" },
  { to: "/kartu", icon: IdCard, label: "Kartu", color: "indigo" },
  { to: "/impor", icon: Upload, label: "Impor Data", color: "orange" },
  { to: "/kategori", icon: Tags, label: "Kategori", color: "cyan" },
  { to: "/kesehatan-data", icon: Activity, label: "Kesehatan Data", color: "red" },
];

// Item Akun — Profil, Pengaturan, Panduan, Umpan Balik, Admin (adminOnly).
export const accountItems = [
  { to: "/profil", icon: User, label: "Profil" },
  { to: "/pengaturan", icon: Settings, label: "Pengaturan" },
  { to: "/panduan", icon: BookOpen, label: "Panduan Tools" },
  { to: "/umpan-balik", icon: MessageSquare, label: "Umpan Balik" },
  { to: "/admin", icon: Shield, label: "Admin", adminOnly: true },
];

// Menu "Lainnya" BottomNav — dikelompokkan per tujuan agar mudah dipindai
// (sebelumnya 13 ikon datar berwarna-warni). Satu nada warna per kelompok.
export const moreGroups = [
  {
    title: "Pantau",
    tone: "primary",
    items: [
      { to: "/laporan", icon: BarChart3, label: "Laporan", desc: "Ringkasan bulanan & tren pengeluaran" },
      { to: "/anggaran", icon: Wallet, label: "Anggaran", desc: "Batas per kategori & rencana menabung" },
      { to: "/target-tabungan", icon: Target, label: "Target Tabungan", desc: "Umrah, dana darurat, pendidikan" },
    ],
  },
  {
    title: "Kelola uang",
    tone: "teal",
    items: [
      { to: "/dompet", icon: CreditCard, label: "Dompet", desc: "Saldo & transaksi tiap rekening" },
      { to: "/transfer", icon: ArrowRightLeft, label: "Transfer", desc: "Pindah saldo antar rekening" },
      { to: "/audit-kas", icon: Banknote, label: "Audit Kas", desc: "Cocokkan uang tunai di tangan" },
      { to: "/utang", icon: HandCoins, label: "Utang & Piutang", desc: "Pinjaman, cicilan & jatuh tempo" },
      { to: "/tagihan-berulang", icon: RefreshCw, label: "Tagihan Berulang", desc: "Listrik, sewa, langganan rutin" },
      { to: "/zakat", icon: Coins, label: "Zakat", desc: "Hitung nisab & catat pembayaran" },
      { to: "/persetujuan", icon: CheckCheck, label: "Persetujuan", desc: "Transaksi pasangan menunggu Anda" },
      { to: "/kartu", icon: IdCard, label: "Kartu", desc: "Kartu debit, kredit & e-money, terhubung ke rekening" },
      { to: "/catat-otomatis", icon: Zap, label: "Catat Otomatis", desc: "Apple Pay & SMS bank masuk sendiri, tinggal konfirmasi" },
    ],
  },
  {
    title: "Data & akun",
    tone: "slate",
    items: [
      { to: "/rekonsiliasi", icon: Scale, label: "Rekonsiliasi", desc: "Samakan saldo dengan rekening koran" },
      { to: "/impor", icon: Upload, label: "Impor Data", desc: "Dari Excel/CSV atau aplikasi lain" },
      { to: "/kategori", icon: Tags, label: "Kategori", desc: "Atur nama, ikon & warna kategori" },
      { to: "/kesehatan-data", icon: Activity, label: "Kesehatan Data", desc: "Temukan data ganda atau janggal" },
      { to: "/pengaturan", icon: Settings, label: "Pengaturan", desc: "Pasangan, mata uang, cadangan, akun" },
      { to: "/panduan", icon: BookOpen, label: "Panduan", desc: "Cara memakai setiap fitur" },
    ],
  },
];

// Kompatibilitas: daftar datar semua item "Lainnya".
export const moreItems = moreGroups.flatMap((g) => g.items);

export const moreToneClasses = {
  primary: "bg-primary/10 text-primary",
  teal: "bg-sedekah/10 text-sedekah",
  slate: "bg-muted text-muted-foreground",
};

/**
 * Halaman layar-penuh dengan tombol aksi sendiri di bawah: menu bawah
 * disembunyikan, dan wadah utama TIDAK memberi ruang untuknya (dulu tersisa
 * ruang kosong di bawah tombol Simpan). Satu sumber untuk BottomNav & Layout.
 */
export function isNavHidden(pathname = "") {
  return pathname === "/add" || pathname === "/impor" || pathname === "/impor-portofolio" || /^\/transaksi\/[^/]+\/edit$/.test(pathname);
}
