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

## 8. Tahap 3: konsistensi angka & performa

### Bug hitung yang ditemukan dan diperbaiki
Transfer antar-rekening disimpan sebagai **pasangan transaksi pengeluaran + pemasukan** (`saveTransfer`). Tiga tampilan tidak menyaringnya, dan juga ikut menghitung transaksi yang masih *pending* atau *ditolak*:

| Tampilan | Sebelum | Sesudah |
|---|---|---|
| Kartu saldo Beranda | ✅ sudah benar | tetap |
| Kartu "Ringkasan Belanja" (Beranda) | ❌ transfer & pending ikut dihitung sebagai belanja | ✅ |
| Halaman Ringkasan | ❌ transfer & pending ikut dihitung; hanya satu mata uang | ✅ dikonversi seperti Beranda |
| Bar anggaran di Beranda | ❌ transfer & pending ikut dihitung (berbeda dari halaman Anggaran) | ✅ sama dengan halaman Anggaran |

Contoh dampak sebelumnya: transfer Rp 5 jt dari BCA ke Mandiri membuat "Total pengeluaran" di Ringkasan naik Rp 5 jt dan anggaran kategori terkait terlihat jebol, padahal tidak ada uang yang keluar dari keluarga.

Kedua tampilan kini memakai satu fungsi, `monthlyExpenseBreakdown()` di `lib/finance.js`.

**Sisa risiko:** `convertTo()` menjumlahkan nominal apa adanya bila kurs belum tersedia. Kedua tampilan sekarang menampilkan peringatan "Kurs belum tersedia". Sebaiknya nominal tanpa kurs nantinya dipisahkan dari total, bukan ikut dijumlahkan.

### Performa
- Halaman selain Beranda & auth dimuat saat dibuka (`React.lazy`). Bundle awal turun dari **2,32 MB → 756 KB** (gzip 688 KB → 237 KB).

### Alur
- Kartu "N transaksi menunggu persetujuan Anda" muncul di Beranda bila ada.

### Masih menunggu keputusan
- Gabung Ringkasan + Laporan menjadi satu halaman bertab.
- Ganti 4 quick link Beranda dengan tombol aksi.

## 9. Tahap 4: nominal tanpa kurs tidak lagi dijumlahkan diam-diam

**Sebelum:** bila kurs belum tersedia, `convertTo()` mengembalikan nominal mentah. Akibatnya 500 SAR terhitung Rp 500. Kebalikannya juga terjadi: Rp 5 jt bisa tampil sebagai SAR 5 jt saat mata uang tampilan SAR.

**Sesudah:**
- `convertTo()` mengembalikan 0 bila kurs tidak ada, dan `canConvert()` dipakai untuk mendeteksinya.
- `summarizeConsolidated()` dan `monthlyExpenseBreakdown()` mengumpulkan nominal yang dikecualikan di `unconverted` (per mata uang).
- Tampilan menyebutnya secara eksplisit:
  - **Beranda** (kartu saldo): "Belum termasuk transaksi SAR (kurs belum tersedia)".
  - **Ringkasan Belanja** dan **Ringkasan**: "Belum termasuk SAR 500,00".
  - **Aset** dan **Dashboard Aset**: "Aset dalam mata uang ini belum termasuk dalam total".
  - **Laporan**: catatan di bawah tombol "Muat Kurs".

**Catatan zakat:** Dashboard Aset menghitung nilai emas & non-emas lewat `convertTo()`. Aset tanpa kurs kini *dikecualikan*, bukan dijumlahkan dengan satuan yang salah, dan peringatannya tampil di halaman. Pastikan kurs termuat sebelum mengambil keputusan nisab.

## 10. Tahap 5: alur Beranda & Laporan

- **Ringkasan + Laporan digabung.** `/laporan` sekarang punya dua tab: *Bulan ini* (isi halaman Ringkasan sebelumnya) dan *Analisis & ekspor*. `/ringkasan` dialihkan ke `/laporan?tab=bulanan`, jadi tautan lama tetap berfungsi. Menu berkurang satu.
- **Pintasan Beranda → aksi.** Pintasan Laporan, Anggaran, dan Aset (sudah ada di navigasi) diganti dengan aksi yang sering dilakukan:
  - **Scan struk:** membuka form catat dengan tombol scan disorot. Pemilih file tidak bisa dibuka otomatis tanpa ketukan pengguna.
  - **Sedekah:** menampilkan total sedekah bulan ini.
  - **Transfer:** antar rekening.
  - **Tagihan:** menampilkan jumlah tagihan yang lewat atau mendekati jatuh tempo (≤3 hari). Teks berwarna merah bila ada yang lewat jatuh tempo.

