import { base44 } from "@/api/base44Client";
import { checkUpload, UploadRejected } from "@/lib/uploadRules";

export { checkUpload, UploadRejected, UPLOAD_KINDS } from "@/lib/uploadRules";

// Unggah lewat satu pintu: validasi dulu (lib/uploadRules.js), baru kirim.
export async function uploadFile(file, kind = "image") {
  const bad = checkUpload(file, kind);
  if (bad) throw new UploadRejected(bad);
  return base44.integrations.Core.UploadFile({ file });
}

export async function uploadPrivateFile(file, kind = "image") {
  const bad = checkUpload(file, kind);
  if (bad) throw new UploadRejected(bad);
  return base44.integrations.Core.UploadPrivateFile({ file });
}

/** Pesan untuk toast: alasan penolakan bila ada, selain itu pesan bawaan. */
export const uploadErrorText = (e, fallback) => e?.userMessage || fallback;
