import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isAuthorizedCall } from "../../shared/workflowAuth.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    if (!await isAuthorizedCall(req, base44)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Kumpulkan seluruh data entitas (service role = akses penuh)
    const [transactions, assets, categories, budgets, zakatPayments, snapshots, templates, investmentLots] = await Promise.all([
      base44.asServiceRole.entities.Transaction.list('-created_date', 5000),
      base44.asServiceRole.entities.Asset.list('-created_date', 5000),
      base44.asServiceRole.entities.Category.list('-created_date', 5000),
      base44.asServiceRole.entities.Budget.list('-created_date', 5000),
      base44.asServiceRole.entities.ZakatPayment.list('-created_date', 5000),
      base44.asServiceRole.entities.AssetSnapshot.list('-created_date', 5000),
      base44.asServiceRole.entities.TransactionTemplate.list('-created_date', 5000),
      base44.asServiceRole.entities.InvestmentLot.list('-created_date', 5000),
    ]);

    const now = new Date();
    const backup = {
      app: 'NAFKITA',
      exported_at: now.toISOString(),
      counts: {
        transactions: transactions.length,
        assets: assets.length,
        categories: categories.length,
        budgets: budgets.length,
        zakatPayments: zakatPayments.length,
        snapshots: snapshots.length,
        templates: templates.length,
        investmentLots: investmentLots.length,
      },
      data: { transactions, assets, categories, budgets, zakatPayments, snapshots, templates, investmentLots },
    };

    const json = JSON.stringify(backup, null, 2);
    const dateStr = now.toISOString().slice(0, 10);
    const fileName = `nafkita-backup-${dateStr}.json`;

    // Ambil token Google Drive (konektor shared builder)
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');

    // Upload via Google Drive multipart/related
    const metadata = { name: fileName, description: 'Cadangan data NAFKITA' };
    const boundary = 'nafkita_' + Math.random().toString(36).slice(2);
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${json}\r\n` +
      `--${boundary}--`;

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return Response.json({ error: 'drive_upload_failed', details: errText }, { status: 502 });
    }

    const file = await uploadRes.json();
    return Response.json({
      status: 'success',
      file_name: fileName,
      file_id: file.id,
      counts: backup.counts,
      exported_at: backup.exported_at,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}