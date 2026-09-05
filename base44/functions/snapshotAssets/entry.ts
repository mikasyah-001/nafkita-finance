import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isAuthorizedCall } from "../../shared/workflowAuth.ts";
import { resolvePartnerId, assetVisibleTo } from "../../shared/partnerResolve.ts";

const CURRENCIES = ['IDR', 'SAR', 'USD'];

// Snapshot aset bulanan: satu record per (user, period, mata uang).
// Sebelumnya menggabungkan seluruh user & mata uang menjadi satu snapshot global;
// kini dipecah per pemilik dan per mata uang agar tidak tercampur.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Otorisasi: user terautentikasi (snapshot miliknya sendiri) ATAU token workflow
    // (snapshot seluruh user). isAuthorizedCall dipakai hanya bila tidak ada user.
    let caller = null;
    try { caller = await base44.auth.me(); } catch {}
    const isWorkflow = !caller && await isAuthorizedCall(req, base44);
    if (!caller && !isWorkflow) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = caller && !isWorkflow
      ? [caller]
      : await base44.asServiceRole.entities.User.list('-created_date', 5000);
    const allAssets = await base44.asServiceRole.entities.Asset.filter({}, '-created_date', 5000);
    const partnerships = await base44.asServiceRole.entities.Partnership.list('-created_date', 200);

    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const partnerOf = (userId) => {
      const active = (partnerships || []).find(
        (p) => p.status === 'active' && (p.inviter_id === userId || p.invitee_id === userId)
      );
      if (!active) return null;
      return active.inviter_id === userId ? active.invitee_id : active.inviter_id;
    };

    let created = 0;
    let updated = 0;

    for (const u of users) {
      if (!u || !u.id) continue;
      const partnerId = partnerOf(u.id);
      // Aset terlihat oleh user ini: milik sendiri + shared milik pasangan.
      const visible = (allAssets || []).filter((a) => assetVisibleTo(a, u.id, partnerId));

      for (const cur of CURRENCIES) {
        const inCur = visible.filter((a) => (a.currency || 'IDR') === cur);
        if (inCur.length === 0) continue;

        let emas_value = 0, investasi_value = 0, bank_value = 0, other_value = 0;
        inCur.forEach((a) => {
          const v = a.value || 0;
          if (a.type === 'emas') emas_value += v;
          else if (a.type === 'investasi') investasi_value += v;
          else if (a.type === 'bank') bank_value += v;
          else other_value += v;
        });
        const total_value = emas_value + investasi_value + bank_value + other_value;

        const existing = await base44.asServiceRole.entities.AssetSnapshot.filter({
          owner_id: u.id, period, currency: cur
        });
        if (existing.length > 0) {
          await base44.asServiceRole.entities.AssetSnapshot.update(existing[0].id, {
            emas_value, investasi_value, bank_value, other_value, total_value
          });
          updated++;
        } else {
          await base44.asServiceRole.entities.AssetSnapshot.create({
            owner_id: u.id, currency: cur, period,
            emas_value, investasi_value, bank_value, other_value, total_value
          });
          created++;
        }
      }
    }

    return Response.json({ period, created, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}