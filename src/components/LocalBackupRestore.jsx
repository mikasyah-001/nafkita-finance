import { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useRefresh } from "@/hooks/useFinance";
import { toast } from "sonner";
import { Download, Upload, Loader2, FileJson, AlertTriangle, Check } from "lucide-react";

const ENTITIES = [
  { key: "Transaction", label: "Transaksi" },
  { key: "Asset", label: "Aset" },
  { key: "Category", label: "Kategori" },
  { key: "Budget", label: "Anggaran" },
  { key: "ZakatPayment", label: "Zakat" },
  { key: "AssetSnapshot", label: "Snapshot Aset" },
  { key: "TransactionTemplate", label: "Template" },
  { key: "InvestmentLot", label: "Lot Investasi" },
];

const STRIP = ["id", "created_date", "updated_date", "created_by_id"];

function clean(arr) {
  return (arr || []).map((r) => {
    const c = { ...r };
    STRIP.forEach((k) => delete c[k]);
    return c;
  });
}

export default function LocalBackupRestore() {
  const refresh = useRefresh();
  const fileRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pending, setPending] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = {};
      for (const e of ENTITIES) {
        data[e.key] = await base44.entities[e.key].list("-created_date", 5000);
      }
      const backup = {
        app: "NAFKITA",
        exported_at: new Date().toISOString(),
        counts: Object.fromEntries(ENTITIES.map((e) => [e.key, data[e.key].length])),
        data,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nafkita-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const total = Object.values(backup.counts).reduce((s, n) => s + n, 0);
      toast.success("Cadangan diunduh", { description: `${total} data disimpan ke perangkat.` });
    } catch {
      toast.error("Gagal membuat cadangan");
    }
    setExporting(false);
  };

  const handleFilePicked = (e) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !parsed.data || !parsed.counts) throw new Error();
        setPending(parsed);
      } catch {
        toast.error("File cadangan tidak valid");
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!pending) return;
    setImporting(true);
    try {
      const d = pending.data || {};
      const created = {};
      for (const e of ENTITIES) {
        const records = clean(d[e.key]);
        created[e.key] = records.length
          ? (await base44.entities[e.key].bulkCreate(records)).length || 0
          : 0;
      }
      const total = Object.values(created).reduce((s, n) => s + n, 0);
      toast.success("Cadangan dipulihkan", { description: `${total} data ditambahkan kembali.` });
      refresh();
    } catch {
      toast.error("Gagal memulihkan cadangan");
    }
    setImporting(false);
    setPending(null);
  };

  const fmtDate = (iso) => {
    try {
      return new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">Cadangkan data Anda ke file di perangkat ini. Setiap akun membuat dan memulihkan cadangannya sendiri.</p>

      <button
        onClick={handleExport}
        disabled={exporting}
        className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-60 mb-3"
      >
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Buat Cadangan (Unduh)
      </button>

      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFilePicked} />

      {pending ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-xs flex-1">Pulihkan cadangan ini? Data akan ditambahkan ke data saat ini.</p>
          </div>
          <div className="rounded-lg bg-background/60 p-2.5 mb-2.5">
            <p className="text-[10px] text-muted-foreground mb-1">Dibuat: {fmtDate(pending.exported_at)}</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {ENTITIES.map((e) => (
                <p key={e.key} className="text-[11px] text-muted-foreground flex justify-between">
                  <span>{e.label}</span>
                  <span className="tabular-nums font-medium text-foreground">{pending.counts?.[e.key] ?? 0}</span>
                </p>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleImport} disabled={importing} className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-60">
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Pulihkan
            </button>
            <button onClick={() => setPending(null)} disabled={importing} className="px-3 py-1.5 rounded-lg bg-muted text-xs font-medium">Batal</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full py-2.5 rounded-xl border border-border text-sm font-medium flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform"
        >
          <Upload className="w-4 h-4" /> Pilih File untuk Pulihkan
        </button>
      )}

      <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1">
        <FileJson className="w-3 h-3" /> Simpan file cadangan di tempat aman. Tanpa file ini, data tidak dapat dipulihkan.
      </p>
    </div>
  );
}