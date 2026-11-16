// Nomor rekening untuk aset Tabungan/Bank — satu sumber logika.
// Satu bank bisa punya beberapa rekening, jadi rekening dibedakan oleh
// nomornya, bukan nama bank. Nomor disamarkan (••1234) di daftar & pilihan.

/** "1234 5678-90" → "1234567890"; IBAN → huruf besar tanpa spasi. */
export function normalizeAccountNumber(s) {
  return String(s || "").toUpperCase().replace(/[\s.\-_/]/g, "");
}

/**
 * Validasi ringan: rekening lokal 6–20 angka, atau IBAN (mis. Saudi
 * "SA" + 22 karakter). Kosong = tidak ada error (wajib-tidaknya diatur form).
 */
export function accountNumberError(s) {
  const n = normalizeAccountNumber(s);
  if (!n) return "";
  if (/^\d+$/.test(n)) return n.length < 6 || n.length > 20 ? "No. rekening biasanya 6–20 angka" : "";
  if (/^SA\d+$/.test(n)) return n.length === 24 ? "" : "IBAN Saudi terdiri dari 24 karakter (SA + 22)";
  if (/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(n)) return "";
  return "Isi angka rekening, atau IBAN (mis. SA03 8000 …)";
}

/** Empat digit terakhir, untuk tampilan tersamar. */
export const accountLast4 = (s) => normalizeAccountNumber(s).slice(-4);
export const maskAccount = (s) => (accountLast4(s) ? `••${accountLast4(s)}` : "");

/** Tampilan nomor lengkap yang mudah dibaca: dikelompokkan per 4. */
export function formatAccountNumber(s) {
  const n = normalizeAccountNumber(s);
  return n.replace(/(.{4})(?=.)/g, "$1 ");
}

/** Nama otomatis bila nama dikosongkan: "BCA ••1234". */
export function defaultBankName(bank, account) {
  return [String(bank || "").trim() || "Rekening", maskAccount(account)].filter(Boolean).join(" ");
}

/**
 * Label aset untuk daftar pilihan (catat transaksi, transfer, dll.):
 * nama + ••1234 agar dua rekening di bank yang sama tidak tertukar.
 */
export function assetLabel(a = {}) {
  const name = String(a.name || "").trim();
  const last4 = accountLast4(a.account_number);
  if (!last4 || name.includes(last4)) return name;
  return `${name} ••${last4}`;
}

/** Rekening yang sama sudah tercatat (abaikan aset yang sedang diubah). */
export function findDuplicateAccount(assets = [], account, excludeId) {
  const n = normalizeAccountNumber(account);
  if (!n) return null;
  return assets.find((a) => a.id !== excludeId && a.type === "bank" && normalizeAccountNumber(a.account_number) === n) || null;
}
