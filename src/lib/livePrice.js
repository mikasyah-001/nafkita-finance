// ─────────────────────────────────────────────────────────────────────────
// HARGA ONLINE saham/ETF/reksa dana — AI + pencarian internet (pola sama
// dengan harga emas). Hasil AI TIDAK dipercaya mentah: divalidasi dulu.
// ─────────────────────────────────────────────────────────────────────────
import { base44 } from "@/api/base44Client";
import { num, validateLivePrice } from "./portfolioImport.js";


const keyOf = (it) => (it.ticker ? `${it.ticker}|${(it.exchange || "").toUpperCase()}` : (it.name || "").toLowerCase());

/**
 * items: [{ key?, name, ticker, exchange, currency, ref_price }]
 * → Map key → { price, currency, as_of, source, url, ok, reason }
 */
export async function fetchLivePrices(items) {
  const list = items.filter((i) => i.ticker || i.name);
  if (!list.length) return new Map();
  const lines = list.map((i, n) => `${n + 1}. ${[i.name, i.ticker && `kode ${i.ticker}`, i.exchange && `bursa ${i.exchange}`, `mata uang ${i.currency}`].filter(Boolean).join(", ")}`).join("\n");
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `Cari harga TERAKHIR (penutupan/terbaru hari ini) untuk instrumen berikut dari sumber publik tepercaya (mis. Tadawul/saudiexchange.sa, Argaam, Google Finance, Yahoo Finance, Bloomberg, IDX, Bibit/Bareksa untuk NAB reksa dana).
Instrumen:
${lines}

Untuk setiap instrumen kembalikan: index (nomor urut di atas), price (harga per unit/lembar dalam mata uang yang diminta; untuk reksa dana = NAB/unit), currency, as_of (tanggal harga yyyy-mm-dd), source (nama situs), url.
Jangan menebak. Bila tidak yakin instrumennya sama, kosongkan price.`,
    add_context_from_internet: true,
    response_json_schema: {
      type: "object",
      properties: {
        prices: {
          type: "array",
          items: { type: "object", properties: { index: { type: "string" }, price: { type: "string" }, currency: { type: "string" }, as_of: { type: "string" }, source: { type: "string" }, url: { type: "string" } } },
        },
      },
    },
  });
  const out = new Map();
  (res?.prices || []).forEach((p) => {
    const it = list[Number(num(p.index)) - 1];
    if (!it) return;
    out.set(it.key || keyOf(it), validateLivePrice(p, it));
  });
  return out;
}

export const liveKey = keyOf;

/**
 * Perbarui nilai pasar aset investasi dari harga online.
 * Hanya harga yang lolos validasi yang dipakai; sisanya dilaporkan.
 * Mengembalikan { updated: [{asset, price}], skipped: [{asset, reason}] }.
 */
export async function refreshAssetPrices(assets, updateAsset) {
  const targets = assets.filter((a) => a.type === "investasi" && (a.ticker || a.name) && Number(a.quantity) > 0);
  const items = targets.map((a) => ({
    key: a.id, name: String(a.name || "").replace(/\s*\(.*?\)\s*$/, ""), ticker: a.ticker, exchange: a.exchange || "",
    currency: (a.currency || "IDR").toUpperCase(),
    ref_price: Number(a.last_price) || (Number(a.value) && Number(a.quantity) ? Number(a.value) / Number(a.quantity) : 0),
  }));
  const found = await fetchLivePrices(items);
  const updated = [], skipped = [];
  for (const a of targets) {
    const lp = found.get(a.id);
    if (!lp || !lp.ok) { skipped.push({ asset: a, reason: lp?.reason || "Tidak ditemukan" }); continue; }
    const qty = Number(a.quantity);
    await updateAsset(a.id, {
      last_price: lp.price,
      value: Math.round(lp.price * qty * 100) / 100,
      price_date: lp.as_of || new Date().toISOString().slice(0, 10),
      import_source: `Harga online · ${lp.source || "internet"}`,
    });
    updated.push({ asset: a, price: lp.price });
  }
  return { updated, skipped };
}
