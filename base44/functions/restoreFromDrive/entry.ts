import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isAuthorizedCall } from "../../shared/workflowAuth.ts";
import { BACKUP_ENTITIES, BACKUP_VERSION, txFingerprint, assetFingerprint, categoryFingerprint, budgetFingerprint } from "../../shared/backupFormat.ts";

const STRIP = ['id', 'created_date', 'updated_date'];

function strip(r) {
  const c = { ...r };
  STRIP.forEach((k) => delete c[k]);
  return c;
}

async function bulkCreateChunked(base44, entityName, records) {
  if (!records.length) return [];
  const out = [];
  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500);
    const res = await base44.asServiceRole.entities[entityName].bulkCreate(chunk);
    if (Array.isArray(res)) out.push(...res);
  }
  return out;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    if (!await isAuthorizedCall(req, base44)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'list';
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');

    if (action === 'list') {
      const q = "name contains 'nafkita-backup' and trashed = false";
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc&fields=files(id,name,createdTime,size)&pageSize=50`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return Response.json({ error: 'drive_list_failed', details: await res.text() }, { status: 502 });
      const data = await res.json();
      return Response.json({ files: data.files || [] });
    }

    if (action === 'restore') {
      const fileId = body.file_id;
      const mode = body.mode === 'replace' ? 'replace' : 'merge';
      if (!fileId) return Response.json({ error: 'file_id required' }, { status: 400 });

      const dl = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!dl.ok) return Response.json({ error: 'drive_download_failed', details: await dl.text() }, { status: 502 });
      const text = await dl.text();
      let backup;
      try { backup = JSON.parse(text); } catch { return Response.json({ error: 'invalid_backup_file' }, { status: 400 }); }

      const d = backup.data || {};

      // Muat data existing untuk dedup.
      const existing = {};
      for (const e of BACKUP_ENTITIES) {
        existing[e.key] = await base44.asServiceRole.entities[e.entity].list('-created_date', 5000);
      }

      // Mode Ganti total: hapus seluruh data lama (backup Drive = cadangan penuh app).
      if (mode === 'replace') {
        for (const e of BACKUP_ENTITIES) {
          await base44.asServiceRole.entities[e.entity].deleteMany({});
        }
        for (const e of BACKUP_ENTITIES) {
          existing[e.key] = [];
        }
      }

      // 1) Aset lebih dulu — bangun peta oldId -> newId untuk InvestmentLot.
      const assetIdMap = {};
      const existingAssetFps = new Set(existing.assets.map(assetFingerprint));
      const assetsToCreate = [];
      for (const a of (d.assets || [])) {
        const fp = assetFingerprint(a);
        if (mode === 'merge' && existingAssetFps.has(fp)) {
          const ex = existing.assets.find((x) => assetFingerprint(x) === fp);
          if (a.id && ex?.id) assetIdMap[a.id] = ex.id;
          continue;
        }
        assetsToCreate.push(a);
      }
      const createdAssets = await bulkCreateChunked(base44, 'Asset', assetsToCreate.map(strip));
      createdAssets.forEach((na, i) => {
        const oldId = assetsToCreate[i].id;
        if (oldId && na?.id) assetIdMap[oldId] = na.id;
      });

      // 2) Kategori (dedup nama+tipe).
      const existingCatFps = new Set(existing.categories.map(categoryFingerprint));
      const catsToCreate = (d.categories || []).filter((c) => !existingCatFps.has(categoryFingerprint(c)));
      await bulkCreateChunked(base44, 'Category', catsToCreate.map(strip));

      // 3) Transaksi (dedup fingerprint).
      const existingTxFps = new Set(existing.transactions.map(txFingerprint));
      const txToCreate = (d.transactions || []).filter((t) => !existingTxFps.has(txFingerprint(t)));
      await bulkCreateChunked(base44, 'Transaction', txToCreate.map(strip));

      // 4) Anggaran (dedup kategori+periode+mata uang+jangkauan).
      const existingBudgetFps = new Set(existing.budgets.map(budgetFingerprint));
      const budgetsToCreate = (d.budgets || []).filter((b) => !existingBudgetFps.has(budgetFingerprint(b)));
      await bulkCreateChunked(base44, 'Budget', budgetsToCreate.map(strip));

      // 5) Entitas lain (zakat, snapshot, template) — langsung dibuat.
      for (const key of ['zakatPayments', 'snapshots', 'templates']) {
        const e = BACKUP_ENTITIES.find((x) => x.key === key);
        const recs = (d[key] || []).map(strip);
        await bulkCreateChunked(base44, e.entity, recs);
      }

      // 6) Lot investasi — remap asset_id ke ID baru; lewati lot yatim.
      const lotsToCreate = (d.investmentLots || []).map((l) => {
        if (l.asset_id && !assetIdMap[l.asset_id]) return null;
        return { ...l, asset_id: l.asset_id ? assetIdMap[l.asset_id] : l.asset_id };
      }).filter(Boolean).map(strip);
      await bulkCreateChunked(base44, 'InvestmentLot', lotsToCreate);

      return Response.json({
        status: 'success',
        mode,
        version: backup.version || 1,
        file_name: backup.file_name || '',
        exported_at: backup.exported_at || '',
        created: {
          transactions: txToCreate.length,
          assets: assetsToCreate.length,
          categories: catsToCreate.length,
          budgets: budgetsToCreate.length,
          zakatPayments: (d.zakatPayments || []).length,
          snapshots: (d.snapshots || []).length,
          templates: (d.templates || []).length,
          investmentLots: lotsToCreate.length,
        },
      });
    }

    return Response.json({ error: 'unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}