## 11. Tahap 6: perapian menyeluruh

| Area | Sebelum | Sesudah |
|---|---|---|
| Test otomatis | 0 | 20 test logika keuangan (`npm test`, test runner bawaan Node) |
| Bug tanggal tagihan bulanan (frontend) | 31 Jan → 3 Mar | 31 Jan → 28/29 Feb, sama dengan backend |
| Kolom isian tanpa label aksesibel | 114 | 0 (`htmlFor`/`aria-label`) |
| Tombol ikon tanpa label | 4 | 0 |
| Teks "Memuat..." | 5 | Skeleton |
| Judul kecil berhuruf kapital & berjarak lebar | 9 | 1 (kolom kode undangan, memang sengaja kapital) |
| Warna palet hardcoded | ±420 | ±3 (di komponen dasar shadcn) |
| Tombol utama / ikon / sekunder | ±20 variasi ditulis manual | `.btn-primary`, `.btn-secondary`, `.btn-icon` (71 tombol dikonversi) |

Tombol lain yang masih ditulis manual sengaja dibiarkan karena memang bukan tombol standar: tab, chip filter, baris daftar yang bisa diketuk, dan pemilih warna.

## 12. Tahap 7: QA visual dengan data contoh

Semua halaman (24 rute, mode terang & gelap, lebar 390px) dijalankan memakai backend tiruan berisi data keluarga contoh: IDR + SAR, transfer, transaksi pending, aset, anggaran, tagihan, utang, dan target. Harness ini hanya ada di lingkungan lokal dan tidak masuk repo.

**Angka terverifikasi:** pengeluaran November Rp 6.070.000 (IDR + 320 SAR × 4.250, tanpa transfer & pending) dan saldo Rp 8.430.000 sama di Beranda, Ringkasan Belanja, Laporan · Bulan ini, dan Laporan · Analisis.

| Temuan | Jenis | Perbaikan |
|---|---|---|
| Kartu Anggaran: "terpakai" ikut menghitung kategori tanpa anggaran → terlihat jebol (4,71 jt / 4 jt) padahal semua kategori aman | **Logika** | Terpakai hanya dari kategori beranggaran (1,96 jt / 4 jt) + baris "Rp 2,75 jt di kategori tanpa anggaran" |
| Dashboard Aset: "Pertumbuhan +133,8%" membandingkan semua aset dengan harga beli sebagian aset | **Logika** | Hanya aset yang punya harga beli → +22,2%, dengan label jumlah aset |
| Kartu "Total Kekayaan" di Beranda sebenarnya saldo bulan ini & duplikat kartu saldo | Label menyesatkan | Hanya tampil bila mata uang tampilan ≠ mata uang utama, dengan label yang benar |
| Chip mata uang terpilih tak terbaca di mode gelap | Kontras | Teks tinta gelap tetap |
| Kolom isian berlatar abu-abu bawaan browser di mode gelap | Konsistensi | Latar input global = warna kartu; `color-scheme` per tema |
| Transfer tampil sebagai pengeluaran merah/pemasukan hijau di Riwayat | Kejelasan | Nominal transfer berwarna netral |
| Label sumbu grafik terpotong ("p 200.000") | Keterbacaan | `formatAxis()`: 50 jt, 1,2 M, seragam di 5 grafik |
| Subjudul aksi cepat & header terpotong; judul "Aset Kelua…" | Keterbacaan | Teks diringkas, subjudul boleh 2 baris, tombol "Tambah" |
| Swatch warna di Pengaturan meluber ke baris kedua | Tata letak | Ukuran & jarak diperkecil |

## 13. Tahap 8: QA otomatis di repo

- `qa/`: aplikasi asli dengan backend & login tiruan yang stateful. Lihat `qa/README.md`.
- `npm run qa`: screenshot 23 halaman × 2 mode. Hasilnya **0 error JavaScript**.
- `npm run qa:flows`: **7/7 alur lolos**:
  - catat pengeluaran;
  - transfer (saldo & belanja tidak berubah, saldo aset berpindah);
  - kartu persetujuan muncul lalu hilang setelah transaksi disetujui;
  - transaksi yang disetujui baru masuk hitungan;
  - hapus transaksi dengan konfirmasi (Batal benar-benar membatalkan).

