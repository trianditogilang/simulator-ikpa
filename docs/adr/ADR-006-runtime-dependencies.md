# ADR-006 — Dependency Runtime Decimal, XLSX, PDF, dan Storage Import

- Status: Accepted
- Tanggal: 31 Agustus 2026
- Pemilik: Solution Architect
- Task: F0-08
- Terkait: F7-01, F12-01–F12-06, ADR-005

## Konteks

Simulator IKPA membutuhkan empat kemampuan runtime yang tidak layak dibuat sendiri:

1. perhitungan desimal yang deterministik;
2. pembacaan dan penulisan XLSX/CSV;
3. pembuatan laporan PDF;
4. penyimpanan sementara berkas import.

Pilihan harus aman untuk deployment serverless Vercel, tidak membawa kode server ke bundle browser, memiliki lisensi yang jelas, dan masih dirawat. Batas upload aplikasi adalah 10 MB, sedangkan payload request/response Vercel Function dibatasi 4,5 MB. Karena itu, upload berkas import tidak boleh melewati Function sebagai request body.

## Keputusan

| Kebutuhan | Pilihan | Lingkup runtime |
|---|---|---|
| Desimal | `big.js` | engine bersama, server dan browser bila diperlukan |
| XLSX/CSV | `exceljs` | server only |
| PDF | `@react-pdf/renderer` | server only |
| Storage import sementara | Cloudflare R2 melalui `@aws-sdk/client-s3` dan `@aws-sdk/s3-request-presigner` | server only; browser hanya menerima presigned URL |

Tidak ada dependency yang dipasang dalam F0-08. Instalasi, versi konkret, dan lockfile dikerjakan oleh F7-01 setelah validasi lisensi dan keamanan.

## 1. Desimal: `big.js`

### Alasan

`big.js` menyediakan aritmetika desimal arbitrary-precision dengan API kecil. Kebutuhan domain saat ini hanya operasi dasar, pembulatan, rasio, dan skor; fungsi matematika tambahan dari library yang lebih besar belum diperlukan.

Konfigurasi wajib dipusatkan dalam satu adapter engine:

- aktifkan `Big.strict = true`;
- terima nilai desimal dari string atau integer, bukan primitive floating-point;
- baca dan tulis kolom PostgreSQL `numeric` sebagai string;
- serialisasikan nilai lintas boundary sebagai string;
- lakukan pembulatan hanya pada boundary yang ditetapkan rule set;
- simpan mode dan skala pembulatan dalam rule set serta golden test;
- gunakan integer Rupiah bila nilai domain memang selalu berupa Rupiah bulat.

Kode fitur tidak boleh mengubah konfigurasi global `Big.DP` atau `Big.RM` secara ad hoc. Adapter engine menjadi satu-satunya tempat konfigurasi tersebut.

### Perbandingan

| Kandidat | Presisi dan keamanan | Serverless/bundle | Lisensi dan maintenance | Putusan |
|---|---|---|---|---|
| `big.js` | Desimal arbitrary-precision; strict mode membantu menolak input `number` yang tidak aman | Kecil dan tanpa kebutuhan runtime khusus | MIT; proyek mapan dan aktif dirawat | Dipilih |
| `decimal.js` | Presisi sangat baik dan fitur matematika lebih luas | Lebih besar karena API lebih luas | MIT; proyek mapan dan aktif dirawat | Tidak dipilih; fitur tambahannya belum dibutuhkan |
| Native `Number` | Rentan galat floating-point pada nilai desimal | Tidak menambah bundle | Bawaan platform | Ditolak untuk kalkulasi IKPA |
| Integer-only | Tepat untuk Rupiah bulat | Tidak menambah bundle | Bawaan platform | Tetap digunakan bila cocok, tetapi tidak cukup untuk rasio dan skor desimal |

## 2. XLSX/CSV: `exceljs`

### Alasan

