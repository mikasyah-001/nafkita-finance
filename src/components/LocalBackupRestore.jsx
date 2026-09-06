import { useRef, useState } from "react";
import { useRefresh, useMe } from "@/hooks/useFinance";
import { exportBackup, importBackup, BACKUP_ENTITIES } from "@/lib/backupRestore";
import { toast } from "sonner";
import { Download, Upload, Loader2, FileJson, AlertTriangle, Check } from "lucide-react";

const labelMap = {
  transactions: "Transaksi",
  assets: "Aset",
  categories: "Kategori",
  budgets: "Anggaran",
  zakatPayments: "Zakat",
  snapshots: "Snapshot Aset",
  templates: "Template",
  investmentLots: "Lot Investasi",
};

export default function LocalBackupRestore() {
  const refresh = useRefresh();
  const { data: me } = useMe();
  const fileRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pending, setPending] = useState(null);
  const [mode, setMode] = useState("merge");
  const [confirmReplace, setConfirmReplace] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nafkita-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const total = Object.values(backup.counts || {}).reduce((s, n) => s + n, 0);
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
        setMode("merge");
        setConfirmReplace(false);
      } catch {
        toast.error("File cadangan tidak valid");
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!pending) return;
    if (mode === "replace" && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    setImporting(true);
    try {
      const result = await importBackup(pending, mode, me?.id);
      const total = Object.values(result).reduce((s, n) => s + (n || 0), 0);
      toast.success("Cadangan dipulihkan", {
        description: mode === "replace"
          ? `${total} data dimuat ulang (data lama dihapus).`
          : `${total} data baru ditambahkan (duplikat dilewati).`,
      });
      refresh();
      setPending(null);
      setConfirmReplace(false);
    } catch {
      toast.error("Gagal memulihkan cadangan");
    }
    setImporting(false);
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
      <p className="text-xs text-muted-foreground mb-3">Cadangkan data Anda ke file di perangkat ini. Format kompatibel dengan cadangan Google Drive. Setiap akun membuat dan memulihkan cadangannya sendiri.</p>

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
            <p className="text-xs flex-1">Pilih mode pemulihan, lalu konfirmasi.</p>
          </div>
          <div className="rounded-lg bg-background/60 p-2.5 mb-2.5">
            <p className="text-[10px] text-muted-foreground mb-1">Dibuat: {fmtDate(pending.exported_at)}</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {BACKUP_ENTITIES.map((e) => (
                <p key={e.key} className="text-[11px] text-muted-foreground flex justify-between">
                  <span>{labelMap[e.key] || e.key}</span>
                  <span className="tabular-nums font-medium text-foreground">{pending.counts?.[e.key] ?? 0}</span>
                </p>
              ))}
            </div>
          </div>

          <div className="flex gap-2 mb-2.5">
            <button
              onClick={() => { setMode("merge"); setConfirmReplace(false); }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium ${mode === "merge" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              Gabung
            </button>
            <button
              onClick={() => { setMode("replace"); setConfirmReplace(false); }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium ${mode === "replace" ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"}`}
            >
              Ganti total
            </button>
          </div>
          {mode === "merge" && (
            <p className="text-[10px] text-muted-foreground mb-2.5">Gabung: lewati data yang sudah ada (duplikat dilewati).</p>
          )}
          {mode === "replace" && (
            <p className="text-[10px] text-red-600 mb-2.5">Ganti total: seluruh data milik Anda saat ini dihapus lalu diganti dengan isi cadangan. Tindakan ini tidak dapat dibatalkan.</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={importing}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-60 ${mode === "replace" ? "bg-red-500 text-white" : "bg-primary text-primary-foreground"}`}
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {mode === "replace" && confirmReplace ? "Yakin? Data dihapus" : mode === "replace" ? "Pulihkan (Ganti total)" : "Pulihkan (Gabung)"}
            </button>
            <button onClick={() => { setPending(null); setConfirmReplace(false); }} disabled={importing} className="px-3 py-1.5 rounded-lg bg-muted text-xs font-medium">Batal</button>
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