**Temuan dari uji alur:**
- **Dua sistem notifikasi.** Aplikasi memakai sonner dan shadcn toast sekaligus. Notifikasi shadcn ("Transaksi disetujui") menutupi seluruh header halaman, termasuk tombol kembali, dan berhenti menghitung mundur selama kursor berada di atasnya. Sekarang semua notifikasi memakai sonner, dipasang global sehingga halaman daftar akun juga mendapatkannya.
- **Tombol edit transaksi** hanya punya `title`. Sekarang ditambah `aria-label` agar terbaca oleh pembaca layar.

## 14. Rebrand NAFKITA: logo baru & arah visual "Hutan & Emas"

- **Logo:** dompet hijau + wordmark. Asetnya ada di `public/brand/` (ikon, wordmark gelap & terang, ikon PWA 180/192/512) dan `public/favicon.png`. Dipakai di favicon, manifest PWA, sidebar, halaman auth, dan Welcome lewat komponen `BrandLogo`. Logo Base44 tidak lagi dipakai.
- **Palet dari logo:**
  - latar gading `#F8F6EF`;
  - primer hijau hutan `#157A5A`;
  - aksen emas `#F8C33A` (tombol Catat, CTA Daftar);
  - hero hijau tua dengan pendar emas;
  - pastel mint/mentega/limau/persik/sage untuk kartu rencana;
  - mode gelap hijau-hitam.
- **Beranda (arah B, versi elegan):**
  - sapaan pasangan dengan avatar berdua;
  - chip aksi cepat;
  - hero "Sisa uang bulan ini";
  - carousel **Rencana kita** (target tabungan);
  - **pengingat kontekstual** berbasis aturan: pengeluaran > pemasukan, belum ada anggaran, belum mencatat hari ini;
  - judul seksi berupa pertanyaan: "Ke mana perginya?", "Masih aman?", "Jejak terakhir".
- **Navigasi bawah:** pil melayang dengan tombol Catat emas; item aktif berupa ubin lembut.
- Pola diadopsi dari referensi, tetapi identitas visualnya (warna, logo, ilustrasi) tetap milik NAFKITA.

## 15. Fitur baru dari referensi (bertahap)

### 15.1 Laporan bulanan sebagai gambar
- Di **Laporan › Bulan ini** ada tombol "Bagikan sebagai gambar". Gambar berisi total pengeluaran, pemasukan, sedekah, rasio menabung, 4 kategori teratas, kontribusi per orang, dan catatan pengeluaran luar biasa.
- Di HP gambar bisa dibagikan langsung ke WhatsApp; di perangkat lain bisa disimpan sebagai PNG. Daftar transaksi rinci sengaja tidak dimuat.

### 15.2 Audit kas tunai & pengeluaran luar biasa
- **Struktur data:** jenis aset baru `tunai` (enum Asset, aditif).
- **Halaman `/audit-kas`:**
  - menampilkan "seharusnya di tangan" untuk dompet yang dipilih;
  - tiga langkah: tarik tunai (Transfer rekening → dompet), belanja tunai ("Dibayar dari" dompet), hitung uang fisik;
  - selisih disesuaikan lewat `reconcileAsset` yang sudah ada.
- **Aturan kunci:** hanya transaksi yang dibayar dari dompet itu yang dihitung. Ini menghindari kesalahan di aplikasi referensi, yang membandingkan semua pengeluaran (termasuk non-tunai) dengan tarik tunai.
- **Pengeluaran luar biasa:** tag `luar-biasa`, diatur lewat sakelar di form Catat. Tetap masuk total, tetapi dikeluarkan dari rata-rata harian ("rutin"). Ditandai badge di daftar transaksi dan disebut di laporan.

### 15.3 Rencana bulanan
- **Struktur data:** `Budget.kind`: `expense` | `income_plan` | `savings_plan` (aditif; anggaran lama otomatis `expense`).
- **Kartu "Rencana bulan ini"** di Anggaran berisi target pemasukan dan target menabung. Capaian memakai logika yang sama dengan Beranda: menabung = pemasukan − pengeluaran − sedekah.
- Progres rencana menabung juga tampil di kartu saldo Beranda.
- **Bug diperbaiki:** toggle Bersama/Pribadi di halaman Anggaran tidak berpengaruh, karena halaman itu memakai state lokal sementara toggle mengubah state global.
- **Bug diperbaiki:** aturan latar input global terlalu spesifik sehingga menimpa `bg-transparent`, dan kolom di kartu pastel tampil sebagai kotak putih/hitam. Sekarang memakai `:where()`.

