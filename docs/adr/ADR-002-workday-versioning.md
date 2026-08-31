# ADR-002 — Versioning Kalender Kerja

**Status:** Accepted for implementation; production use requires regulatory approval  
**Date:** 31 Agustus 2026  
**Decision owner:** Solution Architect  
**Related:** F0-04, [ADR-001 — Batas Hari Kerja, H+17, dan H-0](ADR-001-workday-boundaries.md)

## Context

ADR-001 menetapkan bahwa kalkulasi memakai `LocalDate`, timezone organisasi, dan
override hari kerja yang dapat mengubah default Senin–Jumat. ERD awal hanya
memiliki tabel `workdays` dengan unique key `(year, date)`. Dengan model itu,
perubahan kalender pada tahun yang sama dapat mengubah hasil deadline pada
histori, snapshot, atau jadwal yang sudah dibuat.

Produk juga membutuhkan dua hal yang berbeda:

1. beberapa rule set dapat memakai kalender yang sama; dan
2. koreksi kalender harus dapat diterapkan untuk perhitungan mendatang tanpa
   mengubah hasil yang sudah disimpan.

## Decision

Kalender kerja dimodelkan sebagai **calendar version terpisah yang immutable**.
Calendar version direferensikan oleh `rule_set` saat rule set dipublish, dan
direferensikan langsung oleh `score_snapshot` saat hasil historis disimpan.

Kalender tidak ditanam sebagai salinan JSON di dalam rule set dan tidak ada
satu kalender mutable yang selalu aktif untuk setiap tahun.

### 1. Identitas dan cakupan

- Identitas logis calendar version adalah `(year, version)`; contohnya
  `2026.1` dan `2026.2`.
- Nomor versi bersifat monoton dalam satu tahun dan tidak boleh digunakan ulang
  setelah publish. Namespace versi kalender terpisah dari namespace versi rule
  set, walaupun keduanya boleh kebetulan memiliki label yang sama.
- Untuk MVP, calendar version bersifat global per tahun, konsisten dengan ERD
  saat ini yang memodelkan `rule_sets` dan `workdays` tanpa `kppn_scope_id`.
  Ownership Admin KPPN, audit, dan pembatasan akses tetap wajib diterapkan pada
  workflow. Kalender per-scope memerlukan keputusan arsitektur baru sebelum
  diimplementasikan.
- Tahun calendar version harus sama dengan tahun setiap `date` di dalamnya dan
  sama dengan tahun rule set yang mereferensikannya.
- Timezone bukan bagian dari identitas calendar version. Tanggal kalender
  bersifat lokal; timezone berasal dari organisasi/konteks kalkulasi sesuai
  ADR-001 dan dicatat pada formula trace atau hasil yang relevan.

### 2. Bentuk data logical

Implementasi database pada F7-05 harus menerjemahkan model berikut.

#### `calendar_versions`

| Kolom | Tipe | Aturan |
|---|---|---|
| `id` | UUID | PK; tidak berubah |
| `year` | integer | Tahun kalender |
| `version` | text | Wajib; unique bersama `year`, tidak dipakai ulang |
| `status` | enum | `draft`, `published`, atau `retired` |
| `source` | text | Sumber kalender dan/atau dokumen penetapan |
| `change_notes` | text | Alasan pembuatan atau koreksi versi |
| `created_by` | UUID | FK ke `users.id` |
| `published_at` | timestamptz | Nullable sampai publish |
| `retired_at` | timestamptz | Nullable sampai retire |
| `created_at` | timestamptz | Metadata |
| `updated_at` | timestamptz | Metadata; tidak mengubah isi versi published |

`status=retired` hanya menghentikan penggunaan baru. Calendar version yang
telah direferensikan histori tetap dapat dibaca untuk audit dan kalkulasi ulang
historis. Record published atau retired tidak boleh dihapus.

#### `workdays`

