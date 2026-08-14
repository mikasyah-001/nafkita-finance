import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isAuthorizedCall } from "../../shared/workflowAuth.ts";
import { getAppUrl } from "../../shared/appUrl.ts";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const formatIDR = (n) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");

const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function buildEmail(name, periodLabel, summary, appUrl) {
  const greeting = esc(name) || "Keluarga";
  const btnHref = esc(appUrl || "https://nafkita.base44.app");
  const rows = summary.topCategories.length
    ? summary.topCategories.map(([cat, val], i) =>
        `<tr><td style="padding:9px 14px;color:#475569;font-size:13px;border-bottom:1px solid #f1f5f9;">${i + 1}. ${esc(cat)}</td><td style="padding:9px 14px;color:#0f172a;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${formatIDR(val)}</td></tr>`
      ).join("")
    : `<tr><td colspan="2" style="padding:14px;color:#94a3b8;font-size:13px;text-align:center;">Tidak ada pengeluaran bulan ini</td></tr>`;

  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 6px 28px rgba(15,23,42,0.10);">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:30px 28px 26px;">
          <p style="margin:0;color:#ffffff;font-size:12px;opacity:0.92;letter-spacing:0.08em;text-transform:uppercase;">NAFKITA &middot; Ringkasan Bulanan</p>
          <h1 style="margin:10px 0 0;color:#ffffff;font-size:23px;font-weight:700;line-height:1.25;">Halo, ${greeting} 👋</h1>
          <p style="margin:8px 0 0;color:#e0e7ff;font-size:13px;">Ringkasan keuangan bulan ${esc(periodLabel)}</p>
        </td></tr>
        <tr><td style="padding:26px 26px 8px;">
          <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65;">
            Saatnya meninjau anggaran bersama pasangan. Berikut ringkasan keuangan keluarga kamu bulan lalu.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;margin-bottom:18px;">
            <tr><td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0;color:#64748b;font-size:12px;">Pemasukan</p>
              <p style="margin:4px 0 0;color:#059669;font-size:18px;font-weight:700;">${formatIDR(summary.income)}</p>
            </td></tr>
            <tr><td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0;color:#64748b;font-size:12px;">Pengeluaran</p>
              <p style="margin:4px 0 0;color:#ef4444;font-size:18px;font-weight:700;">${formatIDR(summary.expense)}</p>
            </td></tr>
            <tr><td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0;color:#64748b;font-size:12px;">Sedekah</p>
              <p style="margin:4px 0 0;color:#0d9488;font-size:18px;font-weight:700;">${formatIDR(summary.sedekah)}</p>
            </td></tr>
            <tr><td style="padding:14px 18px;">
              <p style="margin:0;color:#64748b;font-size:12px;">Saldo Bersih</p>
              <p style="margin:4px 0 0;color:${summary.balance >= 0 ? "#059669" : "#ef4444"};font-size:20px;font-weight:700;">${summary.balance >= 0 ? "+" : ""}${formatIDR(summary.balance)}</p>
            </td></tr>
          </table>
          <p style="margin:0 0 10px;color:#334155;font-size:14px;font-weight:600;">Top 5 Pengeluaran per Kategori</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
            ${rows}
          </table>
          <p style="margin:16px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
            Total <strong>${summary.count} transaksi</strong> tercatat bulan ini. Buka NAFKITA untuk melihat detail lengkap dan merencanakan anggaran bulan ini bersama pasangan.
          </p>
        </td></tr>
        <tr><td style="padding:8px 26px 26px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
            <tr><td style="background:#6366f1;border-radius:12px;padding:13px 26px;">
              <a href="${btnHref}" target="_blank" rel="noopener" style="display:block;margin:0;color:#ffffff;font-size:14px;font-weight:600;text-align:center;text-decoration:none;">Buka NAFKITA &amp; tinjau anggaran bersama</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 26px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;">
          <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.55;text-align:center;">Email ini dikirim otomatis setiap tanggal 1 oleh NAFKITA.</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;color:#94a3b8;font-size:11px;text-align:center;">&copy; NAFKITA &mdash; Manajemen Keuangan Keluarga</p>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    if (!await isAuthorizedCall(req, base44)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await base44.asServiceRole.entities.User.list();
    const partnerships = await base44.asServiceRole.entities.Partnership.filter({ status: "active" });

    const userMap = {};
    users.forEach((u) => { userMap[u.id] = u; });

    const paired = new Set();
    const couples = [];
    partnerships.forEach((p) => {
      if (p.inviter_id && p.invitee_id) {
        paired.add(p.inviter_id);
        paired.add(p.invitee_id);
        couples.push([p.inviter_id, p.invitee_id]);
      }
    });

    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
    const monthEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 1);
    const periodLabel = `${MONTHS[prevMonth.getMonth()]} ${prevMonth.getFullYear()}`;

    const allTx = await base44.asServiceRole.entities.Transaction.filter({
      date: { $gte: monthStart.toISOString(), $lt: monthEnd.toISOString() }
    });

    const computeSummary = (txs) => {
      const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + (t.amount || 0), 0);
      const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + (t.amount || 0), 0);
      const sedekah = txs.filter((t) => t.type === "sedekah").reduce((s, t) => s + (t.amount || 0), 0);
      const balance = income - expense;
      const catMap = {};
      txs.filter((t) => t.type === "expense").forEach((t) => {
        if (t.category) catMap[t.category] = (catMap[t.category] || 0) + (t.amount || 0);
      });
      const topCategories = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
      return { income, expense, sedekah, balance, topCategories, count: txs.length };
    };

    let sent = 0;
    const sendTo = async (emails, summary, name) => {
      for (const email of emails) {
        if (!email) continue;
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: email,
            subject: `📊 Ringkasan Keuangan ${periodLabel} - NAFKITA`,
            body: buildEmail(name, periodLabel, summary, getAppUrl(req))
          });
          sent++;
        } catch (e) {
          // skip individual send errors
        }
      }
    };

    for (const [aId, bId] of couples) {
      const a = userMap[aId];
      const b = userMap[bId];
      if (!a && !b) continue;
      const txs = allTx.filter((t) => t.visibility !== "private" && (t.created_by_id === aId || t.created_by_id === bId));
      const summary = computeSummary(txs);
      const name = a?.full_name || b?.full_name || "Keluarga";
      await sendTo([a?.email, b?.email].filter(Boolean), summary, name);
    }

    for (const u of users) {
      if (paired.has(u.id) || !u.email) continue;
      const txs = allTx.filter((t) => t.created_by_id === u.id);
      const summary = computeSummary(txs);
      await sendTo([u.email], summary, u.full_name);
    }

    return Response.json({ sent, period: periodLabel, couples: couples.length, singles: users.length - paired.size });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}