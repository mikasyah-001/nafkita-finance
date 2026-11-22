// Foto depan kartu disamarkan DI PERANGKAT sebelum diunggah: bagian nomor
// kartu dipikselkan (bisa digeser/diatur), gambar diperkecil & dikodekan
// ulang (metadata EXIF/lokasi ikut terbuang). Foto asli tidak pernah dikirim.

export const DEFAULT_BAND = { top: 0.5, height: 0.2 };
const MAX_W = 1200;

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Gambar tidak bisa dibaca")); };
    img.src = url;
  });
}

// Gambar ke canvas dengan pita piksel (band: pecahan tinggi 0–1).
export function renderMasked(canvas, img, band = DEFAULT_BAND) {
  const scale = Math.min(1, MAX_W / img.naturalWidth);
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const y = Math.max(0, Math.round(h * band.top));
  const bh = Math.max(8, Math.min(h - y, Math.round(h * band.height)));
  // Pikselkan: perkecil drastis lalu perbesar tanpa penghalusan, dua kali
  // (dengan derau) agar digit tidak bisa direkonstruksi.
  const block = Math.max(14, Math.round(w / 28));
  const tmp = document.createElement("canvas");
  tmp.width = Math.max(1, Math.round(w / block)); tmp.height = Math.max(1, Math.round(bh / block));
  const t = tmp.getContext("2d");
  t.imageSmoothingEnabled = true;
  t.drawImage(canvas, 0, y, w, bh, 0, 0, tmp.width, tmp.height);
  const data = t.getImageData(0, 0, tmp.width, tmp.height);
  for (let i = 0; i < data.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 40;
    data.data[i] += n; data.data[i + 1] += n; data.data[i + 2] += n;
  }
  t.putImageData(data, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, y, w, bh);
  return { w, h };
}

export function canvasToFile(canvas, name = "kartu.jpg") {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(new File([blob], name, { type: "image/jpeg" })) : reject(new Error("Gagal memproses foto"))), "image/jpeg", 0.82);
  });
}
