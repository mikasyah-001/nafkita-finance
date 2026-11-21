import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLabel, parseAmount, detectCurrency, parseOccurredAt, normalizeMerchant,
  suggestCategory, isDuplicate, reviewReason, extractToken, looksLikeToken,
} from "../../../base44/shared/autoIngest.js";

test("normalisasi label", () => {
  assert.equal(normalizeLabel("Al Rajhi Harian"), "al-rajhi-harian");
  assert.equal(normalizeLabel("  D360__Visa!! "), "d360-visa");
  assert.equal(normalizeLabel("Bébé"), "bebe");
  assert.equal(normalizeLabel(""), "");
  assert.equal(normalizeLabel(null), "");
  assert.ok(normalizeLabel("a".repeat(50)).length <= 32);
  assert.ok(!normalizeLabel("abcdefghij-abcdefghij-abcdefghij-x").endsWith("-"));
});

test("nominal dari berbagai format Shortcuts", () => {
  assert.equal(parseAmount(12.5), 12.5);
  assert.equal(parseAmount(-12.5), 12.5);
  assert.equal(parseAmount("SAR 12.50"), 12.5);
  assert.equal(parseAmount("12,50 ر.س"), 12.5);
  assert.equal(parseAmount("Rp 25.000"), 25000);
  assert.equal(parseAmount("Rp1.250.000"), 1250000);
  assert.equal(parseAmount("1,234.56"), 1234.56);
  assert.equal(parseAmount("1.234,56"), 1234.56);
  assert.equal(parseAmount("SAR 1,250"), 1250);
  assert.equal(parseAmount("٢٥٫٥٠ ر.س"), 25.5);
  assert.equal(parseAmount("abc"), 0);
  assert.equal(parseAmount(""), 0);
  assert.equal(parseAmount(null), 0);
  assert.equal(parseAmount(NaN), 0);
});

test("deteksi mata uang di teks nominal", () => {
  assert.equal(detectCurrency("SAR 12.50"), "SAR");
  assert.equal(detectCurrency("usd 3.00"), "USD");
  assert.equal(detectCurrency("12,50 ر.س"), "SAR");
  assert.equal(detectCurrency("Rp 25.000"), "IDR");
  assert.equal(detectCurrency("12.50"), null);
  assert.equal(detectCurrency(12.5), null);
});

test("waktu transaksi", () => {
  const now = new Date("2026-11-21T10:00:00Z");
  assert.equal(parseOccurredAt("2026-11-21T09:58:00Z", now), "2026-11-21T09:58:00.000Z");
  assert.equal(parseOccurredAt("bukan tanggal", now), now.toISOString());
  assert.equal(parseOccurredAt("2027-01-01T00:00:00Z", now), now.toISOString());
  assert.equal(parseOccurredAt(undefined, now), now.toISOString());
});

test("saran kategori dari riwayat merchant", () => {
  const history = [
    { merchant: "Starbucks", category: "Kopi", date: "2026-11-01" },
    { merchant: "STARBUCKS #1234", category: "Makan", date: "2026-11-10" },
    { merchant: "Panda", category: "Belanja", date: "2026-11-05" },
  ];
  assert.equal(normalizeMerchant("STARBUCKS #1234 Riyadh"), "starbucks riyadh");
  assert.equal(suggestCategory("Starbucks", history), "Makan");
  assert.equal(suggestCategory("STARBUCKS RIYADH", history), "Makan");
  assert.equal(suggestCategory("Panda Retail", history), "Belanja");
  assert.equal(suggestCategory("Toko Baru", history), null);
  assert.equal(suggestCategory("", history), null);
});

test("deteksi duplikat", () => {
  const base = { label: "d360", amount: 12.5, merchant: "Panda", occurred_at: "2026-11-21T10:00:00Z" };
  assert.equal(isDuplicate(base, [{ ...base, occurred_at: "2026-11-21T10:05:00Z" }]), true);
  assert.equal(isDuplicate(base, [{ ...base, occurred_at: "2026-11-21T10:20:00Z" }]), false);
  assert.equal(isDuplicate(base, [{ ...base, amount: 13 }]), false);
  assert.equal(isDuplicate(base, [{ ...base, label: "rajhi" }]), false);
  assert.equal(isDuplicate(base, [{ ...base, merchant: "" }]), true);
  assert.equal(isDuplicate(base, [{ ...base, merchant: "Jarir" }]), false);
  assert.equal(isDuplicate(base, []), false);
});

test("alasan perlu dicek", () => {
  assert.equal(reviewReason({ amount: 10, merchant: "Panda", rawCurrency: "SAR", assetCurrency: "SAR" }), "");
  assert.equal(reviewReason({ amount: 10, merchant: "Panda", rawCurrency: null, assetCurrency: "SAR" }), "");
  assert.match(reviewReason({ amount: 0, merchant: "Panda" }), /Nominal/);
  assert.match(reviewReason({ amount: 10, merchant: "Amazon", rawCurrency: "USD", assetCurrency: "SAR" }), /USD/);
  assert.match(reviewReason({ amount: 10, merchant: " " }), /merchant/);
});

test("ekstraksi token", () => {
  assert.equal(extractToken("Bearer nfk_abc", {}), "nfk_abc");
  assert.equal(extractToken("bearer   nfk_abc", {}), "nfk_abc");
  assert.equal(extractToken("", { token: " nfk_x " }), "nfk_x");
  assert.equal(extractToken(null, null), "");
  assert.equal(looksLikeToken("nfk_" + "a".repeat(43)), true);
  assert.equal(looksLikeToken("abc"), false);
});
