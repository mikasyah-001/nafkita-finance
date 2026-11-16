import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { queryClientInstance } from "@/lib/query-client";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

const CONFIRM_WORD = "HAPUS";

// Hapus akun permanen (syarat App Store & Google Play untuk aplikasi dengan
// login). Konfirmasi dua lapis: dialog peringatan + ketik kata "HAPUS".
export default function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = typed.trim().toUpperCase() === CONFIRM_WORD;

  const close = (o) => {
    if (busy) return;
    setOpen(o);
    if (!o) setTyped("");
  };

  const handleDelete = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke("deleteMyAccount", { confirm: CONFIRM_WORD });
      if (res?.data?.error) throw new Error(res.data.error);
      queryClientInstance.clear();
      try { localStorage.clear(); sessionStorage.clear(); } catch { /* abaikan */ }
      toast.success("Akun Anda telah dihapus", { description: "Terima kasih telah memakai NAFKITA." });
      setTimeout(() => base44.auth.logout("/selamat-datang"), 900);
    } catch (e) {
      const code = e?.response?.data?.error || e?.message || "";
      toast.error("Gagal menghapus akun", {
        description: code === "user_delete_failed"
          ? "Data Anda sudah dihapus, tetapi akun belum terhapus. Silakan hubungi kami lewat menu Umpan balik."
          : "Tidak ada yang dihapus permanen dari akun Anda. Periksa koneksi lalu coba lagi.",
      });
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
      <h2 className="font-semibold text-[15px] text-destructive flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> Hapus Akun
      </h2>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
        Menghapus akun dan seluruh data Anda secara permanen. Unduh cadangan lebih dulu di grup "Data &amp; Cadangan" bila perlu.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full btn-secondary btn-sm mt-3 text-destructive border-destructive/30 hover:bg-destructive/10"
      >
        <Trash2 className="w-4 h-4" /> Hapus Akun
      </button>

      <AlertDialog open={open} onOpenChange={close}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-3xl p-6">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle className="text-lg">Hapus akun secara permanen?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm leading-relaxed space-y-2">
                <p>Tindakan ini <strong className="text-foreground">tidak dapat dibatalkan</strong>. Yang akan dihapus:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Profil dan akses masuk Anda</li>
                  <li>Semua transaksi, aset, anggaran, utang, tagihan, target tabungan, dan catatan zakat yang Anda buat</li>
                  <li>Koneksi pasangan diputus — catatan bersama yang <em>Anda</em> buat juga hilang dari tampilan pasangan</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="block text-sm">
            <span className="text-muted-foreground">Ketik <strong className="text-foreground">{CONFIRM_WORD}</strong> untuk melanjutkan</span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              disabled={busy}
              className="input mt-1.5"
              aria-label={`Ketik ${CONFIRM_WORD} untuk konfirmasi`}
            />
          </label>
          <AlertDialogFooter className="flex-row gap-2 sm:space-x-0">
            <AlertDialogCancel disabled={busy} className="flex-1 mt-0 h-11 rounded-xl">Batal</AlertDialogCancel>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!ready || busy}
              className="flex-1 h-11 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {busy ? "Menghapus…" : "Hapus Akun"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
