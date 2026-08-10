import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isAuthorizedCall } from "../../shared/workflowAuth.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    if (!await isAuthorizedCall(req, base44)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const assets = await base44.asServiceRole.entities.Asset.list();
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let emas_value = 0, investasi_value = 0, bank_value = 0, other_value = 0;
    assets.forEach((a) => {
      const v = a.value || 0;
      if (a.type === 'emas') emas_value += v;
      else if (a.type === 'investasi') investasi_value += v;
      else if (a.type === 'bank') bank_value += v;
      else other_value += v;
    });
    const total_value = emas_value + investasi_value + bank_value + other_value;

    const existing = await base44.asServiceRole.entities.AssetSnapshot.filter({ period });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.AssetSnapshot.update(existing[0].id, {
        emas_value, investasi_value, bank_value, other_value, total_value
      });
    } else {
      await base44.asServiceRole.entities.AssetSnapshot.create({
        period, emas_value, investasi_value, bank_value, other_value, total_value
      });
    }

    return Response.json({ period, emas_value, investasi_value, bank_value, other_value, total_value });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}