import { useEffect, useState, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Users, Receipt, Landmark, TrendingUp, TrendingDown, Heart, Activity } from "lucide-react";
import { formatMoney, formatMoneyShort, formatDate } from "@/lib/finance";
import { ChipChoice } from "@/components/FormSheet";

export function lastActiveLabel(iso) {
  if (!iso) return "Belum pernah aktif";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 5) return "Online";
  if (m < 60) return `Aktif ${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Aktif ${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `Aktif ${d} hari lalu`;
  return `Aktif ${formatDate(iso, "d MMM yyyy")}`;
}

// Ringkasan admin. Nominal SELALU per mata uang — SAR tidak dijumlah sebagai IDR.
export default function AdminStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cur, setCur] = useState("IDR");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      // auto:true → backend tidak mencatat audit untuk penyegaran berkala.
      const res = await base44.functions.invoke("adminStats", { auto: silent });
      setStats(res?.data || res);
    } catch (e) {
      if (!silent) toast.error("Gagal memuat statistik", { description: e?.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 30000);
    return () => clearInterval(interval);
  }, [load]);

  const txCurs = useMemo(() => {
    const by = stats?.transactions?.by_currency;
    if (by) return Object.keys(by).sort((a, b) => (a === "IDR" ? -1 : b === "IDR" ? 1 : a.localeCompare(b)));
    return ["IDR"];
  }, [stats]);
  useEffect(() => { if (txCurs.length && !txCurs.includes(cur)) setCur(txCurs[0]); }, [txCurs, cur]);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!stats) return null;

  const { users: u = {}, transactions: tx = {}, assets: a = {}, user_breakdown = [] } = stats;
  // Kompatibel dengan respons lama (tanpa by_currency): anggap IDR.
  const txBy = tx.by_currency || { IDR: { income: tx.income || 0, expense: tx.expense || 0, sedekah: tx.sedekah || 0 } };
  const assetBy = a.by_currency || { IDR: { value: a.total_value || 0, count: a.count || 0 } };
  const t = txBy[cur] || { income: 0, expense: 0, sedekah: 0, count: 0 };
  const top = [...user_breakdown].slice(0, 6);

  return (
    <div className="space-y-5">
      {/* Aktivitas */}
      <section>
        <Heading icon={Activity} right={
          <button onClick={() => load(true)} disabled={refreshing} aria-label="Segarkan statistik"
            className="h-8 px-3 rounded-full bg-card border border-border text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> Segarkan
          </button>
        }>Aktivitas pengguna</Heading>
        <div className="grid grid-cols-3 gap-2">
          <Pastel tone="card-pastel-mint" label="Online sekarang" value={u.active_now ?? 0} />
          <Pastel tone="card-pastel-sage" label="Aktif 24 jam" value={u.active_24h ?? 0} />
          <Pastel tone="card-pastel-lime" label="Aktif 30 hari" value={u.active_30d ?? 0} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5 px-1">Dari {u.total ?? 0} pengguna terdaftar · diperbarui otomatis tiap 30 detik</p>
      </section>

      {/* Transaksi per mata uang */}
      <section>
        <Heading icon={Receipt} right={<span className="text-[11px] text-muted-foreground">{(tx.count ?? 0).toLocaleString("id-ID")} transaksi</span>}>Arus uang seluruh pengguna</Heading>
        {txCurs.length > 1 && (
          <div className="mb-2"><ChipChoice size="sm" ariaLabel="Mata uang" value={cur} onChange={setCur} options={txCurs} /></div>
        )}
        <div className="surface rounded-3xl divide-y divide-border">
          <MoneyRow icon={TrendingUp} tone="text-income bg-income/10" label="Pemasukan" value={formatMoney(t.income, cur)} />
          <MoneyRow icon={TrendingDown} tone="text-expense bg-expense/10" label="Pengeluaran" value={formatMoney(t.expense, cur)} />
          <MoneyRow icon={Heart} tone="text-sedekah bg-sedekah/10" label="Sedekah" value={formatMoney(t.sedekah, cur)} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5 px-1">Tanpa transfer antar rekening & transaksi yang belum disetujui. Tiap mata uang dihitung terpisah.</p>
      </section>

      {/* Aset per mata uang */}
      <section>
        <Heading icon={Landmark} right={<span className="text-[11px] text-muted-foreground">{(a.count ?? 0).toLocaleString("id-ID")} aset</span>}>Nilai aset tercatat</Heading>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(assetBy).sort((x, y) => (x[0] === "IDR" ? -1 : y[0] === "IDR" ? 1 : 0)).map(([c, v]) => (
            <div key={c} className="card-pastel card-pastel-butter rounded-3xl p-3.5">
              <p className="text-[11px] opacity-75">{c} · {v.count} aset</p>
              <p className="font-heading text-lg font-extrabold tabular-nums leading-tight mt-1 truncate">{formatMoneyShort(v.value, c)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Paling aktif */}
      {top.length > 0 && (
        <section>
          <Heading icon={Users}>Paling aktif mencatat</Heading>
          <ul className="surface rounded-3xl divide-y divide-border">
            {top.map((ub, i) => (
              <li key={ub.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-7 text-center font-heading font-extrabold text-muted-foreground/60 tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                    {ub.name}
                    {ub.role === "admin" && <span className="px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">Admin</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{lastActiveLabel(ub.last_active_at)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums">{ub.tx_count}</p>
                  <p className="text-[10px] text-muted-foreground">transaksi · {ub.asset_count} aset</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Heading({ icon: Icon, children, right }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2 px-1">
      <h2 className="text-sm font-semibold flex items-center gap-1.5"><Icon className="w-4 h-4 text-muted-foreground" /> {children}</h2>
      {right}
    </div>
  );
}

function Pastel({ tone, label, value }) {
  return (
    <div className={`card-pastel ${tone} rounded-3xl p-3`}>
      <p className="font-heading text-2xl font-extrabold tabular-nums leading-none">{Number(value).toLocaleString("id-ID")}</p>
      <p className="text-[11px] opacity-80 leading-tight mt-1.5">{label}</p>
    </div>
  );
}

function MoneyRow({ icon: Icon, tone, label, value }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-4 h-4" /></span>
      <span className="flex-1 text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-bold tabular-nums">{value}</span>
    </div>
  );
}
