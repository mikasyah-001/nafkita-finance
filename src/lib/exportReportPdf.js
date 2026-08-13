import { jsPDF } from "jspdf";
import { formatRupiah } from "@/lib/finance";

const TYPE_LABEL = { income: "Pemasukan", expense: "Pengeluaran", sedekah: "Sedekah" };

function loadImageDataUrl(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const maxW = 420;
        const scale = Math.min(1, maxW / (img.naturalWidth || maxW));
        const canvas = document.createElement("canvas");
        canvas.width = (img.naturalWidth || maxW) * scale;
        canvas.height = (img.naturalHeight || 240) * scale;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function downloadReportPdf({ monthName, scopeLabel, stats, categoryRows, transactions }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;
  const ensure = (need) => { if (y + need > pageH - margin) { doc.addPage(); y = margin; } };

  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("Laporan Keuangan - NAFKITA", margin, y); y += 22;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`Periode: ${monthName}`, margin, y); y += 14;
  doc.text(`Cakupan: ${scopeLabel}`, margin, y); y += 20;

  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("Ringkasan", margin, y); y += 16;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  stats.forEach((s) => { ensure(16); doc.text(`${s.label}: ${s.value}`, margin, y); y += 14; });
  y += 10;

  if (categoryRows.length) {
    ensure(30);
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Pengeluaran per Kategori", margin, y); y += 16;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Kategori", margin, y); doc.text("Bulan Ini", margin + 200, y); doc.text("Bulan Lalu", margin + 290, y); doc.text("Selisih", margin + 380, y); y += 4;
    doc.setLineDash([]); doc.line(margin, y, pageW - margin, y); y += 12;
    doc.setFont("helvetica", "normal");
    categoryRows.forEach((r) => {
      ensure(16);
      doc.text(String(r.name).slice(0, 30), margin, y);
      doc.text(formatRupiah(r.value), margin + 200, y);
      doc.text(formatRupiah(r.prev), margin + 290, y);
      const diff = r.value - r.prev;
      doc.text((diff >= 0 ? "+" : "") + formatRupiah(diff), margin + 380, y);
      y += 14;
    });
    y += 16;
  }

  doc.addPage(); y = margin;
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("Detail Transaksi & Bukti", margin, y); y += 18;

  for (const t of transactions) {
    if (y + 60 > pageH - margin) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(`${new Date(t.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })} • ${TYPE_LABEL[t.type] || t.type}`, margin, y); y += 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Kategori: ${t.category || "-"}`, margin, y); y += 12;
    doc.text(`Nominal: ${formatRupiah(t.amount)} (${t.currency || "IDR"})`, margin, y); y += 12;
    if (t.merchant) { ensure(12); doc.text(`Merchant: ${t.merchant}`, margin, y); y += 12; }
    if (t.input_by_name) { ensure(12); doc.text(`Diinput: ${t.input_by_name}`, margin, y); y += 12; }
    if (t.notes) {
      const lines = doc.splitTextToSize(`Catatan: ${t.notes}`, pageW - 2 * margin);
      lines.forEach((ln) => { ensure(12); doc.text(ln, margin, y); y += 12; });
    }
    y += 4;
    if (t.photo_url) {
      const dataUrl = await loadImageDataUrl(t.photo_url);
      const imgW = 240; const imgH = 150;
      if (y + imgH > pageH - margin) { doc.addPage(); y = margin; }
      if (dataUrl) {
        try { doc.addImage(dataUrl, "JPEG", margin, y, imgW, imgH); } catch { doc.text("[Bukti tidak dapat dimuat]", margin, y); }
        y += imgH + 8;
      } else {
        doc.text("[Bukti tidak dapat dimuat]", margin, y); y += 14;
      }
    }
    y += 8;
    doc.setLineDash([2, 2]); doc.line(margin, y, pageW - margin, y); doc.setLineDash([]); y += 10;
  }

  doc.save(`Laporan_NAFKITA_${monthName.replace(/\s+/g, "_")}_${scopeLabel}.pdf`);
}