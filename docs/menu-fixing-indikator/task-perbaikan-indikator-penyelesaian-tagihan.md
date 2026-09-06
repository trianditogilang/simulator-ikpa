# Task — Perbaikan Indikator IKPA Penyelesaian Tagihan

## Status dan tujuan

**Prioritas:** P0 / blokir validitas hasil simulasi

Perbaiki implementasi indikator **Penyelesaian Tagihan** pada aplikasi Simulator IKPA. Indikator ini adalah indikator mandiri dengan **bobot 10%** terhadap IKPA total.

Halaman data boleh tetap menggunakan workspace bersama dengan Belanja Kontraktual:

```text
/operator/data/contracts-invoices
```

Namun task ini hanya berfokus pada **Penyelesaian Tagihan**. Jangan mengubah formula, eligibility, atau engine indikator **Belanja Kontraktual** selain perubahan navigasi/UI minimum agar konteks kedua indikator tidak tercampur.

## Sumber kebenaran

Gunakan urutan sumber berikut apabila ada ketidaksesuaian:

1. Materi PDF `penyelesaian-tagihan.pdf`.
2. Penjelasan bisnis yang menyertai task ini.
3. Contoh perhitungan pada PDF: **13 tepat waktu dari 15 SPM LS kontraktual = 86,67**.
4. Dokumen audit `06-penyelesaian-tagihan.md` untuk peta kode dan daftar gap implementasi saat ini.

Jangan mempertahankan perilaku lama hanya karena sudah ada di engine, rule set, atau dokumen teknis bila bertentangan dengan materi PDF.

---

## 1. Definisi indikator

### 1.1 Bobot indikator

- Bobot Penyelesaian Tagihan terhadap IKPA total: **10%**.
- Nilai indikator berada pada skala 0–100.
- Kontribusi ke nilai IKPA total dihitung:

\[
Kontribusi\ IKPA\ Penyelesaian\ Tagihan = Nilai\ PT \times 10\%
\]

### 1.2 Rumus kanonis

\[
Nilai\ PT = \frac{Jumlah\ SPM\ LS\ Kontraktual\ Non\text{-}Pegawai\ Tepat\ Waktu}{Jumlah\ Seluruh\ SPM\ LS\ Kontraktual\ Non\text{-}Pegawai\ Eligible} \times 100
\]

Definisi **tepat waktu**:

> SPM LS Kontraktual diterima KPPN pada saat proses konversi paling lambat 17 hari kerja dari tanggal BAST atau BAPP.

Ketentuan penting:

- Titik awal adalah **tanggal BAST/BAPP**, bukan tanggal satker menerima dokumen fisik.
- Dasar BAST/BAPP adalah tanggal yang dipilih satker pada modul **Komitmen SAKTI**.
- Titik akhir adalah **tanggal SPM LS Kontraktual diterima KPPN pada proses konversi**, bukan tanggal SPM dibuat/ditandatangani satker.
- Yang dihitung hanya **SPM LS kontraktual non-belanja pegawai**.
- Batas adalah **17 hari kerja**, bukan 17 hari kalender.

---

## 2. Aturan bisnis kanonis

### 2.1 Objek yang masuk penilaian

Sebuah baris SPM masuk pembilang atau penyebut indikator hanya jika seluruh kondisi berikut terpenuhi:

- Jenis dokumen adalah **SPM-LS**.
- Bersifat **kontraktual** / terhubung dengan kontrak yang sah dalam tahun anggaran relevan.
- **Bukan belanja pegawai** (`isPegawai = false`).
- Memiliki tanggal BAST/BAPP yang valid.
- Memiliki tanggal diterima KPPN pada proses konversi yang valid untuk perhitungan final.

Ketentuan:

- SPM belanja pegawai harus dikecualikan dari **pembilang dan penyebut**, bukan hanya diberi label di UI.
- Jangan mencampur SPM non-kontraktual ke dalam nilai indikator.
- Relasi `contractId` dapat digunakan sebagai pengaman bahwa SPM adalah kontraktual, tetapi UI dan trace tetap harus menjelaskan kategori/eligibility SPM.

