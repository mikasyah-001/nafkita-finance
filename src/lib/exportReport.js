function csvCell(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToCsv(cells) {
  return cells.map(csvCell).join(",");
}

const pct = (n, d) => (d > 0 ? +((n / d) * 100).toFixed(1) : 0);

const TYPE_LABEL = { income: "Pemasukan", expense: "Pengeluaran", sedekah: "Sedekah" };

export function downloadMonthlyReport({ monthName, scopeLabel, rows, total, prevTotal, avgPerDay, count, transactions }) {
  const lines = [];

  lines.push("Laporan Keuangan Bulanan - NAFKITA");
  lines.push(rowToCsv(["Field", "Nilai"]));
  lines.push(rowToCsv(["Periode", monthName]));
  lines.push(rowToCsv(["Cakupan", scopeLabel]));
  lines.push("");

  lines.push("RINGKASAN PENGELUARAN PER KATEGORI");
  lines.push(rowToCsv(["Kategori", "Jumlah (IDR)", "Jumlah Transaksi", "Persen (%)", "Bulan Lalu (IDR)", "Selisih (IDR)", "Perubahan (%)"]));
  rows.forEach((r) => {
    lines.push(rowToCsv([
      r.name, r.value, r.count, pct(r.value, total),
      r.prev, r.value - r.prev, r.prev > 0 ? pct(r.value - r.prev, r.prev) : 0,
    ]));
  });
  lines.push(rowToCsv(["TOTAL", total, count, 100, "", "", ""]));
  lines.push("");

  lines.push("STATISTIK");
  lines.push(rowToCsv(["Metrik", "Nilai"]));
  lines.push(rowToCsv(["Total Pengeluaran (IDR)", total]));
  lines.push(rowToCsv(["Rata-rata per Hari (IDR)", Math.round(avgPerDay)]));
  lines.push(rowToCsv(["Jumlah Transaksi", count]));
  lines.push(rowToCsv(["Total Bulan Lalu (IDR)", prevTotal]));
  lines.push(rowToCsv(["Perubahan vs Bulan Lalu (%)", prevTotal > 0 ? pct(total - prevTotal, prevTotal) : 0]));
  lines.push("");

  lines.push("DETAIL TRANSAKSI");
  lines.push(rowToCsv(["Tanggal", "Jenis", "Kategori", "Merchant", "Nominal (IDR)", "Catatan", "Diinput", "Mata Uang"]));
  transactions.forEach((t) => {
    lines.push(rowToCsv([
      new Date(t.date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }),
      TYPE_LABEL[t.type] || t.type, t.category || "", t.merchant || "", t.amount,
      t.notes || "", t.input_by_name || "", t.currency || "IDR",
    ]));
  });

  const csv = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Laporan_Keuangan_${monthName.replace(/\s+/g, "_")}_${scopeLabel}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}