### Verifikasi
- Unit test: 24/24.
- Uji alur `npm run qa:flows`: 11 alur, termasuk audit kas, pengeluaran luar biasa, rencana menabung, dan toggle cakupan Anggaran.

### Catatan untuk Base44
Perubahan skema (`Asset.type` + `tunai`, `Budget.kind`) ada di `base44/entities/`. Pastikan Base44 menerapkan skema terbaru setelah merge. Bila skema belum ikut tersinkron, membuat dompet tunai atau menyimpan rencana bisa ditolak oleh validasi.

## 16. Perapian menyeluruh tahap akhir

- **Catat transaksi:**
  - urutan mengikuti alur pikir: jenis → nominal (kartu hero, format ribuan, nominal cepat) → scan → template/kategori → detail (satu kartu) → opsi lanjutan;
  - footer simpan menempel dengan ringkasan.
- **Riwayat:**
  - ringkasan masuk/keluar/selisih untuk tampilan yang difilter, cari & filter bergaya kartu, grup harian;
  - neto harian kini tanpa transfer/pending, dan sedekah dihitung sebagai uang keluar.
- **Semua form modal** (aset, target, kategori, utang, pelunasan, tagihan) memakai `FormSheet` yang sama.
- **Halaman lain ditata seragam:** Transfer, Zakat, Pengaturan, Profil, Persetujuan, Rekonsiliasi, Kesehatan Data, Panduan, Umpan Balik, Target, Kategori, Utang, Tagihan.
- **Pengaturan dirampingkan:**
  - pemilih warna (bertentangan dengan brand tetap) dihapus;
  - menu Kategori/Impor/Catat dihapus karena duplikat;
  - kartu Panduan dihapus karena duplikat;
  - Panel Admin hanya untuk admin.

### Audit alur tambah aset

| Masalah | Perbaikan |
|---|---|
| Ganti jenis membawa gram/harga/satuan lama | `switchAssetType()` mengosongkan isian yang maknanya berbeda |
| Emas fisik & tanah bisa tersimpan SAR padahal label "Rp" | Dikunci IDR |
| Emas tanpa harga beli tersimpan bernilai 0 | Harga beli/gram wajib |
| Tanah tanpa harga sekarang bernilai 0 | Default = luas × harga/m² |
| Bank/tunai ditanya harga & bukti beli (mengacaukan pertumbuhan aset) | Tidak ditanyakan & tidak disimpan |
| Halaman Aset menghitung emas digital SAR dengan harga emas Rupiah | Harga emas Rupiah hanya untuk emas IDR |
| Angka negatif diterima | Ditolak |

Aturan ini dikumpulkan di `buildAssetPayload()` dan dijaga oleh 7 unit test + 2 uji alur layar.

### Verifikasi
- Unit test: 31/31.
- `npm run qa`: 23 halaman × 2 mode, 0 error JS.
- `npm run qa:flows`: 13/13 alur lolos.

## 17. Audit zakat mal

**Rujukan:** praktik BAZNAS (situs BAZNAS daerah) dan PMA 52/2014 jo. PMA 31/2019. Ketentuannya:
- nisab 85 gr emas dengan harga saat dihitung, kadar 2,5%, haul 1 tahun hijriah;
- harta simpanan (tabungan, deposito, emas) digabung;
- utang jatuh tempo dikurangkan;
- rumah tinggal dan kendaraan pakai bukan objek zakat mal.

| Temuan | Jenis | Perbaikan |
|---|---|---|
| Nisab dihitung terpisah per mata uang | Syariat | Semua harta simpanan dikonversi & digabung dalam IDR |
| Emas & simpanan dicek nisab terpisah (50 gr + Rp60 jt → tidak wajib) | Syariat | Digabung |
| Rumah, tanah, "lainnya" ikut dihitung | Syariat | Dikecualikan dan ditampilkan sebagai "Tidak dihitung" |
| Utang jatuh tempo tidak dikurangkan; piutang diabaikan | Syariat | Utang ≤12 bulan dikurangkan; piutang lancar dihitung (bisa dimatikan) |
| Emas dinilai harga beli bila harga pasar belum ada | Syariat | Wajib harga emas terkini; status "Butuh harga emas" |
| Haul tidak ada; lunas dicatat per tahun Masehi | Syariat/alur | Tanggal haul (354 hari), periode & jatuh tempo hijriah |
| 3 jalur hitung berbeda (backend, Dashboard Aset, notifier) | Alur | `src/lib/zakat.js` + cermin `base44/shared/zakat.ts`; paritas diuji |
| Lunas per jenis tanpa mata uang (bayar emas IDR = emas SAR lunas) | Bug | Pembayaran per periode haul, bisa dicicil, sisa terlihat |
| Bayar zakat tidak tercatat di keuangan | Alur | Tercatat sebagai transaksi sedekah kategori Zakat (opsional dari rekening) |
| Toggle Bersama/Pribadi di halaman Zakat tidak berpengaruh | Bug | Dihapus |
| Input harga emas tidak dipakai perhitungan | Bug | Dipakai & disimpan di profil |
| Harga emas dari AI tanpa batas kewajaran | Risiko | Rentang Rp500 rb–10 jt/gr; sumber & tanggal ditampilkan |
| Email: nominal SAR diformat "Rp"; dikirim tanpa melihat haul | Bug | Aturan sama, format benar, hanya saat haul ≤30 hari |