### 2.2 Tanggal dan batas H+17 hari kerja

Definisi perhitungan:

- Hari BAST/BAPP adalah **hari ke-0**.
- Penghitungan dimulai pada hari setelah BAST/BAPP.
- Hari kerja ke-17 adalah deadline/H+17.
- SPM tepat waktu bila tanggal konversi KPPN berada **pada atau sebelum** deadline H+17.
- SPM terlambat bila tanggal konversi KPPN berada setelah deadline H+17.

Contoh batas konseptual:

```text
BAST/BAPP: hari ke-0
Hari kerja berikutnya: H+1
...
Hari kerja ke-17: deadline, masih tepat waktu
Hari kerja ke-18: terlambat
```

### 2.3 Kalender kerja kanonis

Aplikasi harus memakai **satu utilitas kalender kerja yang sama** untuk engine, UI, strip reminder, deadline, Dashboard, detail indikator, serta scheduler reminder.

Hari kerja harus:

- Menghitung Senin–Jumat sebagai hari kerja normal.
- Mengecualikan Sabtu dan Minggu.
- Mengecualikan libur nasional/daerah yang tercatat dalam kalender aplikasi.
- Menghormati override kalender kerja, baik hari kerja tambahan maupun hari kerja yang dinonaktifkan.
- Menangani batas tahun, leap year, dan tanggal ISO tanpa pergeseran zona waktu.

Larangan:

- Jangan gunakan engine yang menghitung akhir pekan sebagai hari kerja.
- Jangan gunakan strip UI yang menghitung Senin–Jumat tetapi mengabaikan libur, jika engine menggunakan aturan lain.
- Jangan memakai tiga implementasi berbeda untuk engine, helper deadline, dan reminder.

### 2.4 Status SPM yang belum dikonversi

SPM yang belum diterima KPPN / belum mempunyai tanggal konversi harus memiliki status operasional:

- `Menunggu konversi`, atau
- `Berisiko`, atau
- `Terlambat` bila sudah melewati deadline H+17 tanpa konversi.

Aturan penilaian:

- Jangan menjadikan SPM belum konversi sebagai SPM tepat waktu.
- Jangan memasukkan SPM belum konversi ke pembilang.
- Tentukan satu kebijakan yang eksplisit dan konsisten untuk penyebut nilai final:
  - Bila penilaian hanya atas SPM yang telah diajukan/dikonversi, tandai nilai sebagai estimasi selama masih ada SPM berjalan.
  - Bila SPM yang sudah memiliki BAST wajib menjadi denominator meskipun belum konversi, tampilkan risiko dan perlakukan lewat kebijakan yang eksplisit.
- Jangan menyamarkan nilai sebagai nilai final jika terdapat data berjalan yang belum memiliki tanggal konversi.

Dokumentasikan kebijakan yang dipilih dalam trace, UI, dan dokumentasi teknis.

### 2.5 Validasi tanggal dan data

- `bastBappDate` wajib ada dan valid.
- `receivedAtKppn` boleh kosong hanya untuk status berjalan; bila sudah terisi, harus valid.
- Tanggal konversi KPPN tidak boleh lebih awal daripada tanggal BAST/BAPP.
- Nomor SPM wajib diisi dan sebaiknya unik dalam ruang lingkup tahun anggaran/satker sesuai kebijakan domain.
- Tanggal masa depan harus ditolak atau diberi status draft yang tidak masuk penilaian.
- Jangan izinkan baris dengan `receivedAtKppn < bastBappDate` dihitung 0 hari lalu dianggap tepat waktu.
- Jangan menampilkan JSON/Zod error mentah kepada operator.

---

## 3. Contoh penerimaan wajib: materi PDF

### 3.1 Contoh agregat

Sepanjang tahun anggaran, Satker ABC memiliki:

| Kategori | Jumlah SPM LS Kontraktual Non-Pegawai |
|---|---:|
| Tepat waktu (maksimal H+17 hari kerja) | 13 |
| Terlambat | 2 |
| Total eligible | 15 |

Hasil yang wajib diperoleh:

