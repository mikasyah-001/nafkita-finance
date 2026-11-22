import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Inbox, Smartphone, Plus, Copy, Check, Ban, AlertTriangle, CreditCard, Link2, BookOpen, MessageSquareText, IdCard,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import {
  useAssets, useCategories, useMe, useIncomingTransactions, useIngestDevices, usePaymentCards,
} from "@/hooks/useFinance";
import { saveTransactionWithAsset } from "@/lib/linkedAsset";
import { formatMoney } from "@/lib/finance";
import { assetLabel } from "@/lib/bankAccount";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import FormSheet, { FieldGroup, FieldRow, fieldInput, ChipChoice } from "@/components/FormSheet";
import NativeSelect from "@/components/NativeSelect";
import CardSheet, { manageCards, useMigrateLegacyLabels, STATUS_LABEL } from "@/components/CardSheet";
import MoneyInput from "@/components/MoneyInput";
import { confirmAction } from "@/components/ConfirmHost";
import { ListSkeleton } from "@/components/LoadingSkeleton";

// Catat Otomatis — transaksi Apple Pay & SMS bank dikirim Shortcuts iOS ke Nafkita.
// Tab "Kotak Masuk": konfirmasi 1 tap (saldo & laporan baru berubah di sini).
// Tab "Sambungan": perangkat (token), kartu → rekening, panduan setup.

const LINKABLE_TYPES = ["bank", "tunai", "emas_digital", "lainnya"];
const CARD_ACCOUNT_TYPES = ["bank", "tunai", "lainnya"];
// Tautan iCloud shortcut siap pakai "Kirim ke Nafkita" (dibuat sekali oleh admin
// di iPhone, lalu diisi di variabel lingkungan). Kosong → panduan manual saja.
const SHORTCUT_URL = import.meta.env.VITE_NAFKITA_SHORTCUT_URL || "";
const SOURCE_TEXT = { apple_pay: "Apple Pay", sms: "SMS bank", email: "Email bank" };

const msg = (e, fallback) => e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback;
const manage = async (payload) => (await base44.functions.invoke("manageAutoIngest", payload)).data;
const endpointUrl = () => `${window.location.origin}/api/apps/${appParams.appId}/functions/ingestTransaction`;
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

function useInvalidate() {
  const qc = useQueryClient();
  return (all = false) => Promise.all([
    qc.invalidateQueries({ queryKey: ["autoIngest"] }),
    ...(all ? [qc.invalidateQueries({ queryKey: ["transactions"] }), qc.invalidateQueries({ queryKey: ["assets"] }), qc.invalidateQueries({ queryKey: ["pendingApprovals"] })] : []),
  ]);
}

function CopyButton({ text, label = "Salin" }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }
    catch { toast.error("Gagal menyalin — tekan lama teks untuk menyalin manual"); }
  };
  return (
    <button type="button" onClick={copy} className="btn-secondary btn-sm shrink-0" aria-label={label}>
      {done ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {done ? "Tersalin" : label}
    </button>
  );
}

export default function AutoIngest() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "sambungan" ? "sambungan" : "masuk";
  const { data: incoming = [] } = useIncomingTransactions();
  const { data: cards = [], isLoading: loadingCards } = usePaymentCards();
  useMigrateLegacyLabels(cards, loadingCards);
  const unmapped = cards.filter((c) => c.status === "unmapped").length;

  return (
    <div className="px-5 pt-6 pb-8">
      <PageHeader title="Catat Otomatis" subtitle="Apple Pay & SMS bank masuk sendiri, Anda tinggal konfirmasi" back />
      <ChipChoice
        ariaLabel="Bagian"
        value={tab}
        onChange={(v) => setParams(v === "masuk" ? {} : { tab: v }, { replace: true })}
        options={[
          { value: "masuk", label: `Kotak Masuk${incoming.length ? ` (${incoming.length})` : ""}` },
          { value: "sambungan", label: `Sambungan${unmapped ? ` · ${unmapped} baru` : ""}` },
        ]}
      />
      <div className="mt-5">{tab === "masuk" ? <InboxTab /> : <ConnectTab />}</div>
    </div>
  );
}

