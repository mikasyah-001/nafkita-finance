import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { waitUntil } from 'base44:runtime';

const TYPE_LABEL = {
  bug: 'Laporan Error',
  feature: 'Permintaan Fitur',
  suggestion: 'Saran',
  other: 'Lainnya',
};

const clip = (v, n) => (v == null ? '' : String(v)).trim().slice(0, n);

// Menyimpan umpan balik pengguna lalu memberi tahu semua admin (notifikasi
// in-app + email, best-effort). Create Feedback khusus admin (RLS) agar klien
// tidak bisa membuat record berisi status/balasan/email palsu; record dibuat
// lewat service role dengan owner_id/owner_email dari sesi → tampil di
// "Laporan saya" (RLS read: data.owner_id).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const type = ['bug', 'feature', 'suggestion', 'other'].includes(body.type) ? body.type : 'suggestion';
    const subject = clip(body.subject, 120);
    const message = clip(body.message, 2000);
    const contact = clip(body.contact, 120);
    const screenshot_url = /^https:\/\//.test(String(body.screenshot_url || '')) ? clip(body.screenshot_url, 1000) : '';
    const c = body.context && typeof body.context === 'object' ? body.context : null;
    const context = c ? {
      path: clip(c.path, 200),
      user_agent: clip(c.user_agent, 300),
      platform: clip(c.platform, 60),
      screen: clip(c.screen, 40),
      standalone: !!c.standalone,
      online: c.online !== false,
    } : undefined;

    if (!subject || !message) {
      return Response.json({ error: 'Subjek dan pesan wajib diisi' }, { status: 400 });
    }

    const sender = user.full_name || user.email;
    const record = await base44.asServiceRole.entities.Feedback.create({
      owner_id: user.id,
      owner_email: user.email || '',
      type,
      subject,
      message,
      contact,
      screenshot_url,
      context,
      sender_name: user.full_name || '',
      sender_email: user.email || '',
      status: 'open',
      status_updated_at: new Date().toISOString(),
    });

    // Beri tahu admin — best-effort, tidak menghambat respons.
    waitUntil((async () => {
      try {
        const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' }, '-created_date', 50);
        const label = TYPE_LABEL[type] || 'Umpan Balik';
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
          screenshot_url ? `\nTangkapan layar: ${screenshot_url}` : '',
          '',
          'Tinjau & balas di aplikasi: Admin → Laporan.',
        ].join('\n');

        for (const a of admins) {
          if (a.id && a.id !== user.id) {
            try {
              await base44.asServiceRole.entities.Notification.create({
                target_user_id: a.id,
                actor_name: sender,
                action: 'created',
                entity_kind: 'feedback',
                event_key: `feedback:${record.id}:created:${a.id}`,
                title: `${label} baru: ${subject}`,
                body: message.slice(0, 140),
                ref_id: record.id,
                read: false,
              });
            } catch (_) { /* lewati */ }
          }
          if (a.email) {
            try {
              await base44.asServiceRole.integrations.Core.SendEmail({
                to: a.email,
                subject: `[NAFKITA] ${label}: ${subject}`,
                body: emailBody,
              });
            } catch (_) { /* lewati */ }
          }
        }
      } catch (_) { /* best-effort */ }
    })());

    return Response.json({ ok: true, id: record.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
