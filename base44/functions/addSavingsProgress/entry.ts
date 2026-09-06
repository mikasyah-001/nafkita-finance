import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { roundForCurrency } from "../../shared/assetAdjust.ts";
import { recordAssetMutation } from "../../shared/assetMutation.ts";

// Menambah progress tabungan ke sebuah SavingsGoal.
// method = "manual": hanya menambah current_amount + contribution_history.
// method = "topup": memindahkan dana dari aset bank ke goal
//   (mengurangi saldo aset, menambah current_amount, mencatat mutasi aset).
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

    // Top-up: kurangi saldo aset sumber.
    if (method === "topup" && source_asset_id) {
      const asset = await base44.entities.Asset.get(source_asset_id);
      if (!asset) return Response.json({ error: "asset_not_found" }, { status: 404 });
      if (asset.created_by_id !== me.id)
        return Response.json({ error: "forbidden" }, { status: 403 });
      if ((asset.value || 0) < amt)
        return Response.json({ error: "saldo_tidak_cukup" }, { status: 400 });

      const prevValue = asset.value || 0;
      const newValue = roundForCurrency(prevValue - amt, asset.currency);
      await base44.entities.Asset.update(source_asset_id, { value: newValue });

      // Catat mutasi aset immutable.
      await recordAssetMutation(base44, {
        asset_id: source_asset_id,
        previous_value: prevValue,
        new_value: newValue,
        change_type: "transfer",
        source_ref: goal_id,
        source_description: `Top-up tabungan: ${goal.name}`,
        actor_id: me.id,
        actor_name: me.full_name || me.email,
        currency: asset.currency || "IDR",
        notes: notes || "",
      });
    }

    // Update goal: current_amount + contribution_history.
    const newAmount = roundForCurrency((goal.current_amount || 0) + amt, goal.currency);
    const history = Array.isArray(goal.contribution_history) ? [...goal.contribution_history] : [];
    history.push({
      date: new Date().toISOString(),
      amount: amt,
      method: method || "manual",
      notes: notes || "",
    });

    const updateData = {
      current_amount: newAmount,
      contribution_history: history,
    };

    // Tandai selesai bila target tercapai.
    if (newAmount >= (goal.target_amount || 0) && goal.target_amount > 0) {
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