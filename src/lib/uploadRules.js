// Satu pintu unggah berkas. Atribut `accept` di <input> hanya saran browser
// (bisa dilewati di Android/desktop), jadi tipe & ukuran dicek di sini sebelum
// berkas dikirim. SVG/HTML ditolak: berkas publik itu bisa membawa skrip.
export const UPLOAD_KINDS = {
  image: { types: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"], exts: ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"], maxMb: 10, label: "gambar (JPG, PNG, WEBP, HEIC)" },
  imageOrPdf: { types: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "application/pdf"], exts: ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "pdf"], maxMb: 15, label: "gambar atau PDF" },
  document: { types: ["application/pdf", "text/plain"], exts: ["pdf", "txt"], maxMb: 15, label: "PDF atau TXT" },
};

export class UploadRejected extends Error {
  constructor(userMessage) { super(userMessage); this.userMessage = userMessage; }
}

const ext = (name) => String(name || "").toLowerCase().split(".").pop();

/** Kembalikan pesan galat (string) bila berkas tidak boleh diunggah, atau null. */
export function checkUpload(file, kind = "image") {
  const k = UPLOAD_KINDS[kind] || UPLOAD_KINDS.image;
  if (!file) return "Berkas tidak ditemukan";
  if (!file.size) return "Berkas kosong";
  if (file.size > k.maxMb * 1024 * 1024) return `Berkas terlalu besar (maks. ${k.maxMb} MB)`;
  const type = String(file.type || "").toLowerCase();
  // Sebagian kamera/galeri tidak mengisi MIME → pakai ekstensi; MIME yang terisi wajib cocok.
  const ok = type ? k.types.includes(type) : k.exts.includes(ext(file.name));
  if (!ok) return `Jenis berkas tidak didukung. Gunakan ${k.label}.`;
  return null;
}
