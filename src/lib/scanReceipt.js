import { base44 } from "@/api/base44Client";

/**
 * Reads a receipt/bon image via LLM and returns parsed transaction fields.
 * Category is matched against the user's actual expense categories (fuzzy).
 */
export async function scanReceipt(fileUrl, categories) {
  const expenseNames = (categories || [])
    .filter((c) => c.type === "expense")
    .map((c) => c.name);

  const prompt = `Kamu adalah asisten keuangan keluarga. Analisa foto bon/struk ini dengan teliti.
Ekstrak:
1. total nominal yang dibayar (angka bulat tanpa mata uang "Rp" atau titik/koma pemisah ribuan; jika ada desimal, bulatkan)
2. nama merchant / tempat toko (singkat)
3. kategori pengeluaran — pilih salah satu dari daftar berikut: ${expenseNames.length ? expenseNames.join(", ") : "Makanan, Transportasi, Belanja, Tagihan, Kesehatan, Pendidikan, Hiburan, Lainnya"}. Jika tidak ada yang cocok, jawab "Lainnya".
4. tanggal transaksi (format ISO yyyy-mm-dd; jika tidak tertera di bon, gunakan tanggal hari ini)
Jawab HANYA dengan JSON valid sesuai skema.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    file_urls: [fileUrl],
    response_json_schema: {
      type: "object",
      properties: {
        amount: { type: "number" },
        merchant: { type: "string" },
        category: { type: "string" },
        date: { type: "string" },
      },
    },
  });

  let matched = "";
  if (result.category) {
    const r = String(result.category).toLowerCase().trim();
    matched =
      expenseNames.find((n) => n.toLowerCase() === r) ||
      expenseNames.find((n) => n.toLowerCase().includes(r) || r.includes(n.toLowerCase())) ||
      "";
  }

  return {
    amount: Number(result.amount) > 0 ? Math.round(Number(result.amount)) : 0,
    merchant: result.merchant ? String(result.merchant).trim() : "",
    category: matched,
    date: result.date ? String(result.date).slice(0, 10) : "",
  };
}