import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useRefresh } from "@/hooks/useFinance";
import { toast } from "sonner";
import { HardDriveDownload, Loader2, RefreshCw, FileJson, AlertTriangle } from "lucide-react";

export default function DriveBackupRestore() {
  const refresh = useRefresh();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("restoreFromDrive", { action: "list" });
      setFiles(res.data.files || []);
    } catch {
      toast.error("Gagal memuat daftar cadangan");
    }
    setLoading(false);
  };

  useEffect(() => { loadFiles(); }, []);

  const handleRestore = async (fileId) => {
    setRestoring(fileId);
    setConfirmId(null);
    try {
      const res = await base44.functions.invoke("restoreFromDrive", { action: "restore", file_id: fileId });
      const c = res.data.created || {};
      const total = Object.values(c).reduce((s, n) => s + (n || 0), 0);
      toast.success("Cadangan dipulihkan", { description: `${total} data ditambahkan kembali` });
      refresh();
    } catch {
      toast.error("Gagal memulihkan cadangan");
    }
    setRestoring(null);
  };

  const fmtSize = (b) => {
    const n = Number(b) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / 1048576).toFixed(1)} MB`;
  };
  const fmtDate = (iso) => {
    try {
      return new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  };

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">Pulihkan data dari cadangan di Google Drive. Data cadangan akan ditambahkan ke data saat ini.</p>

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">{loading ? "Memuat..." : `${files.length} cadangan tersedia`}</span>
        <button onClick={loadFiles} disabled={loading} className="text-xs text-muted-foreground flex items-center gap-1 active:scale-95">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Muat ulang
        </button>
      </div>

      {loading ? (
        <div className="py-6 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : files.length === 0 ? (
        <div className="py-6 text-center">
          <FileJson className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Belum ada cadangan di Google Drive</p>
          <p className="text-xs text-muted-foreground mt-1">Cadangan otomatis dibuat setiap Senin.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className="rounded-xl border border-border p-3">
              {confirmId === f.id ? (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-xs flex-1">Pulihkan cadangan ini? Data akan ditambahkan ke data saat ini.</p>
                  <button onClick={() => handleRestore(f.id)} disabled={!!restoring} className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-60">Ya</button>
                  <button onClick={() => setConfirmId(null)} disabled={!!restoring} className="px-2.5 py-1 rounded-lg bg-muted text-xs font-medium">Batal</button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <FileJson className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{f.name}</p>
                    <p className="text-[10px] text-muted-foreground">{fmtDate(f.createdTime)}{f.size ? ` • ${fmtSize(f.size)}` : ""}</p>
                  </div>
                  <button onClick={() => setConfirmId(f.id)} disabled={!!restoring} className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1 disabled:opacity-60 shrink-0">
                    {restoring === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <HardDriveDownload className="w-3 h-3" />} Pulihkan
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}