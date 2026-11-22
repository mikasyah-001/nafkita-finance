import { test } from "node:test";
import assert from "node:assert/strict";
import { toLast4, validExpiry, expiryState, containsSensitiveCardData, cardAssetAllowed, parseBankSms, isOtpSms } from "../../../base44/shared/cards.js";

test("kartu: 4 digit terakhir & masa berlaku", () => {
  assert.equal(toLast4("4111 1111 1111 1234"), "1234");
  assert.equal(toLast4("••0315"), "0315");
  assert.equal(toLast4("12"), "");
  const now = new Date("2026-11-22T10:00:00Z");
  assert.equal(validExpiry(8, 29, now), true);
  assert.equal(validExpiry(13, 29, now), false);
  assert.equal(expiryState(8, 2029, now), "ok");
  assert.equal(expiryState(12, 2026, now), "soon");
  assert.equal(expiryState(10, 2026, now), "expired");
});

test("kartu: tolak data sensitif & aturan rekening", () => {
  assert.equal(containsSensitiveCardData("kartu 4111 1111 1111 1111"), true);
  assert.equal(containsSensitiveCardData("CVV 123"), true);
  assert.equal(containsSensitiveCardData("Kartu belanja harian"), false);
  assert.equal(cardAssetAllowed("debit", { type: "bank" }), true);
  assert.equal(cardAssetAllowed("debit", { type: "emas" }), false);
  assert.equal(cardAssetAllowed("credit", null), true);
  assert.equal(cardAssetAllowed("debit", null), false);
});

test("SMS bank: Arab, Inggris, Indonesia", () => {
  const ar = parseBankSms("شراء عبر نقاط البيع\nبطاقة: 0315;مدى\nمبلغ: 25.50 SAR\nلدى: PANDA RETAIL\nفي: 2026-11-21 10:00");
  assert.equal(ar.ok, true); assert.equal(ar.amount, 25.5); assert.equal(ar.currency, "SAR"); assert.equal(ar.last4, "0315"); assert.equal(ar.merchant, "PANDA RETAIL"); assert.equal(ar.direction, "out");
  const en = parseBankSms("Purchase\nAmount: SAR 1,250.00\nCard: **4471\nAt: JARIR BOOKSTORE\nDate: 21/11/26");
  assert.equal(en.amount, 1250); assert.equal(en.last4, "4471"); assert.equal(en.merchant, "JARIR BOOKSTORE");
  const id = parseBankSms("BCA: Transaksi DEBIT Rp 150.000,00 di INDOMARET PT kartu ****9876 pada 21/11");
  assert.equal(id.amount, 150000); assert.equal(id.currency, "IDR"); assert.equal(id.last4, "9876"); assert.equal(id.merchant, "INDOMARET PT");
  const masuk = parseBankSms("Transfer masuk Rp 2.500.000 ke rek ****1122 dari AHMAD");
  assert.equal(masuk.direction, "in"); assert.equal(masuk.amount, 2500000);
  const salary = parseBankSms("إيداع راتب\nمبلغ: ٥٠٠٠ ر.س");
  assert.equal(salary.direction, "in"); assert.equal(salary.amount, 5000); assert.equal(salary.currency, "SAR");
});

test("SMS bank: OTP & bukan transaksi ditolak", () => {
  assert.equal(isOtpSms("Kode OTP Anda 123456. Jangan berikan kepada siapa pun"), true);
  assert.equal(parseBankSms("رمز التحقق: 4821").reason, "otp");
  assert.equal(parseBankSms("Promo akhir tahun! Nikmati cashback").reason, "no_amount");
});

test("kartu: kembaran lintas sumber & pencocokan SMS", async () => {
  const { findCrossSourceTwin, matchCardForSms } = await import("../../../base44/shared/cards.js");
  const ap = { id: "a", source: "apple_pay", asset_id: "x", direction: "out", amount: 25.5, occurred_at: "2026-11-21T10:00:00Z", status: "new" };
  assert.equal(findCrossSourceTwin({ source: "sms", asset_id: "x", amount: 25.5, occurred_at: "2026-11-21T10:12:00Z" }, [ap])?.id, "a");
  assert.equal(findCrossSourceTwin({ source: "apple_pay", asset_id: "x", amount: 25.5, occurred_at: "2026-11-21T10:12:00Z" }, [ap]), null);
  assert.equal(findCrossSourceTwin({ source: "sms", asset_id: "x", amount: 25.5, occurred_at: "2026-11-21T11:00:00Z" }, [ap]), null);
  const cards = [{ id: "1", last4: "0315", wallet_label: "rajhi", status: "active" }, { id: "2", last4: "4471", status: "active" }];
  assert.equal(matchCardForSms(cards, { last4: "4471" }).id, "2");
  assert.equal(matchCardForSms(cards, { label: "rajhi" }).id, "1");
  assert.equal(matchCardForSms(cards, { last4: "9999" }), null);
});