\[
Nilai\ PT = \frac{13}{15} \times 100 = 86,666... = 86,67
\]

Kontribusi terhadap IKPA total:

\[
86,67 \times 10\% = 8,67
\]

### 3.2 Boundary test H+17

Gunakan kalender kerja kanonis aplikasi untuk test berikut:

- Konversi tepat pada hari kerja ke-17 → **tepat waktu**.
- Konversi pada hari kerja ke-18 → **terlambat**.
- BAST/BAPP dan konversi pada tanggal yang sama → **tepat waktu** (0 hari berlalu), jika secara data memang diperbolehkan.
- Rentang yang mencakup Sabtu, Minggu, dan libur nasional → hanya hari kerja kanonis yang dihitung.
- Hari yang semula akhir pekan tetapi di-override menjadi hari kerja → harus dihitung.
- Hari kerja biasa yang di-override menjadi libur → tidak boleh dihitung.

---

## 4. Gap implementasi yang harus ditutup

Audit saat ini menunjukkan kondisi berikut. Anggap sebagai checklist wajib:

- [ ] `isPegawai` tersimpan dan dilabeli di UI, tetapi masih ikut perhitungan engine. Harus dikecualikan dari pembilang dan penyebut.
- [ ] Engine hanya melewati daftar libur, tetapi masih menghitung Sabtu–Minggu sebagai hari kerja. Harus diperbaiki.
- [ ] `workdays[]`/calendar override belum dipakai engine. Harus dipakai.
- [ ] Strip halaman memakai hitungan Senin–Jumat tanpa libur, sedangkan engine memakai aturan lain. Harus disatukan.
- [ ] Helper deadline H+17 memakai logika lain dan tidak dipakai halaman. Harus diganti/dipakai bersama atau dihapus.
- [ ] `receivedAtKppn` saat ini wajib sehingga tidak ada status SPM berjalan/belum konversi. Perbaiki model/status sesuai kebijakan yang dipilih.
- [ ] `receivedAtKppn < bastBappDate` saat ini dapat lolos dan dianggap tepat waktu. Harus ditolak.
- [ ] Tidak ada pembeda eksplisit SPM kontraktual vs non-kontraktual selain relasi. Pastikan eligibility dapat diverifikasi dan ditelusuri.
- [ ] Duplikasi nomor SPM dan tanggal masa depan belum ditangani. Tambahkan validasi sesuai policy.
- [ ] Dashboard hanya menampilkan agregat dan halaman tidak menunjukkan skor indikator/trace dengan jelas. Tambahkan.
- [ ] Reminder terjadwal H-5/H-2/H-0 belum terbukti memakai kalender dan status yang sama dengan engine. Perbaiki integrasinya.
- [ ] Jangan ubah data kosong menjadi nilai sempurna. Status tanpa SPM eligible adalah `incomplete/belum dapat dinilai`.

---

## 5. Perbaikan data model dan validasi

### 5.1 Field minimum

Pastikan SPM-LS menyimpan dan memetakan field berikut:

| Field | Kegunaan |
|---|---|
| `referenceNumber` | Nomor/referensi SPM untuk trace dan tindakan |
| `contractId` | Validasi keterkaitan kontrak/kontraktual |
| `bastBappDate` | Titik awal H+17 |
| `receivedAtKppn` / `conversionDate` | Titik akhir H+17; tanggal konversi KPPN |
| `isPegawai` | Filter non-belanja pegawai |
| status / konversi belum tersedia | Status berjalan dan risiko sebelum konversi |
| `fiscalYearId` | Batas data tahun anggaran |

Jika nama `receivedAtKppn` ambigu di UI, gunakan label pengguna:

```text
Tanggal Konversi / Diterima KPPN
```

Tambahkan helper text:

```text
Gunakan tanggal SPM LS kontraktual diterima KPPN saat proses konversi, bukan tanggal SPM dibuat.
```

### 5.2 Validasi UI dan server

