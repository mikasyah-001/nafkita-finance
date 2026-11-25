# NAFKITA: Kit Promosi Media Sosial

Materi untuk Threads, Instagram (feed, Reels, Story), TikTok, YouTube Shorts dan status WhatsApp.
Semua gambar diambil dari aplikasi asli yang dijalankan dengan **data contoh** (keluarga "Ahmad & Siti"),
jadi tidak ada data pengguna sungguhan.

## 1. Isi kit

| Folder (`promo/out/`) | Isi | Pakai untuk |
|---|---|---|
| `screens/{ios,android}/{light,dark}/` | 32 layar per perangkat, resolusi 3×. `--full` = satu halaman penuh | Bahan mentah, edit di Canva/CapCut |
| `mockups/{ios,android}/{light,dark}/` | Layar yang sama di dalam bingkai iPhone (Dynamic Island) & Android (punch-hole), latar **transparan** | Ditempel ke desain sendiri |
| `posters/feed/` | 12 poster 4:5 (2160×2700, diunggah jadi 1080×1350) | Carousel Threads / IG feed |
| `posters/story/` | 12 poster 9:16 (2160×3840) | Story IG/WA, cover Reels |
| `video/nafkita-demo-9x16.mp4` | Reel 32 detik, 1080×1920, 30 fps, **tanpa audio** | Reels, TikTok, Shorts, Threads |
| `storyboard.jpg` | Storyboard visual reel (8 adegan) | Brief untuk editor |

Buat ulang semuanya (misalnya setelah tampilan aplikasi berubah):

```bash
npm ci
node promo/capture.mjs     # screenshot (±5 menit)
node promo/mockup.mjs      # mockup + poster
node promo/video.mjs       # video
```

### Daftar layar (nomor = nama file)

| No | Layar | Fungsi yang ditunjukkan |
|---|---|---|
| 01 | Sambutan | Halaman depan & proposisi nilai |
| 02 | Beranda | Sisa uang bulan ini, jatah harian, rencana, aksi cepat |
| 03 | Beranda (privasi) | Sembunyikan semua nominal satu ketuk |
| 04 | Catat transaksi | Nominal, kategori, tempat, IDR/SAR |
| 05 | Scan struk AI | Struk dibaca AI, form terisi otomatis |
| 06 | Riwayat | Filter, cari, bersama/pribadi, status menunggu |
| 07 | Persetujuan | Transaksi besar menunggu persetujuan pasangan |
| 08–09 | Laporan & analisis | Ringkasan bulan, tren, bagikan sebagai gambar, ekspor |
| 10 | Anggaran | Rencana pemasukan & menabung, anggaran per kategori |
| 11 | Target tabungan | Umrah keluarga, dana darurat, pendidikan |
| 12 | Zakat mal | Nisab, haul, harta dihitung, kewajiban zakat |
| 13–14 | Aset & dashboard aset | Total kekayaan, per jenis, pertumbuhan |
| 15–16 | Detail emas & investasi | Untung/rugi per gram, riwayat DCA |
| 17 | Transfer | Antar rekening & ke pasangan |
| 18–19 | Utang & tagihan rutin | Jatuh tempo, pelunasan, tagihan otomatis |
| 20 | Catat otomatis | Notifikasi Apple Pay / SMS bank masuk ke kotak |
| 21–22 | Kartu & dompet | Kartu debit/mada/e-money, saldo per rekening |
| 23–24 | Rekonsiliasi & kesehatan data | Cocokkan saldo bank, deteksi data bermasalah |
| 25–26 | Impor mutasi & portofolio | Teks/PDF mutasi bank, screenshot portofolio |
| 27 | Kategori | Kelola kategori |
| 28 | Profil & pasangan | Koneksi suami–istri |
| 29–30 | Pengaturan & panduan | Tema, mata uang, notifikasi, panduan fitur |
| 31 | Menu lainnya | Semua tool dalam satu menu |
| 32 | Audit kas | Cocokkan uang tunai di dompet |

---

## 2. Pesan inti

- **Siapa:** pasangan Muslim usia 25–45, kelas menengah, banyak yang punya kaitan Indonesia–Saudi
  (pekerja/mukimin, keluarga jamaah, pelaku usaha umrah).
- **Masalah:** uang keluarga tercecer di banyak rekening & dompet, suami–istri tidak punya gambaran yang sama,
  zakat dihitung kira-kira, Rupiah dan Riyal tercampur.
- **Janji:** *Keuangan keluarga yang rapi, terbuka, dan berkah.*
- **Tiga pilar:** Rapi (catat cepat, scan struk AI) · Berdua (kas bersama + ruang pribadi) · Berkah (sedekah & zakat mal).
- **Pembeda:** zakat mal terintegrasi dengan aset & emas, dua mata uang IDR/SAR, persetujuan pasangan.
- **Nada:** hangat, tenang, tidak menggurui. Hindari klaim mutlak ("100% aman", "pasti hemat").

---

