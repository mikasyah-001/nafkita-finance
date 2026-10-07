import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { isAuthorizedCall } from "../../shared/workflowAuth.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { periodInTz, userTz } from "../../shared/timezone.ts";

const CURRENCIES = ["IDR", "SAR", "USD"];

// Snapshot aset bulanan: satu record per (user, period, mata uang, scope).
// scope "own" = hanya aset milik sendiri (created_by_id === owner).
// scope "family" = termasuk aset shared milik pasangan (tampilan keluarga).
// Periode dihitung per timezone pengguna (default Asia/Riyadh).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    let caller = null;
    try { caller = await base44.auth.me(); } catch {}
    const isWorkflow = !caller && (await isAuthorizedCall(req, base44));
    if (!caller && !isWorkflow) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = caller && !isWorkflow
      ? [caller]
      : await fetchAll(base44.asServiceRole.entities.User);
    const allAssets = await fetchAll(base44.asServiceRole.entities.Asset);
    const partnerships = await fetchAll(base44.asServiceRole.entities.Partnership);

    const partnerOf = (userId) => {
      const active = (partnerships || []).find(
        (p) => p.status === "active" && (p.inviter_id === userId || p.invitee_id === userId)
      );
      if (!active) return null;
      return active.inviter_id === userId ? active.invitee_id : active.inviter_id;
    };

    let created = 0;
    let updated = 0;

    for (const u of users) {
      if (!u || !u.id) continue;
      const tz = userTz(u);
      const period = periodInTz(tz);
      const partnerId = partnerOf(u.id);
      const ownAssets = (allAssets || []).filter((a) => a.created_by_id === u.id);
      const familyAssets = (allAssets || []).filter(
        (a) => a.created_by_id === u.id || (a.visibility === "shared" && a.created_by_id === partnerId)
      );

      for (const scope of ["own", "family"]) {
        const assets = scope === "own" ? ownAssets : familyAssets;
        for (const cur of CURRENCIES) {
          const inCur = assets.filter((a) => (a.currency || "IDR") === cur);
          if (inCur.length === 0) continue;

          let emas_value = 0, investasi_value = 0, bank_value = 0, other_value = 0;
          inCur.forEach((a) => {
            const v = a.value || 0;
            if (a.type === "emas" || a.type === "emas_digital") emas_value += v;
            else if (a.type === "investasi") investasi_value += v;
            else if (a.type === "bank") bank_value += v;
            else other_value += v;
          });
          const total_value = emas_value + investasi_value + bank_value + other_value;

          const existing = await base44.asServiceRole.entities.AssetSnapshot.filter({
            owner_id: u.id, period, currency: cur, scope
          });
          if (existing.length > 0) {
            await base44.asServiceRole.entities.AssetSnapshot.update(existing[0].id, {
              emas_value, investasi_value, bank_value, other_value, total_value
            });
            updated++;
          } else {
            await base44.asServiceRole.entities.AssetSnapshot.create({
              owner_id: u.id, currency: cur, period, scope,
              emas_value, investasi_value, bank_value, other_value, total_value
            });
            created++;
          }
        }
      }
    }

    return Response.json({ created, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}