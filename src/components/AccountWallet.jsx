import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ArrowRight, Eye, EyeOff, Plus, ChevronUp, Users } from "lucide-react";
import { useAssets, useTransactions, useCategories, useMe } from "@/hooks/useFinance";
import { usePrivacy } from "@/lib/PrivacyContext";
import { maskAccount } from "@/lib/bankAccount";
import { walletAccounts, accountActivity, wrapIndex } from "@/lib/wallet";
import Money from "@/components/Money";
import TransactionItem from "@/components/TransactionItem";

// "Dompet": kartu rekening menyembul dari saku. Geser kartu ke ATAS untuk
// rekening berikutnya, ke BAWAH untuk sebelumnya (juga bisa ketuk titik atau
// tombol panah). Saldo, tombol catat, dan aktivitas di bawahnya mengikuti
// kartu yang sedang tampil.

// Warna kartu tetap terang di mode gelap — kartu adalah "benda fisik".
const TONES = [
  { bg: "linear-gradient(160deg, hsl(82 52% 76%), hsl(90 40% 66%))", ink: "hsl(150 40% 12%)" },
  { bg: "linear-gradient(160deg, hsl(200 38% 76%), hsl(205 32% 64%))", ink: "hsl(210 40% 14%)" },
  { bg: "linear-gradient(160deg, hsl(268 38% 82%), hsl(262 30% 70%))", ink: "hsl(265 35% 18%)" },
  { bg: "linear-gradient(160deg, hsl(44 85% 78%), hsl(38 70% 66%))", ink: "hsl(30 45% 14%)" },
  { bg: "linear-gradient(160deg, hsl(18 72% 82%), hsl(12 55% 70%))", ink: "hsl(10 40% 16%)" },
  { bg: "linear-gradient(160deg, hsl(160 38% 76%), hsl(168 32% 62%))", ink: "hsl(168 45% 12%)" },
];
const tone = (i) => TONES[i % TONES.length];
const POCKET = "hsl(var(--hero-from))";
const STORE_KEY = "nafkita.wallet.selected";
const SWIPE_PX = 36;

const readSaved = () => { try { return localStorage.getItem(STORE_KEY); } catch { return null; } };
const saveSelected = (id) => { try { localStorage.setItem(STORE_KEY, id); } catch { /* penyimpanan diblokir */ } };

