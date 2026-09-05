import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isAuthorizedCall } from "../../shared/workflowAuth.ts";
import { resolvePartnerId, txVisibleTo } from "../../shared/partnerResolve.ts";
import { getAppUrl } from "../../shared/appUrl.ts";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const CURRENCIES = ["IDR", "SAR", "USD"];

const fmt = (n, cur) => {
  const c = (cur || "IDR").toUpperCase();
  const v = Math.round(Number(n) || 0);
  if (c === "USD") return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (c === "SAR") return "SAR " + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "Rp" + v.toLocaleString("id-ID");
};

const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function buildEmail(name, periodLabel, perCurrency, appUrl) {
  const greeting = esc(name) || "Keluarga";
  const btnHref = esc(appUrl || "https://nafkita.base44.app");

  const blocks = CURRENCIES.map((cur) => {
    const s = perCurrency[cur];
    if (!s || s.count === 0) return "";
    const rows = s.topCategories.length
      ? s.topCategories.map(([cat, val], i) =>
          `<tr><td style="padding:9px 14px;color:#475569;font-size:13px;border-bottom:1px solid #f1f5f9;">${i + 1}. ${esc(cat)}</td><td style="padding:9px 14px;color:#0f172a;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${fmt(val, cur)}</td></tr>`
        ).join("")
      : `<tr><td colspan="2" style="padding:14px;color:#94a3b8;font-size:13px;text-align:center;">Tidak ada pengeluaran</td></tr>`;
    return `
      <tr><td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;background:#f8fafc;">
        <p style="margin:0;color:#64748b;font-size:12px;">Pemasukan (${cur})</p>
        <p style="margin:4px 0 0;color:#059669;font-size:18px;font-weight:700;">${fmt(s.income, cur)}</p>
      </td></tr>
      <tr><td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;color:#64748b;font-size:12px;">Pengeluaran (${cur})</p>
        <p style="margin:4px 0 0;color:#ef4444;font-size:18px;font-weight:700;">${fmt(s.expense, cur)}</p>
      </td></tr>
      <tr><td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;color:#64748b;font-size:12px;">Sedekah (${cur})</p>
        <p style="margin:4px 0 0;color:#0d9488;font-size:18px;font-weight:700;">${fmt(s.sedekah, cur)}</p>
      </td></tr>
      <tr><td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;color:#64748b;font-size:12px;">Saldo Bersih (${cur})</p>
        <p style="margin:4px 0 0;color:${s.balance >= 0 ? "#059669" : "#ef4444"};font-size:20px;font-weight:700;">${s.balance >= 0 ? "+" : ""}${fmt(s.balance, cur)}</p>
      </td></tr>
      <tr><td style="padding:10px 18px 14px;">
        <p style="margin:0 0 6px;color:#334155;font-size:12px;font-weight:600;">Top 5 Pengeluaran (${cur})</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">${rows}</table>
      </td></tr>`;
  }).filter(Boolean).join("");

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
        <tr><td style="padding:22px 22px 6px;">
          <p style="margin:0 0 14px;color:#334155;font-size:14px;line-height:1.6;">Total dipisah per mata uang (IDR/SAR/USD) tanpa konversi. Saldo = pemasukan − pengeluaran − sedekah.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">${blocks}</table>
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

const computeSummary = (txs) => {
  const perCurrency = {};
  CURRENCIES.forEach((cur) => {
    const inCur = txs.filter((t) => (t.currency || "IDR") === cur);
    const income = inCur.filter((t) => t.type === "income").reduce((s, t) => s + (t.amount || 0), 0);
    const expense = inCur.filter((t) => t.type === "expense").reduce((s, t) => s + (t.amount || 0), 0);
    const sedekah = inCur.filter((t) => t.type === "sedekah").reduce((s, t) => s + (t.amount || 0), 0);
    const catMap = {};
    inCur.filter((t) => t.type === "expense").forEach((t) => {
      if (t.category) catMap[t.category] = (catMap[t.category] || 0) + (t.amount || 0);
    });
    perCurrency[cur] = {
      income, expense, sedekah,
      balance: income - expense - sedekah,
      topCategories: Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5),
      count: inCur.length,
    };
  });
  return perCurrency;
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    if (!await isAuthorizedCall(req, base44)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await base44.asServiceRole.entities.User.list('-created_date', 5000);
    const partnerships = await base44.asServiceRole.entities.Partnership.filter({ status: "active" });

    const userMap = {};
    users.forEach((u) => { if (u && u.id) userMap[u.id] = u; });

    const paired = new Set();
    const couples = [];
    (partnerships || []).forEach((p) => {
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
    }, '-date', 5000);

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
        } catch (e) { /* skip */ }
      }
    };

    for (const [aId, bId] of couples) {
      const a = userMap[aId];
      const b = userMap[bId];
      if (!a && !b) continue;
      const txs = (allTx || []).filter((t) => t.visibility !== "private" && (t.created_by_id === aId || t.created_by_id === bId));
      const summary = computeSummary(txs);
      const name = a?.full_name || b?.full_name || "Keluarga";
      await sendTo([a?.email, b?.email].filter(Boolean), summary, name);
    }

    for (const u of users) {
      if (!u || !u.id || paired.has(u.id) || !u.email) continue;
      const txs = (allTx || []).filter((t) => t.created_by_id === u.id);
      const summary = computeSummary(txs);
      await sendTo([u.email], summary, u.full_name);
    }

    return Response.json({ sent, period: periodLabel, couples: couples.length, singles: users.length - paired.size });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}