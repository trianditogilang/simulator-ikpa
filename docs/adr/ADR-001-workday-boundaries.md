# ADR-001 — Batas Hari Kerja, H+17, dan H-0

**Status:** Accepted for implementation; production use requires regulatory approval  
**Date:** 31 Agustus 2026  
**Decision owner:** Product & IKPA Analyst  
**Related:** F0-03, [Status Verifikasi Parameter IKPA 2026](../regulatory-verification-2026.md)

## Context

PER-5/PB/2024 menetapkan penyampaian SPM-LS kontraktual tepat waktu paling lambat 17 hari kerja dari tanggal BAST/BAPP. Spesifikasi produk juga memakai H-n/H-0 untuk reminder. Dokumen sumber yang diperiksa belum menjelaskan konvensi teknis aplikasi untuk inklusivitas tanggal awal, timestamp, dan override weekend.

Tanpa satu konvensi, engine, UI, scheduler, dan golden test dapat menghasilkan tanggal berbeda.

## Decision

### 1. Tipe tanggal

- Tanggal bisnis direpresentasikan sebagai `LocalDate` berformat `YYYY-MM-DD`, bukan JavaScript `Date` pada tengah malam.
- Setiap perhitungan membawa IANA timezone organisasi; default `Asia/Jakarta`.
- Deadline regulasi disimpan sebagai tanggal lokal. Waktu pengiriman notifikasi disimpan terpisah, lalu dikonversi ke UTC untuk `scheduled_at`.
- Konversi UTC tidak boleh mengubah tanggal bisnis yang sudah dihitung.

### 2. Resolusi hari kerja

Untuk sebuah tanggal lokal, urutan resolusinya:

1. Jika calendar version aktif memiliki override eksplisit `isWorkday`, gunakan nilai tersebut.
2. Jika tidak ada override, Senin–Jumat adalah hari kerja.
3. Jika tidak ada override, Sabtu–Minggu bukan hari kerja.

Konsekuensinya:

- Hari libur/cuti bersama pada weekday dicatat `isWorkday=false`.
- Hari kerja pengganti pada weekend dicatat `isWorkday=true`.
- Deskripsi tanggal hanya metadata; tidak menentukan status.
- Perhitungan produksi dilarang memakai kalender draft atau kalender tanpa versi yang disetujui.

Schema/versioning kalender diputuskan terpisah pada F0-04.

### 3. H+17 Penyelesaian Tagihan

H+17 menggunakan interval **start-exclusive, end-inclusive**:

- Tanggal BAST/BAPP adalah hari ke-0 dan tidak dihitung.
- Hari kerja eligible berikutnya adalah hari ke-1.
- Deadline adalah hari kerja eligible ke-17 setelah tanggal BAST/BAPP.
- Jika BAST/BAPP jatuh pada weekend/libur, tanggal itu tetap hari ke-0; pencarian hari ke-1 maju ke hari kerja berikutnya.
- Deadline selalu jatuh pada hari yang di-resolve sebagai hari kerja.

Kontrak fungsi:

```ts
addWorkdays(bastBappDate, 17, { start: 'exclusive' })
```

Untuk audit, formula trace minimum:

```text
start=2026-01-30; mode=exclusive_start; workdays=17;
calendarVersion=2026.x; deadline=2026-02-24
```

### 4. Penghitungan interval

`countWorkdays(start, end)` untuk ketepatan tagihan memakai aturan yang sama:

- `start` tidak dihitung;
- `end` dihitung bila merupakan hari kerja;
- tepat waktu jika hasil `<= maximumWorkdays`;
- tanggal penerimaan sebelum BAST/BAPP adalah input invalid, bukan nilai negatif.

Kontrak fungsi:

```ts
countWorkdays(start, end, {
  includeStart: false,
  includeEnd: true,
})
```

### 5. H-n dan H-0 reminder