## 3. Reel 32 detik (`video/nafkita-demo-9x16.mp4`)

Format 9:16. Teks diletakkan di zona aman (di bawah 230 px dari atas, di atas 340 px dari bawah).

| # | Waktu | Visual | Teks di layar | Voice-over (opsional) | Layar |
|---|---|---|---|---|---|
| 1 | 0–3 s | Latar hijau, teks besar muncul | **Gaji masuk, lalu ke mana perginya?** | "Gaji masuk… lalu ke mana perginya?" | — |
| 2 | 3–7 s | iPhone naik dari bawah, Beranda | NAFKITA · *Keuangan keluarga rapi & berkah* | "Kenalkan NAFKITA, buku kas keluarga Muslim." | 02 |
| 3 | 7–11,5 s | Form kosong → kilat kamera → hasil scan | Scan struk AI · *Foto struk. Beres dicatat.* | "Foto struknya, AI yang mencatat." | 04 → 05 |
| 4 | 11,5–15,5 s | iPhone & Android masuk dari kiri/kanan | Suami & istri · *Satu kas bersama, tetap ada privasi.* | "Satu kas berdua, tetap ada ruang pribadi." | 06 + 07 |
| 5 | 15,5–20 s | Layar zakat menggulir pelan | Zakat mal · *Zakat dihitung sesuai ketentuan.* | "Zakat mal dihitung dari aset dan emasmu." | 12 (penuh) |
| 6 | 20–24 s | Dua ponsel: catat otomatis + kartu mada | Indonesia ⇄ Saudi · *Rupiah & Riyal, tak lagi tercampur.* | "Rupiah dan Riyal, rapi terpisah." | 20 + 21 |
| 7 | 24–27,5 s | Android mode gelap, dashboard aset menggulir | Aset & emas · *Lihat kekayaan tumbuh.* | "Lihat kekayaanmu tumbuh." | 14 (gelap, penuh) |
| 8 | 27,5–32 s | Logo, CTA, dua ponsel naik | *Mulai rapikan nafkah keluarga hari ini.* · Gratis · URL | "Gratis. Mulai hari ini." | 12 + 02 |

**Audio:** pilih musik/nasyid instrumental yang sedang tren langsung di aplikasi (lisensi aman). Ketukan berganti di 3 s, 7 s, 9 s (kilat scan), 11,5 s, 15,5 s, 20 s, 24 s, 27,5 s.
**Caption Reels:** lihat bagian 6, post #1.

### Variasi video 15 detik (untuk A/B hook)

Bisa dipotong dari reel di atas atau direkam ulang dari layar asli.

| Video | Hook (0–2 s) | Isi | Penutup |
|---|---|---|---|
| A. Scan struk | "Malas nyatet belanja? Coba ini." | Adegan 3, diperlambat. Tunjukkan struk asli lalu angka terisi | "Foto struk, beres." |
| B. Zakat | "Zakat malmu tahun ini berapa? Jangan ditebak." | Adegan 5, sorot nisab 85 g & 2,5% | "Hitung di NAFKITA. Perkiraan, bukan fatwa." |
| C. Riyal | "Kerja di Saudi, keluarga di Indonesia?" | Adegan 6 + kurs otomatis | "Dua mata uang, satu catatan." |
| D. Pasangan | "Suami belanja 3 juta, istri baru tahu sebulan kemudian 😅" | Adegan 4, sorot tombol Setujui | "Transparan berdua." |

---

## 4. Carousel Threads / IG feed (`posters/feed/`)

Threads menerima hingga 20 gambar per post; IG hingga 20. Urutan yang disarankan:

| Slide | File | Judul | Tujuan |
|---|---|---|---|
| 1 | P01-hero | Keuangan keluarga yang rapi, terbuka, dan berkah. | Hook + proposisi |
| 2 | P02-scan-struk | Foto struknya. Beres dicatat. | Kemudahan |
| 3 | P03-berdua | Satu kas keluarga, tetap ada ruang pribadi. | Pembeda pasangan |
| 4 | P04-zakat | Zakat dihitung sesuai ketentuan. | Pembeda syariah |
| 5 | P05-rupiah-riyal | Rupiah & Riyal, tak lagi tercampur. | Segmen Saudi |
| 6 | P06-aset-emas | Lihat kekayaan tumbuh, bukan sekadar saldo. | Aspirasi |
| 7 | P07-anggaran-target | Anggaran rapi, umrah makin dekat. | Tujuan keluarga |
| 8 | P08-laporan | Sebulan keuangan, sekali lihat. | Bukti kegunaan |
| 9 | P09-privasi | Sembunyikan semua angka. Satu ketuk. | Kepercayaan |
| 10 | P10-mode-gelap | Nyaman dipakai siang & malam. | Detail produk |
| 11 | P11-semua-fitur | Semua kebutuhan nafkah dalam satu aplikasi. | Kelengkapan |
| 12 | P12-cta | Mulai rapikan nafkah keluarga hari ini. | Ajakan |