`workdays` menjadi child dari `calendar_versions`:

| Kolom | Tipe | Aturan |
|---|---|---|
| `id` | UUID | PK |
| `calendar_version_id` | UUID | FK ke `calendar_versions.id`, `ON DELETE RESTRICT` |
| `date` | date | Harus berada pada `year` calendar version |
| `is_workday` | boolean | Nilai override eksplisit |
| `description` | text | Keterangan libur, cuti, atau hari kerja pengganti |
| `created_by` | UUID | FK ke `users.id` |
| `created_at` | timestamptz | Metadata |
| `updated_at` | timestamptz | Metadata |

Unique key menjadi `(calendar_version_id, date)`.

Satu row `workdays` menyatakan override eksplisit. Tidak adanya row berarti
resolver mengikuti default ADR-001: Senin–Jumat adalah hari kerja dan
Sabtu–Minggu bukan hari kerja. Model ini mendukung weekday holiday dan weekend
workday tanpa mengandalkan arti terbalik dari `is_holiday`.

Karena itu, implementasi schema harus mengganti atau memetakan kolom awal
`is_holiday` ke `is_workday`; jangan menganggap setiap row dengan
`is_holiday=false` sebagai hari kerja sebelum memastikan apakah data lama
berisi seluruh tanggal atau hanya override.

#### `rule_sets`

Tambahkan `calendar_version_id` sebagai FK ke `calendar_versions.id`.

- Draft boleh belum memiliki binding ketika policy belum lengkap.
- Rule set published wajib memiliki binding ke calendar version published yang
  tahunnya sama.
- Binding tidak dapat diubah setelah rule set published.
- Perubahan kalender yang akan memengaruhi rule set dibuat sebagai rule set
  version baru yang menunjuk calendar version baru. Rule set lama tetap dapat
  digunakan untuk tanggal efektif dan histori yang menjadi tanggung jawabnya.

Validasi kesamaan tahun membutuhkan kombinasi constraint/schema dan validasi
server dalam transaksi; FK biasa saja tidak cukup untuk memeriksa nilai `year`
di dua tabel.

#### `score_snapshots`

Tambahkan `calendar_version_id` sebagai FK non-null untuk snapshot yang dibuat
dari rule set published. `rule_set_id` dan `rule_set_version` yang sudah ada
tetap dipertahankan.

Snapshot juga harus menyimpan `calendarVersionId`, `calendarVersion`, dan
timezone kalkulasi di `breakdown_json` atau formula trace yang terstruktur agar
detail dapat ditampilkan tanpa kehilangan konteks. Nilai tersebut adalah
jejak tampilan; sumber identitas relasional tetap `calendar_version_id`.

Aturan penulisan snapshot:

- pasangan `rule_set_id`–`calendar_version_id` harus sama dengan binding rule
  set saat snapshot dibuat;
- `input_hash` mencakup identitas rule set dan calendar version yang dipakai;
- snapshot bersifat immutable secara bisnis;
- `ON DELETE RESTRICT` mencegah calendar version yang digunakan snapshot
  dihapus; dan
- preview dari draft boleh dihitung untuk UI, tetapi tidak boleh disimpan
  sebagai snapshot historis sebelum konteks versi yang immutable tersedia.

#### `notification_deliveries`

Delivery berbasis `workday` harus menyimpan `calendar_version_id` sebagai
referensi konteks jadwal, selain `rule_set_version` yang sudah ada. Untuk
delivery non-workday, kolom dapat nullable. Nilai ini membuat pemeriksaan dan
re-evaluasi jadwal dapat menampilkan kalender yang dipakai tanpa menebak dari
payload email.

## Lifecycle

### Membuat dan menerbitkan kalender

1. Admin membuat `calendar_versions` berstatus `draft` dengan `year`, version,
   source, dan change notes.
