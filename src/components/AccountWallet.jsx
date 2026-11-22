import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ArrowRight, ChevronUp, ChevronDown, Landmark, Banknote, Plus, Users, Lock, SlidersHorizontal, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAssets, useTransactions, useCategories, useMe } from "@/hooks/useFinance";
import { maskAccount } from "@/lib/bankAccount";
import { walletAccounts, walletCandidates, accountActivity } from "@/lib/wallet";
import CardStack, { useCardStack } from "@/components/CardStack";
import Money from "@/components/Money";
import TransactionItem from "@/components/TransactionItem";
import FormSheet from "@/components/FormSheet";

// "Dompet keluarga" — tumpukan kartu rekening khas Nafkita (hijau-emas,
// motif bintang delapan). Geser ke ATAS = rekening berikutnya, ke BAWAH =
// sebelumnya (atau tombol ▲▼). Semua kartu tetap terpasang dan hanya
// posisinya yang dianimasikan — tidak ada bongkar-pasang, jadi tidak berkedip.
// Dipakai di halaman /dompet. Rekening yang tampil diatur lewat "Atur" (User.wallet_hidden_ids).

const TONES = [
  ["168 62% 15%", "160 55% 23%"],
  ["192 55% 15%", "184 45% 24%"],
  ["78 32% 15%", "70 28% 24%"],
  ["24 38% 15%", "30 34% 23%"],
  ["232 32% 18%", "222 28% 27%"],
];
// Warna kartu tetap per rekening: urut tanggal dibuat dari semua rekening
// kandidat — tidak bergeser saat rekening disembunyikan atau saldo berubah.
export const toneMap = (list) => Object.fromEntries(
  [...list].sort((a, b) => String(a.created_date || a.id).localeCompare(String(b.created_date || b.id))).map((a, i) => [a.id, i]),
);
const cardBg = (i) => {
  const [a, b] = TONES[i % TONES.length];
  return `radial-gradient(80% 60% at 100% 0%, hsl(var(--gold) / 0.20), transparent 60%), linear-gradient(155deg, hsl(${a}), hsl(${b}))`;
};
const STORE_KEY = "nafkita.wallet.selected";
const readSaved = () => { try { return localStorage.getItem(STORE_KEY); } catch { return null; } };
export const saveSelected = (id) => { try { localStorage.setItem(STORE_KEY, id); } catch { /* penyimpanan diblokir */ } };

function StarPattern({ id }) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
      <defs>
        <pattern id={id} width="34" height="34" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="white" strokeOpacity="0.07" strokeWidth="1">
            <rect x="9" y="9" width="16" height="16" />
            <rect x="9" y="9" width="16" height="16" transform="rotate(45 17 17)" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export function WalletCard({ account, meId, tone }) {
  const Icon = account.type === "tunai" ? Banknote : Landmark;
  const cur = (account.currency || "IDR").toUpperCase();
  const mine = account.created_by_id === meId;
  const subtitle = [account.broker, maskAccount(account.account_number)].filter(Boolean).join(" · ") || (account.type === "tunai" ? "Uang tunai" : "Rekening");
  return (
    <div className="absolute inset-0 rounded-[26px] overflow-hidden p-5 text-[hsl(var(--hero-foreground))]" style={{ background: cardBg(tone) }}>
      <StarPattern id={`nk-star-${account.id}`} />
      <div className="absolute left-5 right-5 top-0 h-[3px] rounded-b-full bg-gold/80" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0"><Icon className="w-[18px] h-[18px]" /></span>
          <div className="min-w-0">
            <p className="font-heading font-bold text-[16px] leading-tight truncate">{account.name}</p>
            <p className="text-[11px] opacity-65 truncate">{subtitle}</p>
          </div>
        </div>
        <span className="text-[11px] font-bold tracking-widest rounded-full px-2.5 py-1 border border-gold/50 text-gold shrink-0">{cur}</span>
      </div>
      {/* Isi selalu dirender (juga di kartu belakang) agar tidak ada konten yang muncul-hilang saat berpindah */}
      <>
          <div className="relative mt-5">
            <p className="text-[11px] opacity-65">Saldo</p>
            <p className="font-heading text-[30px] leading-[1.1] font-extrabold tracking-tight tabular-nums break-words">
              <Money value={account.value || 0} currency={cur} />
            </p>
          </div>
          <div className="absolute left-5 right-5 bottom-3.5 flex items-center justify-between text-[11px] opacity-70">
            <span className="inline-flex items-center gap-1">
              {account.visibility === "private" ? <><Lock className="w-3 h-3" /> Pribadi</> : mine ? <><Users className="w-3 h-3" /> Bersama</> : <><Users className="w-3 h-3" /> Milik pasangan</>}
            </span>
            <span className="font-heading font-bold tracking-wide opacity-80">NAFKITA</span>
          </div>
      </>
    </div>
  );
}