- `H-0` adalah tanggal deadline yang sama, bukan hari setelah deadline dan bukan otomatis pukul 00.00.
- Untuk event `workday`, H-n dihitung dengan `subtractWorkdays(deadline, n)`.
- Untuk event `calendar_day`, H-n dihitung dengan pengurangan hari kalender.
- Untuk event `schedule` dan `event_based`, formula event menentukan tanggal; tidak boleh diam-diam memakai kalkulator workday.
- `sendTime` wajib terpisah dari `leadDays`.
- Delivery H-0 harus dijadwalkan pada atau sebelum `deadlineTime` policy.
- Jika `deadlineTime` resmi belum ditetapkan, H-0 boleh ditampilkan sebagai preview tetapi tidak boleh dipublish sebagai reminder mandatory.
- Tindak lanjut setelah deadline adalah event lain; tidak boleh direpresentasikan sebagai H negatif.

Semantik `leadDays=0` dan validasi policy diselesaikan pada F0-05.

## Worked Examples

Contoh berikut memakai kalender sintetis untuk menguji boundary; contoh bukan kalender libur resmi 2026.

### Example A — lintas bulan tanpa libur

Input:

- BAST/BAPP: Jumat, `2026-01-30`.
- Sabtu/Minggu non-kerja.
- Tidak ada libur weekday.

Hasil:

| Urutan | Tanggal |
|---:|---|
| Hari ke-1 | Senin, `2026-02-02` |
| Hari ke-5 | Jumat, `2026-02-06` |
| Hari ke-10 | Jumat, `2026-02-13` |
| Hari ke-15 | Jumat, `2026-02-20` |
| Hari ke-17/deadline | Selasa, `2026-02-24` |

Reminder workday terhadap deadline tersebut:

| Lead | Tanggal |
|---:|---|
| H-5 | Selasa, `2026-02-17` |
| H-2 | Jumat, `2026-02-20` |
| H-0 | Selasa, `2026-02-24` |

### Example B — libur weekday

Dengan input Example A, bila `2026-02-17` ditandai `isWorkday=false`, hari itu dilewati dan deadline bergeser menjadi `2026-02-25`.

### Example C — weekend menjadi hari kerja

Dengan input Example A, bila Sabtu `2026-02-07` ditandai `isWorkday=true`, tanggal tersebut ikut dihitung dan deadline bergeser satu hari kerja lebih awal menjadi `2026-02-23`.

### Example D — BAST/BAPP pada hari libur

Jika BAST/BAPP adalah Minggu `2026-02-01`, tanggal tersebut tetap hari ke-0. Dengan kalender tanpa libur tambahan, Senin `2026-02-02` adalah hari ke-1.

### Example E — batas ketepatan

- `receivedDate` sama dengan deadline: tepat waktu.
- `receivedDate` pada hari kerja berikutnya: terlambat.
- `receivedDate` kosong: belum selesai; tidak dihitung sebagai tepat waktu.

## Rejected Alternatives

### Menghitung BAST/BAPP sebagai hari ke-1

Ditolak karena menghasilkan deadline satu hari lebih awal dan tidak sesuai konvensi `addWorkdays(start, 17)` yang paling mudah diaudit. Jika approver regulasi menetapkan sebaliknya, perubahan harus dibuat sebagai opsi calculator berversi dan golden test baru.

### Menggunakan timestamp UTC untuk seluruh formula

Ditolak karena konversi timezone dapat menggeser tanggal bisnis dan membuat hasil berbeda antara server, browser, dan scheduler.

### Menganggap semua Senin–Jumat selalu hari kerja

Ditolak karena tidak mendukung hari libur/cuti bersama dan hari kerja pengganti.

## Consequences

- Engine dan deadline calculator harus menerima calendar version serta timezone eksplisit.
- Snapshot/delivery harus menyimpan rule set version; versi kalender harus dapat ditelusuri melalui rule set atau referensi langsung.
- UI menampilkan tanggal deadline absolut, jenis hari, timezone, dan formula trace.
- Test wajib mencakup lintas bulan/tahun, leap day, weekday holiday, weekend override, start pada libur, dan exact deadline.
- Konvensi ini berstatus asumsi aplikasi sampai Admin KPPN/approver menandatangani approval produksi.

## Production Acceptance

- [ ] Approver menyetujui `exclusive_start` untuk H+17.
- [ ] Calendar version 2026 disetujui.
- [ ] `deadlineTime` event mandatory ditetapkan.
- [ ] Golden test tanggal lintas bulan/tahun lulus.
- [ ] Formula trace mencantumkan mode hitung dan calendar version.
