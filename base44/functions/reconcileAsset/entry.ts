import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { fetchAllByDate } from "../../shared/fetchAll.ts";
import { txEffect, roundForCurrency } from "../../shared/assetAdjust.ts";
import { recordAssetMutation } from "../../shared/assetMutation.ts";

// Rekonsiliasi saldo aset bank.
// - Menghitung saldo terhitung dari mutasi transaksi terkait aset sampai as_of_date.
//   computed_balance = asset.value - sum(txEffect(t) for t where linked_asset_id = asset_id and date > as_of_date)
// - Membandingkan dengan statement_balance yang dimasukkan pengguna.
// - Menyimpan record Reconciliation.
// - Bila create_adjustment=true dan ada selisih, membuat transaksi penyesuaian
//   (is_adjustment) untuk menutup selisih dan menyesuaikan saldo aset.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { asset_id, statement_balance, as_of_date, create_adjustment, notes } = body;
    if (!asset_id) return Response.json({ error: "asset_id wajib diisi" }, { status: 400 });
    if (statement_balance == null) return Response.json({ error: "statement_balance wajib diisi" }, { status: 400 });

    const asset = await base44.entities.Asset.get(asset_id);
    if (!asset) return Response.json({ error: "asset_not_found" }, { status: 404 });
    if (asset.created_by_id !== me.id)
      return Response.json({ error: "forbidden" }, { status: 403 });

    const stmtBal = Number(statement_balance);
    const asOf = as_of_date || new Date().toISOString().slice(0, 10);
    const asOfEnd = asOf + "T23:59:59.999Z";

    // Ambil semua transaksi terkait aset ini.
    const txs = await fetchAllByDate(
      base44.entities.Transaction,
      { linked_asset_id: asset_id }
    );

    // Saldo terhitung = saldo sekarang - efek transaksi SETELAH as_of_date.
    let postDateEffect = 0;
    for (const t of (txs || [])) {
      if (new Date(t.date) > new Date(asOfEnd)) {
        postDateEffect += txEffect(t);
      }
    }
    const computedBalance = roundForCurrency((asset.value || 0) - postDateEffect, asset.currency);
    const difference = roundForCurrency(stmtBal - computedBalance, asset.currency);

    let adjustmentTxId = null;
    let reconciledStatus = "open";

    // Bila diminta, buat transaksi penyesuaian untuk menutup selisih.
    if (create_adjustment && Math.abs(difference) > 0.005) {
      const adjType = difference > 0 ? "income" : "expense";
      const adjAmt = Math.abs(difference);
      const adjPrev = asset.value;
      const delta = adjType === "income" ? adjAmt : -adjAmt;
      const newVal = roundForCurrency((asset.value || 0) + delta, asset.currency);
      await base44.entities.Asset.update(asset_id, { value: newVal });

      await recordAssetMutation(base44, {
        asset_id, previous_value: adjPrev, new_value: newVal,
        change_type: "reconciliation_adjustment",
        source_ref: "recon-" + asset_id + "-" + asOf,
        source_description: `Penyesuaian rekonsiliasi ${asOf}`,
        actor_id: me.id, actor_name: me.full_name || me.email,
        currency: asset.currency || "IDR",
      });

      try {
        const tx = await base44.entities.Transaction.create({
          type: adjType,
          amount: adjAmt,
          currency: asset.currency || "IDR",
          category: "Penyesuaian Rekonsiliasi",
          date: asOf + "T23:59:00.000Z",
          merchant: `Penyesuaian ${asset.name || "rekening"}`,
          notes: `Penyesuaian rekonsiliasi ${asOf}${notes ? " — " + notes : ""}`,
          input_by_name: me.full_name || me.email,
          tags: [],
          visibility: "shared",
          linked_asset_id: asset_id,
          notif_batch_id: "recon-" + Date.now(),
          is_adjustment: true,
        });
        adjustmentTxId = tx.id;
        reconciledStatus = "reconciled";
      } catch (e) {
        // Rollback aset.
        try { await base44.entities.Asset.update(asset_id, { value: adjPrev }); } catch {}
        return Response.json({ error: e?.message || "gagal_buat_adjustment" }, { status: 500 });
      }
    } else if (Math.abs(difference) <= 0.005) {
      // Selisih nol = otomatis reconciled.
      reconciledStatus = "reconciled";
    }

    // Simpan record rekonsiliasi.
    const recon = await base44.entities.Reconciliation.create({
      asset_id,
      asset_name: asset.name || "",
      statement_balance: stmtBal,
      computed_balance: computedBalance,
      difference,
      currency: asset.currency || "IDR",
      as_of_date: asOf,
      status: reconciledStatus,
      adjustment_tx_id: adjustmentTxId || undefined,
      notes: notes || "",
    });

    return Response.json({
      ok: true,
      reconciliation: recon,
      computed_balance: computedBalance,
      statement_balance: stmtBal,
      difference,
      adjustment_tx_id: adjustmentTxId,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}