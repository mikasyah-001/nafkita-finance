import * as XLSX from "xlsx";
import { formatMoney } from "@/lib/finance";

const TYPE_LABEL = { income: "Pemasukan", expense: "Pengeluaran", sedekah: "Sedekah" };

export function downloadReportXlsx({ monthName, scopeLabel, currency = "IDR", stats, categoryRows, transactions }) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Ringkasan
  const summaryData = [
    ["Laporan Keuangan - NAFKITA"],
    [],
    ["Periode", monthName],
    ["Cakupan", scopeLabel],
    ["Mata Uang", currency],
    [],
    ["Ringkasan"],
    ...stats.map((s) => [s.label, s.value]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  ws1["!cols"] = [{ wch: 25 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Ringkasan");

  // Sheet 2: Pengeluaran per Kategori
  const catData = [
    ["Kategori", `Jumlah (${currency})`, `Bulan Lalu (${currency})`, `Selisih (${currency})`],
    ...categoryRows.map((r) => [r.name, r.value, r.prev, r.value - r.prev]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(catData);
  ws2["!cols"] = [{ wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Kategori");

  // Sheet 3: Detail Transaksi
  const txData = [
    ["Tanggal", "Jenis", "Kategori", "Merchant", `Nominal (${currency})`, "Mata Uang", "Catatan", "Diinput", "Link Bukti"],
    ...transactions.map((t) => [
      new Date(t.date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }),
      TYPE_LABEL[t.type] || t.type,
      t.category || "",
      t.merchant || "",
      t.amount,
      t.currency || currency,
      t.notes || "",
      t.input_by_name || "",
      t.photo_url || "",
    ]),
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(txData);
  ws3["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 10 }, { wch: 30 }, { wch: 16 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Transaksi");

  const fileName = `Laporan_NAFKITA_${monthName.replace(/\s+/g, "_")}_${scopeLabel}_${currency}.xlsx`;
  XLSX.writeFile(wb, fileName);
}