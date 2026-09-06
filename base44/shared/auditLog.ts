// Modul terpusat untuk mencatat tindakan admin ke entity AuditLog.
// Dipanggil dari backend function yang melakukan aksi administratif.

interface Base44Client {
  asServiceRole: {
    entities: {
      AuditLog: {
        create: (data: Record<string, unknown>) => Promise<unknown>;
      };
      [key: string]: unknown;
    };
  };
  auth: {
    me: () => Promise<{ id?: string; full_name?: string; email?: string; role?: string }>;
  };
}

interface LogEntry {
  actor_id?: string;
  actor_name?: string;
  actor_email?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  target_label?: string;
  details?: string;
  ip_address?: string;
}

// Mencatat satu entri audit log. Tidak melempar error — kegagalan logging
// tidak boleh membatalkan aksi admin yang sedang berjalan.
export async function logAdminAction(base44: Base44Client, entry: LogEntry): Promise<void> {
  try {
    let actorId = entry.actor_id;
    let actorName = entry.actor_name;
    let actorEmail = entry.actor_email;

    if (!actorId) {
      try {
        const me = await base44.auth.me();
        actorId = me.id;
        actorName = actorName || me.full_name;
        actorEmail = actorEmail || me.email;
      } catch {}
    }

    await base44.asServiceRole.entities.AuditLog.create({
      actor_id: actorId || "unknown",
      actor_name: actorName || "",
      actor_email: actorEmail || "",
      action: entry.action,
      target_type: entry.target_type || "system",
      target_id: entry.target_id || "",
      target_label: entry.target_label || "",
      details: entry.details || "",
      ip_address: entry.ip_address || "",
    });
  } catch {
    // Audit log failure should never block the main operation.
  }
}