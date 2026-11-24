import { base44 } from "@/api/base44Client";
import { buildAssetPayload, canonicalBrokerFor, withSavedBank } from "@/lib/finance";
import { normalizeAccountNumber, accountNumberError, findDuplicateAccount, defaultBankName } from "@/lib/bankAccount";

// Buat rekening bank secara ringkas (dipakai form kartu: "+ Rekening baru").
// Aturan sama dengan form Aset: nomor rekening wajib & tidak boleh ganda,
// nama otomatis "BCA ••1234" bila kosong, bank tersimpan di profil.
// Mengembalikan { asset } atau { error }.
export function validateQuickAccount({ bank, accountNumber, value }, assets = []) {
  if (!String(bank || "").trim()) return "Isi nama bank";
  const n = normalizeAccountNumber(accountNumber);
  if (!n) return "Isi no. rekening";
  const err = accountNumberError(n);
  if (err) return err;
  const dup = findDuplicateAccount(assets, n);
  if (dup) return `Rekening ini sudah tercatat sebagai "${dup.name}"`;
  const v = Number(value || 0);
  if (!Number.isFinite(v) || v < 0) return "Saldo awal tidak boleh negatif";
  return "";
}

export async function createQuickAccount({ bank, accountNumber, currency, value, role, visibility }, { assets = [], me } = {}) {
  const error = validateQuickAccount({ bank, accountNumber, value }, assets);
  if (error) return { error };
  const broker = canonicalBrokerFor(bank, assets, "bank") || String(bank).trim();
  const { error: e2, payload } = buildAssetPayload({
    type: "bank", name: defaultBankName(broker, accountNumber), broker,
    value: String(Number(value || 0)), currency: currency || me?.default_currency || "IDR",
    visibility: visibility || "shared",
  });
  if (e2) return { error: e2 };
  payload.account_number = normalizeAccountNumber(accountNumber);
  payload.account_role = role === "tabungan" ? "tabungan" : "harian";
  const asset = await base44.entities.Asset.create(payload);
  const saved = Array.isArray(me?.saved_banks) ? me.saved_banks : [];
  const next = withSavedBank(saved, broker);
  if (next) base44.auth.updateMe({ saved_banks: next }).catch(() => {});
  return { asset };
}