export default function AccountWallet({ scope = "shared", recent = 5 }) {
  const { data: me } = useMe();
  const { data: assets = [], isLoading } = useAssets();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const hiddenIds = useMemo(() => (Array.isArray(me?.wallet_hidden_ids) ? me.wallet_hidden_ids : []), [me?.wallet_hidden_ids]);
  const candidates = useMemo(() => walletCandidates(assets, { scope, meId: me?.id }), [assets, scope, me?.id]);
  const tones = useMemo(() => toneMap(candidates), [candidates]);
  const accounts = useMemo(() => walletAccounts(assets, { scope, meId: me?.id, hiddenIds }), [assets, scope, me?.id, hiddenIds]);
  const [selectedId, setSelectedId] = useState(readSaved);

  const stack = useCardStack(accounts, selectedId, setSelectedId);
  const { n, idx, current, go } = stack;

  useEffect(() => { if (current?.id) saveSelected(current.id); }, [current?.id]);
  const activity = useMemo(() => (current ? accountActivity(transactions, current.id, { recent }) : null), [transactions, current, recent]);

  if (isLoading) return null;

  const header = (
    <div className="flex items-end justify-between gap-2 mb-2.5">
      <div className="min-w-0">
        <h2 id="dompet-title" className="font-semibold text-[17px] leading-tight">{n > 1 ? `${n} rekening` : "Rekening"}</h2>
        <p className="text-xs text-muted-foreground truncate">{n > 1 ? "Geser kartu ke atas untuk ganti" : "Bank & uang tunai"}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {n > 1 && (
          <div className="flex items-center gap-0.5 rounded-full border border-border bg-card pl-2.5 pr-1 h-8">
            <span className="text-xs font-semibold tabular-nums mr-0.5" aria-live="polite">{idx + 1}<span className="text-muted-foreground">/{n}</span></span>
            <button type="button" onClick={() => go(-1)} aria-label="Rekening sebelumnya" className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted"><ChevronUp className="w-4 h-4" /></button>
            <button type="button" onClick={() => go(1)} aria-label="Rekening berikutnya" className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted"><ChevronDown className="w-4 h-4" /></button>
          </div>
        )}
        {candidates.length > 0 && (
          <button type="button" onClick={() => setSettingsOpen(true)} className="h-8 px-3 rounded-full border border-border bg-card text-xs font-semibold inline-flex items-center gap-1 hover:bg-muted" aria-label="Atur rekening yang tampil di Dompet">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Atur
          </button>
        )}
      </div>
    </div>
  );

  const sheet = settingsOpen && (
    <WalletSettingsSheet candidates={candidates} tones={tones} hiddenIds={hiddenIds} meId={me?.id} onClose={() => setSettingsOpen(false)} />
  );

  if (!n) {
    return (
      <section className="mb-6" aria-labelledby="dompet-title">
        {header}
        {candidates.length ? (
          <button type="button" onClick={() => setSettingsOpen(true)} className="w-full surface rounded-3xl p-4 text-left text-sm">
            <span className="font-semibold block">Semua rekening disembunyikan</span>
            <span className="text-xs text-muted-foreground">Ketuk untuk memilih rekening yang tampil di Dompet.</span>
          </button>
        ) : (
          <Link to="/aset" className="surface rounded-3xl p-4 flex items-center gap-3 active:scale-[0.99] transition-transform">
            <span className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0"><Plus className="w-5 h-5" /></span>
            <span className="text-sm">
              <span className="font-semibold block">{scope === "private" ? "Belum ada rekening pribadi" : "Belum ada rekening"}</span>
              <span className="text-xs text-muted-foreground">Tambahkan rekening bank atau uang tunai — tiap rekening jadi satu kartu.</span>
            </span>
          </Link>
        )}
        {sheet}
      </section>
    );
  }

  const mine = current.created_by_id === me?.id;
  const cur = (current.currency || "IDR").toUpperCase();

  return (
    <section className="mb-6" aria-labelledby="dompet-title">
      {header}

      {/* Lapisan gestur: geser vertikal di atas tumpukan kartu */}
      <CardStack
        stack={stack}
        items={accounts}
        ariaLabel={`${current.name}, kartu ${idx + 1} dari ${n}`}
        renderCard={(a) => <WalletCard account={a} meId={me?.id} tone={tones[a.id] ?? 0} />}
      />

      {mine ? (
        <div className="grid grid-cols-3 gap-2 mt-3.5">
          <Link to={`/add?type=income&asset=${current.id}`} className="btn-secondary btn-sm"><ArrowDownLeft className="w-4 h-4 text-income" /> Masuk</Link>
          <Link to={`/add?type=expense&asset=${current.id}`} className="btn-primary btn-sm"><ArrowUpRight className="w-4 h-4" /> Keluar</Link>
          <Link to="/transfer" className="btn-secondary btn-sm"><ArrowLeftRight className="w-4 h-4" /> Transfer</Link>
        </div>
      ) : (
        <Link to={`/aset/${current.id}`} className="btn-secondary btn-sm w-full mt-3.5">Lihat rekening pasangan <ArrowRight className="w-4 h-4" /></Link>
      )}

      {activity && (
        <div className="surface mt-3.5" aria-live="polite">
          <div className="flex items-center gap-3 px-4 pt-3.5 pb-3 border-b border-border">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground">Bulan ini di {current.name}</p>
              <p className="text-sm font-semibold tabular-nums flex flex-wrap gap-x-3">
                <span className="text-income inline-flex items-center gap-0.5"><ArrowDownLeft className="w-3.5 h-3.5" /><Money value={activity.masuk} currency={cur} format="short" /></span>
                <span className="text-expense inline-flex items-center gap-0.5"><ArrowUpRight className="w-3.5 h-3.5" /><Money value={activity.keluar} currency={cur} format="short" /></span>
              </p>
            </div>
            <Link to={`/aset/${current.id}`} className="text-xs font-medium text-primary inline-flex items-center gap-1 shrink-0">Riwayat <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {activity.recent.length ? (
            <div className="px-4">
              {activity.recent.map((t) => <TransactionItem key={t.id} tx={t} categories={categories} />)}
            </div>
          ) : (
            <p className="px-4 py-3.5 text-xs text-muted-foreground">
              Belum ada transaksi di {current.name}.{mine ? " Catat lewat tombol Masuk/Keluar agar saldonya ikut bergerak." : ""}
            </p>
          )}
        </div>
      )}
      {sheet}
    </section>
  );
}

