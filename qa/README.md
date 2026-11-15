# QA lokal

Menjalankan aplikasi **asli** dengan backend & login tiruan berisi data keluarga contoh
(IDR + SAR, transfer, transaksi pending, aset, anggaran, tagihan, utang, target).
Tidak menyentuh Base44 dan tidak ikut ter-build ke produksi.

| Perintah | Fungsi |
|---|---|
| `npm run qa:serve` | Buka aplikasi dengan data contoh di http://localhost:5180 (tanpa login) |
| `npm run qa` | Screenshot 23 halaman × mode terang/gelap ke `qa/out/`, gagal bila ada error JavaScript |
| `npm run qa:flows` | Uji alur: catat transaksi, transfer, setujui, hapus. Memastikan angka sama di Beranda & Laporan |
| `npm test` | Unit test logika keuangan (`src/lib/finance.js`) |

Butuh Playwright. Bila belum ada:

```bash
npm i -D playwright && npx playwright install chromium
```

**Kapan dijalankan:** setelah mengubah tampilan atau logika, termasuk perubahan dari Base44 Builder.
Lihat `qa/out/` untuk memeriksa tampilan, dan pastikan `npm run qa:flows` lolos semua.

**Batasan:** backend tiruan (`qa/mockClient.js`) meniru perilaku fungsi Base44 secara sederhana.
Ia menguji apakah tampilan bereaksi benar terhadap data, bukan logika backend itu sendiri.
Bila fungsi backend berubah (mis. `saveTransfer`), sesuaikan juga tiruannya.