Satu dependency menangani pembacaan dan penulisan XLSX serta CSV. API streaming reader/writer memungkinkan pemrosesan per baris dan pelepasan objek yang telah di-commit, sehingga lebih sesuai untuk Function dengan memori terbatas dibanding selalu memuat workbook penuh.

`exceljs` hanya boleh di-import dari modul server. Import dinamis atau boundary `server-only` digunakan agar parser spreadsheet tidak masuk ke bundle browser.

### Aturan keamanan import

- batas ukuran berkas tetap 10 MB dan batas data 10.000 baris;
- hanya `.xlsx` dan `.csv`; `.xls`, `.xlsm`, serta format macro lain ditolak;
- validasi extension, MIME type, dan signature berkas; extension saja tidak cukup;
- workbook harus mengikuti template/domain yang dikenal;
- jumlah worksheet, kolom, sel, dan panjang teks dibatasi;
- formula, external link, hyperlink, gambar, dan macro tidak dipercaya;
- sel formula pada kolom data import dianggap tidak valid, bukan dieksekusi;
- nilai desimal dikonversi ke string lalu divalidasi oleh adapter `big.js`;
- parsing tidak langsung menulis data bisnis ke database;
- proses memiliki timeout dan batas memori;
- pesan error menyebut lokasi baris/kolom tanpa memantulkan isi sensitif secara berlebihan.

### Aturan keamanan export

Nilai teks yang diawali karakter formula spreadsheet seperti `=`, `+`, `-`, `@`, tab, atau carriage return harus dinetralkan sebelum ditulis sebagai CSV/XLSX. Export hanya berisi nilai dan formula yang dibuat eksplisit oleh aplikasi.

### Perbandingan

| Kandidat | Kemampuan | Serverless/bundle | Lisensi dan maintenance | Putusan |
|---|---|---|---|---|
| `exceljs` | Read/write XLSX dan CSV; tersedia streaming API | Server only; ukuran menengah, dapat memproses per baris | MIT; proyek mapan | Dipilih |
| SheetJS `xlsx` | Read/write spreadsheet dengan cakupan format luas | Server only; distribusi dan cakupan lebih luas dari kebutuhan | Model distribusi/edisi perlu pemeriksaan tambahan saat upgrade | Tidak dipilih; ExcelJS sudah mencukupi kebutuhan minimum |
| Library terpisah per read/write/CSV | Dapat dioptimalkan per fungsi | Menambah jumlah dependency dan adapter | Maintenance tersebar | Ditolak; kompleksitas tidak memberi manfaat saat ini |

Presisi angka spreadsheet tidak diserahkan kepada library XLSX. Semua nilai domain tetap melewati validasi string dan adapter desimal.

## 3. PDF: `@react-pdf/renderer`

### Alasan

Laporan PDF sudah direncanakan sebagai komponen TypeScript/TSX. `@react-pdf/renderer` memberi model komponen deklaratif dan mendukung `renderToStream`, sehingga hasil dapat dikirim tanpa file persisten.

Aturan implementasi:

- renderer hanya berjalan di Node/server Function;
- gunakan `renderToStream`; jangan mengandalkan filesystem persisten;
- komponen laporan dan data mapping dipisahkan dari route handler;
- font disertakan sebagai asset lokal yang terkontrol, bukan diambil dari URL remote saat request;
- teks, nama file, dan URL gambar divalidasi;
- HTML mentah tidak diterima sebagai isi laporan;
- response wajib terautentikasi, menggunakan content type PDF dan `Content-Disposition` yang aman;
- metadata laporan mencantumkan versi rule set dan disclaimer yang relevan;
- renderer dikeluarkan dari bundle client.

### Perbandingan

