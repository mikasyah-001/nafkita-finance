// Teks kolom "Link Bukti" pada ekspor CSV/Excel. Bukti privat tidak punya
// tautan permanen (hanya signed URL beberapa menit), jadi tidak ditulis ke file
// yang bisa dibagikan.
export const proofLinkText = (t) => (t?.photo_uri || t?.has_proof ? "Ada (privat, lihat di aplikasi)" : t?.photo_url || "");
