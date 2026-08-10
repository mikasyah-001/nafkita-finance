import { base44 } from "@/api/base44Client";

/**
 * Reads a receipt/bon image via LLM and returns parsed transaction fields.
 * Category is matched against the user's actual expense categories (fuzzy).
 * Uses a vision-capable model for accurate OCR of Indonesian receipts.
 */
export async function scanReceipt(fileUrl, categories) {
  const expenseNames = (categories || [])
    .filter((c) => c.type === "expense")
    .map((c) => c.name);

  const prompt = `Kamu adalah asisten keuangan keluarga yang ahli membaca bon/struk belanja Indonesia. Analisa foto bon ini dengan SANGAT TELITI, perhatikan setiap baris teks.

Tugas:
1. TOTAL — cari baris yang menandakan jumlah dibayar, biasanya berlabel: "TOTAL", "TOTAL BELANJA", "GRAND TOTAL", "JUMLAH", "JUMLAH BAYAR", "TOTAL BAYAR", "TUNAI", "CASH", "QRIS", atau "DEBIT". Ambil angka dari baris TERAKHIR yang berlabel demikian di bagian bawah bon. JANGAN menjumlahkan item sendiri. Tulis juga teks baris tersebut apa adanya di field total_line sebagai bukti.
2. MERCHANT — nama toko/merchant dari header/atas bon (singkat, tanpa alamat panjang).
3. KATEGORI — pilih salah satu dari: ${expenseNames.length ? expenseNames.join(", ") : "Makanan, Transportasi, Belanja, Tagihan, Kesehatan, Pendidikan, Hiburan, Lainnya"}. Jika tidak ada yang cocok, jawab "Lainnya".
4. TANGGAL — format ISO yyyy-mm-dd. Ambil dari bon jika tertera (perhatikan urutan dd/mm/yyyy atau yyyy-mm-dd). Jika tahun hanya 2 digit, anggap 2000+tahun (mis. "24" -> 2024). Jika ragu atau tidak tertera, kosongkan (jangan tebak).
5. CATATAN — ringkasan beberapa item utama yang dibeli (maks 80 karakter, dipisah koma). Kosongkan jika tidak terbaca.

Aturan angka: kembalikan sebagai number bulat (tanpa "Rp", tanpa titik/koma pemisah ribuan). Jika ada desimal, bulatkan. Jika total tidak terbaca, isi 0.

Jawab HANYA dengan JSON valid sesuai skema.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    file_urls: [fileUrl],
    response_json_schema: {
      type: "object",
      properties: {
        amount: { type: "number" },
        total_line: { type: "string" },
        merchant: { type: "string" },
        category: { type: "string" },
        date: { type: "string" },
        notes: { type: "string" },
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

  // Normalize date: support dd/mm/yyyy -> yyyy-mm-dd
  let date = "";
  if (result.date) {
    const raw = String(result.date).trim().slice(0, 10);
    const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      date = `${m[3]}-${m[2]}-${m[1]}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      date = raw;
    } else {
      const d = new Date(raw);
      if (!isNaN(d)) date = d.toISOString().slice(0, 10);
    }
  }

  // Sanity check: only trust the scanned date if it's within a reasonable
  // window around today. AI often misreads 2-digit years on Indonesian
  // receipts (e.g. "24" -> 2020), which would bury the transaction far in
  // the past. Out-of-range dates fall back to empty so the app uses today.
  if (date) {
    const year = Number(date.slice(0, 4));
    const now = new Date();
    if (year < now.getFullYear() - 1 || year > now.getFullYear() + 1) {
      date = "";
    }
  }

  return {
    amount: Number(result.amount) > 0 ? Math.round(Number(result.amount)) : 0,
    merchant: result.merchant ? String(result.merchant).trim() : "",
    category: matched,
    date,
    notes: result.notes ? String(result.notes).trim().slice(0, 120) : "",
  };
}