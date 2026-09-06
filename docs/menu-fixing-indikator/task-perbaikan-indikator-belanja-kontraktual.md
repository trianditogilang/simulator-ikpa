# Task — Perbaikan Indikator IKPA Belanja Kontraktual

## Status dan tujuan

**Prioritas:** P0 / blokir validitas hasil simulasi

Perbaiki implementasi indikator **Belanja Kontraktual** pada aplikasi Simulator IKPA. Indikator ini adalah indikator mandiri dengan **bobot 10%** terhadap IKPA dan tetap memakai workspace data bersama pada halaman:

```text
/operator/data/contracts-invoices
```

Ruang lingkup task ini **hanya Belanja Kontraktual**. Jangan mengubah formula, engine, eligibility, atau reminder indikator **Penyelesaian Tagihan** selain penyesuaian UI yang benar-benar diperlukan agar dua indikator tidak tercampur.

## Sumber kebenaran

Gunakan urutan sumber berikut apabila terdapat ketidaksesuaian:

1. Materi PDF `4belanja-kontraktual.pdf`.
2. Penjelasan bisnis yang menyertai task ini.
3. Contoh perhitungan pada PDF dengan hasil akhir **97,00**.
4. Dokumen audit `05-belanja-kontraktual.md` untuk lokasi kode dan daftar gap implementasi saat ini.

Jangan mempertahankan perilaku lama hanya karena sudah ada di engine, rule set, atau dokumen PRD/FSD/TSD apabila bertentangan dengan materi PDF.

---

## 1. Definisi indikator

### 1.1 Bobot indikator

- Bobot Belanja Kontraktual terhadap IKPA total: **10%**.
- Nilai indikator berada pada skala 0–100, kemudian kontribusi IKPA dihitung:

\[
Kontribusi\ IKPA\ Belanja\ Kontraktual = Nilai\ BK \times 10\%
\]

### 1.2 Tiga subkomponen

| Kode | Subkomponen | Bobot dalam Belanja Kontraktual |
|---|---|---:|
| DAK | Distribusi Akselerasi Kontrak | 20% |
| KD | Kontrak Pra-DIPA / Kontrak Dini | 40% |
| AK53 | Akselerasi Kontrak 53 | 40% |

Formula nilai indikator:

\[
Nilai\ BK = (NK\text{-}DAK \times 20\%) + (NK\text{-}KD \times 40\%) + (NK\text{-}AK53 \times 40\%)
\]

Validasi konfigurasi: jumlah subbobot harus selalu tepat **100%**.

---

## 2. Aturan bisnis kanonis

### 2.1 Distribusi Akselerasi Kontrak — DAK (20%)

**Cakupan kontrak eligible**

- Nilai kontrak **minimal Rp50.000.000**.
- Mencakup **seluruh jenis belanja** yang tersedia dalam data kontrak, bukan hanya akun 53.
- Dasar periode adalah **tanggal kontrak / tanggal tanda tangan kontrak**.

**Rumus rasio**

\[
Rasio\ DAK = \frac{Jumlah\ kontrak\ eligible\ yang\ tanggal\ kontraknya\ sampai\ dengan\ Triwulan\ II}{Jumlah\ seluruh\ kontrak\ eligible\ selama\ tahun\ anggaran} \times 100\%
\]

Ketentuan penting:

- Gunakan **jumlah baris/kontrak (count)**, **bukan total nilai rupiah**.
- Triwulan II berarti tanggal kontrak sampai dengan **30 Juni** tahun anggaran berjalan.
- Pembilang dan penyebut hanya memakai kontrak eligible bernilai minimal Rp50 juta.
- Jangan membatasi akun belanja atau tipe pembayaran pada subkomponen ini.

**Tabel nilai DAK**

| Rasio DAK | Nilai NK-DAK |
|---|---:|
| Rasio = 0% | 0 |
| 0% < Rasio ≤ 25% | 50 |
| 25% < Rasio ≤ 50% | 60 |
| 50% < Rasio ≤ 75% | 80 |
| Rasio > 75% | 100 |

Boundary wajib:

