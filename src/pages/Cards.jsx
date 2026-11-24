import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Lock, LockOpen, ShieldCheck, Eye, Camera, Link2, Ban, Zap, AlertTriangle, Landmark, KeyRound, ImageOff } from "lucide-react";
import { uploadPrivateFile } from "@/lib/upload";
import { useAssets, useMe, usePaymentCards } from "@/hooks/useFinance";
import { assetLabel } from "@/lib/bankAccount";
import { expiryState, validExpiry } from "../../base44/shared/cards.js";
import { DEFAULT_BAND, loadImage, renderMasked, canvasToFile } from "@/lib/cardPhoto";
import { cardBg, StarPattern, toneMap, saveSelected } from "@/components/AccountWallet";
import CardSheet, { manageCards, useMigrateLegacyLabels, KIND_LABEL, NETWORK_LABEL, STATUS_LABEL } from "@/components/CardSheet";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import FormSheet, { FieldGroup, FieldRow, fieldInput } from "@/components/FormSheet";
import Money from "@/components/Money";
import { ListSkeleton } from "@/components/LoadingSkeleton";

// Dompet kartu: kartu debit/kredit/e-money milik sendiri, dikelompokkan per
// rekening. Detail (masa berlaku, nama di kartu, foto depan tersamar) terkunci
// PIN Nafkita 6 angka; token buka hanya di memori dan habis dalam 3 menit.

const ACCOUNT_TYPES = ["bank", "tunai", "lainnya"];
const msg = (e, fallback) => e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback;
const fmtExp = (m, y) => (m && y ? `${String(m).padStart(2, "0")}/${String(y).slice(-2)}` : "—");

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["autoIngest"] });
}

// Sesi buka PIN (memori saja; tidak pernah disimpan di perangkat).
function useVault() {
  const [session, setSession] = useState(null); // { token, expiresAt }
  useEffect(() => {
    if (!session) return undefined;
    const ms = new Date(session.expiresAt).getTime() - Date.now();
    const t = setTimeout(() => setSession(null), Math.max(0, ms));
    return () => clearTimeout(t);
  }, [session]);
  const lock = async () => { setSession(null); try { await manageCards({ action: "lock" }); } catch { /* sudah terkunci di memori */ } };
  return { token: session?.token || null, expiresAt: session?.expiresAt, open: (token, expiresAt) => setSession({ token, expiresAt }), lock };
}

export function PaymentCardVisual({ card, tone = 0, asset, compact = false }) {
  const exp = card._details ? fmtExp(card._details.exp_month, card._details.exp_year) : "••/••";
  return (
    <div className={`relative rounded-[22px] overflow-hidden p-4 text-[hsl(var(--hero-foreground))] ${compact ? "aspect-[1.9/1]" : "aspect-[1.586/1]"}`} style={{ background: cardBg(tone) }}>
      <StarPattern id={`nk-card-${card.id}`} />
      <div className="absolute left-4 right-4 top-0 h-[3px] rounded-b-full bg-gold/80" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading font-bold text-[15px] leading-tight truncate">{card.display_name}</p>
          <p className="text-[11px] opacity-65 truncate">{[card.issuer, KIND_LABEL[card.kind]].filter(Boolean).join(" · ")}</p>
        </div>
        <span className="text-[10px] font-bold tracking-wider rounded-full px-2 py-0.5 border border-gold/50 text-gold shrink-0">{NETWORK_LABEL[card.network] || "Kartu"}</span>
      </div>
      <div className="absolute left-4 right-4 bottom-3.5">
        <p className="font-mono text-[17px] tracking-[0.18em] tabular-nums">•••• •••• •••• {card.last4 || "····"}</p>
        <div className="mt-1 flex items-center justify-between text-[11px] opacity-75">
          <span className="truncate">{asset ? assetLabel(asset) : card.kind === "credit" ? "Kartu kredit" : "Belum terhubung ke rekening"}</span>
          <span className="tabular-nums shrink-0">{exp}</span>
        </div>
      </div>
    </div>
  );
}

