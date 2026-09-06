import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { isAuthorizedCall } from "../../shared/workflowAuth.ts";
import { getAppUrl } from "../../shared/appUrl.ts";
import { startOfTodayInTz, userTz } from "../../shared/timezone.ts";

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const formatTodayID = (d) =>
  `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const buildEmail = (name, dateLabel, appUrl) => {
  const greeting = esc(name) || "Keluarga";
  const btnHref = esc(appUrl || "https://nafkita.base44.app");
  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 6px 28px rgba(15,23,42,0.10);">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:30px 28px 26px;">
          <p style="margin:0;color:#ffffff;font-size:12px;opacity:0.92;letter-spacing:0.08em;text-transform:uppercase;">NAFKITA &middot; Pengingat Malam</p>
          <h1 style="margin:10px 0 0;color:#ffffff;font-size:23px;font-weight:700;line-height:1.25;">Halo, ${greeting} 👋</h1>
          <p style="margin:8px 0 0;color:#e0e7ff;font-size:13px;">${esc(dateLabel)}</p>
        </td></tr>
        <tr><td style="padding:28px 26px 8px;">
          <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65;">
            Sepertinya kamu <strong>belum sempat mencatat transaksi hari ini</strong>. Luangkan sebentar untuk mencatat pengeluaran, pemasukan, atau sedekah hari ini sebelum tidur.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 6px;color:#6366f1;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">💡 Catat Cepat</p>
              <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">Punya bon/struk? Cukup <strong>foto bon</strong> di aplikasi — AI akan membaca dan mencatat transaksinya secara otomatis.</p>
            </td></tr>
          </table>
          <p style="margin:18px 0 0;color:#334155;font-size:15px;line-height:1.65;">
            Mencatat keuangan setiap hari membuat kamu dan pasangan selalu selaras mengelola nafkah keluarga 📊
          </p>
        </td></tr>
        <tr><td style="padding:8px 26px 26px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
            <tr><td style="background:#6366f1;border-radius:12px;padding:13px 26px;">
              <a href="${btnHref}" target="_blank" rel="noopener" style="display:block;margin:0;color:#ffffff;font-size:14px;font-weight:600;text-align:center;text-decoration:none;">Buka NAFKITA di ponselmu &amp; catat sekarang</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 26px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;">
          <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.55;text-align:center;">Email ini dikirim otomatis oleh NAFKITA setiap malam. Jika sudah mencatat, abaikan pesan ini 😊</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;color:#94a3b8;font-size:11px;text-align:center;">&copy; NAFKITA &mdash; Manajemen Keuangan Keluarga</p>
    </td></tr>
  </table>
</body>
</html>`;
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    if (!(await isAuthorizedCall(req, base44))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await base44.asServiceRole.entities.User.list();

    // Tentukan "hari ini" per timezone pengguna (default Asia/Riyadh).
    // Kelompokkan user berdasarkan timezone agar batas "hari ini" tepat.
    const byTz = {};
    for (const u of users) {
      if (!u.email) continue;
      const tz = userTz(u);
      if (!byTz[tz]) byTz[tz] = [];
      byTz[tz].push(u);
    }

    let sent = 0;
    let totalReminded = 0;

    for (const tz of Object.keys(byTz)) {
      const tzUsers = byTz[tz];
      const start = startOfTodayInTz(tz);
      const transactions = await base44.asServiceRole.entities.Transaction.filter({
        date: { $gte: start.toISOString() }
      });
      const recordedIds = new Set(transactions.map((t) => t.created_by_id).filter(Boolean));
      const toRemind = tzUsers.filter((u) => !recordedIds.has(u.id));
      totalReminded += toRemind.length;

      // Label tanggal dalam timezone pengguna.
      const nowInTz = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
      const dateLabel = formatTodayID(nowInTz);

      for (const u of toRemind) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: u.email,
            subject: "🌙 Pengingat Malam: Catat transaksi hari ini",
            body: buildEmail(u.full_name, dateLabel, getAppUrl(req))
          });
          sent++;
        } catch {
          // skip individual send errors
        }
      }
    }

    return Response.json({ sent, total_users: users.length, reminded: totalReminded });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}