- `referenceNumber` wajib; tampilkan `Nomor SPM-LS wajib diisi.`
- Kontrak wajib dipilih dan harus berada pada satker/tahun anggaran yang sama.
- `bastBappDate` wajib.
- Jika konversi sudah diisi, validasi `receivedAtKppn >= bastBappDate`.
- `isPegawai` harus diisi secara eksplisit atau memiliki default yang jelas dengan label yang mudah dipahami.
- Hindari default tanggal hari ini yang membuat pengguna tanpa sadar mencatat tanggal konversi final. Untuk SPM belum konversi, dukung status/field kosong dengan jelas.
- Tampilkan error validasi inline di field; banner global hanya untuk error sistem.
- Jangan render `JSON.stringify(error)` atau payload validator teknis di UI.

---

## 6. Kebutuhan UI/UX

### 6.1 Batas scope halaman bersama

Halaman tetap boleh bersama dengan data Kontrak, tetapi indikator harus dipisahkan:

- Menu/sidebar Penyelesaian Tagihan membuka:

```text
/operator/data/contracts-invoices?tab=invoices
```

- Hanya menu Penyelesaian Tagihan yang aktif pada konteks tersebut.
- Tab `SPM-LS` adalah fokus task ini.
- Jangan tampilkan detail/rumus Belanja Kontraktual sebagai konten utama ketika tab SPM-LS aktif.
- Jangan ubah formula Belanja Kontraktual dalam task ini.

### 6.2 Kartu indikator Penyelesaian Tagihan

Tambahkan kartu/summary khusus Penyelesaian Tagihan yang memuat:

- Nilai Penyelesaian Tagihan.
- Bobot indikator: 10%.
- Kontribusi terhadap IKPA.
- Jumlah SPM LS kontraktual non-pegawai tepat waktu.
- Jumlah total SPM LS kontraktual non-pegawai eligible.
- Jumlah berkas berjalan/menunggu konversi dan jumlah berisiko, bila ada.
- Status nilai: `Lengkap`, `Estimasi`, atau `Belum dapat dinilai`.
- Tautan/accordion `Lihat rincian perhitungan`.

### 6.3 Tabel SPM-LS

Tabel tab SPM-LS setidaknya menampilkan:

| Kolom | Keterangan |
|---|---|
| Nomor SPM-LS | Referensi berkas |
| Kontrak terkait | Nomor kontrak dan ringkasannya |
| Kategori | Non-pegawai / Pegawai — pegawai ditandai dikecualikan |
| BAST/BAPP | Tanggal titik awal |
| Konversi KPPN | Tanggal titik akhir atau `Belum dikonversi` |
| Deadline H+17 | Hasil kalender kerja kanonis |
| Hari kerja berlalu | Hasil utilitas kanonis |
| Status | Tepat waktu / Terlambat / Menunggu / Berisiko |
| Dampak nilai | `Dihitung`, `Dikecualikan pegawai`, atau alasan lain |

Jangan hanya menampilkan label pegawai; pastikan `Dampak nilai` transparan.

### 6.4 Detail dan trace perhitungan

Pada detail indikator, tampilkan:

- Pembilang: jumlah SPM tepat waktu.
- Penyebut: jumlah seluruh SPM eligible non-pegawai.
- Rasio dan pembulatan.
- Bobot indikator dan kontribusi IKPA.
- Definisi tepat waktu: maksimal 17 hari kerja dari BAST/BAPP hingga konversi KPPN.
- Ringkasan SPM dikecualikan, minimal berapa berkas pegawai dan alasannya.
- Ringkasan SPM berjalan/berisiko yang belum dikonversi, beserta dampak terhadap status estimasi/final.

### 6.5 Reminder H+17

Reminder harus membantu tindakan, bukan hanya informasi statis:

- Deadline dihitung dengan utilitas kalender kanonis yang sama dengan engine.
- Tampilkan prioritas minimal H-5, H-2, H-0, dan kondisi terlambat sesuai kebijakan aplikasi.
- Gunakan penerima dan kanal reminder sesuai policy; jangan menyatakan pengiriman berhasil jika hanya ada strip UI.
- Pada tab SPM-LS, tampilkan daftar berkas berisiko/terlambat dengan tombol menuju detail berkas.
- Saran strategi harus mencerminkan aturan bisnis:
  - Segera proses pembayaran atas pekerjaan yang telah BAST/BAPP, termasuk pekerjaan termin.
  - Koordinasikan kelengkapan lampiran dengan pihak ketiga segera setelah ada kendala.
  - Fokus pada batas 17 **hari kerja** sejak tanggal BAST/BAPP, bukan tanggal satker menerima dokumen dan bukan tanggal SPM dibuat.

