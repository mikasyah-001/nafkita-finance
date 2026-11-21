import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ArrowRight, ChevronUp, ChevronDown, Landmark, Banknote, Plus, Users, Lock } from "lucide-react";
import { useAssets, useTransactions, useCategories, useMe } from "@/hooks/useFinance";
import { maskAccount } from "@/lib/bankAccount";
import { walletAccounts, accountActivity, wrapIndex } from "@/lib/wallet";
import Money from "@/components/Money";
import TransactionItem from "@/components/TransactionItem";

// "Dompet keluarga" — tumpukan kartu rekening khas Nafkita: kartu hijau-emas
// bermotif bintang delapan, saldo langsung di kartu. Geser kartu ke ATAS
// untuk rekening berikutnya, ke BAWAH untuk sebelumnya (atau tombol ▲▼).
// Tombol catat & transaksi di bawah tumpukan mengikuti kartu terdepan.

// Nuansa kartu: semua gelap & hangat agar teks terang selalu terbaca, dibedakan
// oleh warna dasarnya (hutan, laut, zaitun, kurma, malam).
const TONES = [
  ["168 62% 15%", "160 55% 23%"],
  ["192 55% 15%", "184 45% 24%"],
  ["78 32% 15%", "70 28% 24%"],
  ["24 38% 15%", "30 34% 23%"],
  ["232 32% 18%", "222 28% 27%"],
];
const cardBg = (i) => {
  const [a, b] = TONES[i % TONES.length];
  return `radial-gradient(80% 60% at 100% 0%, hsl(var(--gold) / 0.20), transparent 60%), linear-gradient(155deg, hsl(${a}), hsl(${b}))`;
};
const STORE_KEY = "nafkita.wallet.selected";
const SWIPE_PX = 36;
const CARD_H = 176;

const readSaved = () => { try { return localStorage.getItem(STORE_KEY); } catch { return null; } };
const saveSelected = (id) => { try { localStorage.setItem(STORE_KEY, id); } catch { /* penyimpanan diblokir */ } };

// Motif bintang delapan (dua persegi berputar 45°) — ornamen halus khas Nafkita.
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

