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

// Menu "Lainnya" BottomNav = Alat + Ringkasan + Anggaran + Laporan.
export const moreItems = [
  ...toolItems,
  { to: "/ringkasan", icon: PiggyBank, label: "Ringkasan", color: "slate" },
  { to: "/anggaran", icon: Wallet, label: "Anggaran", color: "slate" },
  { to: "/laporan", icon: BarChart3, label: "Laporan", color: "slate" },
];

// Warna ikon untuk menu "Lainnya" BottomNav (per kategori).
export const moreColorClasses = {
  blue: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400",
  rose: "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400",
  amber: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
  teal: "bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400",
  emerald: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
  violet: "bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400",
  indigo: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400",
  orange: "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400",
  cyan: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400",
  red: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400",
  slate: "bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300",
};