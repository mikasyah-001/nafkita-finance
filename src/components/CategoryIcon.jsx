import {
  Wallet, ShoppingCart, Car, ReceiptText, HeartPulse, GraduationCap,
  Gamepad2, Gift, Vault, Landmark, Coins, Briefcase, Utensils, Bus,
  Lightbulb, Package, Sparkles, MoreHorizontal, Plus, Home, Heart, Map,
} from "lucide-react";

const iconMap = {
  Wallet, ShoppingCart, Car, ReceiptText, HeartPulse, GraduationCap,
  Gamepad2, Gift, Vault, Landmark, Coins, Briefcase, Utensils, Bus,
  Lightbulb, Package, Sparkles, MoreHorizontal, Plus, Home, Heart, Map,
  // Ikon babi tidak dipakai lagi; kategori lama bernama "PiggyBank" tampil sebagai brankas.
  PiggyBank: Vault,
};

export default function CategoryIcon({ name, className }) {
  const Icon = iconMap[name] || Wallet;
  return <Icon className={className} />;
}