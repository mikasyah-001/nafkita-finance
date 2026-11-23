import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeTxInput, isSafeUrl, safeUrl } from "../../../base44/shared/txInput.js";

test("sanitizeTxInput: field sistem dibuang, nominal divalidasi", () => {
  const { data } = sanitizeTxInput({ type: "expense", amount: "150000", currency: "idr", category: "Makan", approval_status: "approved", transfer_pair_id: "x", savings_goal_id: "g", is_adjustment: true, created_by_id: "victim", linked_asset_id: "a1" });
  assert.deepEqual(Object.keys(data).sort(), ["amount", "category", "currency", "linked_asset_id", "type"]);
  assert.equal(data.amount, 150000);
  assert.equal(data.currency, "IDR");
  for (const bad of [-5, 0, "abc", "1e400", Infinity, 1e14, null]) {
    assert.equal(sanitizeTxInput({ type: "expense", amount: bad }).error, "invalid_amount", String(bad));
  }
  assert.equal(sanitizeTxInput({ type: "hack", amount: 1 }).error, "invalid_type");
  assert.equal(sanitizeTxInput({ amount: 1 }).error, "invalid_type");
  assert.equal(sanitizeTxInput({ notes: "x" }, { partial: true }).data.notes, "x", "update parsial boleh tanpa amount");
});

test("URL bukti hanya https (cegah javascript: XSS)", () => {
  assert.equal(isSafeUrl("https://base44.app/file.pdf"), true);
  assert.equal(isSafeUrl(""), true);
  assert.equal(isSafeUrl("javascript:alert(1)//x.pdf"), false);
  assert.equal(isSafeUrl(" JavaScript:alert(1)"), false);
  assert.equal(isSafeUrl("http://x.com/a.png"), false);
  assert.equal(isSafeUrl("data:text/html,<script>"), false);
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(sanitizeTxInput({ type: "expense", amount: 1, photo_url: "javascript:alert(1)" }).error, "invalid_photo_url");
});
