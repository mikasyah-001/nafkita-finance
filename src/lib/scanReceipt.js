import { base44 } from "@/api/base44Client";
import { sanitizeIcon, sanitizeColor } from "@/lib/categoryAuto";

/**
 * Reads a receipt/bon image via LLM and returns parsed transaction fields.
 * Category is matched against the user's actual expense categories (fuzzy).
 * Uses a vision-capable model for accurate OCR of Indonesian receipts.
 */
export async function scanReceipt(fileUrl, categories) {
  const expenseNames = (categories || [])
    .filter((c) => c.type === "expense")
    .map((c) => c.name);

  const categoryList = expenseNames.length
    ? expenseNames.join(", ")
    : "Makanan, Transportasi, Belanja, Tagihan, Kesehatan, Pendidikan, Hiburan, Lainnya";

  const prompt = `Kamu adalah asisten keuangan keluarga yang ahli membaca bon/struk dan riwayat mutasi bank/e-wallet Indonesia. Analisa foto dengan SANGAT TELITI, perhatikan setiap baris.

Tugas: temukan SEMUA transaksi yang tertera pada foto. Satu foto bisa berisi:
- Satu bon/struk (1 transaksi), atau
- Riwayat mutasi bank/e-wallet (banyak transaksi, sering dikelompokkan di bawah satu tanggal).

Untuk SETIAP transaksi, tentukan:
1. TOTAL — nominal dibayar (number bulat, tanpa "Rp"/titik/koma). Untuk bon, ambil baris TOTAL/GRAND TOTAL/JUMLAH BAYAR terakhir. Untuk mutasi, ambil nominal per baris (abaikan tanda minus/kurung).
2. MERCHANT — nama toko/merchant/penerima (singkat, tanpa nomor referensi panjang).
3. KATEGORI — pilih salah satu dari: ${categoryList}. Jika tidak ada yang cocok, JANGAN pakai "Lainnya"; usulkan kategori baru yang tepat (nama singkat Indonesia, 1-2 kata, mis. "Kesehatan", "Hiburan", "Olahraga", "Perawatan", "Donasi", "Kopi"). Sertakan category_icon (salah satu: Wallet, ShoppingCart, Car, ReceiptText, HeartPulse, GraduationCap, Gamepad2, Gift, PiggyBank, Landmark, Coins, Briefcase, Utensils, Bus, Lightbulb, Package, Sparkles, Home, Heart) dan category_color (salah satu: orange, blue, pink, red, teal, indigo, violet, green, amber, cyan, rose, slate) yang paling sesuai.
4. TANGGAL — format ISO yyyy-mm-dd. Untuk mutasi, ambil tanggal per transaksi; jika transaksi dikelompokkan di bawah header tanggal, gunakan tanggal header tersebut untuk semua transaksi di grup itu. Jika tahun hanya 2 digit, anggap 2000+tahun. Jika ragu/tidak tertera, kosongkan (jangan tebak).
5. JAM — waktu transaksi format HH:mm (24 jam). Ambil dari jam cetak pada bon/struk atau kolom waktu pada mutasi. Jika tidak tertera, kosongkan (jangan tebak).
6. CATATAN — ringkasan singkat item/nama transaksi (maks 80 karakter). Kosongkan jika tidak terbaca.
7. MATA UANG — kode mata uang yang tertera (IDR/SAR/USD). Bila tidak tertera, isi "IDR".

Kembalikan array "transactions" berisi SEMUA transaksi yang terbaca. Jika hanya satu transaksi, tetap kembalikan array dengan 1 elemen. JANGAN gabungkan beberapa transaksi menjadi satu.

Jawab HANYA dengan JSON valid sesuai skema.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    file_urls: [fileUrl],
    response_json_schema: {
      type: "object",
      properties: {
        transactions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              amount: { type: "number" },
              merchant: { type: "string" },
              category: { type: "string" },
              category_icon: { type: "string" },
              category_color: { type: "string" },
              date: { type: "string" },
              time: { type: "string" },
              notes: { type: "string" },
              currency: { type: "string" },
            },
          },
        },
      },
    },
  });

  const normalizeDate = (raw) => {
    if (!raw) return "";
    const r = String(raw).trim().slice(0, 10);
    let d = "";
    const m = r.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) d = `${m[3]}-${m[2]}-${m[1]}`;
    else if (/^\d{4}-\d{2}-\d{2}$/.test(r)) d = r;
    else {
      const dt = new Date(r);
      if (!isNaN(dt)) d = dt.toISOString().slice(0, 10);
    }
    if (d) {
      const year = Number(d.slice(0, 4));
      const now = new Date();
      if (year < now.getFullYear() - 1 || year > now.getFullYear() + 1) d = "";
    }
    return d;
  };

  const normalizeTime = (raw) => {
    if (!raw) return "";
    const r = String(raw).trim();
    const m = r.match(/(\d{1,2})[:.](\d{2})/);
    if (m) {
      const h = Number(m[1]);
      if (h >= 0 && h <= 23) return `${String(h).padStart(2, "0")}:${m[2]}`;
    }
    return "";
  };

  const matchCategory = (cat) => {
    if (!cat) return { name: "", isNew: false };
    const r = String(cat).toLowerCase().trim();
    const existing =
      expenseNames.find((n) => n.toLowerCase() === r) ||
      expenseNames.find((n) => n.toLowerCase().includes(r) || r.includes(n.toLowerCase()));
    if (existing) return { name: existing, isNew: false };
    return { name: String(cat).trim(), isNew: true };
  };

  const items = (result.transactions || [])
    .map((t) => {
      const cat = matchCategory(t.category);
      return {
        amount: Number(t.amount) > 0 ? Math.round(Number(t.amount)) : 0,
        merchant: t.merchant ? String(t.merchant).trim() : "",
        category: cat.name,
        category_new: cat.isNew,
        category_icon: cat.isNew ? sanitizeIcon(t.category_icon) : "",
        category_color: cat.isNew ? sanitizeColor(t.category_color) : "",
        date: normalizeDate(t.date),
        time: normalizeTime(t.time),
        notes: t.notes ? String(t.notes).trim().slice(0, 120) : "",
        currency: ["IDR", "SAR", "USD"].includes(String(t.currency || "").toUpperCase()) ? String(t.currency).toUpperCase() : "IDR",
      };
    })
    .filter((t) => t.amount > 0);

  return { transactions: items };
}