- Tepat 25% → 50.
- Tepat 50% → 60.
- Tepat 75% → 80.
- Lebih dari 75% → 100.

### 2.2 Kontrak Pra-DIPA / Kontrak Dini — KD (40%)

**Cakupan kontrak eligible**

- Nilai kontrak **minimal Rp50.000.000**.
- Seluruh jenis belanja.
- Dasar penilaian: **tanggal kontrak / tanggal tanda tangan kontrak**.

**Nilai per kontrak**

| Kondisi tanggal kontrak | Poin kontrak |
|---|---:|
| Sebelum 1 Januari tahun anggaran berkenaan | 120 |
| 1 Januari sampai dengan 31 Maret tahun anggaran berkenaan | 110 |
| Setelah 31 Maret | Tidak memperoleh poin pada komponen KD |

**Rumus nilai komponen**

Nilai KD adalah rata-rata poin kontrak yang memperoleh poin Pra-DIPA atau non-Pra-DIPA sampai dengan 31 Maret:

\[
NK\text{-}KD = \frac{\sum Poin\ kontrak\ eligible\ dengan\ tanggal\ kontrak\ \leq 31\ Maret}{Jumlah\ kontrak\ eligible\ dengan\ tanggal\ kontrak\ \leq 31\ Maret}
\]

Ketentuan penting:

- Kontrak setelah 31 Maret **tidak boleh dimasukkan ke penyebut rata-rata KD**.
- Jangan membuat rata-rata tertimbang nilai rupiah. Setiap kontrak eligible bernilai satu observasi/poin.
- Kontrak sebelum 1 Januari memperoleh 120; jalur ini wajib aktif dan tidak boleh bergantung pada flag yang selalu `false`.
- Nilai KD secara desain dapat melebihi 100, misalnya 112,50 dalam contoh materi.

### 2.3 Akselerasi Kontrak 53 — AK53 (40%)

**Cakupan kontrak eligible**

Kontrak hanya masuk komponen AK53 apabila seluruh kondisi berikut terpenuhi:

- Jenis belanja / account code adalah **53**.
- Nilai kontrak **Rp50.000.000 sampai dengan Rp200.000.000**, termasuk batas bawah dan batas atas.
- Tipe pembayaran adalah **sekaligus**.
- Kontrak termin **tidak dihitung** pada komponen ini.
- Penilaian penyelesaian berdasarkan **tanggal SP2D / tanggal konversi pembayaran**, bukan tanggal kontrak dan bukan tanggal BAST.

**Poin berdasarkan triwulan tanggal SP2D**

| Tanggal SP2D selesai | Poin AK53 |
|---|---:|
| Triwulan I: 1 Januari–31 Maret | 100 |
| Triwulan II: 1 April–30 Juni | 90 |
| Triwulan III: 1 Juli–30 September | 80 |
| Triwulan IV: 1 Oktober–31 Desember | 70 |

**Rumus nilai komponen**

\[
NK\text{-}AK53 = \frac{\sum Poin\ seluruh\ kontrak\ AK53\ eligible}{Jumlah\ kontrak\ AK53\ eligible}
\]

Ketentuan penting:

- Jangan menggunakan rasio `selesai TW I / total` sebagai skor AK53.
- Jangan memakai `signedAt` untuk menentukan triwulan penyelesaian.
- Jangan memasukkan kontrak akun selain 53, nilai di luar rentang Rp50–200 juta, atau kontrak termin.
- Kolom `paymentType` dan `sp2dAt` yang sudah disimpan harus benar-benar dipakai engine.

### 2.4 Data kosong atau tidak eligible

- Jika data belum ada atau tidak ada kontrak eligible untuk suatu komponen, status komponen harus **incomplete / belum dapat dinilai**.
- Jangan menetapkan skor 100 otomatis untuk data kosong.
- Jangan memberi kontribusi sempurna yang tidak didukung data.
- UI harus menjelaskan penyebab, misalnya:
  - `Belum ada kontrak ≥ Rp50 juta untuk penilaian distribusi.`
  - `Belum ada kontrak eligible Pra-DIPA atau sampai 31 Maret.`
  - `Belum ada kontrak belanja 53, Rp50–200 juta, sekaligus, dengan tanggal SP2D.`