/* ---------------------------- Kotak Masuk ---------------------------- */

function InboxTab() {
  const { data: me } = useMe();
  const { data: items = [], isLoading } = useIncomingTransactions();
  const { data: assets = [] } = useAssets();
  const { data: categories = [] } = useCategories();
  const { data: devices = [] } = useIngestDevices();
  const invalidate = useInvalidate();
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(null);

  const assetById = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);
  const accountsFor = (cur) => assets.filter((a) => a.created_by_id === me?.id && LINKABLE_TYPES.includes(a.type || "bank")
    && String(a.currency || "IDR").toUpperCase() === String(cur || "IDR").toUpperCase());
  const catsOf = useMemo(() => {
    const by = (t) => categories.filter((c) => (c.type || "expense") === t).map((c) => c.name);
    return { out: by("expense"), in: by("income") };
  }, [categories]);
  const isIn = (it) => it.direction === "in";

  const draftOf = (it) => ({
    category: drafts[it.id]?.category ?? it.suggested_category ?? "",
    amount: drafts[it.id]?.amount ?? (it.amount > 0 ? String(it.amount) : ""),
    // Rekening bisa dikoreksi (mis. dua kartu Wallet bernama sama → label sama).
    asset_id: drafts[it.id]?.asset_id ?? it.asset_id ?? "",
  });
  const setDraft = (id, patch) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  // Mata uang rekening diubah setelah item masuk → nominal tidak bisa dipakai apa adanya.
  const curMismatch = (it) => {
    const a = assetById[draftOf(it).asset_id];
    return !!a && String(a.currency || "IDR").toUpperCase() !== String(it.currency || "IDR").toUpperCase();
  };
  const isReady = (it) => { const d = draftOf(it); return !!d.category && Number(d.amount) > 0 && !it.review_reason && !curMismatch(it); };

  const saveOne = async (it) => {
    const d = draftOf(it);
    if (!d.category) throw new Error("Pilih kategori dulu");
    if (!(Number(d.amount) > 0)) throw new Error("Isi nominal");
    if (curMismatch(it)) throw new Error("Mata uang rekening sudah berubah — abaikan item ini dan catat manual");
    const asset = assetById[d.asset_id];
    const src = SOURCE_TEXT[it.source] || "Apple Pay";
    const res = await saveTransactionWithAsset({
      type: isIn(it) ? "income" : "expense",
      amount: Number(d.amount),
      currency: it.currency || assetById[it.asset_id]?.currency || "IDR",
      category: d.category,
      date: it.occurred_at || new Date().toISOString(),
      merchant: it.merchant || "",
      notes: `Otomatis dari ${src}${it.card_name ? ` (${it.card_name})` : it.label ? ` (${it.label})` : ""}`,
      tags: [it.source === "sms" ? "sms-bank" : "apple-pay"],
      // Rekening pribadi → transaksinya juga pribadi (tidak terlihat pasangan).
      visibility: asset?.visibility === "private" ? "private" : "shared",
      linked_asset_id: d.asset_id || undefined,
    }, undefined, { incoming_id: it.id });
    return res;
  };

  const onSave = async (it) => {
    setBusy(it.id);
    try {
      const res = await saveOne(it);
      toast.success(res?.needs_approval ? "Tersimpan, menunggu persetujuan pasangan" : "Tersimpan ke transaksi");
      await invalidate(true);
    } catch (e) { toast.error(msg(e, "Gagal menyimpan")); }
    finally { setBusy(null); }
  };

  const onDismiss = async (it) => {
    setBusy(it.id);
    try { await manage({ action: "dismiss_incoming", ids: [it.id] }); await invalidate(); }
    catch (e) { toast.error(msg(e, "Gagal mengabaikan")); }
    finally { setBusy(null); }
  };

  const ready = items.filter(isReady);
  const onSaveAll = async () => {
    if (!(await confirmAction({ title: `Simpan ${ready.length} transaksi?`, description: "Hanya item yang kategorinya sudah terisi dan tidak perlu dicek.", destructive: false, confirmText: "Simpan semua" }))) return;
    setBusy("all");
    let ok = 0;
    for (const it of ready) { try { await saveOne(it); ok++; } catch { /* lanjut item berikutnya */ } }
    setBusy(null);
    toast.success(`${ok} dari ${ready.length} transaksi tersimpan`);
    await invalidate(true);
  };

  if (isLoading) return <ListSkeleton rows={3} />;

  if (!items.length) {
    return (
      <div className="surface rounded-3xl px-4">
        <EmptyState
          icon={Inbox}
          title="Kotak masuk kosong"
          subtitle={devices.some((d) => !d.revoked)
            ? "Bayar dengan Apple Pay atau terima SMS transaksi dari bank untuk kartu yang sudah terhubung — transaksinya muncul di sini."
            : "Belum ada iPhone tersambung. Buka tab Sambungan untuk mulai."}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Belum masuk saldo & laporan sampai Anda simpan.</p>
        {ready.length > 1 && (
          <button type="button" className="btn-primary btn-sm" disabled={!!busy} onClick={onSaveAll}>Simpan {ready.length} siap</button>
        )}
      </div>
      {items.map((it) => {
        const d = draftOf(it);
        const asset = assetById[d.asset_id];
        const cur = it.currency || asset?.currency || "IDR";
        const accountOptions = accountsFor(cur);
        const baseCats = isIn(it) ? catsOf.in : catsOf.out;
        const catOptions = d.category && !baseCats.includes(d.category) ? [d.category, ...baseCats] : baseCats;
        return (
          <article key={it.id} className="surface rounded-3xl p-4" aria-label={`Transaksi ${it.merchant || "tanpa nama"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">{it.merchant || (isIn(it) ? "Uang masuk" : "Tanpa nama merchant")}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {it.source === "sms" ? <MessageSquareText className="w-3 h-3 inline -mt-0.5 mr-1" /> : <CreditCard className="w-3 h-3 inline -mt-0.5 mr-1" />}
                  {SOURCE_TEXT[it.source] || "Apple Pay"} · {asset ? assetLabel(asset) : it.card_name || it.label} · {fmtTime(it.occurred_at)}
                </p>
              </div>
              <p className={`font-heading font-extrabold tabular-nums shrink-0 ${isIn(it) ? "text-success" : ""}`}>{Number(d.amount) > 0 ? `${isIn(it) ? "+" : "−"}${formatMoney(Number(d.amount), cur)}` : "—"}</p>
            </div>

            {curMismatch(it) && (
              <div className="mt-3 rounded-2xl bg-destructive/10 text-destructive px-3 py-2 text-xs flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Mata uang rekening {assetLabel(asset)} kini {String(asset.currency || "IDR").toUpperCase()}, sedangkan transaksi ini {cur}. Abaikan item ini lalu catat manual dengan nominal yang benar.</span>
              </div>
            )}
            {it.review_reason && (
              <div className="mt-3 rounded-2xl bg-warning/10 text-warning px-3 py-2 text-xs flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{it.review_reason}{/^Nominal/.test(it.review_reason) ? `${it.raw_amount ? ` — terkirim: "${it.raw_amount}"` : ""}. Periksa nominal sebelum menyimpan.` : ""}</span>
              </div>
            )}

            {it.raw_text && (
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none">Isi SMS</summary>
                <p className="mt-1 whitespace-pre-wrap break-words rounded-xl bg-muted/50 px-3 py-2" dir="auto">{it.raw_text}</p>
              </details>
            )}

            <div className="mt-3 grid gap-2">
              {it.review_reason && (
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">Nominal ({cur})</span>
                  <MoneyInput className="input" currency={cur} value={d.amount} onChange={(v) => setDraft(it.id, { amount: v })} aria-label="Nominal" />
                </label>
              )}
              {accountOptions.length > 1 && (
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">Rekening · {it.card_name || it.label}</span>
                  <NativeSelect className="input" value={d.asset_id} sheetTitle="Rekening" aria-label="Rekening" onChange={(e) => setDraft(it.id, { asset_id: e.target.value })}>
                    {accountOptions.map((a) => <option key={a.id} value={a.id}>{assetLabel(a)}</option>)}
                  </NativeSelect>
                </label>
              )}
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Kategori{it.suggested_category && d.category === it.suggested_category ? (it.suggested_source === "keyword" ? " · ditebak dari nama toko" : " · dari riwayat merchant ini") : ""}</span>
                <NativeSelect className="input" value={d.category} sheetTitle="Kategori" aria-label="Kategori" onChange={(e) => setDraft(it.id, { category: e.target.value })}>
                  <option value="">Pilih kategori…</option>
                  {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </NativeSelect>
              </label>
            </div>

            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-secondary btn-sm" disabled={!!busy} onClick={() => onDismiss(it)}>Abaikan</button>
              <button type="button" className="btn-primary btn-sm flex-1" disabled={!!busy || !d.category || !(Number(d.amount) > 0) || curMismatch(it)} onClick={() => onSave(it)}>
                {busy === it.id ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ----------------------------- Sambungan ----------------------------- */

function ConnectTab() {
  const { data: me } = useMe();
  const { data: devices = [], isLoading: loadingDevices } = useIngestDevices();
  const { data: cards = [], isLoading: loadingCards } = usePaymentCards();
  const { data: assets = [] } = useAssets();
  const invalidate = useInvalidate();
  const [deviceSheet, setDeviceSheet] = useState(false);
  const [setupToken, setSetupToken] = useSetupToken();
  const [cardSheet, setCardSheet] = useState(null); // null | {} | kartu

  const ownAssets = useMemo(
    () => assets.filter((a) => a.created_by_id === me?.id && CARD_ACCOUNT_TYPES.includes(a.type || "bank")),
    [assets, me?.id],
  );
  const assetById = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);
  const activeDevices = devices.filter((d) => !d.revoked);
  // Kartu yang relevan untuk Catat Otomatis: yang baru terdeteksi lebih dulu.
  const autoCards = cards.filter((c) => c.status === "unmapped" || c.wallet_label || c.last4 || c.status === "active")
    .sort((a, b) => (a.status === "unmapped" ? -1 : 0) - (b.status === "unmapped" ? -1 : 0));

  const revoke = async (d) => {
    if (!(await confirmAction({ title: `Cabut akses ${d.name}?`, description: "Shortcut di perangkat ini berhenti mengirim transaksi. Tidak bisa dibatalkan — buat token baru bila perlu.", confirmText: "Cabut" }))) return;
    try { await manage({ action: "revoke_device", device_id: d.id }); await invalidate(); toast.success("Akses dicabut"); }
    catch (e) { toast.error(msg(e, "Gagal mencabut")); }
  };

  const quickIgnore = async (c) => {
    try { await manageCards({ action: "set_status", card_id: c.id, status: "ignored" }); await invalidate(); }
    catch (e) { toast.error(msg(e, "Gagal menyimpan")); }
  };

  return (
    <div className="space-y-7">
      {/* Perangkat */}
      <section aria-labelledby="ai-devices">
        <div className="mb-2.5 flex items-end justify-between gap-2">
          <div>
            <h2 id="ai-devices" className="font-semibold text-[17px] leading-tight">1. iPhone tersambung</h2>
            <p className="text-xs text-muted-foreground">Setiap iPhone punya token sendiri & bisa dicabut kapan saja</p>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setDeviceSheet(true)}><Plus className="w-4 h-4" /> Tambah</button>
        </div>
        {loadingDevices ? <ListSkeleton rows={1} /> : activeDevices.length === 0 ? (
          <div className="surface rounded-3xl p-5 text-sm text-muted-foreground text-center">Belum ada iPhone. Tekan Tambah untuk membuat token.</div>
        ) : (
          <div className="surface rounded-3xl divide-y divide-border">
            {activeDevices.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                <Smartphone className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{d.name} <span className="text-muted-foreground font-normal">··{d.token_hint}</span></p>
                  <p className="text-xs text-muted-foreground">{d.last_used_at ? `Terakhir mengirim ${fmtTime(d.last_used_at)}` : "Belum pernah mengirim"}</p>
                </div>
                <button type="button" className="btn-icon btn-icon-sm" aria-label={`Cabut ${d.name}`} onClick={() => revoke(d)}><Ban className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Kartu → rekening */}
      <section aria-labelledby="ai-cards">
        <div className="mb-2.5 flex items-end justify-between gap-2">
          <div>
            <h2 id="ai-cards" className="font-semibold text-[17px] leading-tight">2. Kartu → rekening</h2>
            <p className="text-xs text-muted-foreground">Hanya kartu aktif yang dicatat. Kartu lain dibuang tanpa menyimpan nominal.</p>
          </div>
          <Link to="/kartu" className="btn-secondary btn-sm"><IdCard className="w-4 h-4" /> Semua kartu</Link>
        </div>
        {loadingCards ? <ListSkeleton rows={1} /> : autoCards.length === 0 ? (
          <div className="surface rounded-3xl p-5 text-sm text-muted-foreground text-center">Belum ada kartu. Setelah pembayaran Apple Pay / SMS bank pertama, kartunya muncul di sini untuk dihubungkan.</div>
        ) : (
          <div className="surface rounded-3xl divide-y divide-border">
            {autoCards.map((c) => {
              const a = assetById[c.asset_id];
              return (
                <div key={c.id} className="px-4 py-3">
                  <button type="button" className="w-full flex items-center gap-3 text-left" onClick={() => setCardSheet(c)}>
                    <CreditCard className={`w-5 h-5 shrink-0 ${c.status === "unmapped" ? "text-warning" : "text-muted-foreground"}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold truncate">{c.display_name}{c.last4 ? <span className="font-mono text-muted-foreground font-normal"> ••{c.last4}</span> : null}</span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {c.status === "unmapped" ? "Terdeteksi, belum terhubung — transaksinya tidak disimpan" : STATUS_LABEL[c.status] || c.status}
                        {a ? ` · ${assetLabel(a)}` : ""}{c.wallet_label ? ` · ${c.wallet_label}` : ""}{c.last_seen_at ? ` · terakhir ${fmtTime(c.last_seen_at)}` : ""}
                      </span>
                    </span>
                  </button>
                  {c.status === "unmapped" && (
                    <div className="mt-2.5 pl-8 flex gap-2">
                      <button type="button" className="btn-primary btn-sm flex-1" onClick={() => setCardSheet(c)}><Link2 className="w-4 h-4" /> Hubungkan</button>
                      <button type="button" className="btn-secondary btn-sm" onClick={() => quickIgnore(c)}><Ban className="w-4 h-4" /> Abaikan</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <SetupGuide
        hasToken={activeDevices.length > 0}
        token={setupToken}
        onClearToken={() => setSetupToken(null)}
        onNewToken={() => setDeviceSheet(true)}
        exampleLabel={cards.find((c) => c.status === "active" && c.wallet_label)?.wallet_label}
      />

      {deviceSheet && (
        <DeviceSheet
          onClose={() => setDeviceSheet(false)}
          onCreated={(token) => {
            setDeviceSheet(false); setSetupToken(token); invalidate();
            // Langsung ke panduan: token & langkah pemasangan tampil di tempat yang sama.
            setTimeout(() => document.getElementById("ai-guide")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
          }}
        />
      )}
      {cardSheet && (
        <CardSheet
          initial={cardSheet}
          assets={ownAssets}
          onClose={() => setCardSheet(null)}
          onSaved={() => { setCardSheet(null); invalidate(); }}
        />
      )}
    </div>
  );
}

function DeviceSheet({ onClose, onCreated }) {
  const [name, setName] = useState("iPhone");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try { const res = await manage({ action: "create_device", name }); onCreated(res.token); }
    catch (e) { toast.error(msg(e, "Gagal membuat token")); setSaving(false); }
  };
  return (
    <FormSheet title="Tambah iPhone" subtitle="Token tampil di panduan pemasangan, bisa disalin sambil mengikuti langkahnya" onClose={onClose}
      footer={<button type="button" className="btn-primary w-full" disabled={saving || !name.trim()} onClick={submit}>{saving ? "Membuat…" : "Buat token"}</button>}>
      <FieldGroup>
        <FieldRow icon={Smartphone} label="Nama perangkat" htmlFor="ai-device-name">
          <input id="ai-device-name" className={fieldInput} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="iPhone Mika" />
        </FieldRow>
      </FieldGroup>
    </FormSheet>
  );
}

// Token baru disimpan sementara di sesi tab ini (30 menit) agar bisa disalin
// berulang sambil bolak-balik ke app Pintasan. Tidak pernah dikirim ke server
// lagi & hilang saat tab ditutup, kedaluwarsa, atau "Selesai" ditekan.
const SETUP_KEY = "nafkita.ingest.setupToken";
const SETUP_TTL_MS = 30 * 60 * 1000;
function readSetupToken() {
  try {
    const v = JSON.parse(sessionStorage.getItem(SETUP_KEY) || "null");
    return v && v.exp > Date.now() ? v : null;
  } catch { return null; }
}
function useSetupToken() {
  const [entry, setEntry] = useState(readSetupToken);
  useEffect(() => {
    if (!entry) return undefined;
    const t = setTimeout(() => setEntry(null), Math.max(0, entry.exp - Date.now()));
    return () => clearTimeout(t);
  }, [entry]);
  const set = (token) => {
    const next = token ? { token, exp: Date.now() + SETUP_TTL_MS } : null;
    try { if (next) sessionStorage.setItem(SETUP_KEY, JSON.stringify(next)); else sessionStorage.removeItem(SETUP_KEY); } catch { /* penyimpanan diblokir */ }
    setEntry(next);
  };
  return [entry, set];
}

function CopyRow({ label, value, copyText, mono = true }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground mb-1">{label}</p>
      <div className="flex gap-2 items-center">
        <code className={`flex-1 min-w-0 break-all text-xs surface rounded-xl px-3 py-2 ${mono ? "font-mono" : ""}`}>{value}</code>
        <CopyButton text={copyText ?? value} />
      </div>
    </div>
  );
}

// "Bahan pemasangan": URL, token & header di satu kartu di atas langkah-langkah.
function SetupKit({ token, hasToken, onClear, onNewToken }) {
  const url = endpointUrl();
  const mins = token ? Math.max(1, Math.round((token.exp - Date.now()) / 60000)) : 0;
  return (
    <div className="surface rounded-3xl p-4 space-y-3 border border-primary/20">
      <p className="text-sm font-semibold">Bahan pemasangan</p>
      {token ? (
        <>
          <CopyRow label="Token (tempel saat shortcut “Kirim ke Nafkita” meminta)" value={token.token} />
          <CopyRow label="Header Authorization (cara manual)" value={`Bearer ${token.token.slice(0, 10)}…`} copyText={`Bearer ${token.token}`} />
        </>
      ) : (
        <div className="rounded-2xl bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground flex items-center justify-between gap-3">
          <span>{hasToken ? "Token lama tidak bisa dilihat lagi (disimpan terenkripsi). Butuh untuk memasang? Buat token baru." : "Belum ada token."}</span>
          <button type="button" className="btn-secondary btn-sm shrink-0" onClick={onNewToken}><Plus className="w-4 h-4" /> Token</button>
        </div>
      )}
      <CopyRow label="URL" value={url} />
      {token && (
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] text-muted-foreground flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 text-warning" />
            Tampil di perangkat ini ±{mins} menit lagi agar bisa disalin sambil memasang. Jangan bagikan shortcut yang berisi token.</p>
          <button type="button" className="btn-secondary btn-sm shrink-0" onClick={onClear}>Selesai</button>
        </div>
      )}
    </div>
  );
}

function GuideSteps({ steps }) {
  return (
    <ol className="surface rounded-3xl divide-y divide-border">
      {steps.map(([t, d, action], i) => (
        <li key={t} className="flex gap-3 px-4 py-3">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{d}</p>
            {action && <div className="mt-2">{action}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function SetupGuide({ hasToken, token, onClearToken, onNewToken, exampleLabel }) {
  const label = exampleLabel || "rajhi-harian";
  const [mode, setMode] = useState("apple_pay");
  const url = endpointUrl();
  // Tombol salin langsung di langkah yang membutuhkannya — tidak perlu bolak-balik.
  const copyToken = token ? <CopyButton text={token.token} label="Salin token" /> : null;
  const copyUrl = <CopyButton text={url} label="Salin URL" />;
  const copyHeader = token ? <CopyButton text={`Bearer ${token.token}`} label="Salin header" /> : null;
  const tokenStep = ["Buat token", token ? "Token siap — ada di kartu Bahan pemasangan di atas." : hasToken ? "Token lama tidak bisa ditampilkan lagi. Bila perlu memasang ulang, buat token baru lalu cabut yang lama." : "Tekan + Token di atas (atau Tambah di bagian 1)."];
  // Cara cepat: satu shortcut siap pakai + satu otomasi untuk semua kartu.
  // Label otomatis = nama kartu di Wallet; kartu baru muncul di bagian 2 untuk dihubungkan.
  const quick = [
    tokenStep,
    ["Pasang shortcut \"Kirim ke Nafkita\"", SHORTCUT_URL ? "Tekan tombol di bawah → Tambah Pintasan → tempel token saat ditanya." : "Tautan shortcut belum tersedia — gunakan cara manual di bawah.", copyToken],
    ["Uji dengan tombol ▶", "Jalankan shortcut sekali dari app Pintasan. Bila muncul \"Terhubung ✓\", sambungan beres (tidak ada transaksi yang dibuat)."],
    ["Buat SATU otomasi untuk semua kartu", "Pintasan → Otomasi → + → Wallet (iOS 17–18: \"Transaksi\"). Centang semua kartu yang ingin dicatat → Jalankan Segera."],
    ["Isi aksinya", "Tambah aksi \"Jalankan Pintasan\" → pilih \"Kirim ke Nafkita\" → masukan: Input Pintasan."],
    ["Bayar sekali, lalu hubungkan", "Setelah pembayaran pertama, tiap kartu muncul di bagian 2 sebagai \"Belum terhubung\". Ketuk Hubungkan → pilih rekeningnya. Pembayaran berikutnya langsung masuk Kotak Masuk."],
  ];
  const manual = [
    ["Siapkan kartu", `Di halaman Kartu, isi Label Apple Pay tiap kartu (mis. "${label}") dan pilih rekeningnya.`],
    ["Buka Pintasan → Otomasi → +", "Pilih pemicu Wallet. Pilih SATU kartu, lalu Jalankan Segera."],
    ["Tambah aksi \"Dapatkan Konten URL\"", "Tempel URL. Metode: POST. Header: Authorization = Bearer nfk_…", <div className="flex flex-wrap gap-2">{copyUrl}{copyHeader}</div>],
    ["Isi Minta Isi (JSON), semua jenis Teks", `label = ${label} · amount = Input Pintasan (Jenis: Transaksi) → Jumlah · merchant = Input Pintasan → Penjual · name = Input Pintasan → Nama (cadangan bila Penjual kosong).`],
    ["Ulangi per kartu", "Satu otomasi per kartu dengan label berbeda."],
  ];
  // SMS bank (Al Rajhi, D360, bank Indonesia). Kartu dicocokkan lewat 4 digit
  // terakhir di SMS; SMS OTP & promo dibuang tanpa disimpan.
  const sms = [
    tokenStep,
    ["Isi 4 digit terakhir kartu", "Di halaman Kartu, pastikan tiap kartu punya 4 digit terakhir & rekening. SMS \"…kartu ****0315…\" otomatis masuk ke kartu ••0315."],
    ["Pintasan → Otomasi → + → Pesan", "Pesan Berisi: kata yang selalu ada di SMS transaksi bank Anda (mis. \"SAR\", \"مبلغ\", atau \"Rp\"). Pilih Jalankan Segera."],
    ["Tambah aksi \"Dapatkan Konten URL\"", "Tempel URL. Metode: POST. Header: Authorization = Bearer nfk_…", <div className="flex flex-wrap gap-2">{copyUrl}{copyHeader}</div>],
    ["Isi Minta Isi (JSON), jenis Teks", "text = Input Pintasan → Isi · sender = Input Pintasan → Pengirim · label (opsional) = nama bank, mis. alrajhi."],
    ["Cek di Kotak Masuk", "Uang keluar jadi pengeluaran, uang masuk (gaji, transfer masuk) jadi pemasukan. Isi SMS bisa dibuka di tiap item untuk dicek."],
  ];
  return (
    <section aria-labelledby="ai-guide" className="space-y-3">
      <div>
        <h2 id="ai-guide" className="font-semibold text-[17px] leading-tight"><BookOpen className="w-4 h-4 inline -mt-1 mr-1" />3. Pasang di iPhone (±3 menit, sekali saja)</h2>
        <p className="text-xs text-muted-foreground">Apple Pay menangkap pembayaran kartu di iPhone. SMS bank menangkap transaksi kartu fisik, transfer & uang masuk.</p>
      </div>
      <SetupKit token={token} hasToken={hasToken} onClear={onClearToken} onNewToken={onNewToken} />
      <ChipChoice ariaLabel="Sumber" size="sm" value={mode} onChange={setMode}
        options={[{ value: "apple_pay", label: "Apple Pay" }, { value: "sms", label: "SMS bank" }]} />
      {mode === "apple_pay" ? (
        <>
          {SHORTCUT_URL && (
            <a href={SHORTCUT_URL} target="_blank" rel="noreferrer" className="btn-primary w-full"><Smartphone className="w-4 h-4" /> Pasang shortcut &quot;Kirim ke Nafkita&quot;</a>
          )}
          <GuideSteps steps={quick} />
          <details className="surface rounded-3xl">
            <summary className="px-4 py-3 text-sm font-semibold cursor-pointer select-none">Cara manual (tanpa tautan shortcut)</summary>
            <div className="px-1 pb-1"><GuideSteps steps={manual} /></div>
          </details>
        </>
      ) : (
        <>
          <GuideSteps steps={sms} />
          <p className="text-[11px] text-muted-foreground px-1">SMS berisi kode OTP tidak pernah dicatat. Bila satu pembelian masuk dari Apple Pay dan SMS sekaligus, Nafkita menandainya agar tidak dobel.</p>
        </>
      )}
    </section>
  );
}
