# ADR-003 — Semantik Lead Time dan H-0

**Status:** Accepted for implementation; production use requires regulatory approval  
**Date:** 31 Agustus 2026  
**Decision owner:** Solution Architect  
**Related:** F0-05, [ADR-001 — Batas Hari Kerja, H+17, dan H-0](ADR-001-workday-boundaries.md), [ADR-002 — Versioning Kalender Kerja](ADR-002-workday-versioning.md)

## Context

Dokumen produk awal memiliki dua kontrak yang tidak konsisten:

- validasi `minLeadDays >= 1`; dan
- contoh reminder mandatory pada H-5, H-2, dan H-0.

H-0 juga tidak boleh ditafsirkan sebagai pengiriman pada pukul 00.00. Tanggal
deadline, offset hari, jam pengiriman, timezone, dan tindak lanjut setelah
deadline harus menjadi konsep yang terpisah agar Compliance Guard, scheduler,
preview UI, dan audit menghasilkan keputusan yang sama.

## Decision

Lead time memakai **offset hari non-negatif yang eksplisit**. Kontrak
authoritative menggunakan `allowedLeadDays`, bukan hanya pasangan minimum dan
maksimum.

### 1. Arti `leadDays`

- `leadDays` adalah jumlah hari sebelum tanggal deadline.
- `leadDays=0` berarti **H-0**, yaitu tanggal deadline yang sama.
- `leadDays>0` berarti H-n sesuai `dayType` policy.
- Nilai negatif dilarang. Tindak lanjut setelah deadline dimodelkan sebagai
  event reminder baru dengan deadline/formula sendiri, bukan sebagai H negatif.
- H-0 tidak berarti pukul 00.00. Waktu kirim berasal dari `sendTime` dan
  timezone konfigurasi organisasi.

Tanggal deadline harus dihitung lebih dahulu. Offset tidak boleh mengubah
deadline regulasi.

### 2. Kontrak policy

Kontrak logical `ReminderPolicy` memiliki field berikut:

| Field | Tipe | Aturan |
|---|---|---|
| `allowedLeadDays` | `number[]` | Wajib, integer unik, setiap nilai `>= 0`, terurut naik |
| `requiredLeadDays` | `number[]` | Default `[]`; subset dari `allowedLeadDays`, tidak dapat dihapus Operator |
| `defaultSchedule` | object[] | Setiap entry memiliki `leadDays` yang diizinkan dan `sendTime` terpisah |
| `dayType` | enum | `workday`, `calendar_day`, `event_based`, atau `schedule` |
| `deadlineFormula` | DSL/JSON | Menentukan tanggal deadline/trigger, bukan offset pengiriman |
| `category` | enum | `mandatory`, `recommended`, atau `optional` |

`allowedLeadDays` adalah sumber kebenaran. UI boleh menampilkan rentang
minimum–maksimum yang diturunkan dari array, tetapi nilai turunan tersebut tidak
disimpan sebagai aturan kedua.

Contoh representasi:

```json
{
  "allowedLeadDays": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  "requiredLeadDays": [0],
  "defaultSchedule": [
    { "leadDays": 5, "sendTime": "07:00" },
    { "leadDays": 2, "sendTime": "07:00" },
    { "leadDays": 0, "sendTime": "07:00" }
  ]
}
```

Dengan model ini, aturan lama “H-1 sampai H-16” direpresentasikan sebagai
`[1, 2, ..., 16]`. Jika policy juga mewajibkan H-0, nilai `0` ditambahkan dan
dicantumkan pada `requiredLeadDays`; tidak ada pengecualian tersembunyi pada
validator.

### 3. Bentuk schema database

Pada implementasi F7-05/F0-11, field JSON berikut menjadi bagian dari
`reminder_policies`:

| Kolom logical | Kolom database | Tipe | Keterangan |
|---|---|---|---|
| `allowedLeadDays` | `allowed_lead_days_json` | JSONB array integer | Required dan authoritative |
| `requiredLeadDays` | `required_lead_days_json` | JSONB array integer | Subset yang terkunci |
| `defaultSchedule` | `default_schedule_json` | JSONB array object | Jadwal default dengan `leadDays` dan `sendTime` |

`min_lead_days` dan `max_lead_days` dari ERD awal tidak lagi menjadi schema
canonical. Bila diperlukan selama migrasi, keduanya hanya menjadi compatibility
projection yang dihitung dari `allowed_lead_days_json` dan tidak boleh menjadi
sumber validasi atau penulisan baru.

