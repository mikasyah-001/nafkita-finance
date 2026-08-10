import { base44 } from "@/api/base44Client";

const VALID_ICONS = [
  "Wallet", "ShoppingCart", "Car", "ReceiptText", "HeartPulse", "GraduationCap",
  "Gamepad2", "Gift", "PiggyBank", "Landmark", "Coins", "Briefcase", "Utensils",
  "Bus", "Lightbulb", "Package", "Sparkles", "Home", "Heart", "MoreHorizontal", "Plus",
];
const VALID_COLORS = ["orange", "blue", "pink", "red", "teal", "indigo", "violet", "green", "amber", "cyan", "rose", "slate"];

const norm = (s) => String(s || "").toLowerCase().trim();

export const sanitizeIcon = (icon) => (VALID_ICONS.includes(icon) ? icon : "Wallet");
export const sanitizeColor = (color) => (VALID_COLORS.includes(color) ? color : "slate");

/**
 * Ensure category records exist for the given proposals.
 * Proposals: [{ name, icon, color }]. Only categories not already present
 * (case-insensitive) are created. Returns the created records.
 */
export async function ensureCategories(proposals, existingCategories, type = "expense") {
  const existingNames = new Set((existingCategories || []).map((c) => norm(c.name)));
  const toCreate = [];
  const seen = new Set();
  (proposals || []).forEach((p) => {
    const name = String(p.name || "").trim();
    if (!name) return;
    const key = norm(name);
    if (existingNames.has(key) || seen.has(key)) return;
    seen.add(key);
    toCreate.push({
      name,
      type,
      icon: sanitizeIcon(p.icon),
      color: sanitizeColor(p.color),
      is_default: false,
    });
  });
  if (!toCreate.length) return [];
  try {
    return await base44.entities.Category.bulkCreate(toCreate);
  } catch {
    return [];
  }
}