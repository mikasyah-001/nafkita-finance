import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { fetchAll } from "../../shared/fetchAll.ts";
import { txEffect, roundForCurrency } from "../../shared/assetAdjust.ts";

// Dipanggil workflow terjadwal harian.
// Memproses semua tagihan berulang aktif dengan next_date <= hari ini:
// - Membuat satu transaksi otomatis (expense/sedekah) menyesuaikan saldo aset.
// - Memajukan next_date sesuai frekuensi.
// - Mengisi last_run_date.
// - Tidak memicu notifikasi instan (notif_batch_id).
//
// Menggunakan asServiceRole karena workflow tidak memiliki konteks user.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const today = new Date().toISOString().slice(0, 10);
    const todayStart = today + "T08:00:00.000Z";

    const bills = await fetchAll(base44.asServiceRole.entities.RecurringBill, {
      status: "active",
    });

    const due = (bills || []).filter((b) => {
      if (!b.next_date) return false;
      return b.next_date <= today;
    });

    const results = [];
    for (const bill of due) {
      try {
        const amt = Number(bill.amount) || 0;
        const cur = bill.currency || "IDR";
        const inputName = "Tagihan Berulang";

        // Sesuaikan saldo aset bila ditautkan.
        if (bill.linked_asset_id) {
          try {
            const asset = await base44.asServiceRole.entities.Asset.get(bill.linked_asset_id);
            if (asset) {
              const delta = -amt; // expense/sedekah selalu mengurangi
              const newVal = roundForCurrency((asset.value || 0) + delta, asset.currency);
              await base44.asServiceRole.entities.Asset.update(bill.linked_asset_id, { value: newVal });
            }
          } catch (e) {
            console.error("[processRecurringBills] asset adjust failed", bill.id, e);
          }
        }

        // Buat transaksi.
        const tx = await base44.asServiceRole.entities.Transaction.create({
          type: bill.type || "expense",
          amount: amt,
          currency: cur,
          category: bill.category || "Tagihan",
          date: todayStart,
          merchant: bill.category || "Tagihan Berulang",
          notes: `Otomatis dari tagihan berulang${bill.notes ? " — " + bill.notes : ""}`,
          input_by_name: inputName,
          tags: [],
          visibility: bill.visibility || "shared",
          linked_asset_id: bill.linked_asset_id || undefined,
          notif_batch_id: "recurring-" + bill.id + "-" + today,
          recurring_id: bill.id,
        });

        // Hitung next_date berdasarkan frekuensi.
        const nextDate = computeNext(bill.next_date, bill.frequency);

        // Perbarui bill: last_run_date + next_date.
        await base44.asServiceRole.entities.RecurringBill.update(bill.id, {
          last_run_date: today,
          next_date: nextDate,
        });

        results.push({ bill_id: bill.id, tx_id: tx.id, next_date: nextDate });
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

function computeNext(currentDate, frequency) {
  const d = new Date(currentDate);
  switch (frequency) {
    case "daily": d.setDate(d.getDate() + 1); break;
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "yearly": d.setFullYear(d.getFullYear() + 1); break;
    case "monthly":
    default: d.setMonth(d.getMonth() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}