Jika kebijakan produk membutuhkan metode agregasi ketika satu komponen incomplete, tampilkan nilai indikator sebagai estimasi/tidak final; jangan menyamarkan nilai menjadi final. Implementasikan satu perilaku yang konsisten untuk Dashboard, halaman detail, snapshot, dan ekspor.

---

## 3. Contoh penerimaan wajib: materi PDF

Implementasikan test berbasis contoh PDF berikut.

### 3.1 Data kontrak

| No. | Kontrak | Akun | Nilai | Tanggal kontrak | Tipe | Tanggal SP2D |
|---:|---|---:|---:|---|---|---|
| 1 | Kontrak 1 | 52 | 1.458.000.000 | 29 Des tahun sebelumnya | sekaligus | 28 Agu |
| 2 | Kontrak 2 | 52 | 344.000.000 | 12 Jan | sekaligus | 15 Feb |
| 3 | Kontrak 3 | 53 | 440.000.000 | 28 Feb | sekaligus | 19 Apr |
| 4 | Kontrak 4 | 53 | 187.500.000 | 1 Mar | sekaligus | 28 Mar |
| 5 | Kontrak 5 | 52 | 400.000.000 | 4 Apr | sekaligus | 6 Mei |
| 6 | Kontrak 6 | 53 | 125.000.000 | 30 Mei | sekaligus | 5 Jul |
| 7 | Kontrak 7 | 52 | 90.360.000 | 27 Jun | sekaligus | 11 Jul |
| 8 | Kontrak 8 | 52 | 732.000.000 | 23 Agu | sekaligus | 19 Des |
| 9 | Kontrak 9 | 52 | 288.500.000 | 16 Sep | sekaligus | 18 Okt |
| 10 | Kontrak 10 | 52 | 175.600.000 | 11 Nov | sekaligus | 29 Nov |

### 3.2 Hasil yang harus diperoleh

1. **NK-KD = 112,50**
   - Kontrak 1: 120.
   - Kontrak 2, 3, 4: masing-masing 110.
   - \((120 + 110 + 110 + 110) / 4 = 112,50\).

2. **NK-AK53 = 90,00**
   - Kontrak 3 tidak eligible karena nilainya Rp440 juta, lebih dari Rp200 juta.
   - Kontrak 4: akun 53, Rp187,5 juta, sekaligus, SP2D 28 Maret → 100.
   - Kontrak 6: akun 53, Rp125 juta, sekaligus, SP2D 5 Juli → 80.
   - \((100 + 80) / 2 = 90\).

3. **NK-DAK = 80**
   - Kontrak eligible sampai Triwulan II = 7 kontrak.
   - Total kontrak eligible tahun anggaran = 10 kontrak.
   - Rasio = \(7 / 10 \times 100\% = 70\%\).
   - Rasio >50% sampai 75% → nilai 80.

4. **Nilai Belanja Kontraktual = 97,00**

\[
(112,50 \times 40\%) + (90 \times 40\%) + (80 \times 20\%) = 97,00
\]

5. Kontribusi indikator terhadap IKPA total = \(97,00 \times 10\% = 9,70\).

---

## 4. Gap implementasi yang harus ditutup

Audit saat ini menunjukkan kondisi berikut. Anggap sebagai checklist perbaikan:

