import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTransactions, useAssets, useCategories } from "@/hooks/useFinance";
import { formatDate, colorMap } from "@/lib/finance";
import Money from "@/components/Money";
import CategoryIcon from "@/components/CategoryIcon";
import EmptyState from "@/components/EmptyState";
import { AlertTriangle, Tag, TrendingDown, Clock, CheckCircle2, Loader2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";

const STALE_DAYS = 90;

export default function DataHealth() {
  const navigate = useNavigate();
  const { data: transactions = [], isLoading: txLoading } = useTransactions();
  const { data: assets = [], isLoading: assetLoading } = useAssets();
  const { data: categories = [] } = useCategories();

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

    return { noCategory, negativeAssets, staleAssets };
  }, [transactions, assets]);

  const totalIssues = issues.noCategory.length + issues.negativeAssets.length + issues.staleAssets.length;
  const isHealthy = totalIssues === 0;
  const loading = txLoading || assetLoading;

  return (
    <div className="px-5 pt-6">
      <PageHeader title="Kesehatan Data" subtitle="Deteksi masalah data keuangan Anda" back />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Status Banner */}
          <div className={`rounded-2xl border p-4 mb-4 ${isHealthy ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10"}`}>
            <div className="flex items-center gap-3">
              {isHealthy ? (
                <CheckCircle2 className="w-8 h-8 text-success shrink-0" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-warning shrink-0" />
              )}
              <div>
                <p className="font-semibold text-sm">
                  {isHealthy ? "Data Anda Sehat!" : `${totalIssues} masalah ditemukan`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isHealthy
                    ? "Tidak ada masalah pada transaksi dan aset Anda."
                    : "Perbaiki masalah di bawah untuk menjaga akurasi laporan."}
                </p>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            <SummaryCard icon={Tag} count={issues.noCategory.length} label="Tanpa Kategori" color="orange" />
            <SummaryCard icon={TrendingDown} count={issues.negativeAssets.length} label="Saldo Negatif" color="red" />
            <SummaryCard icon={Clock} count={issues.staleAssets.length} label="Aset Stale" color="amber" />
          </div>

          {/* Transaksi tanpa kategori */}
          {issues.noCategory.length > 0 && (
            <IssueSection
              icon={Tag}
              title="Transaksi Tanpa Kategori"
              subtitle={`${issues.noCategory.length} transaksi belum dikategorisasi`}
              color="orange"
            >
              {issues.noCategory.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                  <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
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
                    className="text-xs text-primary font-medium px-2 py-1 rounded-lg bg-primary/10 shrink-0"
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
              color="red"
            >
              {issues.negativeAssets.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                  <div className="w-9 h-9 rounded-xl bg-destructive/15 flex items-center justify-center shrink-0">
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
              color="amber"
            >
              {issues.staleAssets.map((a) => {
                const lastUpdate = new Date(a.updated_date || a.created_date);
                const daysAgo = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                    <div className="w-9 h-9 rounded-xl bg-warning/15 flex items-center justify-center shrink-0">
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
            <EmptyState
              icon={CheckCircle2}
              title="Semua data bersih"
              subtitle="Tidak ada transaksi tanpa kategori, saldo negatif, atau aset yang belum diperbarui."
            />
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, count, label, color }) {
  const cm = colorMap[color] || colorMap.slate;
  return (
    <div className="surface p-3 text-center">
      <div className={`w-9 h-9 rounded-xl ${cm.bg} flex items-center justify-center mx-auto mb-1.5`}>
        <Icon className={`w-4 h-4 ${cm.text}`} />
      </div>
      <p className="text-xl font-bold tabular-nums">{count}</p>
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}

function IssueSection({ icon: Icon, title, subtitle, color, children }) {
  const cm = colorMap[color] || colorMap.slate;
  return (
    <div className="surface p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg ${cm.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${cm.text}`} />
        </div>
        <div>
          <h2 className="font-semibold text-sm">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}