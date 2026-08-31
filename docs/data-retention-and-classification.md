# Kebijakan Retensi dan Klasifikasi Data

- Status: Approved untuk baseline MVP
- Tanggal: 31 Agustus 2026
- Pemilik: Security Agent
- Task: F0-10
- Terkait: F0-11, ADR-004, ADR-006, ADR-007

## Tujuan

Dokumen ini menetapkan klasifikasi, masa simpan, redaction log, legal hold, dan prosedur penghapusan untuk Simulator IKPA. Kebijakan dibuat dinamis melalui versi policy yang disetujui, tetapi tidak boleh melemahkan peraturan atau Jadwal Retensi Arsip (JRA) yang berlaku.

Baseline aplikasi adalah fallback MVP, bukan pengganti keputusan pejabat kearsipan. Sebelum produksi, organisasi wajib memetakan setiap kelas record ke JRA resmi dan menyetujui profil retensinya.

## Prinsip

1. Kumpulkan dan simpan hanya data yang diperlukan untuk tujuan operasional, audit, keamanan, atau kewajiban hukum.
2. Hapus, musnahkan, anonimisasi, atau arsipkan data setelah trigger dan masa retensinya terpenuhi.
3. Soft delete adalah state operasional, bukan pemenuhan penghapusan akhir.
4. Legal hold menunda disposition, tetapi tidak memperluas hak akses.
5. Data personal tidak boleh dipertahankan lebih lama hanya karena penyimpanan murah.
6. Data yang menjadi arsip permanen dipindahkan ke sistem kearsipan yang disetujui; database aplikasi bukan repositori arsip statis.
7. Setiap keputusan retensi dapat dijelaskan melalui record class, policy version, dasar hukum, trigger, periode, dan disposition.
8. Penghapusan harus dapat dibuktikan tanpa menyimpan kembali data yang telah dihapus.

## Hierarki kebijakan

Urutan keputusan yang berlaku:

1. legal hold atau perintah hukum yang sah;
2. peraturan dan JRA resmi yang berlaku untuk organisasi/record series;
3. profil organisasi/KPPN yang telah dipublish dan masih berada dalam guardrail regulasi;
4. baseline MVP pada dokumen ini.

Jika baseline bertentangan dengan JRA resmi, JRA resmi menang. Jika belum ada mapping JRA yang disetujui, production deletion untuk record bisnis diblokir dan menghasilkan status `RETENTION_POLICY_UNAPPROVED`; data sementara yang jelas seperti raw import tetap mengikuti batas keamanan maksimumnya.

## Landasan regulasi

- UU Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi menetapkan pemrosesan terbatas dan sesuai tujuan, penghentian pemrosesan ketika masa retensi/tujuan tercapai, serta penghapusan atau pemusnahan sesuai ketentuan.
- UU Nomor 43 Tahun 2009 tentang Kearsipan dan aturan pelaksanaannya menjadikan JRA dasar penyusutan arsip.
- KMK 768/KM.1/2024 menetapkan JRA substantif Kementerian Keuangan. Seri pelaksanaan anggaran memiliki disposition yang berbeda, termasuk contoh 2 tahun aktif + 3 tahun inaktif untuk record tertentu serta record lain yang permanen.
- PP Nomor 71 Tahun 2019 mensyaratkan rekam jejak audit dipelihara sesuai kebijakan retensi penyelenggara dan peraturan yang berlaku.

Angka baseline di bawah adalah pemetaan teknis konservatif untuk aplikasi simulator. Penetapan record series resmi dan nasib akhir `musnah`, `dinilai kembali`, atau `permanen` harus ditandatangani pejabat arsip/keamanan organisasi.

## Klasifikasi keamanan