Pada `org_reminder_configs.schedule_json`, setiap entry menyimpan `leadDays`,
`sendTime`, channel, dan data delivery lain yang diizinkan. Konfigurasi Operator
tidak menyimpan tanggal deadline hasil kalkulasi; tanggal tersebut selalu
diturunkan ulang oleh server dari event, policy, calendar version, dan timezone.

### 4. Perhitungan tanggal

Setelah `deadlineDate` dihasilkan oleh deadline formula:

| `dayType` | `leadDays=n` dihitung sebagai |
|---|---|
| `workday` | `subtractWorkdays(deadlineDate, n)` memakai calendar version pada rule set |
| `calendar_day` | `deadlineDate - n` hari kalender |
| `event_based` | Trigger/event formula menentukan tanggal; `leadDays` tidak boleh diam-diam diterapkan |
| `schedule` | Jadwal eksplisit menentukan waktu; offset relatif hanya valid bila didefinisikan DSL |

Untuk semua tipe, `n=0` mengembalikan `deadlineDate`. Resolver kalender dan
inklusivitasnya mengikuti ADR-001/ADR-002.

`sendTime` adalah waktu lokal dengan format `HH:mm` yang valid pada timezone
organisasi. Urutan konversi wajib:

1. hitung `deadlineDate` sebagai `LocalDate`;
2. hitung `reminderDate` berdasarkan `leadDays` dan `dayType`;
3. gabungkan `reminderDate` dan `sendTime` pada timezone organisasi; lalu
4. konversi instant tersebut ke UTC hanya untuk penyimpanan/scheduler.

Konversi UTC tidak boleh memindahkan tanggal bisnis yang telah dipilih.

### 5. Deadline time dan validasi H-0

Policy yang menyediakan H-0 harus memiliki `deadlineTime` yang jelas pada
timezone organisasi/policy. Delivery valid bila waktu kirim berada pada atau
sebelum `deadlineAt`:

```text
scheduledAt <= combine(deadlineDate, deadlineTime, organizationTimezone)
```

Jika `deadlineTime` belum ditetapkan oleh sumber resmi:

- H-0 boleh ditampilkan sebagai preview/non-mandatory dengan warning;
- policy mandatory tidak boleh dipublish; dan
- scheduler tidak boleh mengirim event mandatory yang tidak memiliki batas waktu
  dapat diaudit.

`sendTime` yang sama dengan `deadlineTime` diperbolehkan. `sendTime` setelah
`deadlineTime` ditolak oleh Compliance Guard, bukan dikoreksi diam-diam.

### 6. Aturan kategori dan konfigurasi Operator

- `mandatory` tidak dapat dinonaktifkan; `enabled` tetap `true`.
- Setiap selected lead day harus ada di `allowedLeadDays`.
- Setiap `requiredLeadDays` harus ada di konfigurasi final dan tidak dapat
  dihapus atau dipindahkan ke tanggal/jam yang melanggar policy.
- Jika H-0 diwajibkan, `0` harus ada di `requiredLeadDays` dan schedule mandatory
  H-0 tidak boleh dihapus.
- `recommended` dan `optional` boleh memilih subset `allowedLeadDays` sesuai
  policy; tidak boleh menambahkan offset sendiri.
- Recipient, channel, escalation, dan custom message tunduk pada guard yang
  sama, tetapi tidak mengubah semantik lead day.
- Preview jadwal selalu server-authoritative dan menampilkan deadline date,
  reminder date, send time, timezone, calendar version bila relevan, serta
  alasan penolakan jika invalid.

### 7. Error contract minimum

Compliance Guard harus menghasilkan error actionable dan stabil, sekurang-
kurangnya:

| Kode | Kondisi |
|---|---|
| `LEAD_DAYS_NEGATIVE` | `leadDays < 0` |
| `LEAD_DAYS_NOT_ALLOWED` | Nilai tidak terdapat pada `allowedLeadDays` |
| `REQUIRED_LEAD_DAY_MISSING` | Required offset hilang dari konfigurasi |
| `DEFAULT_SCHEDULE_INVALID` | Jadwal default memakai offset/format waktu yang tidak valid |
| `H0_DEADLINE_TIME_REQUIRED` | H-0 mandatory belum memiliki `deadlineTime` resmi |
| `DELIVERY_AFTER_DEADLINE` | `scheduledAt > deadlineAt` |
| `NON_RELATIVE_DAY_TYPE_OFFSET` | Offset dipakai pada event/schedule tanpa DSL yang mendefinisikannya |

