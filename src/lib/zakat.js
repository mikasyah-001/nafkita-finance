// ─────────────────────────────────────────────────────────────────────────
// ZAKAT MAL — sumber tunggal perhitungan di frontend.
// Cermin logika: base44/shared/zakat.ts (computeZakatMal). Ubah keduanya bersamaan.
//
// Ketentuan yang dipakai (praktik BAZNAS / PMA 52/2014 jo. PMA 31/2019):
//  • Nisab: setara 85 gram emas, dinilai dengan harga emas saat dihitung.
//  • Kadar: 2,5%. Haul: 1 tahun hijriah (±354 hari).
//  • Harta simpanan DIGABUNG untuk mencapai nisab: uang tunai, tabungan,
//    emas (nilai pasar), investasi (nilai pasar), dan piutang lancar.
//    Semua mata uang dikonversi ke satu mata uang (IDR) — nisab tidak
//    dihitung terpisah per mata uang.
//  • Utang yang jatuh tempo (≤ 12 bulan) dikurangkan sebelum cek nisab.
//  • Tidak dihitung: rumah tinggal/properti, tanah, kendaraan & barang
//    pakai ("lainnya") — kecuali dimiliki untuk diperjualbelikan.
//  • Haul emas mengikuti data aset: dihitung per aset dari tanggal beli
//    (purchase_date; bila kosong, tanggal aset dicatat). Emas yang belum
//    genap 354 hari belum masuk perhitungan periode ini (tiap perolehan
//    punya haul sendiri — pendapat Syafi'i/Hanbali yang umum di Indonesia).
//  • Perhiasan yang dipakai wajar: diperselisihkan ulama; aplikasi tidak
//    bisa membedakannya, jadi semua emas tercatat dihitung (lebih hati-hati).
// Hasilnya PERKIRAAN, bukan fatwa — konsultasikan ke amil/BAZNAS setempat.
// ─────────────────────────────────────────────────────────────────────────
import { convertTo, canConvert } from "./finance.js";

export const NISAB_GOLD_GRAM = 85;
export const ZAKAT_RATE = 0.025;
export const HAUL_DAYS = 354; // 1 tahun hijriah (perkiraan)
export const ZAKAT_CURRENCY = "IDR";

const ZAKATABLE = {
  bank: "kas",
  tunai: "kas",
  emas: "emas",
  emas_digital: "emas",
  investasi: "investasi",
};
export const ZAKAT_EXCLUDED_TYPES = ["properti", "tanah", "lainnya"];
export const ZAKAT_GROUP_LABEL = {
  kas: "Uang tunai & tabungan",
  emas: "Emas (nilai pasar)",
  investasi: "Investasi (nilai pasar)",
  piutang: "Piutang lancar",
  utang: "Utang jatuh tempo",
};

const DAY = 86400000;

/**
 * @param {object} p
 * @param {Array} p.assets   aset terlihat (milik sendiri + bersama pasangan)
 * @param {Array} p.debts    utang/piutang
 * @param {number} p.goldPrice harga emas per gram dalam IDR (0 = belum ada)
 * @param {object} p.rateMap kurs (lihat buildRateMap)
 * @param {boolean} [p.includeReceivables=true] hitung piutang lancar
 * @param {Date} [p.now]
 */
