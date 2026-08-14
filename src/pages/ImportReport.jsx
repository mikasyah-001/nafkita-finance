import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCategories, useRefresh, useTransactions } from "@/hooks/useFinance";
import { formatRupiah, colorMap } from "@/lib/finance";
import { dedupeBatch, filterAgainstExisting } from "@/lib/duplicateDetect";
import CategoryIcon from "@/components/CategoryIcon";
import { toast } from "sonner";
import { ArrowLeft, Upload, FileText, Loader2, Check, AlertCircle, Trash2, FileSearch } from "lucide-react";

export default function ImportReport() {
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data: categories = [] } = useCategories();
  const { data: transactions = [] } = useTransactions();
  const fileRef = useRef(null);
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("file");
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const normalizeDate = (d) => {
    if (!d) return new Date().toISOString().slice(0, 10);
    const dt = new Date(d);
    if (!isNaN(dt)) return dt.toISOString().slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  };

  const mapCategory = (name) => {
    if (!name) return "";
    const match = categories.find((c) => c.name.toLowerCase() === String(name).toLowerCase());
    return match ? match.name : "";
  };

  const normalizeTransactions = (transactions) =>
    (transactions || [])
      .filter((t) => t && Number(t.amount) > 0)
      .map((t, i) => ({
        id: i,
        selected: true,
        date: normalizeDate(t.date),
        time: t.time || "",
        merchant: t.merchant || "",
        category: mapCategory(t.category),
        amount: Number(t.amount) || 0,
        type: t.type === "income" ? "income" : "expense",
      }));

  const parseText = async (rawText) => {
    const catNames = categories.map((c) => c.name).join(", ");
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Ekstrak daftar transaksi dari teks laporan keuangan berikut. Untuk setiap transaksi tentukan: tanggal (format yyyy-mm-dd), jam (format HH:mm, jika tersedia di laporan; jika tidak ada kosongkan), merchant/tempat/no transaksi, kategori (pilih dari: ${catNames}; jika tidak ada yang cocok gunakan "Lainnya"), nominal (angka tanpa mata uang), dan tipe ("expense" untuk pengeluaran, "income" untuk pemasukan). Teks:\n\n${rawText}`,
      response_json_schema: {
        type: "object",
        properties: {
          transactions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string" },
                time: { type: "string" },
                merchant: { type: "string" },
                category: { type: "string" },
                amount: { type: "number" },
                type: { type: "string" },
              },
            },
            },
            },
            },
            });
            return normalizeTransactions(result.transactions || []);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setRows([]);
    setError("");
    setParsing(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const isText = file.type.startsWith("text") || file.name.endsWith(".txt");
      let transactions = [];
      if (isText) {
        const res = await fetch(file_url);
        const rawText = await res.text();
        transactions = await parseText(rawText);
      } else {
        const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: {
            type: "object",
            properties: {
              transactions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    date: { type: "string" },
                    time: { type: "string" },
                    merchant: { type: "string" },
                    category: { type: "string" },
                    amount: { type: "number" },
                    type: { type: "string" },
                  },
                },
              },
            },
          },
        });
        const out = result.output;
        transactions = normalizeTransactions(Array.isArray(out) ? out : out?.transactions);
      }
      if (transactions.length === 0) {
        setError("Tidak ada transaksi yang berhasil diekstrak dari file.");
      } else {
        setRows(transactions);
        toast.success(`${transactions.length} transaksi terbaca`, { description: "Periksa data sebelum disimpan." });
      }
    } catch (err) {
      setError("Gagal membaca file. Pastikan format didukung (PDF/TXT).");
    }
    setParsing(false);
  };

  const handleAnalyzeText = async () => {
    if (!text.trim()) return toast.error("Masukkan teks laporan terlebih dahulu");
    setRows([]);
    setError("");
    setParsing(true);
    try {
      const transactions = await parseText(text);
      if (transactions.length === 0) {
        setError("Tidak ada transaksi yang berhasil diekstrak dari teks.");
      } else {
        setRows(transactions);
        toast.success(`${transactions.length} transaksi terbaca`, { description: "Periksa data sebelum disimpan." });
      }
    } catch (err) {
      setError("Gagal menganalisis teks. Coba perjelas formatnya.");
    }
    setParsing(false);
  };

  const updateRow = (id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const toggleRow = (id) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)));
  };

  const removeRow = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const selectedCount = rows.filter((r) => r.selected).length;
  const selectedTotal = rows.filter((r) => r.selected).reduce((s, r) => s + r.amount, 0);

  const handleImport = async () => {
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) return toast.error("Tidak ada transaksi dipilih");
    const missingCat = selected.filter((r) => r.type !== "sedekah" && !r.category);
    if (missingCat.length > 0) return toast.error("Ada transaksi tanpa kategori", { description: "Lengkapi kategori atau hapus baris tersebut." });

    setImporting(true);
    try {
      const payload = selected.map((r) => ({
        type: r.type,
        amount: r.amount,
        category: r.category,
        date: new Date(`${r.date}T${r.time || "12:00"}`).toISOString(),
        merchant: r.merchant || "",
        notes: "Diimpor dari laporan",
        photo_url: "",
        input_by_name: user?.full_name || user?.email || "Keluarga",
      }));
      const unique = dedupeBatch(payload);
      const { toSave, skipped } = filterAgainstExisting(unique, transactions);
      if (!toSave.length) {
        toast.error("Semua transaksi duplikat", { description: "Tidak ada transaksi baru untuk disimpan." });
        setImporting(false);
        return;
      }
      await base44.entities.Transaction.bulkCreate(toSave);
      refresh();
      toast.success(`${toSave.length} transaksi berhasil disimpan!`, skipped.length ? { description: `${skipped.length} transaksi duplikat dilewati.` } : undefined);
      navigate("/riwayat");
    } catch (err) {
      toast.error("Gagal menyimpan transaksi");
    }
    setImporting(false);
  };

  return (
    <div className="px-5 pt-8 pb-28">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold">Impor Laporan</h1>
      </div>

      <p className="text-sm text-muted-foreground mb-4">Unggah file atau tempel teks laporan pengeluaran lama. AI akan membaca transaksinya, lalu Anda bisa memeriksa dan memilih sebelum disimpan.</p>

      <div className="flex gap-2 bg-muted p-1 rounded-2xl mb-4">
        <button onClick={() => setMode("file")} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${mode === "file" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>Unggah File</button>
        <button onClick={() => setMode("text")} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${mode === "text" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>Tempel Teks</button>
      </div>

      {mode === "file" ? (
        <>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={parsing}
            className="w-full rounded-2xl border-2 border-dashed border-border py-8 flex flex-col items-center gap-2 text-muted-foreground active:scale-[0.99] transition-transform disabled:opacity-60"
          >
            {parsing ? (
              <>
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
                <p className="text-sm font-medium text-primary">Membaca laporan...</p>
              </>
            ) : (
              <>
                <Upload className="w-7 h-7" />
                <p className="text-sm font-medium">Pilih file PDF / TXT</p>
                <p className="text-xs">AI akan mengekstrak transaksi otomatis</p>
              </>
            )}
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.txt,text/plain,application/pdf" className="hidden" onChange={handleFile} />

          {fileName && !parsing && (
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <FileText className="w-3.5 h-3.5" /> {fileName}
            </div>
          )}
        </>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={"Tempel atau ketik teks laporan keuangan di sini...\n\nContoh:\n2 Jan 2026 - Bayar listrik PLN Rp 500.000\n5 Jan 2026 - Belanja bulanan Indomaret 350000\n10 Jan 2026 - Gaji bulanan 8.000.000"}
            className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30 resize-none"
          />
          <button
            onClick={handleAnalyzeText}
            disabled={parsing || !text.trim()}
            className="w-full mt-3 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-60"
          >
            {parsing ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSearch className="w-5 h-5" />}
            {parsing ? "Menganalisis..." : "Analisis Teks"}
          </button>
        </>
      )}

      {error && (
        <div className="flex items-start gap-2 mt-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 p-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between mt-6 mb-3">
            <p className="text-sm font-medium">Pratinjau ({rows.length} transaksi)</p>
            <button onClick={() => setRows((prev) => prev.map((r) => ({ ...r, selected: !prev.every((x) => x.selected) })))} className="text-xs text-primary font-medium">
              {rows.every((r) => r.selected) ? "Batal pilih semua" : "Pilih semua"}
            </button>
          </div>

          <div className="space-y-2">
            {rows.map((r) => {
              const cat = categories.find((c) => c.name === r.category);
              const cm = colorMap[cat?.color] || colorMap.slate;
              const icon = cat?.icon || "Wallet";
              return (
                <div key={r.id} className={`rounded-2xl border bg-card p-3 transition-colors ${r.selected ? "border-border" : "border-border opacity-50"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" checked={r.selected} onChange={() => toggleRow(r.id)} className="w-4 h-4 accent-primary" />
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cm.bg}`}>
                      <CategoryIcon name={icon} className={`w-4 h-4 ${cm.text}`} />
                    </div>
                    <select value={r.type} onChange={(e) => updateRow(r.id, "type", e.target.value)} className="text-xs rounded-lg border border-border px-2 py-1 bg-background outline-none">
                      <option value="expense">Pengeluaran</option>
                      <option value="income">Pemasukan</option>
                    </select>
                    <button onClick={() => removeRow(r.id)} className="ml-auto text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" value={r.date} onChange={(e) => updateRow(r.id, "date", e.target.value)} className="rounded-lg border border-border px-2 py-1.5 text-xs outline-none" />
                    <input type="time" value={r.time || ""} onChange={(e) => updateRow(r.id, "time", e.target.value)} className="rounded-lg border border-border px-2 py-1.5 text-xs outline-none" />
                    <input type="number" value={r.amount} onChange={(e) => updateRow(r.id, "amount", Number(e.target.value))} placeholder="Nominal" className="rounded-lg border border-border px-2 py-1.5 text-xs outline-none col-span-2" />
                    <input value={r.merchant} onChange={(e) => updateRow(r.id, "merchant", e.target.value)} placeholder="Merchant / No Transaksi" className="rounded-lg border border-border px-2 py-1.5 text-xs outline-none col-span-2" />
                    <select value={r.category} onChange={(e) => updateRow(r.id, "category", e.target.value)} className="rounded-lg border border-border px-2 py-1.5 text-xs outline-none bg-background col-span-2">
                      <option value="">Pilih kategori</option>
                      {categories.filter((c) => c.type === r.type).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {rows.length > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-background/90 backdrop-blur-lg border-t border-border px-5 py-4 z-50">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="text-muted-foreground">{selectedCount} transaksi dipilih</span>
            <span className="font-semibold">{formatRupiah(selectedTotal)}</span>
          </div>
          <button
            onClick={handleImport}
            disabled={importing || selectedCount === 0}
            className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-60"
          >
            {importing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            {importing ? "Menyimpan..." : `Masukkan ${selectedCount} Transaksi`}
          </button>
        </div>
      )}
    </div>
  );
}