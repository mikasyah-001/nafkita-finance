import { test } from "node:test";
import assert from "node:assert/strict";
import { planTransfer, canDeleteTransfer } from "../../../base44/shared/transferRules.js";

const mine = (o) => ({ type: "bank", currency: "IDR", created_by_id: "me", visibility: "shared", ...o });
const theirs = (o) => ({ type: "bank", currency: "IDR", created_by_id: "p", visibility: "shared", ...o });

test("transfer antar rekening sendiri", () => {
  const r = planTransfer({ from: mine({ id: "a" }), to: mine({ id: "b" }), meId: "me", amount: 100 });
  assert.equal(r.ok, true); assert.equal(r.toPartner, false); assert.equal(r.received, 100);
  assert.match(planTransfer({ from: mine({ id: "a" }), to: mine({ id: "a" }), meId: "me", amount: 1 }).error, /tidak boleh sama/);
  assert.match(planTransfer({ from: mine({ id: "a" }), to: mine({ id: "b", type: "emas" }), meId: "me", amount: 1 }).error, /bank atau uang tunai/);
  assert.match(planTransfer({ from: theirs({ id: "a" }), to: mine({ id: "b" }), meId: "me", partnerId: "p", amount: 1 }).error, /asal harus milik Anda/);
});

test("transfer ke rekening pasangan", () => {
  const ok = planTransfer({ from: mine({ id: "a" }), to: theirs({ id: "b" }), meId: "me", partnerId: "p", amount: 500 });
  assert.equal(ok.toPartner, true); assert.equal(ok.inVisibility, "shared");
  assert.match(planTransfer({ from: mine({ id: "a" }), to: theirs({ id: "b" }), meId: "me", partnerId: null, amount: 1 }).error, /pasangan aktif/);
  assert.match(planTransfer({ from: mine({ id: "a" }), to: theirs({ id: "b", visibility: "private" }), meId: "me", partnerId: "p", amount: 1 }).error, /pribadi pasangan/);
  const priv = planTransfer({ from: mine({ id: "a", visibility: "private" }), to: theirs({ id: "b" }), meId: "me", partnerId: "p", amount: 1 });
  assert.equal(priv.outVisibility, "private"); assert.equal(priv.inVisibility, "shared");
});

test("beda mata uang wajib nominal diterima", () => {
  const from = mine({ id: "a", currency: "SAR" }); const to = mine({ id: "b", currency: "IDR" });
  assert.match(planTransfer({ from, to, meId: "me", amount: 250 }).error, /diterima dalam IDR/);
  const r = planTransfer({ from, to, meId: "me", amount: 250, receivedAmount: 1_062_500 });
  assert.equal(r.cross, true); assert.equal(r.amount, 250); assert.equal(r.received, 1_062_500);
});

test("hak hapus transfer", () => {
  const legs = [{ created_by_id: "me", linked_asset_id: "a" }, { created_by_id: "me", linked_asset_id: "b" }];
  const assets = { a: { created_by_id: "me" }, b: { created_by_id: "p" } };
  assert.equal(canDeleteTransfer(legs, assets, "me"), true);
  assert.equal(canDeleteTransfer(legs, assets, "p"), true);
  assert.equal(canDeleteTransfer(legs, assets, "x"), false);
});
