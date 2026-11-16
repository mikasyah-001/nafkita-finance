import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  Upload, Loader2, Check, AlertTriangle, FileText, Image as ImageIcon, X, Pencil, RefreshCw,
  Sparkles, TrendingUp, TrendingDown, Plus, ShieldCheck, Globe,
} from "lucide-react";
import { fetchLivePrices } from "@/lib/livePrice";
import PageHeader from "@/components/PageHeader";
import { ChipChoice } from "@/components/FormSheet";
import { useAssets, useRefresh, useUserCurrencies } from "@/hooks/useFinance";
import { formatMoney, formatNumber, formatDate } from "@/lib/finance";
import {
  INSTRUMENTS, HOLDINGS_PROMPT, HOLDINGS_SCHEMA, normalizeHolding, mergeHoldings,
  matchExistingAsset, holdingToAsset, summarize, reconcileHolding, displayName,
  lotSummary, lotsToCreate, attachLots,
} from "@/lib/portfolioImport";

const MAX_FILES = 10;
const isPdf = (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

// Impor kepemilikan saham/reksa dana/ETF/emas dari aplikasi investasi luar.
// Alur: unggah foto/PDF → AI membaca → gabung & cocokkan aset lama → tinjau/ubah → simpan.
export default function PortfolioImport() {
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data: assets = [] } = useAssets();
  const userCurrencies = useUserCurrencies();
  const fileRef = useRef(null);

  const [files, setFiles] = useState([]); // { id, name, pdf, status, count, error }
  const [rows, setRows] = useState([]); // holding + { id, include }
  const [platform, setPlatform] = useState("");
  const [visibility, setVisibility] = useState("shared");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const reading = files.some((f) => f.status === "reading");

  const readFile = async (file) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    let data;
    try {
      data = await base44.integrations.Core.InvokeLLM({ prompt: HOLDINGS_PROMPT, file_urls: [file_url], response_json_schema: HOLDINGS_SCHEMA });
    } catch (e) {
      // Cadangan untuk PDF bila model tidak menerima berkas langsung.
      if (!isPdf(file)) throw e;
      const res = await base44.integrations.Core.ExtractDataFromUploadedFile({ file_url, json_schema: HOLDINGS_SCHEMA });
      data = res?.output || res;
    }
    return attachLots(data || {});
  };

  const handleFiles = async (e) => {
    const picked = Array.from(e.target.files || []).slice(0, MAX_FILES - files.length);
    if (fileRef.current) fileRef.current.value = "";
    if (!picked.length) return;
    const entries = picked.map((f, i) => ({ id: `${Date.now()}-${i}`, name: f.name, pdf: isPdf(f), status: "reading", count: 0 }));
    setFiles((prev) => [...prev, ...entries]);

    const collected = [];
    await Promise.all(picked.map(async (f, i) => {
      const id = entries[i].id;
      try {
        const raw = await readFile(f);
        collected.push(...raw);
        const lotCount = raw.reduce((t, h) => t + (h.lots?.length || 0), 0);
        setFiles((prev) => prev.map((x) => (x.id === id ? { ...x, status: "done", count: raw.length, lots: lotCount } : x)));
      } catch (err) {
        setFiles((prev) => prev.map((x) => (x.id === id ? { ...x, status: "error", error: err?.message || "Gagal dibaca" } : x)));
      }
    }));
    if (!collected.length) {
      toast.error("Tidak ada kepemilikan terbaca", { description: "Pastikan screenshot memperlihatkan daftar/rincian aset." });
      return;
    }
    // Gabungkan dengan baris yang sudah ada (mis. foto daftar + foto detail).
    setRows((prev) => {
      const fresh = collected.map((r) => normalizeHolding(r, { platform }));
      const merged = mergeHoldings([...prev.map(stripRow), ...fresh]);
      const keep = new Map(prev.map((r) => [rowKey(r), r.include]));
      const next = merged.map((h, i) => ({ ...h, id: `${rowKey(h)}-${i}`, include: keep.get(rowKey(h)) ?? true }));
      if (!platform) {
        const p = next.find((r) => r.platform)?.platform;
        if (p) setPlatform(p);
      }
      return next;
    });
  };

  const view = useMemo(() => rows.map((r) => {
    const h = { ...r, platform: platform || r.platform };
    const existing = matchExistingAsset(h, assets);
    // Layar "Lots Breakdown" saja (tanpa nilai pasar) untuk aset yang sudah ada:
    // hanya menambah riwayat lot, total aset tidak disentuh.
    const lotsOnly = !!existing && !(h.market_value > 0) && h.lots?.length > 0;
    const lotInfo = h.lots?.length ? lotSummary(h.lots, lotsOnly ? existing.quantity : h.quantity) : null;
    // "Nilai pasar belum ada" sudah ditangani kotak aksi di kartu → tidak diulang.
    const warnings = (h.warnings || []).filter((w) => !/Nilai pasar belum ada/.test(w));
    return { ...h, existing, lotsOnly, lotInfo, warnings };
  }), [rows, assets, platform]);

  const chosen = view.filter((r) => r.include);
  // Ringkasan hanya dari baris yang sudah bernilai (hindari "⃁ 0,00" menyesatkan).
  const totals = summarize(chosen.filter((r) => r.market_value > 0));
  const missingValue = view.filter((r) => r.include && !r.lotsOnly && !(r.market_value > 0));
  const nNew = chosen.filter((r) => !r.existing).length;
  const nUpd = chosen.length - nNew;
  const inactive = [...new Set(chosen.map((r) => r.currency))].filter((c) => !userCurrencies.some((u) => u.code === c));

  const updateRow = (id, patch) => setRows((prev) => prev.map((r) => {
    if (r.id !== id) return r;
    const changed = Object.keys(patch).filter((k) => k !== "include");
    return changed.length ? reconcileForEdit({ ...r, ...patch }, changed) : { ...r, ...patch };
  }));
  const removeFile = (id) => setFiles((prev) => prev.filter((f) => f.id !== id));

  // Harga online hari ini (AI + internet), divalidasi sebelum dipakai.
  const [livePending, setLivePending] = useState(null); // null | "all" | rowId
  const applyLive = async (ids) => {
    // Hanya baris tanpa nilai pasar dari layar broker.
    const targets = rows.filter((r) => ids.includes(r.id) && (r.ticker || r.name) && (!(r.market_value > 0) || r.price_source));
    if (!targets.length) return;
    setLivePending(ids.length === 1 ? ids[0] : "all");
    try {
      const items = targets.map((r) => ({ key: r.id, name: r.name, ticker: r.ticker, exchange: r.exchange, currency: r.currency, broker: platform || r.platform || "", instrument: r.instrument, ref_price: r.last_price || (r.quantity && r.market_value ? r.market_value / r.quantity : 0) || r.avg_cost || (r.quantity && r.total_cost ? r.total_cost / r.quantity : 0) }));
      const found = await fetchLivePrices(items);
      // Hitung hasil DI LUAR setRows (callback setState berjalan belakangan —
      // dulu alasan penolakan hilang dari pesan dan jumlah berhasil keliru).
      const patches = new Map(); const fails = [];
      for (const r of targets) {
        const lp = found.get(r.id);
        if (!lp) { fails.push(`${displayName(r)}: tidak ditemukan`); continue; }
        if (!lp.ok) { fails.push(`${displayName(r)}: ${lp.reason}`); continue; }
        const patch = { last_price: lp.price, as_of: lp.as_of || r.as_of, price_source: lp.source };
        if (r.quantity > 0) patch.market_value = Math.round(lp.price * r.quantity * 100) / 100;
        patches.set(r.id, patch);
      }
      const ok = patches.size;
      setRows((prev) => prev.map((r) => {
        const patch = patches.get(r.id);
        return patch ? reconcileForEdit({ ...r, ...patch }, Object.keys(patch).filter((k) => k !== "as_of" && k !== "price_source")) : r;
      }));
      if (ok) toast.success(`Harga online dipakai untuk ${ok} aset`, { description: fails.length ? fails.join(" · ") : undefined });
      else toast.error("Harga online belum ditemukan", { description: fails.join(" · ") || "Coba lagi atau isi manual." });
    } catch (e) {
      toast.error("Gagal mencari harga online", { description: e?.message });
    }
    setLivePending(null);
  };

  const save = async () => {
    if (!chosen.length) return;
    const bad = chosen.find((r) => (!r.lotsOnly && !(r.market_value > 0)) || !(r.name || r.ticker));
    if (bad) {
      const need = !(bad.name || bad.ticker) ? "nama" : !(bad.quantity > 0) ? "jumlah lembar & nilai pasar" : "nilai pasar";
      toast.error(`${displayName(bad) || "Satu baris"}: ${need} belum ada`, { description: "Isi manual, atau ketuk “Cari harga online”." });
      setEditing(bad.id);
      return;
    }
    setSaving(true);
    let created = 0, updated = 0, lotsAdded = 0;
    const lotFails = [];
    try {
      for (const r of chosen) {
        let assetId = r.existing?.id;
        if (r.lotsOnly) {
          // Hanya tanggal beli paling awal yang ikut diperbarui.
          const first = r.lotInfo?.firstDate;
          if (first && (!r.existing.purchase_date || first < String(r.existing.purchase_date).slice(0, 10))) {
            await base44.entities.Asset.update(assetId, { purchase_date: first });
          }
        } else {
          const payload = clean(holdingToAsset(r, { visibility, existing: r.existing }));
          if (r.existing) { await base44.entities.Asset.update(assetId, payload); updated++; }
          else { const res = await base44.entities.Asset.create(payload); assetId = res?.id || res?.data?.id; created++; }
        }
        // Riwayat lot: hanya yang belum ada (impor sebelumnya / DCA manual yang sama).
        if (!assetId && r.lots?.length) lotFails.push(`${displayName(r)}: aset tidak terbuat, lot dilewati`);
        if (assetId && r.lots?.length) {
          const have = r.existing ? await base44.entities.InvestmentLot.filter({ asset_id: assetId }) : [];
          const todo = lotsToCreate(r.lots, have || []);
          for (const l of todo) {
            const rec = { asset_id: assetId, date: l.date, quantity: l.quantity, price_per_unit: l.price, amount: l.amount, notes: `Impor${platform ? ` · ${platform}` : ""}` };
            try {
              await base44.entities.InvestmentLot.create({ ...rec, side: l.side, source: "import" });
              lotsAdded++;
            } catch {
              // Cadangan: bila skema server belum punya kolom side/source, simpan tanpa itu
              // (jual dicatat lewat catatan agar tidak hilang).
              try {
                await base44.entities.InvestmentLot.create({ ...rec, notes: `${rec.notes}${l.side === "sell" ? " · JUAL" : ""}` });
                lotsAdded++;
              } catch (e2) { lotFails.push(`${displayName(r)} ${l.date}: ${e2?.message || "gagal"}`); }
            }
          }
          // Verifikasi: hitung ulang lot yang benar-benar tersimpan untuk aset ini.
          if (todo.length) {
            const after = await base44.entities.InvestmentLot.filter({ asset_id: assetId });
            const missing = lotsToCreate(r.lots, after || []).length;
            if (missing) lotFails.push(`${displayName(r)}: ${missing} lot belum tersimpan`);
          }
        }
      }
      refresh();
      toast.success("Portofolio tersimpan", { description: `${created} aset baru, ${updated} diperbarui${lotsAdded ? `, ${lotsAdded} lot masuk Riwayat DCA` : ""}.` });
      if (lotFails.length) toast.error("Sebagian riwayat lot gagal disimpan", { description: lotFails.slice(0, 4).join(" · ") });
      navigate("/aset");
    } catch (e) {
      toast.error("Sebagian gagal disimpan", { description: `${created + updated} dari ${chosen.length} tersimpan. ${e?.message || ""}` });
      refresh();
    }
    setSaving(false);
  };

  return (
    <div className="px-5 pt-6 pb-40">
      <PageHeader title="Impor portofolio" subtitle="Saham, reksa dana, ETF & emas dari aplikasi lain" back />

      {/* Unggah */}
      <section className="card-pastel card-pastel-sage rounded-3xl p-4 mb-4">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-2xl bg-white/60 dark:bg-white/10 flex items-center justify-center shrink-0"><Sparkles className="w-5 h-5" /></span>
          <div className="min-w-0">
            <h2 className="font-heading font-bold text-[17px] leading-tight">Foto atau PDF portofolio</h2>
            <p className="text-xs opacity-80 leading-snug mt-1">
              Screenshot daftar kepemilikan, rincian per saham, atau laporan PDF dari aplikasi broker/reksa dana/emas. Boleh beberapa sekaligus — data yang sama digabung otomatis.
            </p>
          </div>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={reading || files.length >= MAX_FILES}
          className="w-full mt-3 h-11 rounded-full bg-white/80 dark:bg-white/10 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99] transition-transform">
          {reading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {reading ? "AI sedang membaca…" : files.length ? "Tambah foto/PDF" : "Pilih foto/PDF"}
        </button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleFiles} aria-label="Berkas portofolio" />
        {files.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-2 rounded-2xl bg-white/60 dark:bg-white/10 px-3 py-2 text-xs">
                {f.pdf ? <FileText className="w-4 h-4 shrink-0" /> : <ImageIcon className="w-4 h-4 shrink-0" />}
                <span className="flex-1 min-w-0 truncate">{f.name}</span>
                {f.status === "reading" && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
                {f.status === "done" && <span className="shrink-0 font-semibold">{f.count} kepemilikan{f.lots ? ` · ${f.lots} lot` : ""}</span>}
                {f.status === "error" && <span className="shrink-0 font-semibold text-destructive">Gagal</span>}
                {f.status !== "reading" && <button onClick={() => removeFile(f.id)} aria-label={`Hapus ${f.name} dari daftar`} className="shrink-0 opacity-70"><X className="w-3.5 h-3.5" /></button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {rows.length > 0 && (
        <>
          {/* Pengaturan impor */}
          <section className="surface rounded-3xl divide-y divide-border mb-4">
            <div className="px-4 py-3">
              <label htmlFor="pi-platform" className="block text-[11px] text-muted-foreground">Aplikasi / broker</label>
              <input id="pi-platform" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Mis. Al Rajhi Capital, Bibit" className="w-full bg-transparent outline-none text-sm font-medium py-0.5" />
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm">Jangkauan aset baru</span>
              <ChipChoice size="sm" ariaLabel="Jangkauan" value={visibility} onChange={setVisibility} options={[{ value: "shared", label: "Bersama" }, { value: "private", label: "Pribadi" }]} />
            </div>
          </section>

          {/* Ringkasan */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
            {totals.map((t) => (
              <div key={t.currency} className="shrink-0 card-pastel card-pastel-butter rounded-2xl px-3.5 py-2.5">
                <p className="text-[11px] opacity-75">{t.count} aset · {t.currency}</p>
                <p className="text-sm font-bold tabular-nums">{formatMoney(t.value, t.currency)}</p>
                <p className={`text-[11px] font-semibold tabular-nums ${t.gain >= 0 ? "text-income" : "text-expense"}`}>{t.gain >= 0 ? "+" : ""}{formatMoney(t.gain, t.currency)}</p>
              </div>
            ))}
          </div>
          {inactive.length > 0 && (
            <p className="text-xs text-muted-foreground mb-3 px-1 leading-snug">
              Mata uang {inactive.join(", ")} belum aktif di Pengaturan. Aset tetap tersimpan; aktifkan agar mudah dipilih di laporan.
            </p>
          )}

          {/* Daftar kepemilikan */}
          <div className="flex items-center justify-between gap-2 mb-2 px-1">
            <h2 className="text-sm font-semibold">Tinjau {view.length} kepemilikan</h2>
            {/* Nilai dari layar broker tidak pernah ditimpa — harga online hanya untuk yang kosong */}
            {missingValue.length > 1 && (
              <button onClick={() => applyLive(missingValue.map((r) => r.id))} disabled={!!livePending}
                className="h-8 px-3 rounded-full border border-border bg-card text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
                {livePending === "all" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />} Lengkapi {missingValue.length} yang kosong
              </button>
            )}
          </div>
          <ul className="space-y-2.5">
            {view.map((r) => (
              <HoldingCard key={r.id} r={r} onToggle={() => updateRow(r.id, { include: !r.include })} onEdit={() => setEditing(r.id)}
                onLive={() => applyLive([r.id])} liveBusy={livePending === r.id || livePending === "all"} />
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground mt-3 px-1 leading-snug flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Aset yang sudah ada diperbarui (jumlah, modal, nilai pasar) — nama, jangkauan & catatan tidak diubah. Investasi ikut dihitung zakat mal dengan nilai pasar.
          </p>
        </>
      )}

      {editing && (
        <EditSheet row={rows.find((r) => r.id === editing)} onClose={() => setEditing(null)} onChange={(patch) => updateRow(editing, patch)} currencies={[...new Set([...userCurrencies.map((c) => c.code), "SAR", "USD", "IDR"])]} />
      )}

      {rows.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-background/90 backdrop-blur-xl border-t border-border">
          <div className="max-w-md mx-auto">
            <p className="text-xs text-muted-foreground mb-2">{nNew} baru · {nUpd} diperbarui</p>
            <button onClick={save} disabled={saving || reading || !chosen.length} className="w-full btn-primary disabled:opacity-60">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              {saving ? "Menyimpan…" : `Simpan ${chosen.length} aset`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HoldingCard({ r, onToggle, onEdit, onLive, liveBusy }) {
  const gain = r.gain ?? (r.market_value != null && r.total_cost != null ? r.market_value - r.total_cost : null);
  const pct = gain != null && r.total_cost ? (gain / r.total_cost) * 100 : null;
  const up = (gain ?? 0) >= 0;
  return (
    <li className={`surface rounded-3xl p-4 transition-opacity ${r.include ? "" : "opacity-55"}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={r.include} onChange={onToggle} aria-label={`Sertakan ${displayName(r)}`} className="mt-1 w-4 h-4 accent-[hsl(var(--primary))] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">{r.name || r.ticker || "Tanpa nama"}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {[r.ticker, r.exchange, INSTRUMENTS[r.instrument], r.currency].filter(Boolean).join(" · ")}
              </p>
            </div>
            <button onClick={onEdit} aria-label={`Ubah ${displayName(r)}`} className="h-8 px-3 rounded-full border border-border text-xs font-semibold inline-flex items-center gap-1 shrink-0"><Pencil className="w-3 h-3" /> Ubah</button>
          </div>
          {!r.lotsOnly && <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
            <Stat label={r.instrument === "emas" ? "Gram" : "Jumlah"} value={r.quantity != null ? formatNumber(r.quantity) : "—"} />
            <Stat label="Modal" value={r.total_cost != null ? formatMoney(r.total_cost, r.currency) : "—"} />
            <Stat label="Nilai pasar" value={r.market_value != null ? formatMoney(r.market_value, r.currency) : "—"} strong />
          </div>}
          {gain != null && (
            <p className={`text-xs font-semibold mt-2 inline-flex items-center gap-1 tabular-nums ${up ? "text-income" : "text-expense"}`}>
              {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {up ? "+" : ""}{formatMoney(gain, r.currency)}{pct != null ? ` (${up ? "+" : ""}${pct.toFixed(2)}%)` : ""}
            </p>
          )}
          <div className="mt-2">
            {r.lotsOnly ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[11px] font-semibold">
                <RefreshCw className="w-3 h-3" /> Tambah riwayat lot ke "{r.existing.name}" — total tidak diubah
              </span>
            ) : r.existing ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[11px] font-semibold">
                <RefreshCw className="w-3 h-3" /> Perbarui "{r.existing.name}" · {formatMoney(r.existing.value || 0, r.existing.currency)} → {formatMoney(r.market_value || 0, r.currency)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-income/10 text-income px-2.5 py-1 text-[11px] font-semibold"><Plus className="w-3 h-3" /> Aset baru</span>
            )}
          </div>
          {!r.lotsOnly && !(r.market_value > 0) && (
            <div className="mt-2.5 rounded-2xl bg-warning/10 p-2.5">
              <p className="text-[11px] text-warning font-semibold leading-snug">Nilai pasar belum terbaca dari gambar{r.quantity ? "" : " (jumlah lembar juga belum ada)"}. Paling tepat: tambahkan screenshot Details dari broker.</p>
              <div className="flex gap-2 mt-2">
                <button onClick={onLive} disabled={liveBusy} className="h-8 px-3 rounded-full bg-card border border-border text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
                  {liveBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />} Perkiraan online
                </button>
                <button onClick={onEdit} className="h-8 px-3 rounded-full bg-card border border-border text-xs font-semibold inline-flex items-center gap-1.5"><Pencil className="w-3 h-3" /> Isi manual</button>
              </div>
            </div>
          )}
          {r.price_source && <p className="text-[11px] text-muted-foreground mt-1.5 inline-flex items-center gap-1"><Globe className="w-3 h-3" /> Perkiraan online · {r.price_source}{r.as_of ? ` · ${formatDate(r.as_of, "d MMM yyyy")}` : ""}</p>}
          {r.lotInfo && <LotBlock info={r.lotInfo} lots={r.lots} currency={r.currency} unit={r.instrument === "emas" ? "gr" : r.instrument === "saham" ? "lembar" : "unit"} />}
          {r.warnings?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {r.warnings.map((w) => <li key={w} className="text-[11px] text-warning flex items-start gap-1"><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {w}</li>)}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

// Ringkasan riwayat lot + daftar yang bisa dibuka. Lot hanya riwayat tanggal &
// harga beli — total aset tetap dari rincian broker.
function LotBlock({ info, lots, currency, unit }) {
  const [open, setOpen] = useState(false);
  const tone = info.status === "complete" ? "text-income bg-income/10" : info.status === "none" ? "text-muted-foreground bg-muted" : "text-warning bg-warning/10";
  return (
    <div className="mt-2.5 rounded-2xl border border-border p-2.5">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between gap-2 text-left">
        <span className="text-xs font-semibold">
          {info.count} lot pembelian{info.firstDate ? ` · sejak ${formatDate(info.firstDate, "d MMM yyyy")}` : ""}
        </span>
        <span className="text-[11px] font-semibold text-primary shrink-0">{open ? "Tutup" : "Lihat"}</span>
      </button>
      {info.message && <p className={`mt-1.5 rounded-xl px-2 py-1.5 text-[11px] leading-snug ${tone}`}>{info.message}</p>}
      {open && (
        <ul className="mt-2 divide-y divide-border">
          {lots.map((l) => (
            <li key={`${l.date}${l.side}${l.quantity}${l.price}`} className="flex items-center justify-between gap-2 py-1.5 text-[11px] tabular-nums">
              <span className="min-w-0">
                <span className="font-medium">{formatDate(l.date, "d MMM yyyy")}</span>
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${l.side === "sell" ? "bg-expense/10 text-expense" : "bg-income/10 text-income"}`}>{l.side === "sell" ? "Jual" : "Beli"}</span>
              </span>
              <span className="text-right shrink-0">{formatNumber(l.quantity)} {unit} × {formatMoney(l.price, currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, strong }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground">{label}</p>
      <p className={`tabular-nums truncate ${strong ? "font-bold text-sm" : "font-medium text-xs"}`}>{value}</p>
    </div>
  );
}

function EditSheet({ row, onClose, onChange, currencies }) {
  if (!row) return null;
  const cur = row.currency;
  const isGold = row.instrument === "emas";
  const unitLabel = isGold ? "gram" : row.instrument === "saham" ? "lembar" : "unit";
  const gain = row.market_value != null && row.total_cost != null ? row.market_value - row.total_cost : null;
  const setNum = (k) => (v) => onChange({ [k]: v === "" ? null : Number(v) });
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/30 backdrop-blur-[2px]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Ubah kepemilikan" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-background rounded-t-[28px] max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="font-heading font-bold text-lg">Ubah kepemilikan</h2>
          <button onClick={onClose} aria-label="Tutup" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-3">
          {/* Identitas: nama lebar, kode & mata uang sebaris */}
          <Field label="Nama" value={row.name} onChange={(v) => onChange({ name: v })} text />
          <div className="grid grid-cols-[1fr_6.5rem] gap-2.5">
            <Field label="Kode / ticker" value={row.ticker} onChange={(v) => onChange({ ticker: v.toUpperCase() })} text />
            <label className="block">
              <span className="text-[11px] text-muted-foreground">Mata uang</span>
              <select value={cur} onChange={(e) => onChange({ currency: e.target.value })} className="w-full h-10 rounded-xl border border-border bg-card px-2.5 text-sm mt-0.5">
                {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          {/* Jenis: satu baris geser */}
          <div role="radiogroup" aria-label="Jenis instrumen" className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5">
            {Object.entries(INSTRUMENTS).map(([value, label]) => {
              const on = row.instrument === value;
              return (
                <button key={value} type="button" role="radio" aria-checked={on} onClick={() => onChange({ instrument: value })}
                  className={`shrink-0 h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground/80"}`}>{label}</button>
              );
            })}
          </div>

          {/* Angka: kartu ringkas 2 kolom, mata uang sebagai akhiran */}
          <div className="surface rounded-2xl p-3 grid grid-cols-2 gap-x-2.5 gap-y-2.5">
            <Field label="Jumlah" suffix={unitLabel} value={row.quantity} onChange={setNum("quantity")} />
            <Field label={isGold ? "Harga beli /gr" : "Rata-rata /unit"} suffix={cur} value={row.avg_cost} onChange={setNum("avg_cost")} />
            <Field label="Modal total" suffix={cur} value={row.total_cost} onChange={setNum("total_cost")} />
            <Field label="Nilai pasar" suffix={cur} value={row.market_value} onChange={setNum("market_value")} strong />
            <p className="col-span-2 text-[11px] text-muted-foreground leading-snug tabular-nums">
              {row.last_price ? `Harga terakhir ${formatMoney(row.last_price, cur)}/${unitLabel}` : "Harga terakhir dihitung otomatis"}
              {gain != null && <span className={`font-semibold ${gain >= 0 ? "text-income" : "text-expense"}`}> · {gain >= 0 ? "untung +" : "rugi "}{formatMoney(gain, cur)}</span>}
            </p>
          </div>
        </div>

        <div className="px-5 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-border">
          <button onClick={onClose} className="w-full btn-primary"><Check className="w-5 h-5" /> Selesai</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, text, suffix, strong }) {
  return (
    <label className="block min-w-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="mt-0.5 flex items-center h-10 rounded-xl border border-border bg-card px-3 focus-within:ring-2 ring-primary/30">
        <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} type={text ? "text" : "number"} inputMode={text ? "text" : "decimal"}
          className={`flex-1 min-w-0 bg-transparent outline-none text-sm tabular-nums ${strong ? "font-bold" : ""}`} />
        {suffix && <span className="text-[11px] text-muted-foreground ml-1.5 shrink-0">{suffix}</span>}
      </span>
    </label>
  );
}

// ── util ──
const rowKey = (h) => `${h.ticker || (h.name || "").toLowerCase()}|${h.currency}`;
const stripRow = (r) => { const h = { ...r }; delete h.id; delete h.include; delete h.existing; return h; };
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
// Saat pengguna mengubah angka: angka itu jadi "tertera", turunan lain dihitung ulang.
function reconcileForEdit(r, changed) {
  const given = new Set([...(r.given || []), ...changed]);
  // Untung/rugi dari aplikasi tidak lagi berlaku bila modal/nilai diubah manual.
  if (changed.some((k) => ["market_value", "total_cost", "avg_cost", "quantity", "last_price"].includes(k))) {
    // Modal yang sudah ada (mis. turunan nilai − untung) dikunci dulu agar tidak hilang.
    if (r.total_cost != null && !changed.includes("total_cost")) given.add("total_cost");
    if (r.quantity != null && !changed.includes("quantity")) given.add("quantity");
    given.delete("gain");
  }
  const nums = ["quantity", "avg_cost", "total_cost", "last_price", "market_value", "gain"];
  const base = { ...r, warnings: undefined };
  nums.forEach((k) => { if (!given.has(k)) base[k] = null; });
  const out = reconcileHolding(base);
  return { ...out, given: [...given].filter((k) => nums.includes(k)), id: r.id, include: r.include };
}
