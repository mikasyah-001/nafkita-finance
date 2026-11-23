import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { roundForCurrency } from "../../shared/assetAdjust.ts";
import { recordAssetMutation } from "../../shared/assetMutation.ts";

// Menambah progress tabungan ke sebuah SavingsGoal.
// method = "manual": hanya menambah current_amount + contribution_history.
// method = "topup": TRANSFER dari rekening sumber ke rekening tempat dana
//   target disimpan ("Disimpan di" / allocated_asset_ids). Target adalah penanda
//   atas uang di rekening (model earmark), bukan wadah terpisah — dulu top-up
//   mengurangi saldo rekening tanpa menambah aset lain, sehingga total aset &
//   dasar zakat turun padahal uangnya masih milik keluarga.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { goal_id, amount, method, source_asset_id, notes } = body;
    if (!goal_id) return Response.json({ error: "goal_id wajib diisi" }, { status: 400 });
    const amt = Number(amount);
    if (!amt || amt <= 0) return Response.json({ error: "Nominal harus > 0" }, { status: 400 });

    const goal = await base44.entities.SavingsGoal.get(goal_id);
    if (!goal) return Response.json({ error: "goal_not_found" }, { status: 404 });
    if (goal.created_by_id !== me.id)
      return Response.json({ error: "forbidden" }, { status: 403 });

    // Top-up = transfer ke rekening target (lihat keterangan di atas).
    const allocated = Array.isArray(goal.allocated_asset_ids) ? [...new Set(goal.allocated_asset_ids.filter(Boolean))] : [];
    let transfer = null;
    if (method === "topup") {
      if (!allocated.length) {
        return Response.json({ error: "needs_destination", message: "Atur \"Disimpan di\" pada target agar setoran dipindahkan ke rekening target" }, { status: 400 });
      }
      const destId = String(body.dest_asset_id || (allocated.length === 1 ? allocated[0] : ""));
      if (!destId || !allocated.includes(destId)) return Response.json({ error: "Pilih rekening tujuan target" }, { status: 400 });
      if (!source_asset_id) return Response.json({ error: "Pilih rekening sumber" }, { status: 400 });
      if (source_asset_id === destId) return Response.json({ error: "Rekening sumber sama dengan rekening target" }, { status: 400 });
      const [src, dest] = await Promise.all([
        base44.entities.Asset.get(source_asset_id).catch(() => null),
        base44.entities.Asset.get(destId).catch(() => null),
      ]);
      if (!src || !dest) return Response.json({ error: "asset_not_found" }, { status: 404 });
      if (src.created_by_id !== me.id || dest.created_by_id !== me.id) return Response.json({ error: "forbidden" }, { status: 403 });
      // Hanya rekening bank/tunai yang bisa menerima uang (sama dengan aturan
      // Transfer). Emas/investasi nilainya dari jumlah unit × harga — menambah
      // "value" tanpa membeli unit membuat uangnya tidak terhitung.
      const isMoney = (a) => a.type === "bank" || a.type === "tunai";
      if (!isMoney(src) || !isMoney(dest))
        return Response.json({ error: "Setoran hanya antar rekening bank/tunai. Untuk emas/investasi, catat pembeliannya di Aset." }, { status: 400 });
      const cur = (src.currency || "IDR").toUpperCase();
      if (cur !== (dest.currency || "IDR").toUpperCase())
        return Response.json({ error: "Mata uang rekening sumber & rekening target berbeda — gunakan menu Transfer" }, { status: 400 });
      if ((Number(src.value) || 0) < amt) return Response.json({ error: "saldo_tidak_cukup" }, { status: 400 });

      const myName = me.full_name || me.email;
      const pairId = "goal-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const undo: Array<() => Promise<unknown>> = [];
      try {
        const srcPrev = Number(src.value) || 0;
        const srcNew = roundForCurrency(srcPrev - amt, src.currency);
        await base44.entities.Asset.update(src.id, { value: srcNew });
        undo.push(() => base44.entities.Asset.update(src.id, { value: srcPrev }));
        const destPrev = Number(dest.value) || 0;
        const destNew = roundForCurrency(destPrev + amt, dest.currency);
        await base44.entities.Asset.update(dest.id, { value: destNew });
        undo.push(() => base44.entities.Asset.update(dest.id, { value: destPrev }));

        const common: Record<string, unknown> = {
          category: "Setoran Tabungan", date: new Date().toISOString(), notes: notes || "",
          input_by_name: myName, tags: ["setoran-target"], transfer_pair_id: pairId,
          amount: amt, currency: cur,
          visibility: src.visibility === "private" || dest.visibility === "private" ? "private" : "shared",
        };
        // Id target pribadi juga tidak ditempel pada transaksi bersama.
        if (!(goal.visibility === "private" && common.visibility !== "private")) common.savings_goal_id = goal_id;
        // Nama target pribadi tidak ditulis di transaksi yang bisa dilihat pasangan.
        const goalLabel = goal.visibility === "private" && common.visibility !== "private" ? "target pribadi" : goal.name;
        const outTx = await base44.entities.Transaction.create({ ...common, type: "expense", merchant: `Setoran ${goalLabel} → ${dest.name}`, linked_asset_id: src.id, transfer_direction: "out" });
        undo.push(() => base44.entities.Transaction.delete(outTx.id));
        const inTx = await base44.entities.Transaction.create({ ...common, type: "income", merchant: `Setoran ${goalLabel} dari ${src.name}`, linked_asset_id: dest.id, transfer_direction: "in" });
        undo.push(() => base44.entities.Transaction.delete(inTx.id));

        await recordAssetMutation(base44, { asset_id: src.id, previous_value: srcPrev, new_value: srcNew, change_type: "transfer", source_ref: pairId, source_description: `Setoran target: ${goal.name}`, actor_id: me.id, actor_name: myName, currency: cur, notes: notes || "" });
        await recordAssetMutation(base44, { asset_id: dest.id, previous_value: destPrev, new_value: destNew, change_type: "transfer", source_ref: pairId, source_description: `Setoran target: ${goal.name}`, actor_id: me.id, actor_name: myName, currency: cur, notes: notes || "" });
        transfer = { pairId, outId: outTx.id, srcId: src.id, destId: dest.id, cur };
      } catch (e) {
        for (const fn of undo.reverse()) { try { await fn(); } catch { /* lanjut */ } }
        throw e;
      }
    }

    // Update goal: contribution_history selalu (dipakai proyeksi laju setoran).
    // current_amount hanya untuk target manual — target "Disimpan di" mengambil
    // progres dari saldo rekeningnya, jadi tidak ditambah lagi (hindari ganda).
    const newAmount = transfer ? (goal.current_amount || 0) : roundForCurrency((goal.current_amount || 0) + amt, goal.currency);
    const history = Array.isArray(goal.contribution_history) ? [...goal.contribution_history] : [];
    // Riwayat dicatat dalam mata uang TARGET (dipakai proyeksi). Bila rekening
    // bermata uang lain, frontend mengirim goal_amount (setara, kurs aplikasi);
    // nominal asli rekening disimpan untuk jejak.
    const goalCur = (goal.currency || "IDR").toUpperCase();
    const crossCur = transfer && transfer.cur !== goalCur;
    const goalAmt = crossCur ? Number(body.goal_amount) || 0 : amt;
    history.push({
      date: new Date().toISOString(),
      amount: goalAmt,
      ...(crossCur ? { account_amount: amt, account_currency: transfer.cur } : {}),
      method: method || "manual",
      notes: notes || "",
      ...(transfer ? { transaction_id: transfer.outId, transfer_pair_id: transfer.pairId, asset_id: transfer.srcId, dest_asset_id: transfer.destId } : {}),
    });

    const updateData = {
      current_amount: newAmount,
      contribution_history: history,
    };

    // Tandai selesai bila target tercapai.
    if (!transfer && newAmount >= (goal.target_amount || 0) && goal.target_amount > 0) {
      updateData.status = "completed";
    }

    const updated = await base44.entities.SavingsGoal.update(goal_id, updateData);

    return Response.json({
      ok: true,
      goal_id,
      current_amount: newAmount,
      status: updateData.status || goal.status,
      goal: updated,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}