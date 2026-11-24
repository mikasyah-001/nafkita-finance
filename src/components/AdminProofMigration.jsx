import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";
import { confirmAction } from "@/components/ConfirmHost";

// Admin: pindahkan bukti lama (URL publik) ke penyimpanan privat, per batch.
// Server: base44/functions/migrateLegacyProofs.
const TARGETS = [
  { key: "transactions", label: "Bukti transaksi" },
  { key: "assets", label: "Bukti pembelian aset" },
];

export default function AdminProofMigration() {
  const [counts, setCounts] = useState(null);
  const [busy, setBusy] = useState("");
  const [log, setLog] = useState([]);
  const [reasons, setReasons] = useState([]); // [[alasan, jumlah], ...] dari proses terakhir

  const call = async (args) => {
    const res = await base44.functions.invoke("migrateLegacyProofs", args);
    if (res?.data?.error) throw new Error(res.data.error);
    return res.data;
  };

  const check = async () => {
    setBusy("check");
    try {
      const out = {};
      for (const t of TARGETS) out[t.key] = (await call({ target: t.key, dry_run: true })).candidates || 0;
      setCounts(out);
    } catch (e) {
      toast.error("Gagal memeriksa", { description: e?.message });
    }
    setBusy("");
  };

  const run = async (target) => {
    const label = TARGETS.find((t) => t.key === target)?.label;
    const ok = await confirmAction({
      title: `Pindahkan ${counts?.[target] ?? ""} ${label?.toLowerCase()} ke penyimpanan privat?`,
      description: "Berkas disalin menjadi file privat lalu tautan publiknya dilepas dari data. Item yang gagal dibiarkan apa adanya dan bisa dicoba lagi.",
      confirmText: "Pindahkan",
    });
    if (!ok) return;
    setBusy(target);
    setReasons([]);
    let migrated = 0;
    const failed = [];
    try {
      // Batch berulang sampai habis; item gagal dilewati (skip) agar tetap maju.
      for (let i = 0; i < 200; i++) {
        const r = await call({ target, dry_run: false, limit: 20, skip: failed.length });
        migrated += r.migrated || 0;
        failed.push(...(r.failed || []));
        setLog([`${label}: ${migrated} dipindahkan, ${failed.length} gagal, sisa ${Math.max(0, (r.remaining || 0) - failed.length)}`]);
        if (!r.migrated && !(r.failed || []).length) break;
        if ((r.remaining || 0) <= failed.length) break;
      }
      const grouped = {};
      for (const f of failed) grouped[f.reason] = (grouped[f.reason] || 0) + 1;
      setReasons(Object.entries(grouped).sort((a, b) => b[1] - a[1]));
      if (migrated) toast.success(`${label}: ${migrated} dipindahkan`, { description: failed.length ? `${failed.length} gagal — lihat rincian di kartu.` : "Semua selesai." });
      else toast.error(`${label}: belum ada yang dipindahkan`, { description: failed.length ? "Lihat rincian alasan di kartu." : undefined });
    } catch (e) {
      toast.error("Migrasi berhenti", { description: e?.message });
    }
    setBusy("");
    check();
  };

  return (
    <section aria-label="Bukti lama ke penyimpanan privat" className="surface rounded-3xl p-4 mt-4">
      <p className="text-sm font-semibold flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-primary" /> Bukti lama → penyimpanan privat</p>
      <p className="text-xs text-muted-foreground mt-1 mb-3 leading-snug">Foto bukti yang diunggah sebelum pembaruan keamanan masih berupa tautan publik. Pindahkan agar hanya bisa dibuka lewat aplikasi.</p>
      {!counts ? (
        <button onClick={check} disabled={!!busy} className="btn-secondary btn-sm w-full">
          {busy === "check" ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Periksa jumlah
        </button>
      ) : (
        <div className="space-y-2">
          {TARGETS.map((t) => (
            <div key={t.key} className="flex items-center gap-2">
              <span className="flex-1 text-sm">{t.label}: <b className="tabular-nums privacy-safe">{counts[t.key]}</b></span>
              <button onClick={() => run(t.key)} disabled={!!busy || !counts[t.key]} className="btn-primary btn-sm">
                {busy === t.key ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Pindahkan
              </button>
            </div>
          ))}
        </div>
      )}
      {log.length > 0 && <p className="text-[11px] text-muted-foreground mt-2" aria-live="polite">{log[0]}</p>}
      {reasons.length > 0 && (
        <div className="mt-2 rounded-xl bg-muted p-2.5">
          <p className="text-[11px] font-semibold mb-1">Alasan gagal (kirimkan ke pengembang bila perlu):</p>
          <ul className="text-[11px] text-muted-foreground space-y-0.5 font-mono break-all">
            {reasons.map(([r, n]) => <li key={r}>{n}× {r}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