| Kandidat | Kemampuan dan keamanan | Serverless/bundle | Lisensi dan maintenance | Putusan |
|---|---|---|---|---|
| `@react-pdf/renderer` | Layout deklaratif berbasis komponen; output stream | Lebih besar dari library low-level, tetapi tidak memerlukan browser headless | MIT; dokumentasi dan changelog aktif | Dipilih |
| `pdfkit` | API PDF low-level yang matang | Runtime server cocok, tetapi layout tabel/laporan harus dibangun lebih manual | MIT; proyek mapan | Tidak dipilih; kode layout lebih banyak |
| HTML + browser headless | CSS/HTML fleksibel | Bundle/runtime paling berat, cold start dan resource lebih besar | Bergantung stack browser | Ditolak untuk kebutuhan laporan statis saat ini |

## 4. Storage import sementara: Cloudflare R2

### Alasan

Cloudflare R2 menyediakan API S3-compatible, object private, presigned URL, dan lifecycle rule. Ini sesuai dengan arsitektur Cloudflare yang telah dipilih serta menghindari payload 10 MB melalui batas body Vercel Function 4,5 MB.

Filesystem Vercel bersifat read-only kecuali direktori scratch `/tmp`. Isi `/tmp` tidak dapat menjadi storage lintas invocation dan tidak boleh dipakai sebagai antrean berkas.

### Alur upload minimum

1. Server mengautentikasi pengguna, memvalidasi scope organisasi, dan membuat import job.
2. Server membuat object key acak dan presigned `PUT` URL dengan masa berlaku singkat.
3. Browser mengunggah langsung ke R2 menggunakan URL tersebut.
4. Browser memberitahu server bahwa upload selesai.
5. Server memeriksa object melalui metadata: key, ukuran, content type, dan checksum yang tersedia.
6. Worker memproses object berdasarkan `storage_key`, bukan public URL.
7. Object dihapus setelah job mencapai status terminal; lifecycle rule menjadi safety net untuk object yatim.

Detail retry, status job, serta durasi retensi final ditetapkan oleh F0-10. F0-08 menetapkan prinsip bahwa object bersifat sementara, private, dan tidak boleh bertahan tanpa lifecycle expiry.

### Kontrol keamanan

- bucket dan object tidak public;
- presigned URL dianggap bearer token: tidak dicatat di log dan tidak disimpan di database;
- URL hanya berlaku untuk satu method, satu object key, dan waktu singkat;
- object key dibuat server, misalnya `imports/{env}/{orgId}/{jobId}/{random}.xlsx`;
- nama file dari pengguna hanya metadata, bukan bagian path yang dipercaya;
- database menyimpan `storage_key`, nama asli yang disanitasi, ukuran, checksum, dan status;
- kredensial R2 hanya tersedia pada server;
- izin kredensial dibatasi pada bucket/prefix import;
- worker mengunduh ke memory/stream atau `/tmp` hanya selama invocation, lalu membersihkannya;
- proses menolak object yang ukuran atau tipenya tidak sesuai upload intent;
- penghapusan dilakukan pada success, failure final, dan cancel; lifecycle menangani object yatim.

### Perbandingan

| Kandidat | Keamanan dan lifecycle | Serverless/bundle | Lisensi/maintenance | Putusan |
|---|---|---|---|---|
| Cloudflare R2 + AWS SDK modular | Private object, presigned URL, lifecycle rule, API S3 | Direct upload melewati batas body Function; SDK server only | AWS SDK Apache-2.0; R2 layanan terkelola | Dipilih |
| Vercel Blob | Mendukung direct object storage | Cocok dengan Vercel, tetapi menambah layanan storage kedua tanpa kebutuhan | SDK/provider perlu dikelola terpisah | Tidak dipilih; R2 sudah sesuai arsitektur |
| Vercel `/tmp` | Tidak persisten dan tidak berbagi antar-invocation | Hanya scratch dalam satu invocation | Bawaan runtime | Ditolak sebagai storage job |
| PostgreSQL `bytea` | Dapat diamankan bersama data | Membebani database dan backup untuk blob sementara | Bawaan database | Ditolak |

