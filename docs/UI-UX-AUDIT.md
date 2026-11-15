# Audit UI/UX & Alur — NAFKITA

Tanggal: 15 Nov 2026 · Cakupan: 35 halaman, 100+ komponen, navigasi, tema, tipografi.

## 1. Ringkasan

Fondasi aplikasi sudah baik: ada token warna semantik (`income`, `expense`, `sedekah`, `scope-*`), navigasi sudah satu sumber (`navConfig.js`), dan mode gelap tersedia. Masalah utamanya bukan fiturnya, tetapi **beban visual dan inkonsistensi**:

| Temuan | Dampak ke pengguna | Status |
|---|---|---|
| 191 teks berukuran 9–10px | Melelahkan mata, sulit dibaca di HP | ✅ Dinaikkan ke min. 11px |
| Latar putih murni + teks hampir hitam + indigo jenuh (#6366f1) | Silau, kontras keras saat dipakai lama | ✅ Tema "Mist Indigo" |
| Warna dipasang langsung (`text-emerald-600`, `text-red-500`, 300+ kali) | Warna tidak seragam antarhalaman, mode gelap tidak ikut | ✅ Sebagian besar diganti token semantik |
| Preferensi warna user selalu menimpa token, termasuk di mode gelap | Mode gelap memakai indigo versi terang (kontras buruk) | ✅ Diperbaiki |
| Toggle "Bersama/Pribadi" disalin di 7 halaman | Tampilan & perilaku bisa berbeda tiap halaman | ✅ Jadi satu komponen `ScopeToggle` |
| Menu "Lainnya" (mobile): 13 ikon datar, 11 warna berbeda | Sulit dipindai, terasa ramai | ✅ Dikelompokkan: Pantau / Kelola uang / Data & akun |
| Halaman login, daftar, lupa sandi, MFA berbahasa Inggris | Kesan "template", membingungkan pengguna awam | ✅ Diterjemahkan |
| 10 error lint (import tak terpakai) | Kualitas kode | ✅ Dibersihkan |

## 2. Tema baru — "Mist Indigo"

Tetap tema indigo yang sama, hanya dilunakkan dan didinginkan.

| Token | Sebelum | Sesudah | Alasan |
|---|---|---|---|
| Latar | `#FFFFFF` | kabut biru `hsl(225 33% 97.5%)` | Mengurangi silau; kartu putih jadi "mengambang" tanpa bayangan tebal |
| Teks | `hsl(222 47% 11%)` | tinta navy `hsl(226 32% 17%)` | Kontras tetap AA, tidak sekeras hitam |
| Primer | `#6366F1` (sat. 84%) | `#5C64D6` (sat. 58%) | Indigo yang sama, lebih tenang |
| Pemasukan | hijau jenuh | sage `hsl(158 52% 36%)` | Jelas tapi tidak "berteriak" |
| Pengeluaran | merah `hsl(350 68% 55%)` | rose `hsl(351 58% 54%)` | Mengurangi kesan alarm untuk transaksi rutin |
| Mode gelap | navy-hitam `8%` | navy `10%`, kartu `13.5%` | Lapisan lebih terbaca, tidak "lubang hitam" |
| Kartu saldo | gradien indigo datar | indigo → biru senja + cahaya lembut | Satu titik fokus visual di Beranda |
| Kartu | border + tanpa bayangan | `.surface`: border + bayangan dingin tipis | Hierarki lebih jelas |

Preset warna pilihan user (Pengaturan → Warna) ikut dilunakkan. Pengguna yang sudah memilih preset lama otomatis dipetakan ke padanan lembutnya, sehingga pilihan mereka tetap dihormati.

## 3. Tipografi

- **Judul & angka besar:** Plus Jakarta Sans (tetap; karya foundry Jakarta, identitas lokal).
- **Teks isi:** Inter → **Nunito Sans**. x-height tinggi, bukaan huruf lebar, ujung huruf lembut, sehingga nyaman dibaca lama di layar kecil. Mendukung angka tabular untuk kolom nominal.
- Ukuran dasar 15px, line-height 1.55. Ukuran terkecil sekarang 11px (sebelumnya 9px).
- Label kecil berhuruf kapital dan berjarak lebar di sidebar diganti huruf biasa (lebih mudah dibaca).

## 4. Navigasi

**Mobile (BottomNav)**
- Tombol tengah "Tambah" → **"Catat"** (kata kerja yang jelas), bentuk rounded-square dengan bayangan berwarna primer.
- Indikator aktif berupa garis di atas ikon. Tab "Lainnya" ikut menyala bila halaman aktif ada di dalamnya; sebelumnya pengguna "hilang arah" setelah membuka Zakat dan sejenisnya.
- Sheet "Lainnya": dikelompokkan per tujuan, ada handle, menutup dengan Escape dan saat rute berubah, `aria-modal`, dan safe-area untuk iPhone.
- Pengaturan & Panduan kini bisa diakses langsung dari "Lainnya" (sebelumnya hanya lewat ikon gerigi di Beranda).

**Desktop (Sidebar)**
- Item aktif memakai tint lembut (`primary/10`), bukan blok indigo penuh, sehingga mata tidak ditarik ke menu terus-menerus.

## 5. Audit alur — temuan yang BELUM diubah (perlu keputusan)

Saya sengaja tidak mengubah poin-poin ini karena menyentuh logika bisnis atau struktur informasi. Perlu keputusan Anda terlebih dulu.

### 5.1 Dua logika hitung untuk angka yang sama ⚠️ prioritas tinggi
- **Beranda** memakai `summarizeConsolidated` (semua mata uang dikonversi ke mata uang tampilan).
- **Ringkasan** memakai `summarizeByCurrency` lalu memfilter satu mata uang.
- Akibatnya, untuk keluarga yang punya transaksi IDR + SAR, **total pengeluaran bulan ini bisa berbeda antara Beranda dan Ringkasan**. Ini melanggar prinsip "satu logika bisnis, banyak tampilan".
- Usulan: tetapkan satu fungsi ringkasan bulanan di `lib/finance.js`. Setiap halaman memanggil fungsi itu dengan parameter `mode: "consolidated" | "per-currency"` dan menampilkan label mode secara eksplisit.

### 5.2 Ringkasan vs Laporan tumpang tindih
- `/ringkasan` (Ringkasan Bulanan: pengeluaran per kategori + navigasi bulan) dan `/laporan` (Laporan Keuangan: pengeluaran per kategori + tren + ekspor) menjawab pertanyaan yang hampir sama.
- Usulan: gabungkan menjadi satu halaman **Laporan** dengan tab *Bulan ini / Tren / Ekspor*. Ini mengurangi satu menu dan satu sumber angka.

### 5.3 Persetujuan tersembunyi di menu "Alat"
- Persetujuan transaksi pasangan adalah **inbox yang menunggu tindakan**, bukan alat. Saat ini hanya bisa ditemukan di menu Lainnya/Alat.
- Usulan: tampilkan kartu "N transaksi menunggu persetujuan" di Beranda (hanya bila N > 0), plus badge di NotificationBell.

### 5.4 Quick link di Beranda menduplikasi navigasi
- Empat kartu (Laporan, Anggaran, Aset, Sedekah) mengulang menu yang sudah ada di nav. Tiga di antaranya hanya pintasan.
- Usulan: ganti dengan **aksi** yang sering dilakukan: *Scan struk*, *Catat sedekah*, *Transfer antar dompet*, *Bayar tagihan jatuh tempo*.

### 5.5 Ukuran bundle
- Bundle JS utama > 500 KB (belum di-split per halaman). Di jaringan 4G lemah, misalnya saat jamaah di Makkah, pembukaan pertama terasa lambat.
- Usulan: `React.lazy` per rute di `App.jsx`. Risiko rendah, dampak langsung ke waktu muat.

### 5.6 Sisa warna hardcoded
- Masih ada ±150 pemakaian `amber-*` / `emerald-*` / `rose-*` untuk banner peringatan dan badge (mis. pengingat harian, Zakat).
- Sebagian besar sudah lembut, tetapi idealnya dipindah ke token `warning`/`success` agar mode gelap dan preferensi warna konsisten. Bisa dikerjakan bertahap per halaman.

## 6. Yang perlu dicek manual setelah sinkron ke Base44

Halaman yang butuh login tidak bisa saya screenshot dari lingkungan ini. Mohon cek di Base44 preview:
1. Beranda: kartu saldo (gradien baru), quick link, toggle Bersama/Pribadi.
2. Menu Lainnya di HP: pengelompokan, tutup otomatis setelah pindah halaman.
3. Mode gelap: kartu saldo dan warna primer (seharusnya lebih terang daripada sebelumnya).
4. Pengaturan → Warna: preset baru terlihat lebih lembut.
5. Grafik di Laporan, Aset, dan Proyeksi: warna garis mengikuti warna primer.

## 7. Tahap 2 — sudah dikerjakan

- **Konfirmasi hapus.** Sebelumnya, hapus aset (beserta lot investasinya), transaksi, lot DCA, dan template langsung terjadi tanpa konfirmasi, cukup satu ketukan. Sekarang semua aksi hapus memakai dialog `confirmAction()` yang seragam (`ConfirmHost`), menggantikan `window.confirm` bawaan browser.
- **Skeleton loading.** Beranda, Riwayat, Aset, Ringkasan, Anggaran, Utang, dan Tagihan Berulang tidak lagi sempat menampilkan "Belum ada data" atau Rp 0 saat data sedang dimuat.
- **PageHeader seragam.** 25 halaman memakai satu komponen header (judul, subjudul, tombol kembali, aksi kanan) dengan padding halaman yang sama (`px-5 pt-6`). Semua halaman turunan kini punya tombol kembali; tab utama (Riwayat, Aset) tidak.
- **Transfer & Edit Transaksi** tidak lagi memakai layout layar penuh sendiri, sehingga konsisten dengan halaman lain.