2. Admin memasukkan override tanggal secara manual atau melalui import.
3. Server memvalidasi version unik, tanggal valid dalam tahun tersebut,
   duplicate bebas, `is_workday` eksplisit, dan source tersedia sebelum
   publish.
4. Publish mengunci metadata isi dan seluruh row `workdays`. Hanya status
   `published` lalu `retired` yang boleh berubah.
5. Rule set baru mengikat calendar version published dalam transaksi publish
   rule set. Calendar version published yang belum dipakai tetap aman dan tidak
   menjadi kalender aktif secara implisit.

Tidak ada konsep “mengganti isi kalender 2026 yang aktif”. Yang ada adalah
membuat calendar version baru dan mengatur kapan rule set yang menggunakannya
mulai berlaku. Resolver rentang tanggal dan aturan overlap diselesaikan pada
F0-06.

### Koreksi kalender

Contoh perubahan hari Sabtu `2026-02-07` menjadi hari kerja:

| Artefak | Sebelum | Sesudah |
|---|---|---|
| Calendar version | `2026.1`, tanpa override `2026-02-07` | `2026.2`, override `2026-02-07 = true` |
| Rule set | `2026.1` → calendar `2026.1` | Rule set baru → calendar `2026.2` |
| Snapshot lama | Tetap menunjuk `2026.1` | Tidak diubah |
| Perhitungan baru | Mengikuti resolver rule set lama bila tanggal efektifnya masih berlaku | Mengikuti `2026.2` setelah rule set baru efektif |

Rule set version baru diperlukan walaupun perubahan hanya pada kalender, karena
calendar adalah bagian dari konteks normatif yang menentukan hasil deadline.
`effective_from`, rollback, dan pemilihan versi yang berlaku ditentukan oleh
ADR-004/F0-06.

### Dampak ke reminder yang belum terkirim

Publish rule set baru memicu re-evaluasi delivery yang masih `scheduled` dan
belum dikirim. Re-evaluasi harus:

- memakai pasangan rule set–calendar baru secara atomik;
- menghitung ulang tanggal dan waktu dari `LocalDate` serta timezone yang
  ditetapkan ADR-001;
- mempertahankan audit before/after dan identitas calendar version lama; dan
- tidak mengubah snapshot, delivery yang sudah `sent`, atau histori audit.

Detail status replacement, idempotency key, dan retry dikerjakan pada F10-05,
F10-08, dan F10-09. Tidak boleh ada pengiriman ganda akibat re-evaluasi.

## ERD impact summary

| Area | Perubahan wajib | Alasan |
|---|---|---|
| Calendar | Tambah `calendar_versions`; `workdays` FK ke version dan unique `(calendar_version_id, date)` | Setiap isi kalender memiliki identitas dan histori sendiri |
| Calendar state | `is_holiday` diganti/dinormalisasi menjadi `is_workday` override | Mendukung weekend workday dan default tanpa row |
| Rule set | Tambah `rule_sets.calendar_version_id`; published wajib terikat | Policy dan kalender yang menghasilkan deadline harus satu konteks immutable |
| Snapshot | Tambah `score_snapshots.calendar_version_id`; pertahankan rule set ID/version | Histori dapat ditelusuri langsung dan tidak bergantung pada resolver saat ini |
| Delivery | Tambah `calendar_version_id` untuk policy `workday` | Jadwal dan re-evaluasi dapat diaudit dengan konteks kalendernya |
| Fiscal year | Tidak menambah active calendar terpisah | Kalender aktif diturunkan dari `active_rule_set_id` agar tidak ada dua sumber kebenaran |
| Delete policy | FK historis `RESTRICT`; tidak ada cascade delete untuk version yang direferensikan | Mencegah histori menjadi tidak dapat direproduksi |

## Migration strategy

Migrasi schema pada F7-05 harus dilakukan bertahap dan tidak menghapus data
lama:

1. Buat tabel `calendar_versions`.
2. Untuk setiap kalender legacy yang memang berbeda, buat calendar version
   baseline yang tidak memakai ulang label versi published yang sudah pernah
   digunakan.
