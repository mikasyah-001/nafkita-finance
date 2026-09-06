import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Mengembalikan data notifikasi untuk user yang login:
// - unread_count: jumlah seluruh notifikasi belum dibaca (bukan hanya yang dimuat)
// - items: halaman notifikasi (paginasi via created_date cursor)
// - has_more: apakah masih ada notifikasi lebih lama
//
// RLS Notification membatasi read ke target_user_id == user.id, jadi
// user-scoped SDK sudah aman.
const PAGE_SIZE = 30;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const cursor = body.cursor || null; // created_date item terakhir pada halaman sebelumnya

    // Unread count — ambil semua unread (dibatasi wajar).
    let unreadCount = 0;
    try {
      const unread = await base44.entities.Notification.filter(
        { read: false },
        "-created_date",
        999
      );
      unreadCount = unread ? unread.length : 0;
    } catch {}

    // Halaman items.
    let items = [];
    try {
      if (cursor) {
        items = await base44.entities.Notification.filter(
          { created_date: { $lt: cursor } },
          "-created_date",
          PAGE_SIZE + 1
        );
      } else {
        items = await base44.entities.Notification.list("-created_date", PAGE_SIZE + 1);
      }
    } catch {}

    const hasMore = items.length > PAGE_SIZE;
    if (hasMore) items = items.slice(0, PAGE_SIZE);

    return Response.json({
      unread_count: unreadCount,
      items,
      has_more: hasMore,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}