import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isAuthorizedCall } from "../../shared/workflowAuth.ts";

const STRIP = ['id', 'created_date', 'updated_date', 'created_by_id'];

function clean(arr) {
  return (arr || []).map((r) => {
    const c = { ...r };
    STRIP.forEach((k) => { delete c[k]; });
    return c;
  });
}

async function bulkCreateChunked(base44, entityName, records) {
  if (!records.length) return 0;
  let total = 0;
  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500);
    const res = await base44.asServiceRole.entities[entityName].bulkCreate(chunk);
    total += Array.isArray(res) ? res.length : 0;
  }
  return total;
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
      if (!fileId) return Response.json({ error: 'file_id required' }, { status: 400 });
      const dl = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!dl.ok) return Response.json({ error: 'drive_download_failed', details: await dl.text() }, { status: 502 });
      const text = await dl.text();
      let backup;
      try { backup = JSON.parse(text); } catch { return Response.json({ error: 'invalid_backup_file' }, { status: 400 }); }

      const d = backup.data || {};
      const created = {};
      created.transactions = await bulkCreateChunked(base44, 'Transaction', clean(d.transactions));
      created.assets = await bulkCreateChunked(base44, 'Asset', clean(d.assets));
      created.categories = await bulkCreateChunked(base44, 'Category', clean(d.categories));
      created.budgets = await bulkCreateChunked(base44, 'Budget', clean(d.budgets));
      created.zakatPayments = await bulkCreateChunked(base44, 'ZakatPayment', clean(d.zakatPayments));
      created.snapshots = await bulkCreateChunked(base44, 'AssetSnapshot', clean(d.snapshots));
      created.templates = await bulkCreateChunked(base44, 'TransactionTemplate', clean(d.templates));

      return Response.json({
        status: 'success',
        file_name: backup.file_name || '',
        exported_at: backup.exported_at || '',
        created,
      });
    }

    return Response.json({ error: 'unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}