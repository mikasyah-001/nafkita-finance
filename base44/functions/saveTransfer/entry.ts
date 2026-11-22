import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { roundForCurrency } from "../../shared/assetAdjust.ts";
import { recordAssetMutation } from "../../shared/assetMutation.ts";
import { resolvePartnerId } from "../../shared/partnerResolve.ts";
import { createNotificationIdempotent } from "../../shared/notifyCommon.ts";
import { planTransfer } from "../../shared/transferRules.js";

// Transfer antar-rekening: sepasang transaksi (keluar & masuk) dengan
// transfer_pair_id yang sama — tidak dihitung sebagai pemasukan/pengeluaran.
//
// - Rekening asal: milik sendiri. Rekening tujuan: milik sendiri ATAU milik
//   pasangan aktif (bukan rekening pribadinya). Aturan: shared/transferRules.js.
// - Beda mata uang: body.received_amount = nominal yang diterima dalam mata uang
//   rekening tujuan (kurs bank). Tiap sisi tercatat dalam mata uangnya sendiri.
// - Saldo rekening pasangan diubah lewat service role (RLS hanya izinkan pemilik),
//   dan pasangan mendapat notifikasi uang masuk.
// - Rollback: bila langkah berikutnya gagal, saldo & transaksi dikembalikan.
//
// Body: { from_asset_id, to_asset_id, amount, received_amount?, date?, notes?, visibility? }
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch { /* tanpa sesi */ }
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { from_asset_id, to_asset_id, amount, received_amount, date, notes, visibility } = body;
    const svc = base44.asServiceRole.entities;

    const [fromAsset, toAsset] = await Promise.all([
      from_asset_id ? svc.Asset.get(from_asset_id).catch(() => null) : null,
      to_asset_id ? svc.Asset.get(to_asset_id).catch(() => null) : null,
    ]);
    if (!fromAsset || !toAsset) return Response.json({ error: "aset_tidak_ditemukan", message: "Rekening asal atau tujuan tidak ditemukan" }, { status: 404 });

    const partnerId = toAsset.created_by_id !== me.id ? await resolvePartnerId(base44, me.id) : null;
    const plan = planTransfer({ from: fromAsset, to: toAsset, meId: me.id, partnerId, amount, receivedAmount: received_amount, visibility });
    if (plan.error) return Response.json({ error: "invalid_transfer", message: plan.error }, { status: 400 });

    const myName = me.full_name || me.email;
    const firstName = String(myName || "").split(/\s+/)[0] || "Pasangan";
    const txDate = date || new Date().toISOString();
    const pairId = "trf-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const batchId = "transfer-" + pairId;
    const outLabel = plan.toPartner ? `Transfer ke ${toAsset.name} (pasangan)` : `Transfer ke ${toAsset.name || "rekening tujuan"}`;
    // Sisi masuk di rekening pasangan tidak menyebut nama rekening pribadi pengirim.
    const inLabel = plan.toPartner
      ? `Transfer dari ${firstName}${fromAsset.visibility === "private" ? "" : ` (${fromAsset.name})`}`
      : `Transfer dari ${fromAsset.name || "rekening asal"}`;
    const rateNote = plan.cross ? `Kurs: ${plan.amount} ${plan.fromCur} → ${plan.received} ${plan.toCur}` : "";
    const fullNotes = [notes || "", rateNote].filter(Boolean).join(" · ");

    const undo = [];
    const rollback = async () => { for (const fn of undo.reverse()) { try { await fn(); } catch (e) { console.error("[saveTransfer] rollback", e?.message); } } };

    try {
      // 1) Saldo rekening asal (−amount, mata uang asal)
      const fromPrev = Number(fromAsset.value) || 0;
      const fromNew = roundForCurrency(fromPrev - plan.amount, fromAsset.currency);
      await svc.Asset.update(fromAsset.id, { value: fromNew });
      undo.push(() => svc.Asset.update(fromAsset.id, { value: fromPrev }));

      // 2) Saldo rekening tujuan (+received, mata uang tujuan)
      const toPrev = Number(toAsset.value) || 0;
      const toNew = roundForCurrency(toPrev + plan.received, toAsset.currency);
      await svc.Asset.update(toAsset.id, { value: toNew });
      undo.push(() => svc.Asset.update(toAsset.id, { value: toPrev }));

      // 3) Dua sisi transaksi (dibuat atas nama pengirim)
      const common = { category: "Transfer", date: txDate, notes: fullNotes, input_by_name: myName, tags: plan.toPartner ? ["transfer-pasangan"] : [], notif_batch_id: batchId, transfer_pair_id: pairId };
      const outTx = await base44.entities.Transaction.create({
        ...common, type: "expense", amount: plan.amount, currency: plan.fromCur, merchant: outLabel,
        visibility: plan.outVisibility, linked_asset_id: fromAsset.id, transfer_direction: "out",
      });
      undo.push(() => base44.entities.Transaction.delete(outTx.id));
      const inTx = await base44.entities.Transaction.create({
        ...common, type: "income", amount: plan.received, currency: plan.toCur, merchant: inLabel,
        visibility: plan.inVisibility, linked_asset_id: toAsset.id, transfer_direction: "in",
      });
      undo.push(() => base44.entities.Transaction.delete(inTx.id));

      // 4) Jejak mutasi (setelah semua berhasil)
      await recordAssetMutation(base44, {
        asset_id: fromAsset.id, previous_value: fromPrev, new_value: fromNew, change_type: "transfer", source_ref: pairId,
        source_description: outLabel, actor_id: me.id, actor_name: myName, currency: fromAsset.currency || "IDR",
      });
      await recordAssetMutation(base44, {
        asset_id: toAsset.id, previous_value: toPrev, new_value: toNew, change_type: "transfer", source_ref: pairId,
        source_description: inLabel, actor_id: me.id, actor_name: myName, currency: toAsset.currency || "IDR",
      });

      // 5) Notifikasi uang masuk untuk pasangan
      if (plan.toPartner) {
        try {
          await createNotificationIdempotent(base44, {
            target_user_id: toAsset.created_by_id, actor_name: myName, action: "created", entity_kind: "transaction",
            event_key: `transfer-in-${pairId}`, title: `${firstName} mentransfer ke ${toAsset.name}`,
            body: notes || "Saldo rekening Anda sudah bertambah otomatis.", ref_id: inTx.id,
            amount: plan.received, currency: plan.toCur, tx_type: "income",
          });
        } catch (e) { console.error("[saveTransfer] notifikasi", e?.message); }
      }

      return Response.json({ ok: true, transfer_pair_id: pairId, out_tx: outTx, in_tx: inTx, to_partner: plan.toPartner, cross_currency: plan.cross });
    } catch (e) {
      await rollback();
      return Response.json({ error: "transfer_failed", message: e?.message || "Transfer gagal, saldo dikembalikan" }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