Error tidak membocorkan payload sensitif dan dapat ditampilkan UI berdasarkan
field/entry yang bermasalah.

## Worked examples

### Example A — H+17 dengan H-5, H-2, H-0

- `deadlineDate`: `2026-02-24`, hasil ADR-001.
- `dayType`: `workday`.
- `allowedLeadDays`: `[0, 1, 2, 3, 4, 5, ..., 16]`.
- `requiredLeadDays`: `[0]`.
- Default: H-5 pada `2026-02-17`, H-2 pada `2026-02-20`, H-0 pada
  `2026-02-24`, masing-masing pukul 07.00 WIB.

H-0 jatuh pada tanggal deadline dan bukan pada `2026-02-23` atau pukul 00.00.

### Example B — invalid offset

`leadDays=-1` ditolak dengan `LEAD_DAYS_NEGATIVE`. Kebutuhan mengingatkan satu
hari setelah deadline dibuat sebagai event `post_deadline_follow_up` dengan
formula terpisah.

### Example C — deadline time terlambat

Jika `deadlineAt=2026-02-24 16:00 Asia/Jakarta`, konfigurasi H-0 pada 17.00
ditolak dengan `DELIVERY_AFTER_DEADLINE`. Sistem tidak memindahkannya otomatis
ke 16.00 karena itu mengubah keputusan yang disetujui operator.

## Rejected alternatives

### Hanya mengubah batas minimum menjadi nol

Ditolak karena `min=0, max=16` tidak dapat menyatakan offset mana yang wajib,
tidak mendukung rentang berlubang, dan membuat H-0 mandatory bergantung pada
default JSON yang mudah terlewat validator.

### Menyimpan signed lead day

Ditolak karena angka negatif mencampur reminder pra-deadline dan tindak lanjut
pasca-deadline dalam satu konsep. Event terpisah lebih mudah diaudit.

### Menggunakan durasi timestamp langsung

Ditolak karena tidak menangani weekend, holiday override, LocalDate, dan
timezone organisasi sesuai ADR-001.

### Mempertahankan min/max sebagai dua sumber kebenaran

Ditolak karena array allowed dan rentang min/max dapat tidak sinkron. Min/max
boleh dihitung untuk tampilan atau kompatibilitas migrasi saja.

## Consequences

### Positif

- H-0 memiliki arti deterministik dan dapat diaudit.
- Policy dapat menyatakan offset wajib dan offset yang diizinkan secara eksplisit.
- Scheduler, preview, dan Compliance Guard memakai kontrak yang sama.
- Follow-up pasca-deadline tidak tertukar dengan reminder sebelum deadline.

### Negatif

- Schema memakai JSONB array dan validasi subset tambahan.
- Migrasi dari min/max harus membuat daftar integer dan memeriksa default lama.
- Setiap perubahan `deadlineTime` atau allowed offset memerlukan policy versioning.

## Migration and follow-up

1. Baca `min_lead_days` dan `max_lead_days` legacy sebagai rentang inklusif hanya
   jika keduanya valid.
2. Bentuk `allowed_lead_days_json` dari rentang tersebut.
3. Ambil `requiredLeadDays` dari sumber policy/default schedule yang dapat
   dibuktikan; jangan menyimpulkan H-0 hanya karena policy berkategori mandatory.
4. Validasi ulang semua `default_schedule_json`, timezone, dan deadline time.
5. Tandai konfigurasi yang tidak dapat dipetakan sebagai migration error dan
   jangan mempublish-nya.
6. Setelah kontrak baru aktif, hapus ketergantungan write pada min/max; projection
   lama boleh dipertahankan sementara untuk read compatibility.

F0-04 mengunci calendar version yang digunakan oleh policy workday. F0-06
mengunci rule set resolver. F7-05/F0-11 menerapkan schema/DTO, F10-04
menerapkan Compliance Guard, dan F10-05/F10-08 menerapkan scheduler/idempotency.

## Definition of Done F0-05

- [x] Konflik `minLeadDays >= 1` dengan H-0 diselesaikan.
- [x] `leadDays=0` ditetapkan sebagai H-0 pada tanggal deadline.
- [x] Nilai negatif dan follow-up pasca-deadline dipisahkan.
- [x] `allowedLeadDays`, `requiredLeadDays`, dan schema JSONB dijelaskan.
- [x] `sendTime`, timezone, `deadlineTime`, dan validasi delivery dijelaskan.
- [x] Error contract, migration, dan contoh boundary ditetapkan.
