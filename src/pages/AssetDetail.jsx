import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  Pencil, Trash2, History, ChevronRight, Lock, Users, Receipt, Maximize2, TrendingUp, TrendingDown,
  Globe, Upload, Coins, CalendarDays, Building2, UserRound, NotebookPen, Hash, Scale, ShieldCheck, Ban, Copy,
} from "lucide-react";
import { maskAccount, formatAccountNumber, normalizeAccountNumber } from "@/lib/bankAccount";
import { usePrivacy } from "@/lib/PrivacyContext";
import PageHeader from "@/components/PageHeader";
import AssetForm from "@/components/AssetForm";
import ProofViewer from "@/components/ProofViewer";
import GoldPriceCard from "@/components/GoldPriceCard";
import InvestmentDca from "@/components/InvestmentDca";
import CategoryIcon from "@/components/CategoryIcon";
import Money from "@/components/Money";
import { confirmAction } from "@/components/ConfirmHost";
import { useAssets, useMe, useRateMap, useRefresh, useInvestmentLots, useSavingsGoals } from "@/hooks/useFinance";
import { investmentCategory, CATEGORY_LABEL, emergencyAssetIds } from "@/lib/investmentCategory";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import {
  assetTypeLabels, colorMap, formatDate, formatDuration, formatMoney, formatNumber, isGoldType,
  assetMarketValue, assetGain, goldPriceIn, conversionPreview, assetDisplayName,
} from "@/lib/finance";
import { valueSourceInfo } from "@/lib/portfolioImport";
import { ZAKAT_EXCLUDED_TYPES } from "@/lib/zakat";

const UNIT = { emas: "gram", emas_digital: "gram", tanah: "m²" };

