import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useRefresh } from "@/hooks/useFinance";
import { toast } from "sonner";
import { Cloud, Loader2, Download, RotateCcw, AlertTriangle, Check, ChevronDown } from "lucide-react";

export default function DriveBackup() {
  const refresh = useRefresh();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backing, setBacking] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [mode, setMode] = useState("merge");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("restoreFromDrive", { action: "list" });
      setFiles(res?.data?.files || []);
    } catch {
      setFiles([]);
    }
    setLoading(false);
  };

  useEffect(() => { loadFiles(); }, []);

  const handleBackup = async () => {
    setBacking(true);
    try {
      const res = await base44.functions.invoke("backupToDrive", {});
      const counts = res?.data?.counts || {};
      const total = Object.values(counts).reduce((s, n) => s + n, 0);
      toast.success("Cadangan tersimpan ke Google Drive", { description: `${total} data dicadangkan.` });
      loadFiles();
    } catch (e) {
      toast.error("Gagal mencadangkan ke Drive", { description: e?.message || "Periksa koneksi & coba lagi." });
    }
    setBacking(false);
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    if (mode === "replace" && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    setRestoring(true);
    try {
      const res = await base44.functions.invoke("restoreFromDrive", {
        action: "restore",
        file_id: restoreFile,
        mode,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      const created = res?.data?.created || {};
      const total = Object.values(created).reduce((s, n) => s + (n || 0), 0);
      toast.success("Cadangan dipulihkan", {
        description: mode === "replace"
          ? `${total} data dimuat ulang (data lama dihapus).`
          : `${total} data baru ditambahkan (duplikat dilewati).`,
      });
      refresh();
      setRestoreFile(null);
      setConfirmReplace(false);
    } catch (e) {
      const msg = e?.message || "Gagal memulihkan";
      if (msg.includes("backup_not_yours")) {
        toast.error("File ini bukan cadangan Anda");
      } else {
        toast.error(msg);
      }
    }
    setRestoring(false);
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
      <p className="text-xs text-muted-foreground mb-3">Cadangkan data pribadi Anda ke Google Drive. Setiap akun mencadangkan datanya sendiri. Mode Ganti total hanya menghapus data milik Anda.</p>

      <button
        onClick={handleBackup}
        disabled={backing}
        className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-60 mb-3"
      >
        {backing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />} Buat Cadangan ke Drive
      </button>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">Belum ada cadangan di Drive.</p>
      ) : (
        <div className="space-y-2 mb-3">
          <p className="text-[11px] text-muted-foreground">Cadangan tersedia ({files.length}):</p>
          {files.map((f) => (
            <button
              key={f.id}
              onClick={() => { setRestoreFile(f.id); setMode("merge"); setConfirmReplace(false); }}
              className={`w-full text-left rounded-xl border p-2.5 transition-colors ${restoreFile === f.id ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <p className="text-xs font-medium truncate">{f.name}</p>
              <p className="text-[10px] text-muted-foreground">{fmtDate(f.createdTime)}</p>
            </button>
          ))}
        </div>
      )}

      {restoreFile && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-xs flex-1">Pilih mode pemulihan, lalu konfirmasi.</p>
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
              onClick={handleRestore}
              disabled={restoring}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-60 ${mode === "replace" ? "bg-red-500 text-white" : "bg-primary text-primary-foreground"}`}
            >
              {restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {mode === "replace" && confirmReplace ? "Yakin? Data dihapus" : mode === "replace" ? "Pulihkan (Ganti total)" : "Pulihkan (Gabung)"}
            </button>
            <button onClick={() => { setRestoreFile(null); setConfirmReplace(false); }} disabled={restoring} className="px-3 py-1.5 rounded-lg bg-muted text-xs font-medium">Batal</button>
          </div>
        </div>
      )}
    </div>
  );
}