**Masih bergantung pada keputusan pengguna/amil:**
- Perhiasan yang dipakai: semua emas dihitung (lebih hati-hati).
- Saham/reksa dana dihitung dengan nilai pasar.
- Harta suami & istri dihitung gabungan (milik sendiri + bersama pasangan). Bila ingin per individu, perlu atribut kepemilikan per aset.

## 18. Simbol riyal Saudi resmi
- Simbol SAMA (Feb 2025), Unicode 17 **U+20C1**. Font bawaan perangkat umumnya belum memuat glyph-nya, jadi font *Saudi Riyal* (OFL-1.1) disertakan di `public/fonts/saudi-riyal` khusus untuk karakter itu (`unicode-range`).
- Tampilan aplikasi memakai simbol resmi. PDF, CSV, email, dan teks dropdown native memakai kode "SAR" (`formatMoneyPlain`), karena tidak bisa memuat font tambahan.

## 19. Audit mata uang: input vs tampilan (laporan & seluruh aplikasi)
Kasus pemicu: Laporan › Pertumbuhan per Aset menampilkan "Emas 1g ⃁502.38 → ⃁2,517,000.00 +500915%". Ini terjadi karena harga emas acuan dalam IDR dipakai langsung pada aset bermata uang SAR. Perbaikannya sudah ada di §emas (`assetMarketValue`/`goldPriceIn`). Hasil sekarang: ⃁502.38 → ±⃁592 (+18%).

| Temuan | Jenis | Perbaikan |
|---|---|---|
| Form aset emas/tanah: label "Rp" walau mata uang form SAR. Total ditampilkan dalam SAR, lalu tersimpan dipaksa IDR. Edit aset SAR lama berubah diam-diam jadi IDR | Bug | Mata uang dipilih eksplisit untuk semua jenis aset, label ikut mata uang ("Harga beli / gr (SAR)"), dan disimpan apa adanya |
| Default mata uang form aset tidak pernah mengikuti mata uang utama | Bug | Form baru memakai mata uang utama profil |
| Rupiah diketik saat mata uang SAR (atau sebaliknya) tidak terdeteksi | Risiko | Harga emas/gr dicek kewajarannya per mata uang. Muncul peringatan "Sepertinya nominal ini dalam IDR" dengan tombol ganti satu ketuk |
| Data lama yang sudah salah mata uang | Data | Kesehatan data › "Mata Uang Tampak Keliru" dengan tombol "Jadikan IDR". Untung/rugi aset tersebut tidak ditampilkan (ditandai) agar laporan tidak menyesatkan |
| Catat transaksi SAR tanpa rasa nilai Rupiah | UX | Pratinjau "≈ Rp …" dan peringatan lunak bila nominal SAR tampak Rupiah (mis. SAR 150.000) |
| Total impor mutasi menjumlahkan SAR + IDR sebagai Rupiah | Bug | Total per mata uang |
| Notifikasi duplikat menampilkan "Rp" untuk transaksi SAR | Bug | Memakai mata uang transaksi |
| Zakat hanya bisa dibayar dalam IDR dan hanya dari rekening IDR | Alur | Bisa dibayar dalam SAR dari dompet Riyal. Setara IDR disimpan (`amount_idr`) dan sisa zakat dihitung dalam IDR |

Sudah benar dan tidak diubah: Laporan (konsolidasi memakai kurs, mata uang tanpa kurs diberi peringatan), Anggaran (per mata uang), Proyeksi (saldo per mata uang terpilih), dan grafik kontribusi/tren (menerima transaksi yang sudah dikonversi).
