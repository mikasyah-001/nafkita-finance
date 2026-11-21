import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Inbox, Smartphone, Tag, Plus, Copy, Check, Trash2, Ban, AlertTriangle, CreditCard, Link2, BookOpen,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import {
  useAssets, useCategories, useMe, useIncomingTransactions, useIngestDevices, useCardLabels,
} from "@/hooks/useFinance";
import { saveTransactionWithAsset } from "@/lib/linkedAsset";
import { formatMoney } from "@/lib/finance";
import { assetLabel } from "@/lib/bankAccount";
import { normalizeLabel } from "../../base44/shared/autoIngest.js";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import FormSheet, { FieldGroup, FieldRow, fieldInput, ChipChoice } from "@/components/FormSheet";
import NativeSelect from "@/components/NativeSelect";
import MoneyInput from "@/components/MoneyInput";
import { confirmAction } from "@/components/ConfirmHost";
import { ListSkeleton } from "@/components/LoadingSkeleton";

// Catat Otomatis — transaksi Apple Pay dikirim Shortcuts iOS ke Nafkita.
// Tab "Kotak Masuk": konfirmasi 1 tap (saldo & laporan baru berubah di sini).
// Tab "Sambungan": perangkat (token), label kartu → rekening, panduan setup.

const LINKABLE_TYPES = ["bank", "tunai", "emas_digital", "lainnya"];
const STATUS_TEXT = { active: "Aktif", paused: "Dijeda", unmapped: "Belum terhubung", ignored: "Diabaikan" };

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
    <button type="button" onClick={copy} className="btn-secondary btn-sm shrink-0" aria-label={`${label}: ${text.slice(0, 20)}`}>
      {done ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {done ? "Tersalin" : label}
    </button>
  );
}