export function computeZakatMal({ assets = [], debts = [], goldPrice = 0, rateMap = {}, includeReceivables = true, now = new Date() }) {
  const cur = ZAKAT_CURRENCY;
  const groups = { kas: 0, emas: 0, investasi: 0, piutang: 0, utang: 0 };
  const items = [];
  const excluded = [];
  const unconverted = [];
  const goldPending = []; // emas yang belum genap haul
  let goldGrams = 0;
  let goldGramsPending = 0;

  const toBase = (amount, from) => {
    const f = (from || "IDR").toUpperCase();
    if (!canConvert(f, cur, rateMap)) { unconverted.push(f); return null; }
    return convertTo(Number(amount) || 0, f, cur, rateMap);
  };

  for (const a of assets) {
    const group = ZAKATABLE[a.type];
    if (!group) { excluded.push(a); continue; }
    let value;
    if (group === "emas") {
      const grams = Number(a.quantity) || 0;
      const haul = goldHaul(a, now);
      if (!haul.complete) {
        goldGramsPending += grams;
        goldPending.push({ id: a.id, name: a.name, grams, value: goldPrice > 0 ? grams * goldPrice : null, ...haul });
        continue;
      }
      goldGrams += grams;
      // Emas dinilai dengan harga pasar saat ini, bukan harga beli.
      value = goldPrice > 0 ? grams * goldPrice : null;
      if (value == null) continue;
      items.push({ id: a.id, name: a.name, group, value, grams, ...haul });
      groups.emas += value;
      continue;
    } else {
      value = toBase(a.value, a.currency);
      if (value == null) continue;
    }
    groups[group] += value;
    items.push({ id: a.id, name: a.name, group, value, grams: group === "emas" ? Number(a.quantity) || 0 : undefined });
  }

  const horizon = now.getTime() + 365 * DAY;
  for (const d of debts) {
    if ((d.status || "active") !== "active") continue;
    const remaining = Math.max(0, (Number(d.amount) || 0) - (Number(d.paid_amount) || 0));
    if (remaining <= 0) continue;
    const v = toBase(remaining, d.currency);
    if (v == null) continue;
    if (d.type === "utang") {
      // Utang jatuh tempo dalam 12 bulan (atau tanpa tanggal) dikurangkan.
      const due = d.due_date ? new Date(d.due_date).getTime() : null;
      if (due == null || due <= horizon) {
        groups.utang += v;
        items.push({ id: d.id, name: d.counterparty_name || "Utang", group: "utang", value: v });
      }
    } else if (d.type === "piutang" && includeReceivables) {
      groups.piutang += v;
      items.push({ id: d.id, name: d.counterparty_name || "Piutang", group: "piutang", value: v });
    }
  }

  const gross = groups.kas + groups.emas + groups.investasi + groups.piutang;
  const net = Math.max(0, gross - groups.utang);
  const nisab = goldPrice > 0 ? NISAB_GOLD_GRAM * goldPrice : 0;
  const needsGoldPrice = goldPrice <= 0;
  const reachesNisab = !needsGoldPrice && net >= nisab;
  const zakat = reachesNisab ? round(net * ZAKAT_RATE) : 0;

  return {
    currency: cur, groups, items, excluded, unconverted: [...new Set(unconverted)],
    goldGrams, goldGramsPending, goldPending, goldPrice, gross, net, nisab, needsGoldPrice, reachesNisab, zakat,
    nisabGap: reachesNisab || needsGoldPrice ? 0 : nisab - net,
  };
}

const round = (n) => Math.round(n);

/**
 * Haul satu aset emas dari data yang tersimpan di aset.
 * acquired = purchase_date → created_date → (tidak ada: dianggap sudah haul).
 */
export function goldHaul(asset, now = new Date()) {
  const raw = asset.purchase_date || asset.created_date || null;
  if (!raw) return { complete: true, acquired: null, due: null, daysLeft: 0, dateSource: "unknown" };
  const acquired = new Date(raw);
  const due = new Date(acquired.getTime() + HAUL_DAYS * DAY);
  const daysLeft = Math.ceil((due.getTime() - now.getTime()) / DAY);
  return { complete: daysLeft <= 0, acquired, due, daysLeft: Math.max(0, daysLeft), dateSource: asset.purchase_date ? "purchase" : "recorded" };
}

// ── Haul (tahun hijriah) ──────────────────────────────────────────────────
const hijriFmt = (() => {
  try { return new Intl.DateTimeFormat("id-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return null; }
})();
export function hijriYear(date) {
  if (!hijriFmt) return null;
  const y = hijriFmt.formatToParts(new Date(date)).find((p) => p.type === "year");
  return y ? Number(String(y.value).replace(/\D/g, "")) : null;
}
export function formatHijri(date) {
  if (!hijriFmt) return "";
  return hijriFmt.format(new Date(date)).replace(/\s*H$/, "") + " H";
}

/**
 * Periode haul berjalan. haulStart = tanggal harta pertama kali mencapai nisab.
 * Tanpa haulStart, periode = tahun hijriah berjalan.
 * Mengembalikan { key, label, start, due, daysLeft, isDue }.
 */
export function haulPeriod(haulStart, now = new Date()) {
  if (!haulStart) {
    const y = hijriYear(now);
    return { key: `H${y}`, label: `Tahun ${y} H`, start: null, due: null, daysLeft: null, isDue: false, hijriYear: y };
  }
  const start0 = new Date(haulStart).getTime();
  const elapsed = Math.max(0, now.getTime() - start0);
  const n = Math.floor(elapsed / (HAUL_DAYS * DAY));
  const start = new Date(start0 + n * HAUL_DAYS * DAY);
  const due = new Date(start0 + (n + 1) * HAUL_DAYS * DAY);
  const daysLeft = Math.ceil((due.getTime() - now.getTime()) / DAY);
  const y = hijriYear(due);
  return { key: `haul-${start.toISOString().slice(0, 10)}`, label: `Haul jatuh tempo ${formatHijri(due)}`, start, due, daysLeft, isDue: daysLeft <= 30, hijriYear: y };
}

/** Pembayaran yang termasuk periode haul ini (zakat mal). */
export function paymentsForPeriod(payments = [], period) {
  return payments.filter((p) => p.status === "paid" && (p.period_key ? p.period_key === period.key : p.zakat_type === "mal" && p.year === period.hijriYear));
}
