import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, Landmark, Tag, Trash2, Building2, Hash, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useCardLabels } from "@/hooks/useFinance";
import { assetLabel } from "@/lib/bankAccount";
import { normalizeLabel } from "../../base44/shared/autoIngest.js";
import { CARD_ASSET_TYPES, cardAssetAllowed, onlyDigits } from "../../base44/shared/cards.js";
import FormSheet, { FieldGroup, FieldRow, fieldInput, ChipChoice } from "@/components/FormSheet";
import NativeSelect from "@/components/NativeSelect";
import { confirmAction } from "@/components/ConfirmHost";

// Satu formulir kartu, dipakai halaman Kartu & Catat Otomatis ("Hubungkan").
// Sengaja TIDAK ada kolom nomor lengkap / CVC: hanya 4 digit terakhir.

export const KIND_LABEL = { debit: "Debit", credit: "Kredit", emoney: "E-money", prepaid: "Prabayar" };
export const NETWORK_LABEL = {
  visa: "Visa", mastercard: "Mastercard", mada: "mada", gpn: "GPN", amex: "Amex", jcb: "JCB", unionpay: "UnionPay",
  flazz: "Flazz BCA", emoney: "e-money Mandiri", brizzi: "Brizzi", tapcash: "TapCash", lainnya: "Lainnya",
};
export const STATUS_LABEL = { active: "Dicatat otomatis", paused: "Dijeda", unmapped: "Belum terhubung", ignored: "Diabaikan" };

const msg = (e, fallback) => e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback;
export const manageCards = async (payload) => (await base44.functions.invoke("manageCards", payload)).data;

// Label Catat Otomatis lama (CardLabel) → kartu, sekali & otomatis.
export function useMigrateLegacyLabels(cards, loading) {
  const qc = useQueryClient();
  const { data: legacy = [] } = useCardLabels();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || loading || !legacy.length) return;
    if (legacy.every((l) => cards.some((c) => c.wallet_label === l.label))) return;
    done.current = true;
    manageCards({ action: "migrate_labels" })
      .then((r) => { if (r?.migrated) qc.invalidateQueries({ queryKey: ["autoIngest"] }); })
      .catch(() => { done.current = false; });
  }, [legacy, cards, loading, qc]);
}

