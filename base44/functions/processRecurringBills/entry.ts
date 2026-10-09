import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { fetchAll } from "../../shared/fetchAll.ts";
import { roundForCurrency } from "../../shared/assetAdjust.ts";
import { recordAssetMutation } from "../../shared/assetMutation.ts";

// Dipanggil workflow terjadwal harian.
// Untuk tiap tagihan aktif dengan next_date <= hari ini, proses SATU periode:
// - Idempoten: kunci "recurring-<bill>-<periode>" (periode = next_date). Bila
//   transaksi dengan kunci itu sudah ada, langkah pembuatan & penyesuaian saldo dilewati.
// - Urutan aman: transaksi dibuat dulu, baru saldo aset disesuaikan + mutasi dicatat.
// - Tanggal berikutnya dihitung dari jangkar (start_date), sehingga 31 Jan → 28/29 Feb → 31 Mar.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const today = new Date().toISOString().slice(0, 10);

    const bills = await fetchAll(db.RecurringBill, { status: "active" });
    const due = (bills || []).filter((b) => b.next_date && b.next_date <= today);

    const results = [];
    for (const bill of due) {
      try {
        const period = bill.next_date;
        const key = `recurring-${bill.id}-${period}`;
        const amt = Number(bill.amount) || 0;
        const cur = bill.currency || "IDR";

        const existing = await db.Transaction.filter({ notif_batch_id: key }, { limit: 1 });
        const already = (existing?.items || existing || []).length > 0;

        let txId = null;
        if (!already) {
          const tx = await db.Transaction.create({
            type: bill.type || "expense",
            amount: amt,
            currency: cur,
            category: bill.category || "Tagihan",
            date: period + "T08:00:00.000Z",
            merchant: bill.category || "Tagihan Berulang",
            notes: `Otomatis dari tagihan berulang${bill.notes ? " — " + bill.notes : ""}`,
            input_by_name: "Tagihan Berulang",
            tags: [],
            visibility: bill.visibility || "shared",
            linked_asset_id: bill.linked_asset_id || undefined,
            notif_batch_id: key,
            recurring_id: bill.id,
          });
          txId = tx.id;

          if (bill.linked_asset_id) {
            const asset = await db.Asset.get(bill.linked_asset_id);
            if (asset) {
              const newVal = roundForCurrency((asset.value || 0) - amt, asset.currency);
              await db.Asset.update(bill.linked_asset_id, { value: newVal });
              await recordAssetMutation(base44, {
                asset_id: bill.linked_asset_id, previous_value: asset.value, new_value: newVal,
                change_type: "transaction", source_ref: tx.id,
                source_description: `Tagihan berulang: ${bill.category || ""}`,
                actor_name: "Tagihan Berulang", currency: asset.currency || "IDR",
              });
            }
          }
        }

        const nextDate = computeNext(bill.start_date || bill.next_date, period, bill.frequency);
        await db.RecurringBill.update(bill.id, { last_run_date: today, next_date: nextDate });
        results.push({ bill_id: bill.id, tx_id: txId, skipped_duplicate: already, next_date: nextDate });
      } catch (e) {
        console.error("[processRecurringBills] failed for bill", bill.id, e);
        results.push({ bill_id: bill.id, error: e?.message || "failed" });
      }
    }

    return Response.json({ ok: true, processed: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Hitung periode berikutnya setelah `current` berdasarkan jangkar `anchor`.
function computeNext(anchor, current, frequency) {
  const [ay, am, ad] = anchor.split("-").map(Number);
  const [cy, cm, cd] = current.split("-").map(Number);
  const fmt = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

  if (frequency === "daily" || frequency === "weekly") {
    const d = new Date(Date.UTC(cy, cm - 1, cd));
    d.setUTCDate(d.getUTCDate() + (frequency === "daily" ? 1 : 7));
    return d.toISOString().slice(0, 10);
  }
  if (frequency === "yearly") {
    const y = cy + 1;
    return fmt(y, am, Math.min(ad, lastDay(y, am)));
  }
  let y = cy, m = cm + 1;
  if (m > 12) { m = 1; y++; }
  return fmt(y, m, Math.min(ad, lastDay(y, m)));
}