---

## 7. Teknis implementasi

### 7.1 Satu utilitas kalender kerja

Buat atau refactor satu domain utility, misalnya:

```text
calculateWorkingDays(startDate, endDate, calendar)
addWorkingDays(startDate, days, calendar)
```

Ketentuan utility:

- Berbasis tanggal lokal/PlainDate, bukan timestamp yang rentan pergeseran timezone.
- Mendukung weekend, holidays, serta override hari kerja/non-kerja.
- Mendefinisikan dengan jelas `start-exclusive` dan `end-inclusive`.
- Dipakai oleh engine, UI, query deadline, reminder/scheduler, dan test.

Jangan duplikasi versi `countWorkdays` yang berbeda di engine dan frontend.

### 7.2 Engine dan mapping

- Refactor `calculateInvoiceTimeliness` atau engine ekuivalen agar menerima field eligibility yang benar: kontraktual, pegawai/non-pegawai, BAST, konversi KPPN, dan status.
- Filter `isPegawai = true` sebelum membentuk pembilang dan penyebut.
- Pastikan hanya SPM kontraktual eligible yang dinilai.
- Mapping DB → engine wajib meneruskan data kalender kerja dan override yang lengkap.
- Bila kontrak dihapus, pastikan dampak ke SPM dan audit ditangani konsisten; jangan hilangkan SPM historis tanpa jejak bila data sudah dipakai snapshot.

### 7.3 Satu sumber hasil

Gunakan engine dan kalender yang sama untuk:

- Tab SPM-LS.
- Kartu skor/tagihan pada halaman.
- Dashboard IKPA.
- Simulasi actual/forecast/skenario bila relevan.
- Snapshot dan riwayat.
- Export laporan.
- Reminder Center dan scheduler.
- Detail formula/trace UI.

Tidak boleh ada perbedaan status atau deadline antara strip halaman, Dashboard, dan hasil export untuk SPM yang sama.

### 7.4 Dokumentasi

Setelah implementasi:

- Perbarui `06-penyelesaian-tagihan.md` agar mencerminkan implementasi baru, bukan kondisi audit lama.
- Perbarui PRD/FSD/TSD/ERD bila field/status atau aturan kalender berubah.
- Jelaskan kebijakan untuk SPM belum dikonversi dan kapan nilai dinyatakan estimasi/final.
- Jangan menulis klaim `implemented` bila test penerimaan belum lulus.

---

## 8. Test wajib

### 8.1 Unit test engine

Buat atau ubah test minimal untuk:

- Contoh PDF: 13 tepat waktu dari 15 SPM eligible → nilai `86,67`, kontribusi `8,67`.
- Pegawai tepat waktu tidak dapat menaikkan pembilang atau penyebut.
- Pegawai terlambat tidak dapat menurunkan nilai indikator.
- SPM kontraktual non-pegawai dihitung.
- SPM non-kontraktual dikecualikan.
- Konversi tepat pada hari kerja ke-17 → tepat waktu.
- Konversi pada hari kerja ke-18 → terlambat.
- Sabtu dan Minggu tidak dihitung sebagai hari kerja.
- Libur nasional tidak dihitung sebagai hari kerja.
- Override hari kerja tambahan dihitung.
- Override hari non-kerja/libur tidak dihitung.
- BAST dan konversi di tanggal yang sama → tepat waktu sesuai definisi hari ke-0.
- Konversi sebelum BAST ditolak; tidak boleh menjadi 0 hari dan tepat waktu.
- SPM belum konversi mempunyai status benar dan tidak masuk pembilang.
- Tanpa SPM eligible → `incomplete`, bukan 0 atau 100.
- Perhitungan tanggal batas tidak bergeser akibat timezone.

