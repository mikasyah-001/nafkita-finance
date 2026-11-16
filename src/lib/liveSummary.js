// Logika murni (tanpa API) untuk perkiraan harga online: aset mana yang perlu
// dicek, dan ringkasan hasil yang singkat untuk notifikasi.

/**
 * Pisahkan aset yang PERLU dicek harga online dari yang sudah terbaru.
 * Nilai dari broker hari ini lebih tepat daripada perkiraan online → tidak ditimpa.
 */
export function liveTargets(assets = [], today = new Date().toISOString().slice(0, 10)) {
  const all = assets.filter((a) => a.type === "investasi" && (a.ticker || a.name) && Number(a.quantity) > 0);
  const fresh = all.filter((a) => a.value_source === "broker" && String(a.price_date || "").slice(0, 10) >= today);
  return { fresh, targets: all.filter((a) => !fresh.includes(a)) };
}

const shortName = (a) => String(a?.name || "").replace(/\s*\(.*?\)\s*$/, "").replace(/\s+(Tbk\.?|\(Persero\)).*$/i, "").trim();
const listNames = (rows, max = 2) => {
  const names = rows.map((r) => shortName(r.asset || r));
  return names.length > max ? `${names.slice(0, max).join(", ")} & ${names.length - max} lainnya` : names.join(", ");
};

/**
 * Ringkasan singkat hasil perkiraan online untuk toast — bukan daftar panjang.
 * tone: "success" | "info" | "warning".
 */
export function summarizeLiveResult({ updated = [], skipped = [], fresh = [] } = {}) {
  const parts = [];
  if (fresh.length) parts.push(`${fresh.length} sudah terbaru dari broker hari ini`);
  if (skipped.length) {
    const old = skipped.filter((x) => /^Data lama/.test(x.reason || ""));
    const other = skipped.filter((x) => !old.includes(x));
    if (old.length) parts.push(`harga online ${listNames(old)} belum terbaru`);
    if (other.length) parts.push(`harga online ${listNames(other)} tidak ditemukan`);
  }
  const description = parts.join(" · ");
  if (updated.length) return { tone: "success", title: `${updated.length} nilai diperbarui (perkiraan online)`, description };
  if (!skipped.length) return { tone: "info", title: "Semua nilai sudah terbaru", description: fresh.length ? `${fresh.length} aset sudah diperbarui dari broker hari ini.` : "" };
  return { tone: "warning", title: "Belum ada harga online terbaru", description: `${description}. Isi nilai dari aplikasi broker di atas.` };
}
