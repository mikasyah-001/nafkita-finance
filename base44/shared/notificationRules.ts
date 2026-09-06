// Evaluasi aturan notifikasi pengguna sebelum mengirim notifikasi transaksi.
// Dipanggil oleh notifyPartnerTransaction sebelum membuat record Notification.
//
// Mengembalikan { shouldNotify, channel, priority }:
// - shouldNotify: false bila ada aturan silent untuk kategori ini
// - channel: override channel bila aturan menentukan (in_app/email/both)
// - priority: normal/high
export async function evaluateNotificationRules(base44, { category, amount, target_user_id }) {
  if (!target_user_id) return { shouldNotify: true, channel: null, priority: "normal" };

  let rules = [];
  try {
    rules = await base44.asServiceRole.entities.NotificationRule.filter(
      { created_by_id: target_user_id },
      "-created_date",
      500
    );
  } catch {
    return { shouldNotify: true, channel: null, priority: "normal" };
  }

  if (!rules || rules.length === 0) return { shouldNotify: true, channel: null, priority: "normal" };

  const amt = Number(amount) || 0;
  const cat = category || "*";

  // Cek aturan silent (override — bila ada, lewati notifikasi).
  const silentRule = rules.find(
    (r) => r.silent && (r.category === cat || r.category === "*")
  );
  if (silentRule) return { shouldNotify: false, channel: null, priority: null };

  // Cari aturan yang cocok: exact category match didahulukan, lalu wildcard "*".
  const matched = rules.filter((r) => {
    if (r.enabled === false) return false;
    if (r.category !== cat && r.category !== "*") return false;
    if (r.min_amount && amt < Number(r.min_amount)) return false;
    if (r.max_amount != null && amt > Number(r.max_amount)) return false;
    return true;
  });

  if (matched.length === 0) return { shouldNotify: true, channel: null, priority: "normal" };

  // Gunakan aturan yang paling spesifik (exact category > wildcard).
  const exact = matched.find((r) => r.category === cat);
  const rule = exact || matched[0];
  return { shouldNotify: true, channel: rule.channel || null, priority: rule.priority || "normal" };
}