### 8.2 Integration test

- Membuat SPM non-pegawai dengan BAST dan tanggal konversi mengubah skor sesuai hasil engine.
- Mengubah checkbox/kategori pegawai mengeluarkan SPM dari pembilang dan penyebut secara langsung.
- Mengubah tanggal konversi pada batas H+17 menjadi H+18 mengubah status tepat waktu menjadi terlambat.
- Deadline dan jumlah hari kerja di tabel sama dengan hasil engine dan Reminder Center.
- SPM belum konversi dapat disimpan sebagai berkas berjalan tanpa diakui sebagai tepat waktu.
- Validasi menolak konversi sebelum BAST.
- Sidebar `Penyelesaian Tagihan` membuka `?tab=invoices` dan tidak membuat menu Belanja Kontraktual aktif bersamaan.
- Tidak ada payload error Zod/JSON mentah pada kondisi error form.

### 8.3 UAT manual

- Tambahkan SPM non-pegawai tepat waktu dan terlambat.
- Tambahkan SPM pegawai dan pastikan ditandai `Dikecualikan` serta tidak mengubah nilai.
- Tambahkan SPM yang mencakup weekend/libur/override kalender dan verifikasi jumlah hari kerja.
- Tambahkan SPM belum konversi, pastikan tampil Menunggu/Berisiko sesuai tanggal dan tidak dipandang sebagai hasil final tanpa penjelasan.
- Pastikan nilai di Dashboard, detail halaman, snapshot, dan export konsisten.

---

## 9. Definition of Done

Task dinyatakan selesai hanya jika seluruh kondisi berikut terpenuhi:

- [ ] Formula contoh PDF menghasilkan **86,67** untuk 13 tepat waktu dari 15 SPM eligible.
- [ ] Kontribusi indikator untuk contoh tersebut menghasilkan **8,67**.
- [ ] Hanya SPM LS kontraktual non-belanja pegawai yang masuk pembilang dan penyebut.
- [ ] Tanggal akhir yang dipakai adalah konversi/diterima KPPN, bukan tanggal SPM dibuat.
- [ ] H+17 memakai satu kalender kerja kanonis: weekend, libur, dan override konsisten.
- [ ] Engine, UI, deadline, Dashboard, export, dan reminder menghasilkan status/deadline yang sama.
- [ ] Konversi sebelum BAST tidak bisa masuk data penilaian.
- [ ] SPM belum konversi memiliki status jelas dan tidak dianggap tepat waktu.
- [ ] Tanpa SPM eligible menghasilkan `Belum dapat dinilai/incomplete`, bukan nilai sempurna.
- [ ] UI menampilkan skor, pembilang/penyebut, status, deadline, trace, dan SPM yang dikecualikan.
- [ ] Tab SPM-LS tidak mencampur detail Belanja Kontraktual sebagai konten utama.
- [ ] Sidebar hanya menandai satu menu aktif sesuai `?tab=invoices`.
- [ ] Tidak ada error validator mentah yang ditampilkan ke pengguna.
- [ ] Semua unit test, integration test, dan UAT di atas lulus.
- [ ] Dokumentasi implementasi diperbarui dan mencantumkan file yang diubah.

---

## 10. Format laporan akhir agent

Pada akhir pekerjaan, kirim laporan dengan format berikut:

```markdown
## Ringkasan perubahan
- ...

## File yang diubah
- `path/file.ext` — alasan perubahan

## Keputusan aturan
- Kebijakan SPM belum konversi: ...
- Definisi kalender kerja: ...
- Eligibility SPM kontraktual: ...

## Hasil test
- Unit: ...
- Integration: ...
- UAT: ...

## Contoh PDF
- SPM tepat waktu: 13
- Total SPM eligible: 15
- Nilai PT: 86,67
- Kontribusi IKPA: 8,67

## Risiko / keputusan yang masih memerlukan konfirmasi
- ...
```

Jangan mengubah rumus atau eligibility indikator Belanja Kontraktual dalam task ini, kecuali penyesuaian navigasi/tab minimum agar konteks Penyelesaian Tagihan dapat dibuka secara benar.