Untuk carousel pendek (Threads paling baik 4–6 gambar): **P01 → P02 → P03 → P04 → P12**.

---

## 5. Story (`posters/story/`)

Rangkaian 5 story sehari: P01 → P02 → P04 → P05 → P12. Di P12 tambahkan **stiker tautan** ke URL aplikasi
dan stiker polling: *"Sudah punya catatan keuangan keluarga? Sudah / Belum"*.

---

## 6. Naskah post

**#1 Peluncuran (Threads + Reels)**
> Gaji masuk tanggal 1, tanggal 20 sudah bingung ke mana perginya. Kami bikin NAFKITA untuk keluarga Muslim:
> catat berdua dengan pasangan, foto struk biar AI yang mencatat, pantau emas & aset, dan zakat mal dihitung otomatis.
> Rupiah & Riyal juga bisa. Gratis, buka di HP lalu pasang ke layar utama. Link di bio.

**#2 Scan struk**
> Struk belanja numpuk di dompet? Foto saja. AI baca nominal, toko, tanggal & kategori, sampai 5 bon sekaligus.
> Kamu tinggal cek, lalu simpan. 📸→✅

**#3 Pasangan**
> Bukan soal curiga, tapi soal sepakat. Di NAFKITA ada kas bersama untuk keluarga dan ruang pribadi untuk masing-masing.
> Transaksi besar bisa diatur agar menunggu persetujuan pasangan dulu.

**#4 Zakat**
> Harta sudah sampai nisab belum? NAFKITA menggabungkan tabungan, emas, investasi & piutang lancar,
> dikurangi utang jatuh tempo, lalu menghitung zakat 2,5% berdasarkan haul hijriah. Ini perkiraan, bukan fatwa.
> Cara hitung & rujukannya bisa dibuka di aplikasi.

**#5 Indonesia–Saudi**
> Gaji dalam Riyal, cicilan dalam Rupiah? Catat masing-masing di mata uangnya, laporan bisa digabung dengan kurs otomatis.
> Kartu mada & notifikasi bank Saudi juga bisa dicatat otomatis.

**#6 Privasi**
> Mau buka aplikasi keuangan di tempat umum tanpa angka terlihat? Satu ketuk, semua nominal tersembunyi.
> Plus verifikasi dua langkah & cadangan ke Google Drive.

**#7 Ajakan (Threads, teks saja + P12)**
> Kalau keuangan keluargamu harus dirapikan dalam satu langkah minggu ini, mulai dari mana? Balas di bawah 👇
> (Kami pakai jawabanmu untuk fitur berikutnya.)

Hashtag (maks. 3–5, Threads cukup 1 topik): `#keuangankeluarga #zakatmal #nafkah #keuangansyariah #mukiminsaudi`

---

## 7. Jadwal 2 minggu

| Hari | Kanal | Materi |
|---|---|---|
| Sen W1 | Reels + Threads | Video 32 s + post #1 |
| Rab W1 | Threads carousel | P01–P04, P12 + post #2 |
| Jum W1 | Story | Rangkaian 5 story + polling |
| Sab W1 | Threads teks | Post #7 (pertanyaan) |
| Sen W2 | Reels/TikTok | Variasi A (scan struk) |
| Rab W2 | Threads carousel | P04-zakat + post #4 |
| Jum W2 | Reels/TikTok | Variasi C (Riyal), target audiens Saudi |
| Sab W2 | Threads | P03 + post #3 |

**Ukur:** klik tautan → pendaftaran (beri parameter `?ref=threads`, `?ref=reels` di link bio), simpan/bagikan per post,
dan komentar berisi pertanyaan fitur. Setelah 2 minggu, perbanyak format & hook dengan rasio daftar/klik terbaik.

---

## 8. Catatan sebelum publikasi

1. **Domain.** Materi memakai `nafkita.mikaiel.com`. Pastikan domain ini sudah mengarah ke aplikasi sebelum posting.
   Bila domain berganti, ubah `APP_URL` di `promo/mockup.mjs` lalu render ulang poster & video.
2. **Klaim zakat.** Selalu sertakan "perkiraan, bukan fatwa", sama seperti di aplikasi. Hindari "pasti sah" atau "sesuai fatwa X"
   kecuali sudah ditinjau ahli.
3. **Merek pihak ketiga.** Bingkai ponsel dibuat generik tanpa logo Apple/Google. Penyebutan "Apple Pay" dan "mada" hanya
   untuk menjelaskan kompatibilitas; jangan pakai logo resminya tanpa izin.
4. **Data contoh.** Nama, nominal, dan merchant fiktif. Salah satu data contoh pemasukan bertuliskan "PT Arrahmah";
   ganti di `qa/mockClient.js` bila tidak ingin nama perusahaan muncul.
5. **Klaim fitur.** Daftar fitur mengikuti halaman Sambutan (`src/pages/Welcome.jsx`, 27 fitur). Bila fitur berubah,
   perbarui poster P11.