// Pilih rekening yang tampil di halaman Dompet. Disimpan di profil (ikut di semua
// perangkat). Yang disimpan adalah yang DISEMBUNYIKAN, jadi rekening baru
// otomatis tampil.
function WalletSettingsSheet({ candidates, tones, hiddenIds, meId, onClose }) {
  const qc = useQueryClient();
  const [hidden, setHidden] = useState(() => new Set(hiddenIds));
  const [saving, setSaving] = useState(false);
  const toggle = (id) => setHidden((h) => { const next = new Set(h); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const shownCount = candidates.filter((a) => !hidden.has(a.id)).length;

  const save = async () => {
    setSaving(true);
    // Pertahankan ID tersembunyi dari cakupan lain (Bersama/Pribadi) yang tidak ada di daftar ini.
    const inList = new Set(candidates.map((a) => a.id));
    const next = [...hiddenIds.filter((id) => !inList.has(id)), ...[...hidden].filter((id) => inList.has(id))];
    try {
      await base44.auth.updateMe({ wallet_hidden_ids: next });
      qc.setQueryData(["me"], (m) => (m ? { ...m, wallet_hidden_ids: next } : m));
      toast.success("Dompet diperbarui");
      onClose();
    } catch (e) {
      toast.error("Gagal menyimpan", { description: e?.message });
      setSaving(false);
    }
  };

  return (
    <FormSheet title="Atur dompet" subtitle="Pilih rekening yang tampil sebagai kartu" onClose={onClose}
      footer={<button type="button" className="btn-primary w-full" disabled={saving} onClick={save}>{saving ? "Menyimpan…" : `Simpan · ${shownCount} tampil`}</button>}>
      <ul className="surface rounded-3xl divide-y divide-border" aria-label="Rekening">
        {candidates.map((a) => {
          const on = !hidden.has(a.id);
          return (
            <li key={a.id}>
              <button type="button" role="switch" aria-checked={on} onClick={() => toggle(a.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                <span className="w-9 h-9 rounded-xl shrink-0" style={{ background: cardBg(tones[a.id] ?? 0) }} aria-hidden="true" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold truncate">{a.name}</span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {(a.currency || "IDR").toUpperCase()}{a.created_by_id !== meId ? " · milik pasangan" : ""}{a.visibility === "private" ? " · pribadi" : ""}
                  </span>
                </span>
                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${on ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                  {on && <Check className="w-3.5 h-3.5" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">Rekening yang disembunyikan tetap ada di halaman Aset dan saldonya tetap dihitung. Rekening baru otomatis tampil. Untuk menghapus rekening: buka Riwayat rekening → ikon pensil → tombol hapus.</p>
    </FormSheet>
  );
}
