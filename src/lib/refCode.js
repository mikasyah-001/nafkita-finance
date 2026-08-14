// Kode referensi pasangan — diturunkan deterministik dari user id
// (unik & stabil, tanpa perlu penyimpanan tambahan).
export const deriveRefCode = (userId) => {
  if (!userId) return "";
  const tail = String(userId).replace(/[^a-f0-9]/gi, "").slice(-10);
  if (!tail) return "";
  const num = parseInt(tail, 16);
  if (isNaN(num)) return "";
  return "NK" + num.toString(36).toUpperCase().padStart(7, "0").slice(0, 7);
};