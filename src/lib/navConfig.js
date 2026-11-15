// Sumber tunggal item navigasi untuk Sidebar (desktop) & BottomNav (mobile).
// Mencegah drift antar dua komponen dan memastikan konsistensi menu.
import {
  Home, ReceiptText, Landmark, BarChart3, Wallet, PiggyBank,
  ArrowRightLeft, HandCoins, RefreshCw, Scale, Target, CheckCheck,
  Upload, Tags, Activity, Coins, User, Settings, MessageSquare,
  Shield, BookOpen,
} from "lucide-react";

// Item utama (Sidebar) — Beranda, Riwayat, Aset, Laporan, Ringkasan, Anggaran.
export const mainItems = [
  { to: "/", icon: Home, label: "Beranda", end: true },
  { to: "/riwayat", icon: ReceiptText, label: "Riwayat" },
  { to: "/aset", icon: Landmark, label: "Aset" },
  { to: "/laporan", icon: BarChart3, label: "Laporan" },
  { to: "/ringkasan", icon: PiggyBank, label: "Ringkasan" },
  { to: "/anggaran", icon: Wallet, label: "Anggaran" },
];

// Item Alat — dipakai Sidebar (section "Alat") & BottomNav (menu "Lainnya").
export const toolItems = [
  { to: "/transfer", icon: ArrowRightLeft, label: "Transfer", color: "blue" },
  { to: "/utang", icon: HandCoins, label: "Utang & Piutang", color: "rose" },
  { to: "/tagihan-berulang", icon: RefreshCw, label: "Tagihan Berulang", color: "amber" },
  { to: "/rekonsiliasi", icon: Scale, label: "Rekonsiliasi", color: "teal" },
  { to: "/target-tabungan", icon: Target, label: "Target Tabungan", color: "emerald" },
  { to: "/zakat", icon: Coins, label: "Zakat", color: "violet" },
  { to: "/persetujuan", icon: CheckCheck, label: "Persetujuan", color: "indigo" },
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
      { to: "/ringkasan", icon: PiggyBank, label: "Ringkasan" },
      { to: "/laporan", icon: BarChart3, label: "Laporan" },
      { to: "/anggaran", icon: Wallet, label: "Anggaran" },
      { to: "/target-tabungan", icon: Target, label: "Target Tabungan" },
    ],
  },
  {
    title: "Kelola uang",
    tone: "teal",
    items: [
      { to: "/transfer", icon: ArrowRightLeft, label: "Transfer" },
      { to: "/utang", icon: HandCoins, label: "Utang & Piutang" },
      { to: "/tagihan-berulang", icon: RefreshCw, label: "Tagihan Berulang" },
      { to: "/zakat", icon: Coins, label: "Zakat" },
      { to: "/persetujuan", icon: CheckCheck, label: "Persetujuan" },
    ],
  },
  {
    title: "Data & akun",
    tone: "slate",
    items: [
      { to: "/rekonsiliasi", icon: Scale, label: "Rekonsiliasi" },
      { to: "/impor", icon: Upload, label: "Impor Data" },
      { to: "/kategori", icon: Tags, label: "Kategori" },
      { to: "/kesehatan-data", icon: Activity, label: "Kesehatan Data" },
      { to: "/pengaturan", icon: Settings, label: "Pengaturan" },
      { to: "/panduan", icon: BookOpen, label: "Panduan" },
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
