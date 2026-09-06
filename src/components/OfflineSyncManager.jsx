import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useRefresh, useTransactions, useMe } from "@/hooks/useFinance";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getPending, removePending, toBackendTx } from "@/lib/offlineQueue";
import { findDuplicate } from "@/lib/duplicateDetect";
import { toast } from "sonner";
import { WifiOff, RefreshCw, CloudUpload } from "lucide-react";

export default function OfflineSyncManager() {
  const online = useOnlineStatus();
  const refresh = useRefresh();
  const { data: transactions = [] } = useTransactions();
  const { data: me } = useMe();
  const userId = me?.id;
  const [pending, setPending] = useState([]);
  const [syncing, setSyncing] = useState(false);

  const sync = async () => {
    const list = getPending(userId);
    if (list.length === 0) return;
    setSyncing(true);
    let ok = 0;
    const failed = [];
    for (const tx of list) {
      try {
        const payload = toBackendTx(tx);
        // Cek duplikat terhadap transaksi yang sudah ada di server.
        if (findDuplicate(payload, transactions)) {
          removePending(tx._localId, userId);
          continue;
        }
        const res = await base44.functions.invoke("saveTransactionWithAsset", { transaction: payload });
        const d = res?.data || res;
        if (d?.error) throw new Error(d.error);
        removePending(tx._localId, userId);
        ok++;
      } catch (e) {
        failed.push({ tx, error: e?.message || "Gagal menyinkronkan" });
      }
    }
    setPending(getPending(userId));
    setSyncing(false);
    if (ok > 0) {
      refresh();
      toast.success(`${ok} transaksi disinkronkan`, { description: "Data offline kini tersimpan di server." });
    }
    if (failed.length > 0) {
      toast.error(`${failed.length} transaksi gagal disinkron`, {
        description: failed[0].error,
      });
    }
  };

  useEffect(() => {
    setPending(getPending(userId));
    if (online && userId && getPending(userId).length > 0) sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, userId]);

  let content = null;
  if (!online) {
    content = (
      <div className="bg-amber-500 text-white text-xs font-medium px-4 py-2 flex items-center justify-center gap-2">
        <WifiOff className="w-3.5 h-3.5" /> Mode Offline — transaksi disimpan di perangkat
      </div>
    );
  } else if (syncing) {
    content = (
      <div className="bg-primary text-primary-foreground text-xs font-medium px-4 py-2 flex items-center justify-center gap-2">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menyinkronkan transaksi offline...
      </div>
    );
  } else if (pending.length > 0) {
    content = (
      <div className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-medium px-4 py-2 flex items-center justify-center gap-2">
        <CloudUpload className="w-3.5 h-3.5" /> {pending.length} transaksi menunggu sinkron
        <button onClick={sync} className="underline font-semibold">Sinkronkan</button>
      </div>
    );
  }

  return content;
}