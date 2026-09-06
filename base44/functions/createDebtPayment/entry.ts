import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { txEffect, roundForCurrency } from "../../shared/assetAdjust.ts";
import { recordAssetMutation } from "../../shared/assetMutation.ts";

// Mencatat pelunasan utang/piutang.
// - Memperbarui paid_amount, status (unpaid/partial/paid), paid_date.
// - Bila linked_asset_id diberikan, membuat transaksi pelunasan terkait aset bank
//   (expense untuk utang, income untuk piutang) dan menyesuaikan saldo.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { debt_id, payment_amount, linked_asset_id, payment_date } = body;
    if (!debt_id) return Response.json({ error: "debt_id wajib diisi" }, { status: 400 });
    const payAmt = Number(payment_amount) || 0;
    if (payAmt <= 0) return Response.json({ error: "payment_amount harus > 0" }, { status: 400 });

    const debt = await base44.entities.Debt.get(debt_id);
    if (!debt) return Response.json({ error: "debt_not_found" }, { status: 404 });
    if (debt.created_by_id !== me.id)
      return Response.json({ error: "forbidden" }, { status: 403 });

    const newPaid = (debt.paid_amount || 0) + payAmt;
    const totalAmt = Number(debt.amount) || 0;
    const status = newPaid >= totalAmt ? "paid" : "partial";
    const paidDate = status === "paid" ? (payment_date || new Date().toISOString().slice(0, 10)) : debt.paid_date;

    let adjustmentTxId = null;
    let assetPrev = null;

    // Bila aset bank ditautkan, buat transaksi pelunasan + sesuaikan saldo.
    if (linked_asset_id) {
      const asset = await base44.entities.Asset.get(linked_asset_id);
      if (!asset) return Response.json({ error: "asset_not_found" }, { status: 404 });
      if (asset.created_by_id !== me.id)
        return Response.json({ error: "forbidden" }, { status: 403 });

      // Utang -> expense (uang keluar); Piutang -> income (uang masuk).
      const txType = debt.type === "utang" ? "expense" : "income";
      const delta = txType === "income" ? payAmt : -payAmt;
      assetPrev = asset.value;
      const newVal = roundForCurrency((asset.value || 0) + delta, asset.currency);
      const debtPayRef = "debt-pay-" + Date.now();
      await base44.entities.Asset.update(linked_asset_id, { value: newVal });
      await recordAssetMutation(base44, {
        asset_id: linked_asset_id, previous_value: assetPrev, new_value: newVal,
        change_type: "transaction", source_ref: debtPayRef,
        source_description: `Pelunasan ${debt.type} — ${debt.counterparty_name || ""}`,
        actor_id: me.id, actor_name: me.full_name || me.email,
        currency: asset.currency || "IDR",
      });

      try {
        const tx = await base44.entities.Transaction.create({
          type: txType,
          amount: payAmt,
          currency: debt.currency || "IDR",
          category: debt.type === "utang" ? "Pelunasan Utang" : "Pelunasan Piutang",
          date: (payment_date || new Date().toISOString().slice(0, 10)) + "T00:00:00.000Z",
          merchant: debt.counterparty_name || "",
          notes: `Pelunasan ${debt.type} — ${debt.counterparty_name}`,
          input_by_name: me.full_name || me.email,
          tags: [],
          visibility: debt.visibility || "shared",
          linked_asset_id: linked_asset_id,
          notif_batch_id: debtPayRef,
        });
        adjustmentTxId = tx.id;
      } catch (e) {
        // Rollback aset bila transaksi gagal.
        try { await base44.entities.Asset.update(linked_asset_id, { value: assetPrev }); } catch {}
        return Response.json({ error: e?.message || "gagal_buat_tx" }, { status: 500 });
      }
    }

    // Perbarui record debt.
    const updated = await base44.entities.Debt.update(debt_id, {
      paid_amount: newPaid,
      status,
      paid_date: paidDate || undefined,
    });

    return Response.json({ ok: true, debt: updated, adjustment_tx_id: adjustmentTxId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}