| Kelas | Definisi | Contoh | Kontrol minimum |
|---|---|---|---|
| `PUBLIC` | Disetujui untuk publik | Panduan publik, sumber regulasi publik, disclaimer | Integrity check; tidak memuat data user/satker nonpublik |
| `INTERNAL` | Informasi operasional berisiko rendah | Template kosong, feature/config nonsecret, status layanan | Login bila perlu; tidak masuk log publik |
| `CONFIDENTIAL` | Data bisnis/satker yang dapat merugikan bila terbuka | Input anggaran, realisasi, kontrak, skor, snapshot, laporan, file import | Scope guard, encryption in transit/at rest, export terkontrol |
| `RESTRICTED` | Data personal, security, akses, atau credential | Email, recipient, Clerk ID, access mapping, audit detail, IP, presigned URL, secret | Least privilege, redaction, audit akses, tidak masuk client/log kecuali minimum |

Secret, token, cookie, authorization header, private key, dan presigned URL bukan record bisnis. Nilai tersebut tidak boleh disimpan di database/log dan hanya hidup selama proses yang memerlukannya.

## Data personal

Data personal umum yang dapat diproses aplikasi:

- nama dan email user;
- `clerk_user_id` dan identifier internal;
- mapping akses serta actor perubahan;
- alamat email recipient reminder;
- IP address/user agent bila diperlukan untuk security event;
- nama file atau custom message yang mungkin memuat data personal.

Aplikasi tidak dirancang untuk mengumpulkan data personal spesifik seperti kesehatan, biometrik, genetika, catatan kejahatan, data anak, atau data keuangan pribadi. Field bebas harus memiliki batas panjang dan pemberitahuan agar pengguna tidak memasukkan data tersebut.

Aturan:

- gunakan Clerk subject/internal ID untuk referensi; jangan duplikasi email ke setiap tabel;
- recipient hanya disimpan jika diperlukan untuk konfigurasi/delivery;
- body email penuh tidak disimpan dalam delivery log;
- tampilkan data personal hanya kepada scope yang berwenang;
- export yang memuat personal data diberi klasifikasi `RESTRICTED`;
- permintaan koreksi/penghapusan diverifikasi identitas dan dinilai terhadap JRA/legal hold sebelum dieksekusi;
- penghapusan/pemusnahan diberitahukan kepada subjek bila diwajibkan oleh aturan yang berlaku.

## Baseline retensi MVP

| Record class | Klasifikasi | Trigger | Baseline | Disposition |
|---|---|---|---|---|
| `business_audit` | `RESTRICTED` | Event atau tahun kegiatan ditutup | 5 tahun | Hapus setelah review JRA; 10 tahun/permanen bila diklasifikasikan sebagai pertanggungjawaban keuangan/arsip statis |
| `access_audit` | `RESTRICTED` | Perubahan akses terjadi | 5 tahun | Hapus; actor dipertahankan sebagai ID pseudonim minimum |
| `score_snapshot` | `CONFIDENTIAL` | Tahun anggaran ditutup | 5 tahun | Hapus atau arsip-review; laporan resmi dapat permanen sesuai JRA |
| `formula_trace` | `CONFIDENTIAL` | Mengikuti snapshot induk | Sama dengan snapshot terlama | Disposition bersama snapshot; tidak dipisahkan lebih awal |
| `published_rule_calendar` | `CONFIDENTIAL` | Versi retired dan tidak lagi direferensikan | Selama ada snapshot/delivery yang merujuk | Arsip-review/permanen sesuai JRA; tidak hard-delete selama masih direferensikan |
| `import_object` | `RESTRICTED` | Job success, final failure, atau cancel | Hapus segera; object yatim maksimal 7 hari | Hard-delete R2, tanpa backup |
| `import_preview_error` | `CONFIDENTIAL` | Job terminal | 30 hari | Hard-delete; ringkasan aman tetap pada audit |
| `import_summary` | `CONFIDENTIAL` | Tahun/kegiatan import ditutup | 5 tahun sebagai bagian audit | Hapus mengikuti `business_audit` |
| `delivery_recipient_error` | `RESTRICTED` | Delivery terminal | 90 hari | Hapus email/error detail atau ganti HMAC pseudonym |
| `delivery_metadata` | `CONFIDENTIAL` | Tahun anggaran ditutup | 5 tahun | Hapus setelah review; simpan hanya event/status/time/idempotency/rule version |
| `user_identity` | `RESTRICTED` | Akses terakhir dinonaktifkan | 90 hari | Hapus/anonimisasi kecuali legal hold; audit memakai ID pseudonim |
| `application_log` | `CONFIDENTIAL` | Log dibuat | 30 hari | Hard-delete otomatis |
| `security_log` | `RESTRICTED` | Security event dibuat | 90 hari | Hard-delete; incident evidence dapat legal hold |
| `temporary_export` | `RESTRICTED` | Response selesai | Tidak disimpan; fallback maksimal 24 jam | Hard-delete object/file sementara |
| `deletion_tombstone` | `RESTRICTED` | Deletion job selesai | 5 tahun | Hapus; tidak memuat raw ID atau data personal |