// Detail satu aset — dibuka dengan mengetuk kartu di daftar Aset.
// Semua angka memakai rumus yang sama dengan daftar (assetMarketValue/assetGain).
export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data: assets = [], isLoading } = useAssets();
  const { data: lots = [] } = useInvestmentLots(id); // sama dengan Riwayat DCA (cache bersama)
  const { data: goals = [] } = useSavingsGoals();
  const { hidden } = usePrivacy();
  const { data: me } = useMe();
  const { map: rateMap } = useRateMap();
  const { price: goldPrice } = useGoldPrice();
  const [editing, setEditing] = useState(false);
  const [viewProof, setViewProof] = useState(false);
  const [busy, setBusy] = useState(false);

  const a = assets.find((x) => x.id === id);
  if (!a) {
    return (
      <div className="px-5 pt-6">
        <PageHeader title="Detail aset" back />
        <p className="text-sm text-muted-foreground text-center py-12">{isLoading ? "Memuat…" : "Aset tidak ditemukan."}</p>
      </div>
    );
  }

  const meta = assetTypeLabels[a.type] || assetTypeLabels.lainnya;
  const cm = colorMap[meta.color] || colorMap.slate;
  const cur = (a.currency || "IDR").toUpperCase();
  const mainCur = (me?.default_currency || "IDR").toUpperCase();
  const gp = Number(goldPrice) || 0;
  const value = assetMarketValue(a, gp, rateMap);
  const g = assetGain(a, gp, rateMap);
  const gold = isGoldType(a.type);
  const unit = a.unit || UNIT[a.type] || (a.instrument === "saham" ? "lembar" : "unit");
  const qty = Number(a.quantity) || 0;
  const perUnitMarket = gold ? goldPriceIn(cur, gp, rateMap) : Number(a.last_price) || (qty ? value / qty : 0);
  const isOwner = !a.created_by_id || a.created_by_id === me?.id;
  const vs = a.type === "investasi" || a.import_source ? valueSourceInfo(a) : null;
  // Kategori investasi otomatis (ETF, saham, pasar uang, …) — sumber yang sama dengan daftar aset.
  const catLabel = a.type === "investasi" ? `Investasi · ${CATEGORY_LABEL[investmentCategory(a)]}` : "";
  const isEmergency = emergencyAssetIds(goals).has(a.id);
  const zakatCounted = !ZAKAT_EXCLUDED_TYPES.includes(a.type);
  const duration = formatDuration(a.purchase_date);
  const buyDates = a.type === "investasi"
    ? lots.filter((l) => (l.side || "buy") !== "sell").map((l) => String(l.date).slice(0, 10)).filter(Boolean).sort()
    : [];

  const setVisibility = async (next) => {
    if (busy || next === (a.visibility || "shared")) return;
    setBusy(true);
    try {
      await base44.entities.Asset.update(a.id, { visibility: next });
      refresh();
      toast.success(next === "private" ? "Aset diubah menjadi Pribadi" : "Aset diubah menjadi Bersama");
    } catch { toast.error("Gagal mengubah jangkauan"); }
    setBusy(false);
  };

  const handleDelete = async () => {
    const ok = await confirmAction({
      title: `Hapus aset "${a.name}"?`,
      description: a.type === "investasi" ? "Aset beserta seluruh Riwayat DCA-nya dihapus permanen." : "Aset dihapus permanen dan tidak bisa dikembalikan.",
    });
    if (!ok) return;
    try {
      await base44.functions.invoke("deleteAssetWithLots", { asset_id: a.id });
      refresh();
      toast.success("Aset dihapus");
      navigate("/aset", { replace: true });
    } catch { toast.error("Gagal menghapus"); }
  };

  // Rincian per jenis aset — hanya baris yang relevan & berisi.
  const rows = [
    qty > 0 && { icon: Scale, label: "Jumlah", value: `${formatNumber(qty)} ${unit}` },
    gold && a.purchase_price > 0 && { icon: Coins, label: "Harga beli /gram", value: formatMoney(a.purchase_price, cur) },
    a.type === "tanah" && a.purchase_price > 0 && { icon: Coins, label: "Harga beli /m²", value: formatMoney(a.purchase_price, cur) },
    g.cost > 0 && { icon: Receipt, label: gold || a.type === "tanah" ? "Total harga beli" : "Modal", value: formatMoney(g.cost, cur) },
    a.type === "investasi" && qty > 0 && g.cost > 0 && { icon: Coins, label: "Rata-rata beli", value: `${formatMoney(g.cost / qty, cur)}/${unit}` },
    perUnitMarket > 0 && (gold || a.type === "investasi") && { icon: TrendingUp, label: gold ? "Harga pasar /gram" : `Harga terakhir /${unit}`, value: formatMoney(perUnitMarket, cur) },
    (a.ticker || a.exchange) && { icon: Hash, label: "Kode", value: [a.ticker, a.exchange].filter(Boolean).join(" · ") },
    a.broker && { icon: Building2, label: a.type === "investasi" ? "Broker / aplikasi" : a.type === "bank" ? "Bank" : "Tempat", value: a.broker },
    a.type === "bank" && { icon: Hash, label: "No. rekening / IBAN", wide: true,
      value: a.account_number
        ? <AccountNumber number={a.account_number} masked={hidden} />
        : isOwner
          ? <button type="button" onClick={() => setEditing(true)} className="text-primary font-semibold">+ Tambahkan no. rekening</button>
          : <span className="text-muted-foreground font-normal">Belum diisi</span> },
    // Dibeli bertahap (DCA): tampilkan pertama & terakhir beli dari Riwayat DCA.
    ...(buyDates.length > 1
      ? [
          { icon: CalendarDays, label: "Pertama beli", value: `${formatDate(buyDates[0], "d MMM yyyy")}${formatDuration(buyDates[0]) ? ` · ${formatDuration(buyDates[0])}` : ""}` },
          { icon: CalendarDays, label: "Terakhir beli", value: formatDate(buyDates.at(-1), "d MMM yyyy") },
        ]
      : [a.purchase_date && { icon: CalendarDays, label: "Tanggal beli", value: `${formatDate(a.purchase_date, "d MMM yyyy")}${duration ? ` · ${duration}` : ""}` }]),
    a.owner && { icon: UserRound, label: "Pemilik", value: a.owner },
    a.notes && { icon: NotebookPen, label: "Catatan", value: a.notes, wide: true },
  ].filter(Boolean);

  return (
    <div className="px-5 pt-6 pb-4">
      <PageHeader title={assetDisplayName(a).name} subtitle={[catLabel || meta.label, assetDisplayName(a).ticker, a.broker].filter(Boolean).join(" · ")} back
        actions={<button onClick={() => setEditing(true)} aria-label="Ubah aset" className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform"><Pencil className="w-4 h-4" /></button>} />

      {/* Nilai */}
      <section aria-label="Nilai aset" className="card-gradient-primary relative rounded-[28px] p-5 overflow-hidden mb-4">
        <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full bg-white/10 pointer-events-none" aria-hidden="true" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-white/90 flex items-center justify-center"><CategoryIcon name={meta.icon} className={`w-4 h-4 ${cm.text}`} /></span>
            <span className="text-xs opacity-85">{catLabel || meta.label}</span>
            {isEmergency && <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-white/15 text-[11px] font-semibold"><ShieldCheck className="w-3 h-3" /> Dana darurat</span>}
            {a.visibility === "private" && <span className="ml-auto inline-flex items-center gap-1 h-6 px-2 rounded-full bg-white/15 text-[11px] font-semibold"><Lock className="w-3 h-3" /> Pribadi</span>}
          </div>
          <p className="text-xs opacity-80 mt-4">Nilai saat ini</p>
          <p className="font-heading text-[34px] leading-none font-extrabold tracking-tight tabular-nums mt-1 break-all"><Money value={value} currency={cur} /></p>
          {cur !== mainCur && conversionPreview(value, cur, mainCur, rateMap) && <p className="text-sm opacity-80 mt-1 tabular-nums">{conversionPreview(value, cur, mainCur, rateMap)}</p>}
          {g.available && (
            <p className="text-sm font-semibold mt-2 flex items-center gap-1 tabular-nums">
              {g.gain >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {g.gain >= 0 ? "+" : ""}{formatMoney(g.gain, cur)} ({g.gain >= 0 ? "+" : ""}{g.pct.toFixed(2)}%)
            </p>
          )}
          {/* Asal nilai: baris sendiri di pojok kanan bawah, tidak menempel ke perubahan */}
          {vs && (
            <p className="text-[11px] opacity-80 mt-3 flex items-center justify-end gap-1 text-right">
              {vs.kind === "online" ? <Globe className="w-3 h-3 shrink-0" /> : <Upload className="w-3 h-3 shrink-0" />}
              <span>{vs.label}{vs.date ? ` · ${formatDate(vs.date, "d MMM yyyy")}` : ""}</span>
            </p>
          )}
        </div>
      </section>

      {/* Emas tanpa harga acuan → langsung bisa diatur di sini */}
      {gold && g.needsGoldPrice && <GoldPriceCard grams={qty} className="mb-4" />}

      {/* Rincian */}
      {/* Rincian: grid 2 kolom padat (catatan panjang selebar penuh) */}
      {rows.length > 0 && (
        <section aria-label="Rincian" className="surface rounded-3xl p-4 mb-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {rows.map((r) => (
            <div key={r.label} className={`min-w-0 ${r.wide ? "col-span-2" : ""}`}>
              <p className="text-[11px] text-muted-foreground leading-tight">{r.label}</p>
              <p className="text-[13px] font-semibold tabular-nums leading-snug mt-0.5 break-words">{r.value}</p>
            </div>
          ))}
        </section>
      )}

      {/* Investasi: perbarui nilai + Riwayat DCA langsung di halaman ini */}
      {a.type === "investasi" && <InvestmentDca asset={a} readOnly={!isOwner} />}

      {/* Bukti pembelian */}
      {a.purchase_proof_url && (
        <section aria-label="Bukti pembelian" className="surface rounded-3xl p-3 mb-4">
          <p className="text-sm font-semibold flex items-center gap-1.5 px-1 mb-2"><Receipt className="w-4 h-4 text-muted-foreground" /> Bukti pembelian</p>
          <button type="button" onClick={() => setViewProof(true)} aria-label={`Lihat bukti pembelian ${a.name}`} className="relative block w-full rounded-2xl overflow-hidden bg-muted">
            <img src={a.purchase_proof_url} alt="Bukti pembelian" className="w-full max-h-64 object-contain" />
            <span className="absolute bottom-2 right-2 h-7 px-2.5 rounded-full bg-black/55 text-white text-[11px] font-semibold inline-flex items-center gap-1"><Maximize2 className="w-3 h-3" /> Lihat penuh</span>
          </button>
        </section>
      )}

      {/* Jangkauan, zakat, mutasi */}
      <section className="surface rounded-3xl divide-y divide-border mb-4">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="w-8 h-8 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">{a.visibility === "private" ? <Lock className="w-4 h-4" /> : <Users className="w-4 h-4" />}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground">Jangkauan</p>
            <p className="text-sm font-medium">{a.visibility === "private" ? "Pribadi, hanya Anda" : "Bersama keluarga"}</p>
          </div>
          {isOwner && (
            <div role="radiogroup" aria-label="Jangkauan" className="flex gap-1 p-0.5 rounded-full bg-muted shrink-0">
              {[["shared", "Bersama"], ["private", "Pribadi"]].map(([v, l]) => (
                <button key={v} role="radio" aria-checked={(a.visibility || "shared") === v} disabled={busy} onClick={() => setVisibility(v)}
                  className={`h-7 px-3 rounded-full text-xs font-semibold transition-colors disabled:opacity-60 ${(a.visibility || "shared") === v ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>{l}</button>
              ))}
            </div>
          )}
        </div>
        <Link to="/zakat" className="flex items-center gap-3 px-4 py-2.5">
          <span className="w-8 h-8 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">{zakatCounted ? <ShieldCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-[11px] text-muted-foreground">Zakat mal</span>
            <span className="block text-sm font-medium">{zakatCounted ? "Ikut dihitung (nilai pasar)" : "Tidak dihitung (aset dipakai/tempat tinggal)"}</span>
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </Link>
        <Link to={`/mutasi-aset?asset_id=${a.id}`} className="flex items-center gap-3 px-4 py-2.5">
          <span className="w-8 h-8 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0"><History className="w-4 h-4" /></span>
          <span className="flex-1 min-w-0 text-sm font-medium">Riwayat mutasi saldo</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </Link>
      </section>

      {isOwner && (
        <button onClick={handleDelete} className="w-full h-11 rounded-full border border-destructive/30 text-destructive text-sm font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.99] transition-transform">
          <Trash2 className="w-4 h-4" /> Hapus aset
        </button>
      )}

      {editing && <AssetForm asset={a} onClose={() => setEditing(false)} />}
      {viewProof && <ProofViewer url={a.purchase_proof_url} onClose={() => setViewProof(false)} />}
    </div>
  );
}

// No. rekening tampil lengkap & jelas, bisa disalin. Disamarkan hanya saat
// mode privasi (ikon mata) aktif.
function AccountNumber({ number, masked = false }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(normalizeAccountNumber(number)); toast.success("No. rekening disalin"); }
    catch { toast.error("Gagal menyalin"); }
  };
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <span className="text-base font-bold tracking-wider">{masked ? maskAccount(number) : formatAccountNumber(number)}</span>
      {!masked && (
        <button type="button" onClick={copy} aria-label="Salin no. rekening"
          className="h-7 px-2.5 rounded-full border border-border bg-card text-[11px] font-semibold inline-flex items-center gap-1">
          <Copy className="w-3 h-3" /> Salin
        </button>
      )}
    </span>
  );
}