3. Salin hanya override yang dapat dibuktikan dari data lama ke `workdays` dan
   ubah maknanya menjadi `is_workday`. Data yang ambigu antara “row default” dan
   “override” harus masuk laporan migrasi untuk dikonfirmasi, bukan ditebak.
4. Bind rule set existing ke baseline calendar version yang tepat dan validasi
   kesamaan tahun.
5. Backfill `score_snapshots.calendar_version_id` melalui binding rule set.
   Snapshot yang tidak dapat dipetakan harus ditandai sebagai migration error
   dan menghentikan cutover; jangan mengarang calendar version.
6. Setelah audit dan verifikasi hasil lulus, aktifkan constraint non-null,
   immutability, dan `ON DELETE RESTRICT` sesuai lifecycle di atas.

Migrasi tidak boleh menulis ulang hasil snapshot atau menghitung ulang deadline
historis hanya karena kolom referensi baru ditambahkan.

## Rejected alternatives

### Kalender ditanam langsung di setiap rule set

Ditolak karena menduplikasi row kalender ketika beberapa rule set memakai hari
kerja yang sama. Model ini juga membuat kalender tidak dapat dikelola sebagai
artefak yang dapat dipakai ulang dan memperbesar migration/publish diff.

### Satu kalender mutable per tahun

Ditolak karena update pada `2026` dapat menggeser deadline lama dan membuat
snapshot tidak lagi merepresentasikan input yang saat itu dipakai.

### Menyalin kalender hanya ke `breakdown_json` snapshot

Ditolak karena tidak menyediakan FK, constraint tahun, atau jejak delivery yang
dapat divalidasi secara konsisten. Formula trace tetap berguna sebagai detail
tampilan, tetapi bukan sumber identitas.

## Consequences

### Positif

- Snapshot dan deadline historis tetap reproduktif.
- Satu kalender dapat dipakai ulang oleh beberapa rule set.
- Perubahan kalender menjadi operasi versioned yang mudah diaudit.
- Resolver tidak perlu memilih kalender global mutable terpisah dari rule set.

### Negatif

- Schema memiliki satu tabel dan beberapa FK tambahan.
- Perubahan satu hari memerlukan calendar version dan rule set version baru.
- Publish workflow harus memvalidasi pasangan tahun, status, dan binding.
- Migrasi data legacy membutuhkan konfirmasi bila arti `is_holiday=false`
  tidak dapat dibuktikan.

## Follow-up dan batas keputusan

- **F0-05:** Semantik `leadDays=0`, mandatory H-0, dan validasi waktu kirim.
- **F0-06:** Effective range, overlap, active rule set, rollback, dan resolver.
- **F7-05:** Schema Drizzle, constraint, index, migration, dan immutability DB.
- **F10-05/F10-09:** Re-evaluasi delivery pending dan publish transaction.
- **F4-10/F4-11:** UI kalender, version, diff, dan dampak jadwal.
- **F13-01/F13-03:** Test boundary, snapshot immutability, dan re-evaluasi.

ADR ini tidak menetapkan kalender resmi 2026 atau menyatakan parameter regulasi
yang masih `needs_verification` sebagai final. Persetujuan produksi tetap
mengikuti [status verifikasi parameter 2026](../regulatory-verification-2026.md)
dan checklist go-live.

## Definition of Done F0-04

- [x] Memilih calendar version terpisah dan immutable.
- [x] Menjelaskan struktur `calendar_versions` dan child `workdays`.
- [x] Menjelaskan binding `rule_sets` dan aturan publish/retire.
- [x] Menjelaskan dampak langsung pada `score_snapshots`.
- [x] Menjelaskan dampak delivery, migrasi, delete policy, dan follow-up.
- [x] Menyediakan contoh koreksi kalender tanpa mengubah histori.
