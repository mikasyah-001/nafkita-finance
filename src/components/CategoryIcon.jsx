import {
  Wallet, ShoppingCart, Car, ReceiptText, HeartPulse, GraduationCap,
  Gamepad2, Gift, PiggyBank, Landmark, Coins, Briefcase, Utensils, Bus,
  Lightbulb, Package, Sparkles, MoreHorizontal, Plus, Home, Heart,
} from "lucide-react";

const iconMap = {
  Wallet, ShoppingCart, Car, ReceiptText, HeartPulse, GraduationCap,
  Gamepad2, Gift, PiggyBank, Landmark, Coins, Briefcase, Utensils, Bus,
  Lightbulb, Package, Sparkles, MoreHorizontal, Plus, Home, Heart,
};

export default function CategoryIcon({ name, className }) {
  const Icon = iconMap[name] || Wallet;
  return <Icon className={className} />;
}