- [ ] Distribusi saat ini menghitung **total nilai rupiah**, padahal harus **jumlah kontrak**.
- [ ] Jalur Pra-DIPA 120 tidak bekerja karena `isEarlyProcurement` selalu `false`.
- [ ] KD saat ini dihitung rata-rata tertimbang nilai; harus rata-rata per kontrak.
- [ ] Kontrak setelah 31 Maret saat ini memengaruhi penyebut KD; harus dikeluarkan dari penyebut KD.
- [ ] AK53 saat ini tidak terhubung data karena `accelerations53: []`.
- [ ] AK53 saat ini tidak memfilter akun 53, rentang Rp50–200 juta, dan `paymentType = sekaligus`.
- [ ] AK53 saat ini memakai tanggal kontrak; harus memakai `sp2dAt`.
- [ ] AK53 saat ini menggunakan rasio selesai TW I; harus rata-rata poin 100/90/80/70.
- [ ] `accountCode`, `paymentType`, dan `sp2dAt` harus memengaruhi kalkulasi ketika relevan.
- [ ] Data kosong/tidak eligible saat ini menghasilkan 100; ubah menjadi incomplete.
- [ ] Engine, Dashboard, detail indikator, snapshot, history, dan export harus memakai hasil yang sama.
- [ ] Hindari nilai final melebihi 100 tanpa penandaan. Nilai komponen KD boleh >100; nilai akhir contoh valid adalah 97. Jika policy memerlukan cap nilai akhir, jangan mengasumsikan sendiri: dokumentasikan keputusan dan lindungi dengan test.

---

## 5. Perbaikan data model dan validasi

### 5.1 Field minimal

Pastikan kontrak memiliki dan memetakan field berikut:

| Field | Kegunaan |
|---|---|
| `contractNumber` | Identitas kontrak untuk tabel dan trace |
| `accountCode` | Filter akun 53 untuk AK53 |
| `value` / `amount` | Eligibility ≥ Rp50 juta dan rentang AK53 Rp50–200 juta |
| `signedAt` | DAK dan KD |
| `paymentType` | Pengecualian termin pada AK53 |
| `sp2dAt` | Triwulan penyelesaian AK53 |
| `fiscalYearId` / fiscal year | Batas tahun anggaran |

### 5.2 Validasi aplikasi

- `contractNumber` wajib diisi; pesan pengguna: `Nomor kontrak wajib diisi.`
- Nilai kontrak harus lebih dari 0.
- Akun harus memakai kode yang didukung domain dan konsisten dengan master akun aplikasi.
- `paymentType` wajib dipilih.
- `signedAt` wajib dan valid.
- `sp2dAt` boleh kosong saat kontrak belum selesai, tetapi kontrak tersebut tidak boleh masuk AK53 sampai tanggal tersedia.
- Jangan tampilkan JSON/Zod error mentah kepada operator.
- Error field tampil inline; error server tampil banner ringkas berbahasa Indonesia.
- Pastikan form create/edit tidak memanggil mutation saat halaman pertama kali dimuat.

---

## 6. Kebutuhan UI/UX

### 6.1 Batas scope halaman gabungan

Halaman boleh tetap menjadi workspace bersama Kontrak dan SPM-LS, tetapi perbaikan ini harus menjaga pemisahan indikator:

- Menu/sidebar Belanja Kontraktual membuka:

```text
/operator/data/contracts-invoices?tab=contracts
```

- Hanya menu Belanja Kontraktual yang aktif pada konteks tersebut.
- Tab Kontrak adalah fokus task ini.
- Jangan tampilkan Reminder H+17 Tagihan sebagai panel utama ketika tab Kontrak aktif.
- Jangan ubah perhitungan Penyelesaian Tagihan pada task ini.

### 6.2 Kartu indikator Belanja Kontraktual

Tambahkan kartu/summary khusus Belanja Kontraktual yang memuat:

- Nilai Belanja Kontraktual.
- Bobot indikator: 10%.
- Kontribusi terhadap IKPA.
- Status: `Lengkap`, `Estimasi`, atau `Belum dapat dinilai`.
- Tiga subkomponen dan bobotnya:
  - Distribusi Akselerasi Kontrak — 20%.
  - Kontrak Pra-DIPA — 40%.
  - Akselerasi Kontrak 53 — 40%.
- Tautan/accordion `Lihat rincian perhitungan`.

### 6.3 Detail dan trace yang wajib tampil

Untuk setiap subkomponen, tampilkan dengan bahasa pengguna:

**DAK**

- Jumlah kontrak eligible ≥ Rp50 juta sampai 30 Juni.
- Jumlah kontrak eligible selama tahun anggaran.
- Rasio.
- Bucket nilai yang dipakai.