### Aturan khusus import R2

Sesuai ADR-006:

- raw object private dihapus ketika job terminal;
- lifecycle R2 menghapus object yatim paling lambat 7 hari setelah upload;
- object import tidak masuk backup;
- retry setelah object terhapus harus meminta upload baru;
- metadata job tidak boleh menyimpan presigned URL;
- deletion failure memicu retry dan alert, bukan memperpanjang retention tanpa batas.

### Aturan snapshot dan dependency

Snapshot, formula trace, rule set, dan calendar version membentuk satu rantai reproduksi. Disposition harus memeriksa foreign key/reference:

- snapshot dapat dihapus hanya setelah retention dan legal hold selesai;
- formula trace mengikuti snapshot terlama yang memakai trace tersebut;
- published rule/calendar tidak boleh dihapus selama masih direferensikan;
- jika JRA menetapkan snapshot/laporan permanen, artefak dipindahkan ke arsip yang disetujui beserta metadata integritas.

### Aturan delivery

Delivery log tidak menyimpan body email, authorization data, atau response provider penuh. Selama 90 hari, aplikasi boleh menyimpan recipient minimum dan error code aman untuk troubleshooting. Setelah itu recipient dihapus/pseudonimkan; metadata event, status, timestamp, idempotency key, organization, serta rule/calendar version dapat bertahan sesuai masa audit 5 tahun.

## Policy dinamis berversi

### Unit konfigurasi

Dynamic retention tidak memakai expression/SQL bebas. Setiap rule hanya memiliki field berikut:

| Field | Aturan |
|---|---|
| `recordClass` | Enum stabil dari katalog record class |
| `classification` | `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, atau `RESTRICTED` |
| `trigger` | Enum seperti `created_at`, `terminal_at`, `fiscal_year_closed_at`, `access_deactivated_at`, atau `reference_released_at` |
| `period` | Durasi ISO-8601 terbatas, misalnya `P30D`, `P90D`, atau `P5Y` |
| `disposition` | `delete`, `anonymize`, `archive_review`, atau `permanent` |
| `legalBasis` | Nomor JRA/peraturan/keputusan dan record series |
| `scope` | `system` atau satu KPPN/organisasi yang disetujui |
| `effectiveFrom` | Waktu mulai versi berlaku |
| `approvedBy` / `approvedAt` | Approver dan waktu persetujuan |

### Lifecycle versi

```text
draft -> published -> retired
```

- `draft` dapat diedit dan hanya menghasilkan preview.
- `published` immutable, memiliki dasar hukum dan approver, serta dipakai resolver sejak `effectiveFrom`.
- `retired` tidak dipakai untuk kandidat baru tetapi tetap tersedia untuk menjelaskan deletion job lama.
- Perubahan selalu membuat versi baru; published policy tidak diedit in-place.
- Hanya satu policy published yang efektif per scope dan instant.

### Resolver

Untuk setiap record:

1. identifikasi `recordClass`, organization/KPPN, dan trigger date;
2. hentikan disposition bila legal hold aktif;
3. resolve JRA/regulatory baseline yang berlaku;
4. pilih policy organization published yang valid dan berada dalam guardrail;
5. fallback ke baseline MVP hanya pada environment yang diizinkan;
6. hitung `eligibleAt` secara deterministik;
7. simpan policy version pada deletion candidate/job.

### Guardrail override

- Durasi tidak boleh lebih pendek dari minimum JRA/peraturan.
- Durasi personal data tidak boleh diperpanjang tanpa tujuan, dasar hukum, dan approver.
- `permanent` hanya boleh dipilih bila JRA menyatakan permanen atau ada keputusan arsip yang sah.
- Perubahan trigger/disposition membutuhkan preview jumlah record dan estimasi tanggal tertua/termuda.
- Shortening tidak berlaku retroaktif sampai dry-run dan approval selesai.
- Policy tidak dapat menghapus record yang masih direferensikan atau terkena legal hold.
- Scope organisasi tidak dapat mengubah rule milik organisasi lain.
- Setiap publish/retire dicatat pada audit log tanpa menyimpan isi data yang terdampak.

## Redaction dan logging

### Data yang boleh dicatat

- request ID dan timestamp;
- route/action name;
- status/error code aman;
- latency dan attempt count;
- organization/KPPN ID yang diperlukan;
- actor key pseudonim;
- policy/rule set version;
- jumlah record, bukan isi record.

### Data yang dilarang masuk log

- token, cookie, authorization header, secret, private key;
- presigned URL R2;
- password atau data MFA;
- body email dan daftar recipient penuh;
- raw row import atau workbook content;
- nominal lengkap dan payload snapshot;
- full before/after JSON tanpa allowlist;
- stack trace yang memuat query parameter/body sensitif.

### Teknik redaction

- email UI/log troubleshooting ditampilkan masked, misalnya `a***@example.go.id`;
- korelasi menggunakan HMAC keyed, bukan hash tanpa secret;
- IP disimpan hanya bila diperlukan untuk security, lalu ditruncate atau HMAC;
- filename disanitasi dan tidak dipakai sebagai storage key;
- structured logger memakai allowlist; field tidak dikenal dibuang;
- jika sanitizer gagal, log event minimum tanpa payload—jangan fallback ke raw object.

Audit before/after menyimpan field bisnis yang diizinkan dan mengganti email/identifier personal dengan actor/entity ID. Kebutuhan forensic yang memerlukan data lebih rinci harus memakai legal hold dan penyimpanan evidence terpisah dengan akses terbatas.

## Legal hold

Legal hold memiliki:

- `holdId`, alasan, dasar/otoritas, scope record, pembuat, waktu mulai;
- tanggal review wajib dan approver;
- status `active` atau `released` serta waktu release;
- audit perubahan tanpa menyalin isi record.

Hold aktif menunda delete/anonymize/archive disposition. Hold tidak membuat user baru dapat membaca data dan tidak boleh berstatus aktif tanpa review date. Setelah release, retention job menghitung ulang eligibility dari trigger asli, bukan dari tanggal release.

## Prosedur penghapusan

### Scheduled retention sweep

1. Resolver membuat candidate berdasarkan policy version dan cutoff time.
2. Dry-run merangkum kelas, scope, jumlah, ukuran, dependency, dan legal hold.
3. Guard memblokir policy belum disetujui, reference aktif, hold, atau klasifikasi ambigu.
4. Job mendapat approval sesuai kewenangan organisasi untuk bulk/destructive disposition.
5. Worker menjalankan batch idempotent: anonymize, hard-delete, R2 delete, atau archive handoff.
6. Worker memverifikasi hasil dan retry kegagalan parsial dengan idempotency key yang sama.
7. Sistem membuat deletion tombstone dan completion report tanpa raw record ID/data personal.
8. Failure final menghasilkan alert dan status `needs_intervention`; candidate tidak dianggap terhapus.

### Permintaan subjek data

1. Verifikasi identitas dan kewenangan pemohon.
2. Inventarisasi lokasi data dan tujuan pemrosesan.
3. Periksa kewajiban JRA, legal hold, sengketa, dan pengecualian yang sah.
4. Setujui, tolak dengan alasan, atau lakukan sebagian sesuai dasar yang berlaku.
5. Eksekusi delete/anonymize dan catat tombstone minimum.
6. Berikan pemberitahuan hasil bila diwajibkan.

### Backup dan restore

Backup adalah salinan teknis, bukan perpanjangan retensi bisnis. Baseline menetapkan data terhapus hilang melalui rotasi backup maksimum 35 hari, kecuali provider/JRA yang disetujui mensyaratkan lain. Backup tetap encrypted dan tidak dipakai untuk query operasional.

Deletion ledger menyimpan HMAC ID dan cutoff minimum. Jika backup dipulihkan, environment hasil restore diisolasi dan deletion ledger diterapkan kembali sebelum aplikasi menerima traffic/user access.

## Kepemilikan dan persetujuan

| Tanggung jawab | Pemilik |
|---|---|
| Mapping record class ke JRA | Pejabat arsip/records owner organisasi |
| Klasifikasi keamanan dan guardrail | Security owner |
| Tujuan pemrosesan data | Product/business owner |
| Publish policy | Approver organisasi yang ditunjuk |
| Eksekusi dan monitoring job | Operations/Database owner |
| Legal hold | Legal/records authority |

MVP tidak perlu membuat role aplikasi baru untuk seluruh pemilik tersebut. Identitas approver dapat direkam sebagai actor dan referensi keputusan sampai workflow governance formal tersedia.

## Pengujian dan bukti kepatuhan

- resolver version/effective date dan scope isolation;
- minimum/maximum guardrail serta penolakan policy tanpa dasar hukum;
- boundary 30/90 hari dan 5 tahun;
- legal hold, release, dan recalculation;
- dependency snapshot-rule-calendar;
- terminal import deletion dan orphan lifecycle 7 hari;
- redaction email/token/presigned URL/import payload;
- idempotent delete dan partial retry;
- restore backup lalu reapply deletion ledger;
- dry-run sama dengan candidate aktual pada cutoff yang sama;
- audit publish, approval, execution, failure, dan completion.

## Checklist penerimaan F0-10

- [x] Retensi audit ditetapkan dan dapat dioverride melalui JRA berversi.
- [x] Retensi snapshot/formula trace dan dependency rule/calendar ditetapkan.
- [x] Retensi raw import, preview/error, serta lifecycle R2 ditetapkan.
- [x] Retensi delivery detail dan metadata ditetapkan.
- [x] Data personal diinventarisasi dan memiliki aturan minimisasi/penghapusan.
- [x] Klasifikasi keamanan dan kontrol minimum ditetapkan.
- [x] Redaction log menggunakan allowlist, masking, dan HMAC.
- [x] Legal hold dan prosedur penghapusan disetujui.
- [x] Dynamic policy memakai versi, approval, legal basis, scope, dan guardrail.
- [x] Backup/restore tidak menghidupkan kembali data terhapus ke production.

## Referensi

- [UU Nomor 27 Tahun 2022 — Pelindungan Data Pribadi](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/crc32/)
- [KMK 768/KM.1/2024 — Jadwal Retensi Arsip Substantif Kementerian Keuangan](https://jdih.kemenkeu.go.id/dok/kmk-768-km-1-2024)
- [KMK 768/KM.1/2024 — Fulltext PDF](https://jdih.kemenkeu.go.id/api/download/7a9e8bae-c722-4593-ac34-a0f8d44fb7e5/KMK%20768%20JADWAL%20RETENSI%20ARSIP%20SUBSTANTIF%20%20KEMENTERIAN%20KEUANGAN.pdf)
- [PP Nomor 71 Tahun 2019 — Penyelenggaraan Sistem dan Transaksi Elektronik](https://www.jdih.kemenkeu.go.id/api/download/fulltext/2019/71TAHUN2019PP.pdf)
- [ADR-004 — Rule Set Resolution](adr/ADR-004-rule-set-resolution.md)
- [ADR-006 — Runtime Dependencies dan Storage Import](adr/ADR-006-runtime-dependencies.md)

