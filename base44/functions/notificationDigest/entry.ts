import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { isAuthorizedCall } from "../../shared/workflowAuth.ts";
import { getAppUrl } from "../../shared/appUrl.ts";
import { resolvePartnerId } from "../../shared/partnerResolve.ts";
import { startOfTodayInTz, userTz } from "../../shared/timezone.ts";
import { formatMoney } from "../../shared/notifyCommon.ts";

// Ringkasan notifikasi harian: untuk setiap user dengan daily_digest=true,
// kirim email berisi daftar transaksi & aset bersama yang dicatat/diubah pasangan hari ini.
// Dipicu oleh workflow terjadwal (scheduled).
const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const typeLabel = (t) => (t === "income" ? "Pemasukan" : t === "sedekah" ? "Sedekah" : "Pengeluaran");

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    if (!(await isAuthorizedCall(req, base44))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await base44.asServiceRole.entities.User.list();
    let sent = 0;

    for (const u of users) {
      if (!u.email) continue;
      // Ambil preferensi user.
      let pref = null;
      try {
        const prefs = await base44.asServiceRole.entities.NotificationPreference.filter(
          { created_by_id: u.id }, "-created_date", 1
        );
        pref = (prefs && prefs[0]) || null;
      } catch {}
      if (!pref || !pref.daily_digest) continue;
      if (pref.mute) continue;

      const partnerId = await resolvePartnerId(base44, u.id);
      if (!partnerId) continue;

      const tz = userTz(u);
      const start = startOfTodayInTz(tz);
      const startIso = start.toISOString();

      // Transaksi bersama milik pasangan hari ini.
      const txs = await base44.asServiceRole.entities.Transaction.filter({
        created_by_id: partnerId,
        visibility: "shared",
        date: { $gte: startIso },
      });
      // Aset bersama milik pasangan yang dibuat/diubah hari ini.
      const assets = await base44.asServiceRole.entities.Asset.filter({
        created_by_id: partnerId,
        visibility: "shared",
        updated_date: { $gte: startIso },
      });

      if (!txs.length && !assets.length) continue;

      const nowInTz = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
      const dateLabel = `${DAYS[nowInTz.getDay()]}, ${nowInTz.getDate()} ${MONTHS[nowInTz.getMonth()]} ${nowInTz.getFullYear()}`;

      let htmlRows = "";
      for (const t of txs.slice(0, 20)) {
        const sign = t.type === "income" ? "+" : "-";
        const label = esc(t.merchant || t.notes || (t.type === "sedekah" ? "Sedekah & Infaq" : t.category) || "Transaksi");
        htmlRows += `<tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">${esc(typeLabel(t.type))}</td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">${sign}${esc(formatMoney(t.amount, t.currency))}</td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;">${label}</td></tr>`;
      }
      if (txs.length > 20) {
        htmlRows += `<tr><td colspan="3" style="padding:6px 0;color:#94a3b8;font-size:12px;">...dan ${txs.length - 20} transaksi lainnya</td></tr>`;
      }
      let assetRows = "";
      for (const a of assets.slice(0, 10)) {
        assetRows += `<tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">${esc(a.name || "Aset")}</td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">${esc(formatMoney(a.value, a.currency))}</td></tr>`;
      }

      const appUrl = getAppUrl(req);
      const html = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 6px 28px rgba(15,23,42,0.10);">
<tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:26px 28px;">
<p style="margin:0;color:#fff;font-size:12px;opacity:0.92;letter-spacing:0.08em;text-transform:uppercase;">NAFKITA &middot; Ringkasan Harian</p>
<h1 style="margin:8px 0 0;color:#fff;font-size:21px;font-weight:700;">Halo, ${esc(u.full_name || "Keluarga")} 👋</h1>
<p style="margin:6px 0 0;color:#e0e7ff;font-size:13px;">${esc(dateLabel)}</p>
</td></tr>
<tr><td style="padding:24px 26px;">
${txs.length ? `<p style="margin:0 0 10px;color:#334155;font-size:15px;font-weight:600;">${txs.length} transaksi dari pasangan</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#334155;">
<tr><th style="text-align:left;padding:6px 0;border-bottom:2px solid #e2e8f0;font-size:12px;color:#64748b;">Jenis</th><th style="text-align:left;padding:6px 0;border-bottom:2px solid #e2e8f0;font-size:12px;color:#64748b;">Nominal</th><th style="text-align:left;padding:6px 0;border-bottom:2px solid #e2e8f0;font-size:12px;color:#64748b;">Keterangan</th></tr>
${htmlRows}</table>` : ""}
${assets.length ? `<p style="margin:18px 0 10px;color:#334155;font-size:15px;font-weight:600;">${assets.length} aset diperbarui</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#334155;">
<tr><th style="text-align:left;padding:6px 0;border-bottom:2px solid #e2e8f0;font-size:12px;color:#64748b;">Aset</th><th style="text-align:left;padding:6px 0;border-bottom:2px solid #e2e8f0;font-size:12px;color:#64748b;">Nilai</th></tr>
${assetRows}</table>` : ""}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 4px;">
<tr><td style="background:#6366f1;border-radius:12px;padding:13px 26px;">
<a href="${esc(appUrl)}" target="_blank" rel="noopener" style="display:block;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">Buka NAFKITA</a>
</td></tr></table>
</td></tr>
</table></td></tr></table></body></html>`;

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: u.email,
          subject: `📊 Ringkasan Harian NAFKITA — ${dateLabel}`,
          body: html,
        });
        sent++;
      } catch {}
    }

    return Response.json({ sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}