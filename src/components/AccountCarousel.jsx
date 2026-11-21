import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Landmark, Banknote, Plus, Users } from "lucide-react";
import { useAssets, useTransactions, useCategories, useMe } from "@/hooks/useFinance";
import { isMoneyAsset } from "@/lib/finance";
import { maskAccount } from "@/lib/bankAccount";
import Money from "@/components/Money";
import TransactionItem from "@/components/TransactionItem";

// "Rekening kita": kartu rekening bank/tunai yang bisa digeser. Kartu yang
// sedang tampil menentukan panel "Aktivitas" di bawahnya (masuk/keluar bulan
// ini + transaksi terakhir rekening itu). Saldo = Asset.value, transaksi =
// linked_asset_id — sumber data yang sama dengan halaman Aset (tidak ada
// hitungan baru).

// Aksen pita atas per kartu, agar rekening mudah dibedakan saat digeser.
const BANDS = ["--pastel-lime", "--pastel-butter", "--pastel-mint", "--pastel-peach", "--pastel-sage"];

const isApproved = (t) => !t.approval_status || t.approval_status === "approved";

export default function AccountCarousel({ scope = "shared" }) {
  const { data: me } = useMe();
  const { data: assets = [], isLoading } = useAssets();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const [active, setActive] = useState(0);
  const track = useRef(null);

  const accounts = useMemo(() => assets
    .filter(isMoneyAsset)
    .filter((a) => (scope === "private"
      ? a.visibility === "private" && a.created_by_id === me?.id
      : a.visibility !== "private"))
    // Milik sendiri dulu, lalu saldo terbesar.
    .sort((a, b) => (a.created_by_id === me?.id ? 0 : 1) - (b.created_by_id === me?.id ? 0 : 1) || (b.value || 0) - (a.value || 0)),
  [assets, scope, me?.id]);

  const idx = Math.min(active, Math.max(accounts.length - 1, 0));
  const current = accounts[idx];

  const activity = useMemo(() => {
    if (!current) return null;
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const linked = transactions.filter((t) => t.linked_asset_id === current.id && isApproved(t));
    let masuk = 0, keluar = 0;
    for (const t of linked) {
      if (!String(t.date || "").startsWith(monthKey)) continue;
      if (t.type === "income") masuk += Number(t.amount) || 0;
      else keluar += Number(t.amount) || 0;
    }
    return { masuk, keluar, recent: linked.slice(0, 3) };
  }, [current, transactions]);

  // Indeks kartu aktif dari posisi gulir (lebar kartu + jarak antar kartu).
  const onScroll = () => {
    const el = track.current;
    const card = el?.firstElementChild;
    if (!el || !card) return;
    const step = card.getBoundingClientRect().width + 12;
    const i = Math.round(el.scrollLeft / step);
    if (i !== active) setActive(i);
  };
  const goTo = (i) => {
    const el = track.current;
    const card = el?.children?.[i];
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.firstElementChild.offsetLeft, behavior: "smooth" });
  };

  if (isLoading) return null;

  if (!accounts.length) {
    return (
      <section className="mb-6" aria-labelledby="rekening-title">
        <h2 id="rekening-title" className="font-semibold text-[17px] leading-tight mb-2.5">Rekening kita</h2>
        <Link to="/aset" className="surface rounded-3xl p-4 flex items-center gap-3 active:scale-[0.99] transition-transform">
          <span className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0"><Plus className="w-5 h-5" /></span>
          <span className="text-sm">
            <span className="font-semibold block">{scope === "private" ? "Belum ada rekening pribadi" : "Tambahkan rekening bank atau dompet tunai"}</span>
            <span className="text-xs text-muted-foreground">Saldo tiap rekening tampil sebagai kartu di sini.</span>
          </span>
        </Link>
      </section>
    );
  }

  const isMine = current?.created_by_id === me?.id;

  return (
    <section className="mb-6" aria-labelledby="rekening-title">
      <div className="flex items-end justify-between mb-2.5">
        <div>
          <h2 id="rekening-title" className="font-semibold text-[17px] leading-tight">Rekening kita</h2>
          <p className="text-xs text-muted-foreground">Geser untuk melihat tiap rekening</p>
        </div>
        <Link to="/aset" className="text-xs font-medium text-primary">Kelola</Link>
      </div>

      <div
        ref={track}
        onScroll={onScroll}
        className="-mx-5 px-5 flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1"
        role="group"
        aria-roledescription="carousel"
        aria-label="Daftar rekening"
      >
        {accounts.map((a, i) => {
          const Icon = a.type === "tunai" ? Banknote : Landmark;
          const mine = a.created_by_id === me?.id;
          const masked = maskAccount(a.account_number);
          return (
            <article
              key={a.id}
              aria-label={`${a.name}${i === idx ? " (ditampilkan)" : ""}`}
              className="card-gradient-primary snap-center shrink-0 w-[86%] max-w-[340px] rounded-[26px] overflow-hidden relative"
            >
              <div className="h-1.5" style={{ background: `hsl(var(${BANDS[i % BANDS.length]}))` }} aria-hidden="true" />
              <div className="p-4 pb-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></span>
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight truncate">{a.name}</p>
                      <p className="text-[11px] opacity-70 truncate">{[a.broker, masked].filter(Boolean).join(" · ") || (a.type === "tunai" ? "Uang tunai" : "Rekening")}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold tracking-wider rounded-full px-2 py-1 bg-white/10 shrink-0">{(a.currency || "IDR").toUpperCase()}</span>
                </div>

                <p className="text-[11px] opacity-70 mt-4">Saldo</p>
                <p className="font-heading text-[28px] leading-[1.1] font-extrabold tabular-nums">
                  <Money value={a.value || 0} currency={a.currency || "IDR"} />
                </p>
                {!mine && <p className="text-[11px] opacity-70 mt-0.5 inline-flex items-center gap-1"><Users className="w-3 h-3" /> Rekening pasangan</p>}

                {mine ? (
                  <div className="mt-3.5 grid grid-cols-2 gap-2">
                    <Link to={`/add?type=income&asset=${a.id}`} className="h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 inline-flex items-center justify-center gap-1.5 text-sm font-semibold">
                      <ArrowDownLeft className="w-4 h-4" /> Masuk
                    </Link>
                    <Link to={`/add?type=expense&asset=${a.id}`} className="h-10 rounded-xl bg-gold text-gold-foreground inline-flex items-center justify-center gap-1.5 text-sm font-semibold">
                      <ArrowUpRight className="w-4 h-4" /> Keluar
                    </Link>
                  </div>
                ) : (
                  <Link to={`/aset/${a.id}`} className="mt-3.5 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center gap-1.5 text-sm font-semibold">
                    Lihat rekening <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {accounts.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2.5" role="tablist" aria-label="Pilih rekening">
          {accounts.map((a, i) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={a.name}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-primary" : "w-1.5 bg-border"}`}
            />
          ))}
        </div>
      )}

      {current && activity && (
        <div className="mt-4" aria-live="polite">
          <div className="flex items-end justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground truncate">Aktivitas bulan ini · {current.name}</p>
            <Link to={`/aset/${current.id}`} className="text-xs font-medium text-primary inline-flex items-center gap-1 shrink-0">Detail <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="surface rounded-2xl p-3">
              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><ArrowDownLeft className="w-3 h-3 text-income" /> Masuk</p>
              <p className="font-heading font-bold tabular-nums text-income"><Money value={activity.masuk} currency={current.currency || "IDR"} /></p>
            </div>
            <div className="surface rounded-2xl p-3">
              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-expense" /> Keluar</p>
              <p className="font-heading font-bold tabular-nums text-expense"><Money value={activity.keluar} currency={current.currency || "IDR"} /></p>
            </div>
          </div>
          {activity.recent.length > 0 ? (
            <div className="surface px-4 mt-2.5">
              {activity.recent.map((t) => <TransactionItem key={t.id} tx={t} categories={categories} />)}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-2.5">
              Belum ada transaksi yang terhubung ke rekening ini.{isMine ? " Pilih rekening saat mencatat agar saldonya ikut bergerak." : ""}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