export default function AccountWallet({ scope = "shared" }) {
  const { data: me } = useMe();
  const { data: assets = [], isLoading } = useAssets();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { hidden, toggle } = usePrivacy();

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
  const jump = (i) => { if (i !== idx) { setDir(i > idx ? 1 : -1); setSelectedId(accounts[i].id); } };

  if (isLoading) return null;

  if (!n) {
    return (
      <Link to="/aset" className="surface rounded-3xl p-4 mb-6 flex items-center gap-3 active:scale-[0.99] transition-transform">
        <span className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0"><Plus className="w-5 h-5" /></span>
        <span className="text-sm">
          <span className="font-semibold block">{scope === "private" ? "Belum ada rekening pribadi" : "Tambahkan rekening ke dompet"}</span>
          <span className="text-xs text-muted-foreground">Bank atau uang tunai — tiap rekening jadi satu kartu.</span>
        </span>
      </Link>
    );
  }

  const mine = current.created_by_id === me?.id;
  const cur = current.currency || "IDR";
  const subtitle = [current.broker, maskAccount(current.account_number)].filter(Boolean).join(" · ");

  return (
    <section className="mb-6" aria-label="Dompet rekening">
      {/* Kartu + saku */}
      {/* overflow-hidden: kartu yang keluar "naik" hilang di tepi atas, bukan menutupi elemen lain */}
      <div className="relative overflow-hidden" style={{ height: 112 }}>
        {/* Kartu di belakang: tepinya mengintip, memberi kesan tumpukan */}
        {n > 1 && [2, 1].filter((k) => k < n).map((k) => (
          <div
            key={k}
            aria-hidden="true"
            className="absolute inset-x-4 rounded-[22px]"
            style={{
              top: 14 - k * 7, height: 120, background: tone(idx + k).bg,
              transform: `scale(${1 - k * 0.05})`, opacity: 1 - k * 0.25,
            }}
          />
        ))}

        {/* Kartu aktif — geser vertikal */}
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={current.id}
            custom={dir}
            variants={{
              enter: (d) => ({ y: d > 0 ? 70 : -40, opacity: d > 0 ? 1 : 0, scale: 0.96 }),
              center: { y: 0, opacity: 1, scale: 1 },
              exit: (d) => ({ y: d > 0 ? -46 : 70, opacity: 0, scale: d > 0 ? 0.92 : 0.96 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            drag={n > 1 ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.35}
            onDragEnd={(_, info) => {
              if (info.offset.y < -SWIPE_PX || info.velocity.y < -400) go(1);
              else if (info.offset.y > SWIPE_PX || info.velocity.y > 400) go(-1);
            }}
            className="absolute inset-x-4 rounded-[22px] px-5 pt-4 cursor-grab active:cursor-grabbing select-none shadow-[0_-6px_18px_-10px_rgba(0,0,0,0.35)]"
            style={{ top: 14, height: 120, background: tone(idx).bg, color: tone(idx).ink, touchAction: n > 1 ? "none" : "auto" }}
            role="group"
            aria-roledescription="kartu rekening"
            aria-label={`${current.name}, kartu ${idx + 1} dari ${n}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-heading font-extrabold text-[17px] leading-tight truncate">{current.name}</p>
                {subtitle && <p className="text-[11px] font-medium opacity-70 truncate mt-0.5">{subtitle}</p>}
              </div>
              <span className="font-heading font-extrabold text-sm tracking-wide shrink-0">{cur.toUpperCase()}</span>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Tepi atas saku dengan lekukan di tengah (kartu terlihat di lekukan) */}
        <div className="absolute inset-x-0 z-10 flex pointer-events-none" style={{ top: 72, height: 40 }} aria-hidden="true">
          <div className="flex-1 rounded-tl-[28px]" style={{ background: POCKET }} />
          <svg width="150" height="40" viewBox="0 0 150 40" className="shrink-0 block">
            <path fill={POCKET} d="M0 0 H22 C34 0 38 4 43 12 L53 28 C57 35 61 38 69 38 H81 C89 38 93 35 97 28 L107 12 C112 4 116 0 128 0 H150 V40 H0 Z" />
          </svg>
          <div className="flex-1 rounded-tr-[28px]" style={{ background: POCKET }} />
        </div>
      </div>

      {/* Badan saku */}
      <div className="relative z-10 rounded-b-[28px] px-4 pb-4 -mt-px" style={{ background: POCKET, color: "hsl(var(--hero-foreground))" }}>
        <div className="flex items-center justify-center gap-1.5 pt-1 pb-3">
          {n > 1 && accounts.map((a, i) => (
            <button
              key={a.id}
              type="button"
              aria-label={`Tampilkan ${a.name}`}
              aria-pressed={i === idx}
              onClick={() => jump(i)}
              className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-[hsl(82_52%_76%)]" : "w-1.5 bg-white/25"}`}
            />
          ))}
        </div>

        <div className="rounded-2xl border border-dashed border-white/25 px-4 py-3.5 text-center relative">
          <button
            type="button"
            onClick={toggle}
            aria-label={hidden ? "Tampilkan saldo" : "Sembunyikan saldo"}
            className="mx-auto w-9 h-9 rounded-full bg-[hsl(82_52%_76%)] text-[hsl(150_40%_12%)] flex items-center justify-center"
          >
            {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <p className="font-heading text-[30px] leading-tight font-extrabold tabular-nums mt-1.5 break-words">
            <Money value={current.value || 0} currency={cur} />
          </p>
          <p className="text-[11px] opacity-65">
            {mine ? "Saldo rekening" : <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> Saldo rekening pasangan</span>}
          </p>
          {n > 1 && (
            <button type="button" onClick={() => go(1)} aria-label="Kartu berikutnya" className="absolute right-2 top-2 w-8 h-8 rounded-full text-white/60 hover:text-white flex items-center justify-center">
              <ChevronUp className="w-4 h-4" />
            </button>
          )}
        </div>

        {mine ? (
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Link to={`/add?type=income&asset=${current.id}`} className="h-11 rounded-xl bg-white/10 border border-white/10 inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold">
              <ArrowDownLeft className="w-4 h-4" /> Masuk
            </Link>
            <Link to={`/add?type=expense&asset=${current.id}`} className="h-11 rounded-xl bg-gold text-gold-foreground inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold">
              <ArrowUpRight className="w-4 h-4" /> Keluar
            </Link>
            <Link to="/transfer" className="h-11 rounded-xl bg-white/10 border border-white/10 inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold">
              <ArrowLeftRight className="w-4 h-4" /> Transfer
            </Link>
          </div>
        ) : (
          <Link to={`/aset/${current.id}`} className="mt-3 h-11 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center gap-1.5 text-[13px] font-semibold">
            Lihat rekening <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Aktivitas rekening terpilih */}
      {activity && (
        <div className="mt-4" aria-live="polite">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="surface rounded-2xl p-3">
              <p className="text-[11px] text-muted-foreground flex items-center justify-between">Masuk bulan ini <ArrowDownLeft className="w-3.5 h-3.5 text-income" /></p>
              <p className="font-heading font-bold tabular-nums mt-0.5 truncate"><Money value={activity.masuk} currency={cur} /></p>
            </div>
            <div className="surface rounded-2xl p-3">
              <p className="text-[11px] text-muted-foreground flex items-center justify-between">Keluar bulan ini <ArrowUpRight className="w-3.5 h-3.5 text-expense" /></p>
              <p className="font-heading font-bold tabular-nums mt-0.5 truncate"><Money value={activity.keluar} currency={cur} /></p>
            </div>
          </div>

          <div className="flex items-end justify-between mt-4 mb-2">
            <h2 className="font-semibold text-[15px] leading-tight truncate">Transaksi {current.name}</h2>
            <Link to={`/aset/${current.id}`} className="text-xs font-medium text-primary inline-flex items-center gap-1 shrink-0">Semua <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {activity.recent.length ? (
            <div className="surface px-4">
              {activity.recent.map((t) => <TransactionItem key={t.id} tx={t} categories={categories} />)}
            </div>
          ) : (
            <p className="surface rounded-2xl p-4 text-xs text-muted-foreground">
              Belum ada transaksi di rekening ini.{mine ? " Catat lewat tombol Masuk/Keluar di atas agar saldonya ikut bergerak." : ""}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