**KD**

- Jumlah kontrak Pra-DIPA × 120.
- Jumlah kontrak 1 Januari–31 Maret × 110.
- Jumlah kontrak yang masuk penyebut.
- Nilai rata-rata.

**AK53**

- Jumlah kontrak eligible akun 53, Rp50–200 juta, sekaligus, memiliki SP2D.
- Daftar/perhitungan poin per triwulan SP2D.
- Nilai rata-rata.
- Alasan pengecualian per kontrak bila relevan, misalnya `Termin`, `Nilai > Rp200 juta`, `Akun bukan 53`, atau `SP2D belum tersedia`.

### 6.4 Rekomendasi aksi

Tambahkan rekomendasi yang didasarkan pada data, bukan teks statis:

- Jika ada rencana kontrak eligible sebelum/sekitar awal tahun: dorong penandatanganan Pra-DIPA atau paling lambat 31 Maret.
- Jika rasio kontrak sampai Triwulan II belum optimal: dorong penyelesaian/pendaftaran kontrak yang dapat dilaksanakan paling lambat semester I.
- Jika ada kontrak akun 53 bernilai Rp50–200 juta, sekaligus, tanpa SP2D atau melewati TW I: prioritaskan penyelesaian untuk mengoptimalkan AK53.
- Tampilkan rekomendasi tanpa menyatakan bahwa hasil simulator adalah nilai resmi OMSPAN.

---

## 7. Teknis implementasi

### 7.1 Refactor engine dan mapping

- Refactor `calculateContractual` atau engine ekuivalen agar menerima data kontrak lengkap yang benar-benar dibutuhkan.
- Hindari input paralel/dummy seperti `accelerations53: []` apabila AK53 dapat diturunkan dari satu sumber data kontrak.
- Jika tetap memakai struktur input terpisah, mapping server wajib membangun `accelerations53` dari kontrak nyata dengan field akun, nilai, tipe pembayaran, dan SP2D.
- Hapus atau hindari flag Pra-DIPA manual yang dapat divergen dari `signedAt`; lebih aman membuat status Pra-DIPA secara deterministik dari tanggal dan tahun anggaran.
- Pastikan perbandingan tanggal memakai zona waktu yang aman untuk tanggal `YYYY-MM-DD`, terutama batas 31 Maret dan 30 Juni.
- Jangan memakai `new Date('YYYY-MM-DD')` dengan perilaku UTC yang dapat menggeser bulan/tanggal di WIB. Gunakan parser tanggal lokal/PlainDate/utility domain yang konsisten.

### 7.2 Satu sumber perhitungan

Gunakan engine/utility yang sama untuk:

- Halaman Kontrak.
- Dashboard IKPA.
- Simulasi actual/forecast/skenario bila relevan.
- Snapshot dan riwayat.
- Export laporan.
- Detail formula/trace UI.

Tidak boleh ada dua rumus berbeda antara kartu, tabel, Dashboard, dan export.

### 7.3 Dokumentasi

Setelah implementasi:

- Perbarui `05-belanja-kontraktual.md` agar mencerminkan perilaku yang benar, bukan kondisi audit lama.
- Perbarui PRD/FSD/TSD/ERD bila terdapat field atau aturan yang berubah.
- Dokumentasikan keputusan bila ada aturan yang belum dapat dipastikan dari materi.
- Jangan menulis klaim `implemented` apabila test penerimaan belum lulus.

---

## 8. Test wajib

### 8.1 Unit test engine

Buat/ubah test minimal untuk:

- Contoh PDF menghasilkan NK-KD 112,50; NK-AK53 90; NK-DAK 80; Nilai BK 97,00; kontribusi 9,70.
- DAK menggunakan count, bukan total nilai.
- Batas DAK tepat 0, 25, 25,01, 50, 50,01, 75, dan >75 persen.
- Threshold kontrak Rp49.999.999 tidak eligible; Rp50.000.000 eligible.
- KD: 31 Des tahun sebelumnya = 120; 1 Jan dan 31 Mar = 110; 1 Apr tidak masuk penyebut KD.
- AK53: akun bukan 53 dikecualikan.
- AK53: Rp49.999.999 dan Rp200.000.001 dikecualikan; Rp50 juta dan Rp200 juta masuk.
- AK53: termin dikecualikan; sekaligus masuk.
- AK53: SP2D di TW I/TW II/TW III/TW IV menghasilkan 100/90/80/70.
- AK53: `sp2dAt` kosong tidak ikut skor dan menghasilkan status/trace yang jelas.
- Data kosong dan seluruh data tidak eligible menghasilkan incomplete, bukan 100.
- Perbandingan tanggal batas tidak bergeser karena timezone.

### 8.2 Integration test

- Input kontrak dari UI tersimpan dan mengubah DAK/KD/AK53 sesuai field yang diedit.
- Mengubah `paymentType` dari sekaligus menjadi termin mengeluarkan kontrak dari AK53.
- Mengubah `sp2dAt` dari 31 Maret ke 1 April menurunkan poin AK53 dari 100 menjadi 90.
- Mengubah tanggal kontrak dari 31 Maret ke 1 April mengeluarkan kontrak dari penyebut KD.
- Sidebar `Belanja Kontraktual` membuka tab Kontrak dan tidak membuat menu Tagihan aktif bersamaan.
- Tidak ada payload error Zod/JSON mentah dalam kondisi error form.

### 8.3 UAT manual

- Tambahkan kontrak Pra-DIPA, kontrak Jan–Mar, kontrak setelah Mar, kontrak 53 eligible, kontrak 53 termin, dan kontrak 53 di luar rentang nilai.
- Pastikan rincian UI menjelaskan mengapa masing-masing kontrak masuk atau tidak masuk setiap subkomponen.
- Pastikan hasil Dashboard sama dengan hasil detail halaman dan export.

---

## 9. Definition of Done

Task dianggap selesai hanya jika seluruh kondisi berikut terpenuhi:

- [ ] Formula dan contoh PDF menghasilkan nilai akhir **97,00**.
- [ ] DAK memakai jumlah kontrak, bukan nilai rupiah.
- [ ] Pra-DIPA 120 benar-benar aktif dari tanggal kontrak.
- [ ] KD adalah rata-rata per kontrak yang eligible sampai 31 Maret; kontrak setelah itu tidak masuk penyebut.
- [ ] AK53 memfilter akun 53, Rp50–200 juta, sekaligus, dan memakai tanggal SP2D.
- [ ] AK53 memakai rata-rata poin 100/90/80/70 per triwulan.
- [ ] Data kosong/tidak eligible tidak mendapat nilai 100 otomatis.
- [ ] Dashboard, halaman detail, history, snapshot, dan export konsisten memakai engine yang sama.
- [ ] UI memiliki skor, subskor, trace, status kelengkapan, serta rekomendasi kontraktual yang jelas.
- [ ] Tab Kontrak tidak mencampur reminder H+17 milik Tagihan sebagai fokus utama.
- [ ] Tidak ada error validator mentah yang ditampilkan ke pengguna.
- [ ] Semua unit test, integration test, dan UAT di atas lulus.
- [ ] Dokumentasi implementasi diperbarui dan mencantumkan file yang diubah.

---

## 10. Format laporan akhir agent

Pada akhir pekerjaan, kirim laporan ringkas dengan format berikut:

```markdown
## Ringkasan perubahan
- ...

## File yang diubah
- `path/file.ext` — alasan perubahan

## Keputusan aturan
- ...

## Hasil test
- Unit: ...
- Integration: ...
- UAT: ...

## Contoh PDF
- NK-KD: 112,50
- NK-AK53: 90,00
- NK-DAK: 80,00
- Nilai BK: 97,00
- Kontribusi IKPA: 9,70

## Risiko / keputusan yang masih memerlukan konfirmasi
- ...
```

Jangan melakukan perubahan pada indikator Penyelesaian Tagihan dalam task ini, kecuali perubahan navigasi/tab minimum agar konteks Belanja Kontraktual dapat dibuka secara benar.