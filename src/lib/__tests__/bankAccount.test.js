import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAccountNumber, accountNumberError, maskAccount, formatAccountNumber, defaultBankName, assetLabel, findDuplicateAccount } from "../bankAccount.js";

test("normalisasi & validasi no. rekening / IBAN", () => {
  assert.equal(normalizeAccountNumber(" 123-456 7890 "), "1234567890");
  assert.equal(accountNumberError("1234567890"), "");
  assert.equal(accountNumberError(""), "");
  assert.match(accountNumberError("123"), /6–20 angka/);
  assert.equal(accountNumberError("SA03 8000 0000 6080 1016 7519"), "");
  assert.match(accountNumberError("SA03 8000 0000"), /24 karakter/);
  assert.match(accountNumberError("abc-xyz"), /IBAN/);
});

test("tampilan tersamar, lengkap, nama otomatis & label pilihan", () => {
  assert.equal(maskAccount("1234567890"), "••7890");
  assert.equal(maskAccount(""), "");
  assert.equal(formatAccountNumber("SA0380000000608010167519"), "SA03 8000 0000 6080 1016 7519");
  assert.equal(defaultBankName("BCA", "1234567890"), "BCA ••7890");
  assert.equal(assetLabel({ name: "Tabungan BCA", account_number: "1234567890" }), "Tabungan BCA ••7890");
  assert.equal(assetLabel({ name: "BCA ••7890", account_number: "1234567890" }), "BCA ••7890");
  assert.equal(assetLabel({ name: "Dompet" }), "Dompet");
});

test("satu bank boleh banyak rekening; nomor yang sama = duplikat", () => {
  const assets = [{ id: "a", type: "bank", broker: "BCA", account_number: "1234567890" }, { id: "b", type: "bank", broker: "BCA", account_number: "5555666677" }];
  assert.equal(findDuplicateAccount(assets, "1234 567 890")?.id, "a");
  assert.equal(findDuplicateAccount(assets, "9999888877"), null, "rekening BCA lain boleh");
  assert.equal(findDuplicateAccount(assets, "1234567890", "a"), null, "saat mengubah dirinya sendiri");
});
