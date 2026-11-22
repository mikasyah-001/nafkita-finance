import { test } from "node:test";
import assert from "node:assert/strict";

// deleteImpactText murni; impor modul tanpa klien Base44 tidak mungkin di Node,
// jadi uji salinan logika lewat import dinamis dengan stub sederhana.
test("teks dampak hapus aset", async () => {
  const src = await import("node:fs").then((fs) => fs.readFileSync(new URL("../assetDelete.js", import.meta.url), "utf8"));
  const body = src.slice(src.indexOf("export function deleteImpactText"), src.indexOf("/**"));
  const fn = new Function(`${body.replace("export ", "")}; return deleteImpactText;`)();
  assert.equal(fn({ name: "BCA" }, {}), "Aset dihapus permanen dan tidak bisa dikembalikan.");
  const t = fn({ name: "Al Rajhi" }, { transactions: 12, card_labels: 1, investment_lots: 0 });
  assert.match(t, /12 transaksi tetap tersimpan, tapi tidak lagi terhubung ke Al Rajhi/);
  assert.match(t, /1 label kartu Catat Otomatis/);
  assert.doesNotMatch(t, /DCA/);
});
