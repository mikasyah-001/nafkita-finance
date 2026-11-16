import { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTransactions, useAssets, useCategories, useUserCurrencies, useRateMap, useRefresh } from "@/hooks/useFinance";
import { formatDate, assetCurrencyIssue } from "@/lib/finance";
import Money from "@/components/Money";
import CategoryIcon from "@/components/CategoryIcon";
import EmptyState from "@/components/EmptyState";
import { AlertTriangle, Tag, TrendingDown, Clock, CheckCircle2, Loader2, Coins } from "lucide-react";
import PageHeader from "@/components/PageHeader";

const STALE_DAYS = 90;

export default function DataHealth() {
  const navigate = useNavigate();
  const { data: transactions = [], isLoading: txLoading } = useTransactions();
  const { data: assets = [], isLoading: assetLoading } = useAssets();
  const { data: categories = [] } = useCategories();
  const userCurrencies = useUserCurrencies();
  const { map: rateMap } = useRateMap();
  const refresh = useRefresh();
  const [fixing, setFixing] = useState(null);
  const codes = userCurrencies.map((c) => c.code);

  const issues = useMemo(() => {
    // 1. Transaksi tanpa kategori
    const noCategory = transactions.filter(
      (t) => !t.transfer_pair_id && !t.is_adjustment && !t.category
    );

    // 2. Aset dengan saldo negatif
    const negativeAssets = assets.filter((a) => Number(a.value) < 0);

    // 3. Aset tidak diperbarui (stale)
    const staleThreshold = new Date();
    staleThreshold.setDate(staleThreshold.getDate() - STALE_DAYS);
    const staleAssets = assets.filter((a) => {
      const updated = new Date(a.updated_date || a.created_date);
      return updated < staleThreshold;
    });

    // 4. Harga emas per gram yang tidak wajar untuk mata uangnya
    //    (mis. Rupiah diketik saat mata uang aset SAR).
    const currencyMismatch = assets
      .map((a) => ({ asset: a, issue: assetCurrencyIssue(a, codes, rateMap) }))
      .filter((x) => x.issue);

    return { noCategory, negativeAssets, staleAssets, currencyMismatch };
  }, [transactions, assets, codes.join(","), rateMap]);

  // Perbaikan satu ketuk: hanya label mata uang yang diganti — angka yang
  // diketik pengguna memang dalam mata uang yang disarankan.
  const fixCurrency = async (a, to) => {
    setFixing(a.id);
    try {
      await base44.entities.Asset.update(a.id, { currency: to });
      toast.success(`${a.name} kini tercatat dalam ${to}`);
      refresh();
    } catch (e) {
      toast.error("Gagal memperbaiki", { description: e?.message });
    }
    setFixing(null);
  };

  const totalIssues = issues.noCategory.length + issues.negativeAssets.length + issues.staleAssets.length + issues.currencyMismatch.length;
  const isHealthy = totalIssues === 0;
  const loading = txLoading || assetLoading;

  return (
    <div className="px-5 pt-6">
      <PageHeader title="Kesehatan data" subtitle="Deteksi masalah data keuangan Anda" back />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Status */}
          <section aria-label="Status kesehatan data" className="card-gradient-primary rounded-[28px] p-5 mb-5">
            <div className="flex items-center gap-3">
              <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${isHealthy ? "bg-white/15" : "bg-gold text-gold-foreground"}`}>
                {isHealthy ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </span>
              <div className="min-w-0">
                <p className="font-heading text-[26px] leading-tight font-extrabold tracking-tight">
                  {isHealthy ? "Data Anda Sehat!" : `${totalIssues} masalah ditemukan`}
                </p>
                <p className="text-xs opacity-75 leading-snug">
                  {isHealthy
                    ? "Tidak ada masalah pada transaksi dan aset Anda."
                    : "Perbaiki masalah di bawah untuk menjaga akurasi laporan."}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <SummaryCard icon={Tag} count={issues.noCategory.length} label="Tanpa Kategori" />
              <SummaryCard icon={TrendingDown} count={issues.negativeAssets.length} label="Saldo Negatif" />
              <SummaryCard icon={Clock} count={issues.staleAssets.length} label="Aset Stale" />
              <SummaryCard icon={Coins} count={issues.currencyMismatch.length} label="Salah Mata Uang" />
            </div>
          </section>

          {/* Mata uang salah tafsir */}
          {issues.currencyMismatch.length > 0 && (
            <IssueSection
              icon={Coins}
              title="Mata Uang Tampak Keliru"
              subtitle="Nominal tidak wajar untuk mata uangnya — laporan & zakat jadi melenceng"
              tone="destructive"
            >
              {issues.currencyMismatch.map(({ asset: a, issue }) => (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
                      <Coins className="w-4 h-4 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.type === "emas" || a.type === "emas_digital"
                        ? <>{a.quantity} gr · beli <Money value={a.purchase_price} currency={a.currency} />/gr</>
                        : <>Nilai <Money value={a.value} currency={a.currency} /></>}</p>
                    </div>
                    <button
                      onClick={() => fixCurrency(a, issue.suggest)}
                      disabled={fixing === a.id}
                      className="h-8 px-3.5 rounded-full border border-primary bg-primary text-primary-foreground text-xs font-semibold shrink-0 active:scale-95 transition-transform disabled:opacity-60"
                    >
                      {fixing === a.id ? "Menyimpan..." : `Jadikan ${issue.suggest}`}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{issue.message}</p>
                </div>
              ))}
            </IssueSection>
          )}

          {/* Transaksi tanpa kategori */}
          {issues.noCategory.length > 0 && (
            <IssueSection
              icon={Tag}
              title="Transaksi Tanpa Kategori"
              subtitle={`${issues.noCategory.length} transaksi belum dikategorisasi`}
              tone="warning"
            >
              {issues.noCategory.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <CategoryIcon name="Wallet" className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.merchant || tx.notes || "Transaksi"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(tx.date, "dd MMM yyyy")}</p>
                  </div>
                  <div className="text-sm font-semibold whitespace-nowrap shrink-0">
                    <Money value={tx.amount} currency={tx.currency} />
                  </div>
                  <button
                    onClick={() => navigate(`/transaksi/${tx.id}`)}
                    className="h-8 px-3.5 rounded-full border border-primary bg-primary text-primary-foreground text-xs font-semibold shrink-0 active:scale-95 transition-transform"
                  >
                    Perbaiki
                  </button>
                </div>
              ))}
            </IssueSection>
          )}

          {/* Aset saldo negatif */}
          {issues.negativeAssets.length > 0 && (
            <IssueSection
              icon={TrendingDown}
              title="Aset dengan Saldo Negatif"
              subtitle={`${issues.negativeAssets.length} aset bernilai negatif`}
              tone="destructive"
            >
              {issues.negativeAssets.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
                    <CategoryIcon name="Landmark" className="w-4 h-4 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.type}</p>
                  </div>
                  <div className="text-sm font-semibold text-destructive whitespace-nowrap shrink-0">
                    <Money value={a.value} currency={a.currency} />
                  </div>
                </div>
              ))}
            </IssueSection>
          )}

          {/* Aset stale */}
          {issues.staleAssets.length > 0 && (
            <IssueSection
              icon={Clock}
              title={`Aset Tidak Diperbarui (${STALE_DAYS}+ hari)`}
              subtitle={`${issues.staleAssets.length} aset belum diperbarui dalam ${STALE_DAYS} hari`}
              tone="warning"
            >
              {issues.staleAssets.map((a) => {
                const lastUpdate = new Date(a.updated_date || a.created_date);
                const daysAgo = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-full bg-warning/15 flex items-center justify-center shrink-0">
                      <CategoryIcon name="Landmark" className="w-4 h-4 text-warning" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground">Diperbarui {daysAgo} hari lalu</p>
                    </div>
                    <div className="text-sm font-semibold whitespace-nowrap shrink-0">
                      <Money value={a.value} currency={a.currency} />
                    </div>
                  </div>
                );
              })}
            </IssueSection>
          )}

          {isHealthy && (
            <div className="surface rounded-3xl px-4 mb-4">
            <EmptyState
              icon={CheckCircle2}
              title="Semua data bersih"
              subtitle="Tidak ada transaksi tanpa kategori, saldo negatif, mata uang keliru, atau aset yang belum diperbarui."
            />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, count, label }) {
  return (
    <div className="rounded-2xl bg-white/[0.07] border border-white/10 px-2.5 py-2.5 text-center">
      <Icon className="w-4 h-4 mx-auto mb-1 opacity-75" />
      <p className="font-heading text-xl font-extrabold tabular-nums leading-none">{count}</p>
      <p className="text-[11px] opacity-75 leading-tight mt-1">{label}</p>
    </div>
  );
}

const TONES = {
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
};

function IssueSection({ icon: Icon, title, subtitle, tone, children }) {
  return (
    <section className="mb-5">
      <div className="flex items-center gap-3 mb-2.5">
        <div className={`w-8 h-8 rounded-full ${TONES[tone] || "bg-muted text-muted-foreground"} flex items-center justify-center shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-[17px] leading-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="surface rounded-3xl divide-y divide-border">{children}</div>
    </section>
  );
}