export default function AutoIngest() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "sambungan" ? "sambungan" : "masuk";
  const { data: incoming = [] } = useIncomingTransactions();
  const { data: labels = [] } = useCardLabels();
  const unmapped = labels.filter((l) => l.status === "unmapped").length;

  return (
    <div className="px-5 pt-6 pb-8">
      <PageHeader title="Catat Otomatis" subtitle="Transaksi Apple Pay masuk sendiri, Anda tinggal konfirmasi" back />
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
  const { data: items = [], isLoading } = useIncomingTransactions();
  const { data: assets = [] } = useAssets();
  const { data: categories = [] } = useCategories();
  const { data: devices = [] } = useIngestDevices();
  const invalidate = useInvalidate();
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(null);

  const assetById = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);
  const expenseCats = useMemo(() => categories.filter((c) => (c.type || "expense") === "expense").map((c) => c.name), [categories]);

  const draftOf = (it) => ({
    category: drafts[it.id]?.category ?? it.suggested_category ?? "",
    amount: drafts[it.id]?.amount ?? (it.amount > 0 ? String(it.amount) : ""),
  });
  const setDraft = (id, patch) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const isReady = (it) => { const d = draftOf(it); return !!d.category && Number(d.amount) > 0 && !it.review_reason; };

  const saveOne = async (it) => {
    const d = draftOf(it);
    if (!d.category) throw new Error("Pilih kategori dulu");
    if (!(Number(d.amount) > 0)) throw new Error("Isi nominal");
    const res = await saveTransactionWithAsset({
      type: "expense",
      amount: Number(d.amount),
      currency: it.currency || assetById[it.asset_id]?.currency || "IDR",
      category: d.category,
      date: it.occurred_at || new Date().toISOString(),
      merchant: it.merchant || "",
      notes: `Otomatis dari Apple Pay (${it.label})`,
      tags: ["apple-pay"],
      visibility: "shared",
      linked_asset_id: it.asset_id || undefined,
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
            ? "Bayar dengan Apple Pay memakai kartu yang sudah diberi label — transaksinya akan muncul di sini."
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
        const asset = assetById[it.asset_id];
        const cur = it.currency || asset?.currency || "IDR";
        const catOptions = d.category && !expenseCats.includes(d.category) ? [d.category, ...expenseCats] : expenseCats;
        return (
          <article key={it.id} className="surface rounded-3xl p-4" aria-label={`Transaksi ${it.merchant || "tanpa nama"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">{it.merchant || "Tanpa nama merchant"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  <CreditCard className="w-3 h-3 inline -mt-0.5 mr-1" />{asset ? assetLabel(asset) : it.label} · {fmtTime(it.occurred_at)}
                </p>
              </div>
              <p className="font-heading font-extrabold tabular-nums shrink-0">{Number(d.amount) > 0 ? `−${formatMoney(Number(d.amount), cur)}` : "—"}</p>
            </div>

            {it.review_reason && (
              <div className="mt-3 rounded-2xl bg-warning/10 text-warning px-3 py-2 text-xs flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{it.review_reason}{it.raw_amount ? ` — terkirim: "${it.raw_amount}"` : ""}. Periksa nominal sebelum menyimpan.</span>
              </div>
            )}

            <div className="mt-3 grid gap-2">
              {it.review_reason && (
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">Nominal ({cur})</span>
                  <MoneyInput className="input" currency={cur} value={d.amount} onChange={(v) => setDraft(it.id, { amount: v })} aria-label="Nominal" />
                </label>
              )}
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Kategori{it.suggested_category && d.category === it.suggested_category ? " · dari riwayat merchant ini" : ""}</span>
                <NativeSelect className="input" value={d.category} sheetTitle="Kategori" aria-label="Kategori" onChange={(e) => setDraft(it.id, { category: e.target.value })}>
                  <option value="">Pilih kategori…</option>
                  {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </NativeSelect>
              </label>
            </div>

            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-secondary btn-sm" disabled={!!busy} onClick={() => onDismiss(it)}>Abaikan</button>
              <button type="button" className="btn-primary btn-sm flex-1" disabled={!!busy || !d.category || !(Number(d.amount) > 0)} onClick={() => onSave(it)}>
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
  const { data: labels = [], isLoading: loadingLabels } = useCardLabels();
  const { data: assets = [] } = useAssets();
  const invalidate = useInvalidate();
  const [deviceSheet, setDeviceSheet] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [labelSheet, setLabelSheet] = useState(null); // null | {} | label

  const ownAssets = useMemo(
    () => assets.filter((a) => a.created_by_id === me?.id && LINKABLE_TYPES.includes(a.type || "bank")),
    [assets, me?.id],
  );
  const assetById = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);
  const activeDevices = devices.filter((d) => !d.revoked);
  const sortedLabels = [...labels].sort((a, b) => (a.status === "unmapped" ? -1 : 0) - (b.status === "unmapped" ? -1 : 0));

  const revoke = async (d) => {
    if (!(await confirmAction({ title: `Cabut akses ${d.name}?`, description: "Shortcut di perangkat ini berhenti mengirim transaksi. Tidak bisa dibatalkan — buat token baru bila perlu.", confirmText: "Cabut" }))) return;
    try { await manage({ action: "revoke_device", device_id: d.id }); await invalidate(); toast.success("Akses dicabut"); }
    catch (e) { toast.error(msg(e, "Gagal mencabut")); }
  };

  const quickIgnore = async (l) => {
    try { await manage({ action: "save_label", label_id: l.id, label: l.label, status: "ignored" }); await invalidate(); }
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

      {/* Label kartu */}
      <section aria-labelledby="ai-labels">
        <div className="mb-2.5 flex items-end justify-between gap-2">
          <div>
            <h2 id="ai-labels" className="font-semibold text-[17px] leading-tight">2. Label kartu → rekening</h2>
            <p className="text-xs text-muted-foreground">Hanya label aktif yang dicatat. Label lain dibuang tanpa menyimpan nominal.</p>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setLabelSheet({})}><Plus className="w-4 h-4" /> Label</button>
        </div>
        {loadingLabels ? <ListSkeleton rows={1} /> : sortedLabels.length === 0 ? (
          <div className="surface rounded-3xl p-5 text-sm text-muted-foreground text-center">Belum ada label. Contoh: <b>rajhi-harian</b> → rekening Al Rajhi.</div>
        ) : (
          <div className="surface rounded-3xl divide-y divide-border">
            {sortedLabels.map((l) => {
              const a = assetById[l.asset_id];
              return (
                <div key={l.id} className="px-4 py-3">
                  <button type="button" className="w-full flex items-center gap-3 text-left" onClick={() => setLabelSheet(l)}>
                    <Tag className={`w-5 h-5 shrink-0 ${l.status === "unmapped" ? "text-warning" : "text-muted-foreground"}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold truncate font-mono">{l.label}</span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {l.status === "unmapped" ? "Terdeteksi dari iPhone, belum terhubung — transaksinya tidak disimpan" : STATUS_TEXT[l.status] || l.status}
                        {a ? ` · ${assetLabel(a)}` : ""}{l.last_seen_at ? ` · terakhir ${fmtTime(l.last_seen_at)}` : ""}
                      </span>
                    </span>
                  </button>
                  {l.status === "unmapped" && (
                    <div className="mt-2.5 pl-8 flex gap-2">
                      <button type="button" className="btn-primary btn-sm flex-1" onClick={() => setLabelSheet(l)}><Link2 className="w-4 h-4" /> Hubungkan</button>
                      <button type="button" className="btn-secondary btn-sm" onClick={() => quickIgnore(l)}><Ban className="w-4 h-4" /> Abaikan</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <SetupGuide hasToken={activeDevices.length > 0} exampleLabel={labels.find((l) => l.status === "active")?.label} />

      {deviceSheet && (
        <DeviceSheet
          onClose={() => setDeviceSheet(false)}
          onCreated={(token) => { setDeviceSheet(false); setNewToken(token); invalidate(); }}
        />
      )}
      {newToken && <TokenSheet token={newToken} onClose={() => setNewToken(null)} />}
      {labelSheet && (
        <LabelSheet
          initial={labelSheet}
          assets={ownAssets}
          onClose={() => setLabelSheet(null)}
          onSaved={() => { setLabelSheet(null); invalidate(); }}
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
    <FormSheet title="Tambah iPhone" subtitle="Token dibuat sekali & hanya ditampilkan sekarang" onClose={onClose}
      footer={<button type="button" className="btn-primary w-full" disabled={saving || !name.trim()} onClick={submit}>{saving ? "Membuat…" : "Buat token"}</button>}>
      <FieldGroup>
        <FieldRow icon={Smartphone} label="Nama perangkat" htmlFor="ai-device-name">
          <input id="ai-device-name" className={fieldInput} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="iPhone Mika" />
        </FieldRow>
      </FieldGroup>
    </FormSheet>
  );
}

function TokenSheet({ token, onClose }) {
  const url = endpointUrl();
  return (
    <FormSheet title="Token siap" subtitle="Salin sekarang — setelah ditutup token tidak bisa dilihat lagi" onClose={onClose} wide
      footer={<button type="button" className="btn-primary w-full" onClick={onClose}>Sudah saya salin</button>}>
      <div className="rounded-2xl bg-warning/10 text-warning px-3 py-2 text-xs flex gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>Siapa pun yang memegang token ini bisa menambah item ke kotak masuk Anda (tidak bisa membaca data). Jangan bagikan shortcut yang berisi token.</span>
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1.5">Header Authorization</p>
        <div className="flex gap-2 items-center">
          <code className="flex-1 min-w-0 break-all text-xs surface rounded-xl px-3 py-2">Bearer {token}</code>
          <CopyButton text={`Bearer ${token}`} />
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1.5">URL</p>
        <div className="flex gap-2 items-center">
          <code className="flex-1 min-w-0 break-all text-xs surface rounded-xl px-3 py-2">{url}</code>
          <CopyButton text={url} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Lanjutkan dengan langkah 3 (Panduan pemasangan) di halaman Sambungan.</p>
    </FormSheet>
  );
}

function LabelSheet({ initial, assets, onClose, onSaved }) {
  const isEdit = !!initial.id;
  const [label, setLabel] = useState(initial.label || "");
  const [assetId, setAssetId] = useState(initial.asset_id || "");
  const [status, setStatus] = useState(initial.status && initial.status !== "unmapped" ? initial.status : "active");
  const [saving, setSaving] = useState(false);
  const preview = normalizeLabel(label);

  const submit = async () => {
    setSaving(true);
    try {
      await manage({ action: "save_label", label_id: initial.id, label, asset_id: assetId || undefined, status });
      toast.success("Label tersimpan");
      onSaved();
    } catch (e) { toast.error(msg(e, "Gagal menyimpan label")); setSaving(false); }
  };
  const remove = async () => {
    if (!(await confirmAction({ title: `Hapus label ${initial.label}?`, description: "Transaksi dengan label ini akan dianggap label baru (tidak dicatat) sampai dihubungkan lagi." }))) return;
    try { await manage({ action: "delete_label", label_id: initial.id }); onSaved(); }
    catch (e) { toast.error(msg(e, "Gagal menghapus")); }
  };

  return (
    <FormSheet
      title={initial.status === "unmapped" ? "Hubungkan label" : isEdit ? "Ubah label" : "Label baru"}
      subtitle="Ketik label yang sama persis di shortcut iPhone"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {isEdit && <button type="button" className="btn-secondary" aria-label="Hapus label" onClick={remove}><Trash2 className="w-4 h-4" /></button>}
          <button type="button" className="btn-primary flex-1" disabled={saving || !preview || (status !== "ignored" && !assetId)} onClick={submit}>{saving ? "Menyimpan…" : "Simpan"}</button>
        </div>
      }
    >
      <FieldGroup>
        <FieldRow icon={Tag} label="Label" htmlFor="ai-label" hint={preview && preview !== label ? `Disimpan sebagai: ${preview}` : "Huruf kecil, angka, tanda -. Contoh: rajhi-harian"}>
          <input id="ai-label" className={`${fieldInput} font-mono`} value={label} maxLength={40} autoCapitalize="none" autoCorrect="off" onChange={(e) => setLabel(e.target.value)} placeholder="rajhi-harian" />
        </FieldRow>
        <FieldRow icon={CreditCard} label="Rekening tujuan" htmlFor="ai-asset" hint={assets.length ? "Mata uang transaksi mengikuti rekening ini" : "Belum ada aset bank milik Anda — tambahkan di menu Aset"}>
          <NativeSelect id="ai-asset" className={fieldInput} value={assetId} sheetTitle="Rekening tujuan" aria-label="Rekening tujuan" onChange={(e) => setAssetId(e.target.value)}>
            <option value="">Pilih rekening…</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{assetLabel(a)} ({a.currency || "IDR"})</option>)}
          </NativeSelect>
        </FieldRow>
      </FieldGroup>
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Status</p>
        <ChipChoice ariaLabel="Status label" value={status} onChange={setStatus}
          options={[{ value: "active", label: "Catat" }, { value: "paused", label: "Jeda" }, { value: "ignored", label: "Abaikan selalu" }]} />
      </div>
    </FormSheet>
  );
}

function SetupGuide({ hasToken, exampleLabel }) {
  const label = exampleLabel || "rajhi-harian";
  const steps = [
    ["Buat label", `Di bagian 2, buat label untuk tiap kartu (mis. "${label}") dan pilih rekeningnya.`],
    ["Buat token", hasToken ? "Sudah ada token. Bila lupa menyalin, buat token baru lalu cabut yang lama." : "Di bagian 1, tekan Tambah, lalu salin URL & header Authorization."],
    ["Buka Shortcuts → Automation → +", "Pilih pemicu Wallet (iOS 17–18: \"Transaction\"). Pilih SATU kartu, lalu \"Run Immediately\" dan matikan \"Notify When Run\"."],
    ["Tambah aksi \"Get Contents of URL\"", "Tempel URL. Method: POST. Headers: Authorization = (tempel \"Bearer nfk_…\")."],
    ["Isi Request Body (JSON)", `label = ${label} (teks tetap) · amount = Shortcut Input → Amount · merchant = Shortcut Input → Merchant · card = Shortcut Input → Card.`],
    ["Ulangi per kartu", "Satu otomasi per kartu, masing-masing dengan label berbeda. Kartu tanpa otomasi tidak akan pernah terkirim."],
    ["Uji", "Bayar dengan Apple Pay. Dalam beberapa detik item muncul di Kotak Masuk. Label yang belum dibuat muncul di bagian 2 sebagai \"Belum terhubung\"."],
  ];
  return (
    <section aria-labelledby="ai-guide">
      <div className="mb-2.5">
        <h2 id="ai-guide" className="font-semibold text-[17px] leading-tight"><BookOpen className="w-4 h-4 inline -mt-1 mr-1" />3. Panduan pemasangan (±2 menit per kartu)</h2>
        <p className="text-xs text-muted-foreground">Hanya untuk iPhone dengan Apple Pay. Transfer, QRIS & kartu fisik tidak tertangkap.</p>
      </div>
      <ol className="surface rounded-3xl divide-y divide-border">
        {steps.map(([t, d], i) => (
          <li key={t} className="flex gap-3 px-4 py-3">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{d}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