`@aws-sdk/client-s3` dan `@aws-sdk/s3-request-presigner` digunakan melalui import modular dan hanya pada kode server. Browser tidak menerima kredensial SDK.

## Penempatan Dependency

| Dependency | Penempatan | Catatan |
|---|---|---|
| `big.js` | package engine/domain bersama | Satu adapter konfigurasi dan serialisasi |
| `exceljs` | modul import/export server | Jangan diekspor dari entry point client |
| `@react-pdf/renderer` | modul laporan server | Render melalui stream |
| `@aws-sdk/client-s3` | adapter storage server | Client singleton per runtime |
| `@aws-sdk/s3-request-presigner` | service upload intent server | Hanya membuat URL terbatas |

F7-01 harus memasang versi konkret, memperbarui lockfile, dan memastikan tidak ada library kedua dengan fungsi sama tanpa ADR baru.

## Gate Implementasi F7-01

Sebelum dependency dipakai di produksi:

1. verifikasi lisensi pada versi yang benar-benar dipasang;
2. jalankan audit kerentanan dependency dan review advisory langsung;
3. catat versi dalam lockfile; jangan memasang tag `latest` sebagai kontrak;
4. ukur bundle server dan pastikan dependency server tidak masuk bundle browser;
5. buat smoke test serverless untuk streaming XLSX dan PDF;
6. buat test presisi desimal dan golden test pembulatan;
7. buat test upload langsung untuk berkas mendekati 10 MB;
8. uji penolakan format, formula injection, file terlalu besar, object mismatch, dan expired URL.

## Konsekuensi

### Positif

- kalkulasi tidak bergantung pada floating-point JavaScript;
- satu dependency mencakup XLSX dan CSV;
- PDF dapat dibuat sebagai komponen dan dialirkan langsung;
- upload 10 MB tidak terhalang batas body Vercel Function;
- berkas import tetap private dan sementara.

### Negatif

- empat area runtime menambah dependency yang harus diaudit dan diperbarui;
- ExcelJS, React PDF, dan AWS SDK menambah ukuran bundle server;
- alur direct upload membutuhkan import job dan tahap verifikasi object;
- streaming dan lifecycle perlu integration test, tidak cukup unit test.

### Batasan Keputusan

- keputusan ini tidak memilih versi package; F7-01 melakukannya;
- keputusan ini tidak merancang state machine job atau retensi rinci; F0-10 melakukannya;
- keputusan ini tidak mengizinkan macro, formula import, HTML-to-PDF, atau public upload bucket;
- dependency baru dengan fungsi tumpang tindih memerlukan justifikasi dan pembaruan ADR.

## Checklist Penerimaan F0-08

- [x] Pilihan decimal dibandingkan dari sisi presisi, keamanan, bundle, lisensi, dan maintenance.
- [x] Pilihan XLSX/CSV dibandingkan dari sisi keamanan, serverless, bundle, lisensi, dan maintenance.
- [x] Pilihan PDF dibandingkan dari sisi keamanan, serverless, bundle, lisensi, dan maintenance.
- [x] Pilihan storage import dibandingkan dari sisi keamanan, serverless, lifecycle, bundle, dan maintenance.
- [x] Batas body Vercel dan kebutuhan upload 10 MB memiliki alur yang kompatibel.
- [x] Dependency server dicegah masuk ke bundle browser.
- [x] Instalasi package ditunda ke F7-01.

## Referensi

- [big.js README](https://github.com/MikeMcl/big.js)
- [ExcelJS README](https://github.com/exceljs/exceljs)
- [React PDF v4](https://react-pdf.org/docs/v4)
- [React PDF changelog](https://react-pdf.org/changelog)
- [Vercel Functions limitations](https://vercel.com/docs/functions/limitations)
- [Vercel Functions runtimes](https://vercel.com/docs/functions/runtimes)
- [Vercel guidance for function file writes](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions)
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Cloudflare R2 object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
- [Cloudflare R2 S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/)

