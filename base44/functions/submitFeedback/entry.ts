import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { waitUntil } from 'base44:runtime';

const TYPE_LABEL = {
  bug: 'Laporan Error',
  feature: 'Permintaan Fitur',
  suggestion: 'Saran',
  other: 'Lainnya',
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const type = ['bug', 'feature', 'suggestion', 'other'].includes(body.type) ? body.type : 'suggestion';
    const subject = (body.subject || '').toString().trim();
    const message = (body.message || '').toString().trim();
    const contact = (body.contact || '').toString().trim();

    if (!subject || !message) {
      return Response.json({ error: 'Subjek dan pesan wajib diisi' }, { status: 400 });
    }

    const record = await base44.entities.Feedback.create({
      type,
      subject,
      message,
      contact,
      status: 'open',
    });

    // Notify all admins by email — best-effort, non-blocking
    waitUntil((async () => {
      try {
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' }, '-created_date', 50);
        const label = TYPE_LABEL[type] || 'Umpan Balik';
        const sender = user.full_name || user.email;
        const emailBody = [
          'Halo Pengembang NAFKITA,',
          '',
          `Anda menerima umpan balik baru dari ${sender}.`,
          '',
          `Jenis   : ${label}`,
          `Subjek  : ${subject}`,
          '',
          'Pesan:',
          message,
          contact ? `\nKontak balasan: ${contact}` : '',
          '',
          'Mohon tinjau pada aplikasi NAFKITA.',
        ].join('\n');

        for (const a of admins) {
          if (a.email) {
            try {
              await base44.asServiceRole.integrations.Core.SendEmail({
                to: a.email,
                subject: `[NAFKITA] ${label}: ${subject}`,
                body: emailBody,
              });
            } catch (_) { /* skip individual failure */ }
          }
        }
      } catch (_) { /* best-effort */ }
    })());

    return Response.json({ ok: true, id: record.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}