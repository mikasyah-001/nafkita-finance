import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMe, useAssets } from "@/hooks/useFinance";
import { savedBankUsage, withSavedBank } from "@/lib/finance";

/**
 * Kelola "Bank tersimpan" (pilihan tinggal klik di form Tabungan/Bank &
 * Emas Digital): tambah bank baru, hapus yang salah ketik / tidak dipakai.
 */
export default function SavedBanksManager() {
  const { data: me } = useMe();
  const { data: assets = [] } = useAssets();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const saved = Array.isArray(me?.saved_banks) ? me.saved_banks : [];
  const rows = savedBankUsage(saved, assets);

  const persist = async (next, okMsg) => {
    setBusy(true);
    try {
      await base44.auth.updateMe({ saved_banks: next });
      queryClient.setQueryData(["me"], (m) => (m ? { ...m, saved_banks: next } : m));
      toast.success(okMsg);
    } catch (e) {
      toast.error("Gagal menyimpan", { description: e?.message });
    }
    setBusy(false);
  };

  const add = () => {
    const next = withSavedBank(saved, draft);
    if (!next) return toast.info(draft.trim() ? "Bank ini sudah tersimpan" : "Isi nama bank");
    persist(next, `${draft.trim()} ditambahkan`).then(() => setDraft(""));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Bank yang pernah Anda tulis — muncul sebagai pilihan tinggal klik saat menambah Tabungan/Bank atau Emas Digital.</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Belum ada bank tersimpan.</p>
      ) : (
        <ul aria-label="Bank tersimpan" className="rounded-2xl border border-border divide-y divide-border">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.name}</p>
                <p className="text-[11px] text-muted-foreground">{r.usedBy ? `Dipakai di ${r.usedBy} aset — tetap muncul selama dipakai` : "Tidak dipakai aset mana pun"}</p>
              </div>
              <button type="button" disabled={busy} aria-label={`Hapus ${r.name} dari bank tersimpan`}
                onClick={() => persist(saved.filter((b) => b !== r.name), `${r.name} dihapus dari daftar`)}
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-50">
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          aria-label="Nama bank baru" placeholder="Tambah bank, mis. Riyad Bank"
          className="flex-1 min-w-0 h-10 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 ring-primary/30" />
        <button type="button" onClick={add} disabled={busy} aria-label="Tambah bank" className="h-10 px-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1 disabled:opacity-60">
          <Plus className="w-4 h-4" /> Tambah
        </button>
      </div>
    </div>
  );
}