export default function Cards() {
  const { data: me } = useMe();
  const { data: cards = [], isLoading } = usePaymentCards();
  const { data: assets = [] } = useAssets();
  const invalidate = useInvalidate();
  const vault = useVault();
  const [sheet, setSheet] = useState(null);   // kartu untuk CardSheet
  const [detail, setDetail] = useState(null); // id kartu untuk sheet detail
  useMigrateLegacyLabels(cards, isLoading);

  const own = useMemo(() => assets.filter((a) => a.created_by_id === me?.id && ACCOUNT_TYPES.includes(a.type || "bank")), [assets, me?.id]);
  const assetById = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);
  const tones = useMemo(() => toneMap(cards), [cards]);
  const unmapped = cards.filter((c) => c.status === "unmapped");
  const known = cards.filter((c) => c.status !== "unmapped");
  const groups = useMemo(() => {
    const m = new Map();
    for (const c of known) {
      const key = c.asset_id && assetById[c.asset_id] ? c.asset_id : "_none";
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(c);
    }
    return [...m.entries()].sort(([a], [b]) => (a === "_none") - (b === "_none"));
  }, [known, assetById]);

  const ignore = async (c) => {
    try { await manageCards({ action: "set_status", card_id: c.id, status: "ignored" }); await invalidate(); }
    catch (e) { toast.error(msg(e, "Gagal menyimpan")); }
  };

  const current = cards.find((c) => c.id === detail);

  // Datang dari rekening (/kartu?rekening=<id>): langsung buka form kartu
  // dengan rekening, penerbit & nama terisi.
  const [params, setParams] = useSearchParams();
  const fromAccount = params.get("rekening");
  useEffect(() => {
    if (!fromAccount || !assets.length || !me) return;
    const a = own.find((x) => x.id === fromAccount);
    setParams({}, { replace: true });
    if (!a) return;
    const kind = a.type === "bank" ? "debit" : "emoney";
    setSheet({ asset_id: a.id, kind, issuer: a.broker || "", display_name: `${a.broker || a.name} ${kind === "debit" ? "debit" : ""}`.trim() });
  }, [fromAccount, assets.length, own, me, setParams]);

  return (
    <div className="px-5 pt-6 pb-8">
      <PageHeader title="Kartu" subtitle="Kartu debit, kredit & e-money — terhubung ke rekening" back
        actions={<button type="button" className="btn-primary btn-sm" onClick={() => setSheet({})}><Plus className="w-4 h-4" /> Kartu</button>} />

      <div className="surface rounded-2xl px-3.5 py-2.5 text-xs text-muted-foreground flex gap-2 items-start">
        <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-px" />
        <span>Nafkita hanya menyimpan 4 digit terakhir. Nomor lengkap, CVC, PIN ATM & OTP <b>tidak pernah</b> disimpan. Detail kartu terkunci PIN Nafkita.</span>
      </div>

      {unmapped.length > 0 && (
        <section className="mt-6" aria-labelledby="kt-new">
          <h2 id="kt-new" className="font-semibold text-[17px] leading-tight">Terdeteksi, belum terhubung</h2>
          <p className="text-xs text-muted-foreground mb-2.5">Dari Apple Pay / SMS bank. Transaksinya belum dicatat sampai kartu dihubungkan.</p>
          <div className="surface rounded-3xl divide-y divide-border">
            {unmapped.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <p className="text-sm font-semibold truncate">{c.display_name}{c.last4 ? <span className="font-mono text-muted-foreground"> ••{c.last4}</span> : null}</p>
                <p className="text-xs text-muted-foreground">{c.wallet_label ? <span className="font-mono">{c.wallet_label}</span> : "SMS bank"}{c.seen_count ? ` · ${c.seen_count}× terdeteksi` : ""}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" className="btn-primary btn-sm flex-1" onClick={() => setSheet(c)}><Link2 className="w-4 h-4" /> Hubungkan</button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => ignore(c)}><Ban className="w-4 h-4" /> Abaikan</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 space-y-6">
        {isLoading ? <ListSkeleton rows={2} /> : known.length === 0 ? (
          <div className="surface rounded-3xl px-4">
            <EmptyState icon={KeyRound} title="Belum ada kartu" subtitle="Tambahkan kartu debit, kredit, atau e-money dan hubungkan ke rekeningnya." />
          </div>
        ) : groups.map(([key, list]) => {
          const a = assetById[key];
          return (
            <section key={key} aria-label={a ? assetLabel(a) : "Tanpa rekening"}>
              <div className="mb-2.5 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-semibold text-[15px] leading-tight truncate inline-flex items-center gap-1.5"><Landmark className="w-4 h-4 text-muted-foreground" />{a ? assetLabel(a) : "Tanpa rekening"}</h2>
                  {a && <p className="text-xs text-muted-foreground tabular-nums">Saldo <Money value={a.value || 0} currency={a.currency || "IDR"} /></p>}
                </div>
                {a && <Link to="/dompet" onClick={() => saveSelected(a.id)} className="text-xs font-semibold text-primary shrink-0">Lihat dompet</Link>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {list.map((c) => (
                  <button key={c.id} type="button" className="text-left rounded-[22px] focus-visible:ring-2 ring-primary" onClick={() => setDetail(c.id)} aria-label={`Kartu ${c.display_name}`}>
                    <PaymentCardVisual card={c} tone={tones[c.id]} asset={a} compact />
                    <p className="mt-1.5 px-1 text-[11px] text-muted-foreground flex items-center gap-1">
                      <Zap className={`w-3 h-3 ${c.status === "active" ? "text-primary" : ""}`} />{STATUS_LABEL[c.status]}
                      {c.has_details ? <><span aria-hidden="true">·</span><Lock className="w-3 h-3" /> detail tersimpan</> : null}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {sheet && <CardSheet initial={sheet} assets={own} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); invalidate(); }} />}
      {current && (
        <CardDetailSheet card={current} tone={tones[current.id]} asset={assetById[current.asset_id]} vault={vault}
          onEdit={() => { setDetail(null); setSheet(current); }} onClose={() => setDetail(null)} onChanged={invalidate} />
      )}
    </div>
  );
}

/* ------------------------------ Detail + PIN ------------------------------ */

function CardDetailSheet({ card, tone, asset, vault, onEdit, onClose, onChanged }) {
  const [details, setDetails] = useState(null);
  const [mode, setMode] = useState("view"); // view | pin | edit
  const [loading, setLoading] = useState(false);

  // Terkunci lagi → sembunyikan detail.
  useEffect(() => { if (!vault.token) { setDetails(null); if (mode === "edit") setMode("view"); } }, [vault.token, mode]);

  const reveal = async (token = vault.token) => {
    setLoading(true);
    try { const r = await manageCards({ action: "reveal", card_id: card.id, unlock_token: token }); setDetails(r.details || {}); }
    catch (e) { toast.error(msg(e, "Gagal membuka detail")); if (e?.response?.status === 403) vault.lock(); }
    finally { setLoading(false); }
  };
  const afterUnlock = (token, expiresAt, next) => { vault.open(token, expiresAt); setMode(next); if (next === "view") reveal(token); };
  const wantDetails = (next = "view") => (vault.token ? (next === "view" ? reveal() : setMode(next)) : setMode(`pin:${next}`));
  const state = details ? expiryState(details.exp_month, details.exp_year) : null;

  if (mode.startsWith("pin:")) {
    return <PinSheet onClose={() => setMode("view")} onUnlocked={(t, exp) => afterUnlock(t, exp, mode.slice(4))} />;
  }
  if (mode === "edit") {
    return <DetailsForm card={card} token={vault.token} initial={details || {}} onClose={() => setMode("view")}
      onSaved={async () => { setMode("view"); await onChanged(); reveal(); }} />;
  }
  return (
    <FormSheet title={card.display_name} subtitle={STATUS_LABEL[card.status]} onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={onEdit}>Ubah kartu</button>
          {details ? (
            <button type="button" className="btn-secondary flex-1" onClick={() => wantDetails("edit")}><Camera className="w-4 h-4" /> Ubah detail</button>
          ) : (
            <button type="button" className="btn-primary flex-1" disabled={loading} onClick={() => wantDetails(card.has_details ? "view" : "edit")}>
              {card.has_details ? <><Eye className="w-4 h-4" /> Lihat detail</> : <><Lock className="w-4 h-4" /> Simpan detail</>}
            </button>
          )}
        </div>
      }>
      <PaymentCardVisual card={{ ...card, _details: details }} tone={tone} asset={asset} />
      {details ? (
        <div className="space-y-3">
          <div className="surface rounded-2xl divide-y divide-border text-sm">
            <Row k="Nama di kartu" v={details.holder_name || "—"} />
            <Row k="Berlaku sampai" v={<span className={state === "expired" ? "text-destructive" : state === "soon" ? "text-warning" : ""}>{fmtExp(details.exp_month, details.exp_year)}{state === "expired" ? " · kedaluwarsa" : state === "soon" ? " · segera habis" : ""}</span>} />
            <Row k="4 digit terakhir" v={<span className="font-mono">{card.last4 || "—"}</span>} />
          </div>
          {details.photo_url ? (
            <img src={details.photo_url} alt="Foto depan kartu (nomor disamarkan)" className="w-full rounded-2xl border border-border" referrerPolicy="no-referrer" />
          ) : (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><ImageOff className="w-4 h-4" /> Belum ada foto kartu</p>
          )}
          <button type="button" className="btn-secondary btn-sm w-full" onClick={() => vault.lock()}><Lock className="w-4 h-4" /> Kunci sekarang</button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Lock className="w-4 h-4" /> {card.has_details ? "Masa berlaku, nama & foto terkunci PIN Nafkita." : "Simpan masa berlaku, nama & foto depan (nomor disamarkan) di balik PIN."}
        </p>
      )}
    </FormSheet>
  );
}

const Row = ({ k, v }) => (
  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right">{v}</span></div>
);

function PinSheet({ onClose, onUnlocked }) {
  const [status, setStatus] = useState(null); // {has_pin, locked_until}
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { manageCards({ action: "pin_status" }).then(setStatus).catch(() => setStatus({ has_pin: false })); }, []);
  const creating = status && !status.has_pin;

  const submit = async () => {
    setBusy(true); setError("");
    try {
      if (creating) {
        if (pin !== pin2) throw new Error("PIN tidak sama");
        await manageCards({ action: "set_pin", pin });
      }
      const r = await manageCards({ action: "unlock", pin });
      onUnlocked(r.unlock_token, r.expires_at);
    } catch (e) { setError(msg(e, "Gagal")); setPin(""); setPin2(""); }
    finally { setBusy(false); }
  };
  const digits = (v) => v.replace(/\D/g, "").slice(0, 6);

  return (
    <FormSheet title={creating ? "Buat PIN Nafkita" : "Masukkan PIN Nafkita"}
      subtitle={creating ? "6 angka, khusus untuk membuka detail kartu (bukan PIN ATM)" : "Detail terbuka 3 menit, lalu terkunci lagi"}
      onClose={onClose}
      footer={<button type="button" className="btn-primary w-full" disabled={!status || busy || pin.length !== 6 || (creating && pin2.length !== 6)} onClick={submit}>
        {busy ? "Memeriksa…" : creating ? "Simpan PIN & buka" : <><LockOpen className="w-4 h-4" /> Buka</>}
      </button>}>
      {!status ? <ListSkeleton rows={1} /> : (
        <>
          <FieldGroup>
            <FieldRow icon={KeyRound} label={creating ? "PIN baru" : "PIN"} htmlFor="pin-1">
              <input id="pin-1" className={`${fieldInput} font-mono tracking-[0.5em] text-lg`} type="password" inputMode="numeric" autoComplete="off" maxLength={6}
                value={pin} onChange={(e) => setPin(digits(e.target.value))} autoFocus onKeyDown={(e) => e.key === "Enter" && !creating && pin.length === 6 && submit()} />
            </FieldRow>
            {creating && (
              <FieldRow icon={KeyRound} label="Ulangi PIN" htmlFor="pin-2">
                <input id="pin-2" className={`${fieldInput} font-mono tracking-[0.5em] text-lg`} type="password" inputMode="numeric" autoComplete="off" maxLength={6}
                  value={pin2} onChange={(e) => setPin2(digits(e.target.value))} />
              </FieldRow>
            )}
          </FieldGroup>
          {creating && <p className="text-xs text-muted-foreground">Jangan memakai PIN ATM atau tanggal lahir. 5× salah → terkunci 15 menit.</p>}
          {error && <p className="text-xs text-destructive flex items-center gap-1.5" role="alert"><AlertTriangle className="w-4 h-4" />{error}</p>}
        </>
      )}
    </FormSheet>
  );
}

function DetailsForm({ card, token, initial, onClose, onSaved }) {
  const [month, setMonth] = useState(initial.exp_month ? String(initial.exp_month) : "");
  const [year, setYear] = useState(initial.exp_year ? String(initial.exp_year).slice(-2) : "");
  const [holder, setHolder] = useState(initial.holder_name || "");
  const [img, setImg] = useState(null);
  const [band, setBand] = useState(DEFAULT_BAND);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => { if (img && canvasRef.current) renderMasked(canvasRef.current, img, band); }, [img, band]);
  const expOk = (!month && !year) || validExpiry(month, year);

  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { setImg(await loadImage(f)); setRemovePhoto(false); } catch (err) { toast.error(err.message); }
  };

  const submit = async () => {
    setSaving(true);
    try {
      let photo_uri;
      if (img && canvasRef.current) {
        const file = await canvasToFile(canvasRef.current, `kartu-${card.id}.jpg`);
        photo_uri = (await uploadPrivateFile(file, "image"))?.file_uri;
        if (!photo_uri) throw new Error("Gagal mengunggah foto");
      } else if (removePhoto) photo_uri = null;
      await manageCards({ action: "save_details", card_id: card.id, unlock_token: token, details: { exp_month: month, exp_year: year, holder_name: holder, ...(photo_uri !== undefined ? { photo_uri } : {}) } });
      toast.success("Detail kartu tersimpan");
      onSaved();
    } catch (e) { toast.error(msg(e, "Gagal menyimpan detail")); setSaving(false); }
  };

  return (
    <FormSheet title="Detail kartu" subtitle="Terkunci PIN · nomor lengkap & CVC tidak diminta" onClose={onClose} wide
      footer={<button type="button" className="btn-primary w-full" disabled={saving || !expOk} onClick={submit}>{saving ? "Menyimpan…" : "Simpan detail"}</button>}>
      <FieldGroup>
        <FieldRow icon={Lock} label="Berlaku sampai (BB/TT)" htmlFor="dt-m" hint={expOk ? "Contoh 08 / 29" : "Bulan 01–12, tahun 2 digit"}>
          <div className="flex items-center gap-2">
            <input id="dt-m" className={`${fieldInput} w-12 font-mono`} inputMode="numeric" maxLength={2} placeholder="BB" value={month} onChange={(e) => setMonth(e.target.value.replace(/\D/g, ""))} aria-label="Bulan" />
            <span className="text-muted-foreground">/</span>
            <input className={`${fieldInput} w-12 font-mono`} inputMode="numeric" maxLength={2} placeholder="TT" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))} aria-label="Tahun" />
          </div>
        </FieldRow>
        <FieldRow icon={ShieldCheck} label="Nama di kartu" htmlFor="dt-h">
          <input id="dt-h" className={fieldInput} maxLength={40} autoCapitalize="characters" value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="ISMAIL A" />
        </FieldRow>
      </FieldGroup>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Foto depan kartu (opsional)</p>
        {img ? (
          <>
            <canvas ref={canvasRef} className="w-full rounded-2xl border border-border" aria-label="Pratinjau foto, nomor kartu disamarkan" />
            <label className="block text-xs text-muted-foreground">Geser posisi samaran agar menutup nomor kartu
              <input type="range" min="0" max="0.9" step="0.01" className="w-full" value={band.top} onChange={(e) => setBand((b) => ({ ...b, top: Number(e.target.value) }))} aria-label="Posisi samaran" />
            </label>
            <label className="block text-xs text-muted-foreground">Tinggi samaran
              <input type="range" min="0.08" max="0.6" step="0.01" className="w-full" value={band.height} onChange={(e) => setBand((b) => ({ ...b, height: Number(e.target.value) }))} aria-label="Tinggi samaran" />
            </label>
            <p className="text-[11px] text-muted-foreground">Foto disamarkan di perangkat ini sebelum diunggah. Foto asli tidak dikirim. Jangan memotret sisi belakang (ada CVC).</p>
          </>
        ) : initial.photo_url && !removePhoto ? (
          <div className="flex items-center gap-3">
            <img src={initial.photo_url} alt="Foto kartu tersimpan" className="w-24 rounded-xl border border-border" />
            <button type="button" className="btn-secondary btn-sm" onClick={() => setRemovePhoto(true)}>Hapus foto</button>
          </div>
        ) : null}
        <label className="btn-secondary btn-sm w-full cursor-pointer">
          <Camera className="w-4 h-4" /> {img || initial.photo_url ? "Ganti foto" : "Ambil / pilih foto depan"}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={pick} />
        </label>
      </div>
    </FormSheet>
  );
}
