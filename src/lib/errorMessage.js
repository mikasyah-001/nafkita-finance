// Pesan error yang berguna dari pemanggilan backend Base44.
// Axios hanya memberi "Request failed with status code 500"; pesan asli
// dari fungsi backend ada di response.data.error.
export function errorMessage(e, fallback = "Terjadi kesalahan") {
  const data = e?.response?.data ?? e?.data;
  const server = typeof data === "string" ? data : data?.error || data?.message;
  const status = e?.response?.status ?? e?.status;
  if (server) return status ? `${server} (kode ${status})` : String(server);
  return e?.message || fallback;
}

/** Ringkas daftar sumber yang gagal dari respons parsial backend admin. */
export function partialErrorText(errors) {
  if (!Array.isArray(errors) || !errors.length) return "";
  return errors.map((x) => `${x.source}: ${x.message}`).join(" · ");
}
