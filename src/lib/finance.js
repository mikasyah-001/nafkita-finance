import { format } from "date-fns";
import { id } from "date-fns/locale";

export function formatRupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export const currencies = [
  { code: "IDR", label: "Rupiah", symbol: "Rp" },
  { code: "SAR", label: "Riyal Saudi", symbol: "SAR" },
  { code: "USD", label: "Dolar AS", symbol: "$" },
];

export function formatMoney(n, currency = "IDR") {
  const c = (currency || "IDR").toUpperCase();
  if (c === "USD") return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
  if (c === "SAR") return "SAR " + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
  return formatRupiah(n);
}

export function formatNumber(n) {
  return new Intl.NumberFormat("id-ID").format(n || 0);
}

export function formatDate(date, fmt = "dd MMM yyyy") {
  try {
    return format(new Date(date), fmt, { locale: id });
  } catch {
    return "";
  }
}

export const colorMap = {
  rose: { bg: "bg-rose-100 dark:bg-rose-950/40", text: "text-rose-600 dark:text-rose-400", solid: "bg-rose-500", dot: "bg-rose-500" },
  orange: { bg: "bg-orange-100 dark:bg-orange-950/40", text: "text-orange-600 dark:text-orange-400", solid: "bg-orange-500", dot: "bg-orange-500" },
  amber: { bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-600 dark:text-amber-400", solid: "bg-amber-500", dot: "bg-amber-500" },
  green: { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", solid: "bg-emerald-500", dot: "bg-emerald-500" },
  emerald: { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", solid: "bg-emerald-500", dot: "bg-emerald-500" },
  teal: { bg: "bg-teal-100 dark:bg-teal-950/40", text: "text-teal-600 dark:text-teal-400", solid: "bg-teal-500", dot: "bg-teal-500" },
  blue: { bg: "bg-blue-100 dark:bg-blue-950/40", text: "text-blue-600 dark:text-blue-400", solid: "bg-blue-500", dot: "bg-blue-500" },
  indigo: { bg: "bg-indigo-100 dark:bg-indigo-950/40", text: "text-indigo-600 dark:text-indigo-400", solid: "bg-indigo-500", dot: "bg-indigo-500" },
  violet: { bg: "bg-violet-100 dark:bg-violet-950/40", text: "text-violet-600 dark:text-violet-400", solid: "bg-violet-500", dot: "bg-violet-500" },
  pink: { bg: "bg-pink-100 dark:bg-pink-950/40", text: "text-pink-600 dark:text-pink-400", solid: "bg-pink-500", dot: "bg-pink-500" },
  cyan: { bg: "bg-cyan-100 dark:bg-cyan-950/40", text: "text-cyan-600 dark:text-cyan-400", solid: "bg-cyan-500", dot: "bg-cyan-500" },
  red: { bg: "bg-red-100 dark:bg-red-950/40", text: "text-red-600 dark:text-red-400", solid: "bg-red-500", dot: "bg-red-500" },
  slate: { bg: "bg-slate-100 dark:bg-slate-800/60", text: "text-slate-600 dark:text-slate-300", solid: "bg-slate-500", dot: "bg-slate-500" },
};

export const colorOptions = ["orange", "blue", "pink", "red", "teal", "indigo", "violet", "green", "amber", "cyan", "rose", "slate"];

export const defaultCategories = [
  { name: "Makanan", type: "expense", color: "orange", icon: "Utensils", is_default: true },
  { name: "Transportasi", type: "expense", color: "blue", icon: "Car", is_default: true },
  { name: "Belanja", type: "expense", color: "pink", icon: "ShoppingCart", is_default: true },
  { name: "Tagihan", type: "expense", color: "red", icon: "Lightbulb", is_default: true },
  { name: "Kesehatan", type: "expense", color: "teal", icon: "HeartPulse", is_default: true },
  { name: "Pendidikan", type: "expense", color: "indigo", icon: "GraduationCap", is_default: true },
  { name: "Hiburan", type: "expense", color: "violet", icon: "Gamepad2", is_default: true },
  { name: "Lainnya", type: "expense", color: "slate", icon: "MoreHorizontal", is_default: true },
  { name: "Gaji", type: "income", color: "green", icon: "Wallet", is_default: true },
  { name: "Bonus", type: "income", color: "emerald", icon: "Coins", is_default: true },
  { name: "Hadiah", type: "income", color: "amber", icon: "Gift", is_default: true },
  { name: "Pemasukan Lain", type: "income", color: "cyan", icon: "Plus", is_default: true },
];

export function formatDuration(fromDate) {
  if (!fromDate) return "";
  const from = new Date(fromDate);
  if (isNaN(from)) return "";
  const now = new Date();
  let months = (now.getFullYear() - from.getFullYear()) * 12 + (now.getMonth() - from.getMonth());
  if (now.getDate() < from.getDate()) months--;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years > 0 && remMonths > 0) return `${years} thn ${remMonths} bln`;
  if (years > 0) return `${years} thn`;
  if (remMonths > 0) return `${remMonths} bln`;
  const days = Math.floor((now - from) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Hari ini";
  return `${days} hari`;
}

export const assetTypeLabels = {
  bank: { label: "Tabungan/Bank", icon: "Landmark", color: "blue" },
  emas: { label: "Emas", icon: "Coins", color: "amber" },
  investasi: { label: "Investasi", icon: "Briefcase", color: "green" },
  properti: { label: "Properti", icon: "Home", color: "violet" },
  lainnya: { label: "Lainnya", icon: "Package", color: "slate" },
};