export default function CardSheet({ initial = {}, assets = [], onClose, onSaved }) {
  const isEdit = !!initial.id && initial.status !== "unmapped";
  const [name, setName] = useState(initial.display_name || "");
  const [kind, setKind] = useState(initial.kind || "debit");
  const [network, setNetwork] = useState(initial.network || "lainnya");
  const [issuer, setIssuer] = useState(initial.issuer || "");
  const [last4, setLast4] = useState(initial.last4 || "");
  const [assetId, setAssetId] = useState(initial.asset_id || "");
  const [label, setLabel] = useState(initial.wallet_label || "");
  const [status, setStatus] = useState(initial.status && initial.status !== "unmapped" ? initial.status : "active");
  const [saving, setSaving] = useState(false);

  const options = useMemo(() => assets.filter((a) => (CARD_ASSET_TYPES[kind] || []).includes(a.type || "bank")), [assets, kind]);
  const asset = options.find((a) => a.id === assetId) || null;
  // Sama dengan aturan server: rekening wajib hanya bila kartu dicatat otomatis.
  const assetOk = asset ? cardAssetAllowed(kind, asset) : (status !== "active" || kind === "credit");
  const labelPreview = normalizeLabel(label);

  const submit = async () => {
    setSaving(true);
    try {
      await manageCards({
        action: "save_card",
        card: { id: initial.id, display_name: name, kind, network, issuer, last4, asset_id: asset?.id || null, wallet_label: label, status },
      });
      toast.success(initial.status === "unmapped" ? "Kartu terhubung" : "Kartu tersimpan");
      onSaved?.();
    } catch (e) { toast.error(msg(e, "Gagal menyimpan kartu")); setSaving(false); }
  };
  const remove = async () => {
    if (!(await confirmAction({ title: `Hapus kartu ${initial.display_name}?`, description: "Detail & foto kartu ikut terhapus. Transaksi yang sudah tercatat tidak berubah." }))) return;
    try { await manageCards({ action: "delete_card", card_id: initial.id }); toast.success("Kartu dihapus"); onSaved?.(); }
    catch (e) { toast.error(msg(e, "Gagal menghapus")); }
  };

  return (
    <FormSheet
      title={initial.status === "unmapped" ? "Hubungkan kartu" : isEdit ? "Ubah kartu" : "Tambah kartu"}
      subtitle="Cukup 4 digit terakhir — nomor lengkap & CVC tidak pernah diminta"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {initial.id && <button type="button" className="btn-secondary" aria-label="Hapus kartu" onClick={remove}><Trash2 className="w-4 h-4" /></button>}
          <button type="button" className="btn-primary flex-1" disabled={saving || !name.trim() || !assetOk} onClick={submit}>{saving ? "Menyimpan…" : "Simpan"}</button>
        </div>
      }
    >
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Jenis kartu</p>
        <ChipChoice ariaLabel="Jenis kartu" value={kind} onChange={(v) => { setKind(v); setAssetId(""); }}
          options={Object.entries(KIND_LABEL).map(([value, l]) => ({ value, label: l }))} />
      </div>
      <FieldGroup>
        <FieldRow icon={CreditCard} label="Nama kartu" htmlFor="cs-name">
          <input id="cs-name" className={fieldInput} value={name} maxLength={50} onChange={(e) => setName(e.target.value)} placeholder="Al Rajhi mada harian" />
        </FieldRow>
        <FieldRow icon={Building2} label="Penerbit" htmlFor="cs-issuer">
          <input id="cs-issuer" className={fieldInput} value={issuer} maxLength={40} onChange={(e) => setIssuer(e.target.value)} placeholder="Al Rajhi Bank / BCA" />
        </FieldRow>
        <FieldRow icon={ShieldCheck} label="Jaringan" htmlFor="cs-network">
          <NativeSelect id="cs-network" className={fieldInput} value={network} sheetTitle="Jaringan kartu" aria-label="Jaringan kartu" onChange={(e) => setNetwork(e.target.value)}>
            {Object.entries(NETWORK_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </NativeSelect>
        </FieldRow>
        <FieldRow icon={Hash} label="4 digit terakhir" htmlFor="cs-last4" hint="Dipakai mencocokkan SMS bank (mis. “kartu ****0315”)">
          <input id="cs-last4" className={`${fieldInput} font-mono tracking-widest`} inputMode="numeric" autoComplete="off" value={last4}
            // Tanpa maxLength: nomor lengkap yang ditempel tetap diambil 4 digit TERAKHIR-nya.
            onChange={(e) => setLast4(onlyDigits(e.target.value).slice(-4))} placeholder="0315" />
        </FieldRow>
      </FieldGroup>
      <FieldGroup>
        <FieldRow icon={Landmark} label="Rekening" htmlFor="cs-asset"
          hint={kind === "credit" ? "Opsional untuk kartu kredit" : options.length ? "Transaksi kartu ini mengurangi saldo rekening ini" : "Belum ada aset yang cocok — tambahkan di menu Aset"}>
          <NativeSelect id="cs-asset" className={fieldInput} value={assetId} sheetTitle="Rekening kartu" aria-label="Rekening kartu" onChange={(e) => setAssetId(e.target.value)}>
            <option value="">{kind === "credit" ? "Tanpa rekening" : "Pilih rekening…"}</option>
            {options.map((a) => <option key={a.id} value={a.id}>{assetLabel(a)} ({a.currency || "IDR"})</option>)}
          </NativeSelect>
        </FieldRow>
        <FieldRow icon={Tag} label="Label Apple Pay (opsional)" htmlFor="cs-label"
          hint={labelPreview && labelPreview !== label ? `Disimpan sebagai: ${labelPreview}` : "Terisi otomatis dari nama kartu di Wallet saat pertama dipakai"}>
          <input id="cs-label" className={`${fieldInput} font-mono`} value={label} maxLength={40} autoCapitalize="none" autoCorrect="off" onChange={(e) => setLabel(e.target.value)} placeholder="classic-debit-card" />
        </FieldRow>
      </FieldGroup>
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Catat Otomatis</p>
        <ChipChoice ariaLabel="Status catat otomatis" value={status} onChange={setStatus}
          options={[{ value: "active", label: "Catat" }, { value: "paused", label: "Jeda" }, { value: "ignored", label: "Abaikan" }]} />
      </div>
    </FormSheet>
  );
}