export default function AccountWallet({ scope = "shared" }) {
  const { data: me } = useMe();
  const { data: assets = [], isLoading } = useAssets();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();

  const accounts = useMemo(() => walletAccounts(assets, { scope, meId: me?.id }), [assets, scope, me?.id]);
  const [selectedId, setSelectedId] = useState(readSaved);
  const [dir, setDir] = useState(1);

  const found = accounts.findIndex((a) => a.id === selectedId);
  const idx = found >= 0 ? found : 0;
  const current = accounts[idx];
  const n = accounts.length;

  useEffect(() => { if (current?.id) saveSelected(current.id); }, [current?.id]);
  const activity = useMemo(() => (current ? accountActivity(transactions, current.id) : null), [transactions, current]);

  const go = (step) => {
    if (n < 2) return;
    setDir(step > 0 ? 1 : -1);
    setSelectedId(accounts[wrapIndex(idx + step, n)].id);
  };

  if (isLoading) return null;

  if (!n) {
    return (
      <Link to="/aset" className="surface rounded-3xl p-4 mb-6 flex items-center gap-3 active:scale-[0.99] transition-transform">
        <span className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0"><Plus className="w-5 h-5" /></span>
        <span className="text-sm">
          <span className="font-semibold block">{scope === "private" ? "Belum ada rekening pribadi" : "Isi dompet keluarga"}</span>
          <span className="text-xs text-muted-foreground">Tambahkan rekening bank atau uang tunai — tiap rekening jadi satu kartu.</span>
        </span>
      </Link>
    );
  }

  const mine = current.created_by_id === me?.id;
  const cur = (current.currency || "IDR").toUpperCase();
  const Icon = current.type === "tunai" ? Banknote : Landmark;
  const subtitle = [current.broker, maskAccount(current.account_number)].filter(Boolean).join(" · ") || (current.type === "tunai" ? "Uang tunai" : "Rekening");
  const behind = [1, 2].filter((k) => k < n);

  return (
    <section className="mb-6" aria-labelledby="dompet-title">
      <div className="flex items-end justify-between mb-2.5">
        <div>
          <h2 id="dompet-title" className="font-semibold text-[17px] leading-tight">Dompet keluarga</h2>
          <p className="text-xs text-muted-foreground">{n > 1 ? "Geser kartu ke atas untuk rekening berikutnya" : "Saldo rekening Anda"}</p>
        </div>
        {n > 1 && (
          <div className="flex items-center gap-1 rounded-full border border-border bg-card pl-2.5 pr-1 h-8">
            <span className="text-xs font-semibold tabular-nums" aria-live="polite">{idx + 1}<span className="text-muted-foreground">/{n}</span></span>
            <button type="button" onClick={() => go(-1)} aria-label="Rekening sebelumnya" className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted"><ChevronUp className="w-4 h-4" /></button>
            <button type="button" onClick={() => go(1)} aria-label="Rekening berikutnya" className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted"><ChevronDown className="w-4 h-4" /></button>
          </div>
        )}
      </div>

      {/* Tumpukan: kartu berikutnya mengintip di BAWAH kartu terdepan */}
      <div className="relative" style={{ height: CARD_H + behind.length * 9 }}>
        {behind.slice().reverse().map((k) => (
          <div
            key={k}
            aria-hidden="true"
            className="absolute inset-x-0 rounded-[26px]"
            style={{
              top: k * 9, height: CARD_H, background: cardBg(idx + k),
              transform: `scale(${1 - k * 0.045})`, transformOrigin: "bottom center",
              opacity: 1 - k * 0.2,
            }}
          />
        ))}

        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.article
            key={current.id}
            custom={dir}
            variants={{
              enter: (d) => (d > 0 ? { y: 18, scale: 0.955, opacity: 0.6 } : { y: -26, scale: 1.03, opacity: 0 }),
              center: { y: 0, scale: 1, opacity: 1 },
              exit: (d) => (d > 0 ? { y: -26, opacity: 0, scale: 1.03 } : { y: 18, scale: 0.955, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            drag={n > 1 ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.3}
            onDragEnd={(_, info) => {
              if (info.offset.y < -SWIPE_PX || info.velocity.y < -400) go(1);
              else if (info.offset.y > SWIPE_PX || info.velocity.y > 400) go(-1);
            }}
            className="absolute inset-x-0 top-0 rounded-[26px] overflow-hidden p-5 select-none cursor-grab active:cursor-grabbing text-[hsl(var(--hero-foreground))] shadow-[0_18px_36px_-20px_rgba(0,0,0,0.55)]"
            style={{ height: CARD_H, background: cardBg(idx), touchAction: n > 1 ? "none" : "auto" }}
            aria-roledescription="kartu rekening"
            aria-label={`${current.name}, kartu ${idx + 1} dari ${n}`}
          >
            <StarPattern id={`nk-star-${current.id}`} />
            <div className="absolute left-5 right-5 top-0 h-[3px] rounded-b-full bg-gold/80" aria-hidden="true" />

            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0"><Icon className="w-[18px] h-[18px]" /></span>
                <div className="min-w-0">
                  <p className="font-heading font-bold text-[16px] leading-tight truncate">{current.name}</p>
                  <p className="text-[11px] opacity-65 truncate">{subtitle}</p>
                </div>
              </div>
              <span className="text-[11px] font-bold tracking-widest rounded-full px-2.5 py-1 border border-gold/50 text-gold shrink-0">{cur}</span>
            </div>

            <div className="relative mt-5">
              <p className="text-[11px] opacity-65">Saldo</p>
              <p className="font-heading text-[30px] leading-[1.1] font-extrabold tracking-tight tabular-nums break-words">
                <Money value={current.value || 0} currency={cur} />
              </p>
            </div>

            <div className="absolute left-5 right-5 bottom-3.5 flex items-center justify-between text-[11px] opacity-70">
              <span className="inline-flex items-center gap-1">
                {current.visibility === "private" ? <><Lock className="w-3 h-3" /> Pribadi</> : mine ? <><Users className="w-3 h-3" /> Bersama</> : <><Users className="w-3 h-3" /> Milik pasangan</>}
              </span>
              <span className="font-heading font-bold tracking-wide opacity-80">NAFKITA</span>
            </div>
          </motion.article>
        </AnimatePresence>
      </div>

      {/* Aksi untuk kartu terdepan */}
      {mine ? (
        <div className="grid grid-cols-3 gap-2 mt-3.5">
          <Link to={`/add?type=income&asset=${current.id}`} className="btn-secondary btn-sm"><ArrowDownLeft className="w-4 h-4 text-income" /> Masuk</Link>
          <Link to={`/add?type=expense&asset=${current.id}`} className="btn-primary btn-sm"><ArrowUpRight className="w-4 h-4" /> Keluar</Link>
          <Link to="/transfer" className="btn-secondary btn-sm"><ArrowLeftRight className="w-4 h-4" /> Transfer</Link>
        </div>
      ) : (
        <Link to={`/aset/${current.id}`} className="btn-secondary btn-sm w-full mt-3.5">Lihat rekening pasangan <ArrowRight className="w-4 h-4" /></Link>
      )}

      {/* Aktivitas rekening terdepan: ringkasan + 3 transaksi dalam satu kartu */}
      {activity && (
        <div className="surface mt-3.5" aria-live="polite">
          <div className="flex items-center gap-3 px-4 pt-3.5 pb-3 border-b border-border">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground">Bulan ini</p>
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
    </section>
  );
}
