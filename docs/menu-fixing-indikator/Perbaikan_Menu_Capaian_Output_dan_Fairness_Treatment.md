# Spesifikasi Perbaikan — Menu Capaian Output & Fairness Treatment

**Tujuan dokumen:** Instruksi implementasi mandiri untuk AI agent/developer. Dokumen ini memuat perilaku bisnis, formula, UX Operator, halaman Admin Policy, model data, API, migrasi, pengujian, dan kriteria penerimaan. Implementasi tidak boleh mengandalkan asumsi atau merujuk ke dokumen lain.

**Prioritas:** P0 / memblokir go-live perhitungan Capaian Output.

---

## 1. Ringkasan masalah dan target

Menu Capaian Output saat ini telah menyimpan `RVRO`, `volumeDipa`, `PCRO`, `TPCRO`, `confirmed`, dan `reportedAt`, tetapi perhitungan belum merepresentasikan proses bisnis yang diperlukan:

1. `reportedAt` tidak diinput/diisi sehingga nilai ketepatan waktu menjadi 100 secara tidak sah.
2. Status `confirmed` tidak menjadi syarat nilai Capaian RO.
3. `PCRO` dan `TPCRO` hanya ditampilkan/disimpan, tetapi tidak digunakan pada Formula 1.
4. Engine memakai `RVRO / volumeDipa` untuk periode normal, padahal Formula 1 harus `PCRO / TPCRO` bila PCRO belum 100%.
5. Desember diberi nilai 100 otomatis; seharusnya memakai Formula 2, bukan nilai otomatis.
6. Jika `PCRO = 0%` dan `TPCRO = 0%`, engine tidak boleh skip atau menghasilkan nilai 100; nilai Capaian RO wajib 0.
7. Deadline dihitung dengan beberapa cara berbeda. Harus ada satu kalkulator deadline kanonis berdasarkan 5 hari kerja pada bulan berikutnya.
8. Belum ada mekanisme fairness treatment untuk RO Khusus. Contoh: `FAN.ZZ1` tidak menjadi objek penilaian Capaian Output sehingga tidak boleh masuk pembilang atau penyebut nilai komponen.

**Target hasil:** Operator dapat menginput dan memahami status tiap RO; Admin dapat mengelola pengecualian fairness secara aman; engine menghasilkan trace per RO yang dapat diaudit; dashboard, laporan, dan snapshot menggunakan aturan yang sama.

---

## 2. Ketentuan bisnis yang harus diimplementasikan

### 2.1 Bobot indikator

- Bobot indikator Capaian Output terhadap nilai IKPA: **25%**.
- Nilai indikator Capaian Output terdiri dari:
  - Nilai Kinerja Komponen Ketepatan Waktu (NKKW): **30%**.
  - Nilai Kinerja Komponen Capaian RO (NKCRO): **70%**.
- Rumus nilai indikator sebelum bobot IKPA:

\[
IKPA\text{-}CO = (NKKW \times 30\%) + (NKCRO \times 70\%)
\]

- Kontribusi terhadap IKPA total:

\[
Kontribusi\ IKPA = IKPA\text{-}CO \times 25\%
\]

- Nilai dapat ditampilkan pada skala 0–100. Kontribusi berbobot adalah skala 0–25.

### 2.2 Ketepatan waktu pelaporan

- Deadline laporan untuk periode bulan `M` adalah **hari kerja ke-5 pada bulan `M+1`**.
- Hari Sabtu, Minggu, hari libur nasional, dan cuti bersama yang tercatat pada kalender kerja aktif tidak dihitung sebagai hari kerja.
- Pelaporan tepat waktu bila `reportedAt` berada pada atau sebelum deadline.
- Tepat waktu = 100; terlambat = 0.
- `reportedAt` wajib tersedia untuk RO yang akan dinilai. Nilai tidak boleh diisi dengan tanggal fallback agar terlihat tepat waktu.
- Tanggal/waktu harus disimpan dalam timezone satker atau `Asia/Jakarta`, lalu tanggal lokal dipakai untuk evaluasi deadline.
- Bila data belum dilaporkan/`reportedAt` kosong, status UI adalah `Belum dilaporkan`; skor tidak boleh diasumsikan 100.

### 2.3 Nilai Capaian RO per RO

Sebelum menghitung formula, lakukan evaluasi pengecualian fairness dan status konfirmasi.

1. Bila RO **dikecualikan** oleh fairness treatment yang aktif, RO tidak ikut objek penilaian.
2. Bila RO tidak dikecualikan dan laporan **tidak terkonfirmasi**, nilai Kinerja Komponen Capaian RO untuk RO tersebut = 0.
3. Bila laporan telah terkonfirmasi:
   - Jika periode adalah Desember: gunakan **Formula 2**.
   - Jika periode Januari–November dan `PCRO = 100%`: gunakan **Formula 2**.
   - Jika periode Januari–November dan `PCRO != 100%`: gunakan **Formula 1**.
4. Aturan khusus: bila `PCRO kumulatif = 0%`, nilai Capaian RO = 0, termasuk ketika `TPCRO = 0%`. Jangan membagi 0/0 dan jangan skip RO tersebut.

**Formula 1 — periode Januari–November saat PCRO belum 100%**

\[
Nilai\ Capaian\ RO_i = \frac{PCRO_i}{TPCRO_i} \times 100
\]

`TPCRO` berasal dari target capaian RO yang dilaporkan satker pada Modul Target Kinerja.

**Formula 2 — periode Desember atau PCRO 100%**

\[
Nilai\ Capaian\ RO_i = \frac{RVRO_i}{Volume\ RO\ pada\ DIPA_i} \times 100
\]

Ketentuan validasi Formula 2:

- `volumeDipa` harus lebih dari 0 untuk RO yang dinilai.
- `rvro` harus lebih besar atau sama dengan 0.
- Terapkan batas nilai maksimal 100 hanya bila parameter rule set menyatakannya. Default implementasi sementara: `min(rasio × 100, 100)`.
- Jangan memberi nilai 100 otomatis pada Desember.

Ketentuan validasi Formula 1:

- `PCRO` dan `TPCRO` berada pada rentang 0–100.
- Bila `PCRO = 0`, hasil wajib 0.
- Bila `PCRO > 0` dan `TPCRO = 0`, jangan menghitung pembagian tak terdefinisi. Tandai `invalid_target`, keluarkan dari hasil final, dan tampilkan error blocking agar operator/admin memperbaiki target. Perilaku ini harus bisa dikonfigurasi rule set apabila kemudian ada ketentuan resmi lain.

### 2.4 Agregasi per periode

- Populasi penilaian adalah RO untuk tahun dan periode yang dipilih yang memenuhi `assessmentStatus = included`.
- Jangan mengagregasi semua bulan dalam satu tahun fiskal ketika pengguna memilih satu periode bulanan.
- Satu RO dihitung satu kali pada periode yang sedang dinilai.
- Rata-rata nilai Capaian RO dihitung dari seluruh RO `included` pada periode tersebut; RO bernilai 0 karena tidak terkonfirmasi atau PCRO 0 tetap masuk penyebut.

\[
NKCRO = \frac{\sum Nilai\ Capaian\ RO_i}{Jumlah\ RO\ included}
\]

- Ketepatan waktu dirata-ratakan atas RO `included` yang wajib melapor pada periode tersebut.

\[
NKKW = \frac{\sum Nilai\ Ketepatan\ Waktu_i}{Jumlah\ RO\ included\ yang\ wajib\ lapor}
\]

- Jika tidak ada RO included, status hasil harus `incomplete`/`not_applicable`; jangan menampilkan 100 dan jangan menjadikannya nilai final tanpa kebijakan eksplisit.
- Pembulatan: simpan presisi minimal 4 desimal; tampilkan dan gunakan nilai akhir dua desimal dengan `round half up`. Semua layer memakai utilitas pembulatan yang sama.

### 2.5 Scope gate konfirmasi

Gate `confirmed` wajib diterapkan pada **Nilai Capaian RO/NKCRO**, karena flow bisnis penentuan Formula 1/2 menyatakan laporan tidak terkonfirmasi bernilai 0. Ketepatan waktu tetap berasal dari `reportedAt` dibanding deadline.

Tambahkan parameter rule set `unconfirmedTimelinessTreatment` dengan default `evaluate_by_reported_at`; jangan diam-diam menjadikan nilai ketepatan waktu 0 karena belum ada ketentuan eksplisit dalam flow Formula Capaian RO bahwa gate tersebut juga berlaku untuk NKKW. UI harus menerangkan treatment yang aktif.

---

## 3. Fairness treatment RO Khusus

### 3.1 Prinsip

Fairness treatment adalah kebijakan pengecualian objek penilaian, bukan manipulasi nilai RO.

Contoh kebijakan tahun 2026:

- RO Khusus `FAN.ZZ1` tidak menjadi objek penilaian Indikator Capaian Output.
- Alokasi RO Khusus tidak menjadi objek penilaian Indikator Penyerapan Anggaran.

Untuk Capaian Output, RO Khusus harus tetap dicatat sebagai data, tetapi **tidak masuk pembilang dan penyebut** NKKW maupun NKCRO, tidak mempengaruhi indikator akhir, serta tidak memunculkan rekomendasi peningkatan nilai.

Contoh: empat RO normal bernilai 100 dan satu RO Khusus bernilai 0.

\[
NKCRO = \frac{100+100+100+100}{4} = 100
\]

Bukan \((100+100+100+100+0)/5 = 80\).

### 3.2 Larangan penting

- Jangan mengubah nilai RO Khusus menjadi 100.
- Jangan menghapus laporan/data RO Khusus.
- Jangan mengizinkan Operator memilih pengecualian final untuk memperbaiki skor.
- Jangan memakai kata “dihapus” pada UI; gunakan “Dikecualikan dari objek penilaian”.
- Jangan menerapkan pengecualian ke histori/snapshot yang dibuat sebelum policy efektif tanpa proses recalculation eksplisit dan jejak audit.

### 3.3 Prioritas aturan

Untuk setiap RO dan periode, resolver menentukan status dengan urutan berikut:

1. Rule set fairness yang sudah `published`, efektif, dan berlaku nasional.
2. Rule scope KPPN yang sudah `published`, jika kebijakan nasional mengizinkan scope tersebut.
3. Pengecualian spesifik satker yang sudah `approved`, jika diizinkan policy.
4. Jika tidak ada rule yang cocok, status default adalah `included`.

Jika dua rule dengan prioritas sama berkonflik, block publish/approval dan minta Admin memperbaiki konflik. Engine tidak boleh memilih secara acak.

---

## 4. UX menu Operator Satker

### 4.1 Halaman Capaian Output

URL implementasi dapat tetap menggunakan route yang ada, tetapi UI harus memiliki elemen berikut.

#### Filter/konteks

- Tahun anggaran.
- Bulan/periode penilaian global, 1–12.
- Rule set version aktif.
- Toggle tampilan: `Semua RO`, `RO Dinilai`, `RO Dikecualikan`, `Butuh tindakan`.

Bulan yang dipilih harus menjadi input yang sama untuk tabel, kartu ringkasan, engine, dashboard drill-down, ekspor, dan reminder. Jangan menggunakan state bulan lokal yang tidak terhubung ke konteks kalkulasi.

#### Kartu ringkasan

Tampilkan minimal:

- RO terdaftar.
- RO menjadi objek penilaian.
- RO dikecualikan fairness.
- RO belum terkonfirmasi.
- RO tepat waktu / terlambat / belum dilaporkan.
- NKKW.
- NKCRO.
- Nilai IKPA-Capaian Output dan kontribusi bobot 25%.
- Deadline periode: tanggal hari kerja ke-5 bulan berikutnya, label kalender yang dipakai, dan rule set version.

Jangan menyebut “via OMSPAN” jika aplikasi tidak terintegrasi OMSPAN. Gunakan “berdasarkan Kalender Hari Kerja aktif”.

#### Tabel RO

Tambahkan kolom:

| Kolom | Perilaku |
|---|---|
| Kode RO dan nama RO | Identitas laporan |
| Status penilaian | `Dinilai`, `Dikecualikan`, atau `Menunggu persetujuan` |
| Dasar pengecualian | Kategori, referensi, dan periode efektif jika dikecualikan |
| Status laporan | Belum dilaporkan / Tepat waktu / Terlambat |
| Status konfirmasi | Terkonfirmasi / Belum terkonfirmasi |
| Formula aktif | `F1: PCRO/TPCRO`, `F2: RVRO/Volume DIPA`, `0: belum konfirmasi`, atau `—: dikecualikan` |
| Nilai Capaian RO | Nilai dan trace ringkas |
| Nilai ketepatan waktu | 100 / 0 / belum dapat dihitung |
| Aksi | Lihat detail, edit, ajukan pengecualian bila eligible |

Baris `Dikecualikan` harus tampak berbeda namun tidak disembunyikan. Nilai tersebut tidak masuk ringkasan skor dan kolom formula menampilkan `Tidak dihitung`.

#### Form input laporan

Field wajib:

- Kode RO.
- Periode/bulan.
- Volume RO pada DIPA.
- RVRO.
- PCRO kumulatif.
- TPCRO.
- Tanggal dan waktu pelaporan (`reportedAt`).
- Status konfirmasi.

Aturan UI:

- Jangan mengubah input kosong menjadi 0 tanpa pemberitahuan.
- Validasi ditampilkan sebelum simpan.
- Tampilkan preview Formula 1/Formula 2 berdasarkan periode dan PCRO.
- Tampilkan nilai simulasi per RO beserta alasan formula, tanpa mengklaim nilai resmi.
- Jika status konfirmasi belum ada, tampilkan peringatan bahwa nilai Capaian RO akan 0 sampai terkonfirmasi.
- `reportedAt` tidak dapat diedit diam-diam setelah konfirmasi; perubahan membutuhkan alasan, audit, dan hak khusus yang didefinisikan policy.

### 4.2 Pengajuan fairness oleh Operator

Operator tidak boleh dapat langsung mengecualikan RO. Sediakan aksi **Ajukan Fairness Treatment** jika Admin mengaktifkan `allowOperatorProposal`.

Form pengajuan:

- RO dan periode yang dipilih.
- Indikator: default Capaian Output.
- Kategori alasan: `ro_khusus`, `penyesuaian_regulasi_lain`, `lainnya`.
- Dasar/referensi kebijakan.
- Catatan operator.
- Lampiran opsional atau tautan referensi internal, bila fitur berkas tersedia.

Status pengajuan: `draft`, `submitted`, `approved`, `rejected`, `cancelled`, `expired`.

Saat `draft` atau `submitted`, nilai actual tetap menghitung RO sebagai included. Operator boleh melihat preview “dampak jika disetujui”, dengan label simulasi yang sangat jelas.

### 4.3 Bantuan pengguna

Tambahkan panel “Cara nilai dihitung” di halaman:

1. RO dikecualikan policy tidak dihitung.
2. RO belum terkonfirmasi: nilai Capaian RO = 0.
3. Desember atau PCRO 100%: RVRO/Volume DIPA.
4. Januari–November dan PCRO belum 100%: PCRO/TPCRO.
5. Ketepatan waktu: 5 hari kerja bulan berikutnya.
6. Nilai akhir: 30% ketepatan waktu + 70% Capaian RO; indikator berbobot 25% IKPA.

Gunakan contoh angka yang benar:

- Nilai Capaian RO: 100, 100, 80,95.
- NKCRO = 93,65.
- Jika NKKW = 100, maka nilai indikator = `100×30% + 93,65×70% = 95,56` setelah pembulatan dua desimal.

---

## 5. Halaman Admin — Fairness Treatment Policy

### 5.1 Navigasi dan hak akses

Tambahkan menu:

```text
Admin Policy
  Rule Set IKPA
  Fairness Treatment
  Reminder Policy
  Kalender Hari Kerja
  Riwayat Versi & Audit
```

Hak akses:

| Peran | Hak |
|---|---|
| Operator Satker | Lihat policy yang berlaku untuk satkernya; buat/cabut usulan jika diizinkan; tidak dapat approve/publish/edit rule final |
| Admin KPPN | Buat draft, edit draft, import, preview dampak, approve/reject usulan sesuai scope, publish/retire policy, lihat audit |
| Engine/system | Read-only policy published dan efektif |

Admin tidak mengubah data operasional RO satker. Admin hanya mengelola layer kebijakan eligibility penilaian.

### 5.2 Daftar policy

Kolom daftar:

- Nama policy.
- Indikator.
- Kategori.
- Scope: nasional/KPPN/satker.
- Tahun dan periode efektif.
- Jumlah RO/pola kode.
- Status: draft/published/retired/expired.
- Rule set version.
- Pembuat, penerbit, dan waktu terakhir berubah.
- Jumlah satker dan estimasi RO terdampak.

Filter: tahun, indikator, status, scope, kategori, dan kode/pola RO.

### 5.3 Form policy fairness

Field wajib:

| Field | Keterangan |
|---|---|
| Nama policy | Contoh: `Fairness RO Khusus FAN.ZZ1 TA 2026` |
| Indikator | Minimal `output_achievement`; arsitektur mendukung indikator lain |
| Tipe tindakan | Default dan satu-satunya tindakan awal: `exclude_from_assessment` |
| Kategori | `ro_khusus`, `penyesuaian_regulasi_lain`, `other_authorized` |
| Pencocokan RO | Exact code, daftar kode, prefix, atau regex terbatas/tervalidasi |
| Scope | national, kppn, atau org/satker sesuai kewenangan |
| Tahun anggaran | Wajib |
| Periode efektif | Bulan awal dan akhir, wajib |
| Dasar kebijakan | Nomor/tanggal/judul dokumen atau referensi internal |
| Alasan tampilan | Kalimat yang dapat dilihat Operator |
| Catatan admin | Tidak wajib, internal |
| Allow operator proposal | Boolean |

Contoh policy untuk kasus RO Khusus:

```json
{
  "name": "Fairness RO Khusus FAN.ZZ1 TA 2026",
  "indicatorKey": "output_achievement",
  "action": "exclude_from_assessment",
  "category": "ro_khusus",
  "matchType": "exact",
  "roCodes": ["FAN.ZZ1"],
  "scopeType": "national",
  "fiscalYear": 2026,
  "effectiveMonthStart": 1,
  "effectiveMonthEnd": 12,
  "basisReference": "Fairness treatment IKPA TA 2026",
  "displayReason": "RO Khusus tidak menjadi objek penilaian Indikator Capaian Output",
  "allowOperatorProposal": false
}
```

### 5.4 Workflow policy

1. Admin membuat `draft`.
2. Sistem memvalidasi field, konflik scope/periode, dan pola kode.
3. Admin menjalankan **Preview Dampak**.
4. Admin menerbitkan `published` sebagai versi policy/rule set baru.
5. Engine hanya membaca policy `published` dan efektif.
6. Perubahan published tidak boleh diedit langsung; buat versi draft baru lalu publish.
7. Policy yang tidak lagi berlaku menjadi `retired` atau `expired`, tanpa mengubah snapshot historis.

### 5.5 Preview dampak sebelum publish

Preview wajib menampilkan:

- Daftar satker dan RO yang cocok.
- Jumlah RO akan dikecualikan per satker/periode.
- Nilai NKCRO dan IKPA-CO sebelum/sesudah kebijakan, dengan label **simulasi dampak policy**.
- RO/policy konflik atau pola yang tidak menemukan data.
- Peringatan jika pengecualian mengakibatkan tidak ada RO included.

Tidak boleh ada publish bila conflict resolver belum deterministik.

---

## 6. Perubahan data, backend, dan API

### 6.1 Tabel policy pengecualian

Buat tabel misalnya `assessment_exclusion_policies`:

```text
id UUID PK
rule_set_id UUID nullable FK
name varchar(160) not null
indicator_key varchar(64) not null
action varchar(64) not null default 'exclude_from_assessment'
category varchar(64) not null
match_type varchar(32) not null       -- exact | list | prefix | regex
ro_match_value jsonb not null          -- code/string/list/pattern
scope_type varchar(32) not null        -- national | kppn | organization
scope_id UUID nullable
fiscal_year_id UUID not null
effective_month_start smallint not null check 1..12
effective_month_end smallint not null check 1..12
basis_reference text not null
display_reason text not null
internal_note text nullable
allow_operator_proposal boolean not null default false
status varchar(32) not null            -- draft | published | retired | expired
version integer not null
published_at timestamptz nullable
published_by UUID nullable
created_at timestamptz not null
created_by UUID not null
updated_at timestamptz not null
updated_by UUID not null
```

Tambahkan indeks untuk: `indicator_key`, `fiscal_year_id`, `status`, `scope_type`, `scope_id`, dan periode efektif.

### 6.2 Tabel proposal operator

Buat `assessment_exclusion_proposals`:

```text
id UUID PK
organization_id UUID not null
fiscal_year_id UUID not null
indicator_key varchar(64) not null
ro_code varchar(64) not null
month smallint nullable                 -- null untuk seluruh FY bila diizinkan
category varchar(64) not null
basis_reference text not null
operator_note text nullable
attachment_ref text nullable
status varchar(32) not null             -- draft | submitted | approved | rejected | cancelled | expired
review_note text nullable
resolved_policy_id UUID nullable FK
submitted_at timestamptz nullable
submitted_by UUID not null
reviewed_at timestamptz nullable
reviewed_by UUID nullable
created_at timestamptz not null
updated_at timestamptz not null
```

Approval proposal harus menghasilkan policy/exception yang dapat di-resolve engine atau merefer ke policy final. Jangan hanya menyimpan status approved tanpa dampak ke resolver.

### 6.3 Data laporan output

Pastikan data laporan output mempunyai dan benar-benar diisi:

```text
roCode
month
volumeDipa
rvro
pcro
tpcro
reportedAt timestamptz NOT NULL untuk laporan disubmit
confirmed boolean
confirmedAt timestamptz nullable
confirmedBy UUID nullable
```

Rekomendasi status lifecycle laporan:

```text
draft -> submitted -> confirmed
                 \-> returned/rejected (opsional)
```

Jika lifecycle belum dapat dibuat penuh, minimal pertahankan `confirmed`, tetapi `reportedAt` wajib diisi saat aksi “Kirim Laporan” dan `confirmedAt` diisi saat aksi “Konfirmasi”.

### 6.4 Resolver eligibility tunggal

Buat fungsi tunggal, misalnya:

```ts
resolveOutputAssessmentEligibility({
  fiscalYearId,
  periodMonth,
  organizationId,
  roCode,
  ruleSetVersion
})
```

Hasil minimal:

```ts
{
  assessmentStatus: 'included' | 'excluded',
  exclusionPolicyId?: string,
  exclusionCategory?: string,
  exclusionReason?: string,
  policyReference?: string,
  effectiveRange?: { startMonth: number; endMonth: number },
  resolverVersion: string
}
```

Fungsi ini wajib dipakai oleh engine, loader halaman Operator, dashboard, ekspor, preview Admin, history/snapshot, rekomendasi, dan import validation. Jangan menduplikasi query/filter pengecualian pada masing-masing layer.

### 6.5 API minimal

Operator:

```text
GET  /output-reports?fiscalYear=&month=
POST /output-reports
PATCH /output-reports/:id
POST /output-reports/:id/submit
POST /output-reports/:id/confirm
POST /fairness-proposals
GET  /fairness-policies/effective?indicator=output_achievement
```

Admin:

```text
GET    /admin/fairness-policies
POST   /admin/fairness-policies
PATCH  /admin/fairness-policies/:id            # draft only
POST   /admin/fairness-policies/:id/preview
POST   /admin/fairness-policies/:id/publish
POST   /admin/fairness-policies/:id/retire
POST   /admin/fairness-policies/import
GET    /admin/fairness-proposals
POST   /admin/fairness-proposals/:id/approve
POST   /admin/fairness-proposals/:id/reject
```

Semua endpoint harus melakukan autentikasi, pengecekan scope organisasi/KPPN, dan audit.

---

## 7. Engine dan trace perhitungan

### 7.1 Pseudocode wajib

```ts
for (const report of reportsForSelectedPeriod) {
  const eligibility = resolveOutputAssessmentEligibility(report)

  if (eligibility.assessmentStatus === 'excluded') {
    traces.push({
      roCode: report.roCode,
      included: false,
      outcome: 'excluded',
      reason: eligibility.exclusionReason,
      policyReference: eligibility.policyReference
    })
    continue
  }

  const deadline = calculateFifthWorkingDayOfNextMonth(
    report.fiscalYear,
    report.month,
    activeWorkdayCalendar
  )

  const timeliness = report.reportedAt
    ? (toLocalDate(report.reportedAt) <= deadline ? 100 : 0)
    : null

  let achievement: number
  let formula: 'F1_PCRO_TPCRO' | 'F2_RVRO_VOLUME' | 'ZERO_UNCONFIRMED' | 'ZERO_PCRO' | 'INVALID'

  if (!report.confirmed) {
    achievement = 0
    formula = 'ZERO_UNCONFIRMED'
  } else if (report.pcro === 0) {
    achievement = 0
    formula = 'ZERO_PCRO'
  } else if (report.month === 12 || report.pcro === 100) {
    if (report.volumeDipa <= 0) markBlockingInvalid(report, 'VOLUME_DIPA_MUST_BE_GT_ZERO')
    achievement = min((report.rvro / report.volumeDipa) * 100, 100)
    formula = 'F2_RVRO_VOLUME'
  } else {
    if (report.tpcro <= 0) markBlockingInvalid(report, 'TPCRO_MUST_BE_GT_ZERO_WHEN_PCRO_GT_ZERO')
    achievement = (report.pcro / report.tpcro) * 100
    formula = 'F1_PCRO_TPCRO'
  }

  traces.push({ roCode: report.roCode, included: true, deadline, timeliness, achievement, formula })
}
```

Finalizer harus menentukan perlakuan `timeliness = null` berdasarkan rule set; default yang direkomendasikan adalah status `incomplete` dan nilai final tidak dinyatakan sebagai actual lengkap. Jangan mengganti null menjadi 100.

### 7.2 Trace yang harus tersimpan

Setiap hasil kalkulasi/snapshot memuat:

- tahun, periode, timezone, kalender kerja, dan rule set version;
- jumlah RO terdaftar, included, excluded, invalid, belum terlapor, terlambat, dan belum terkonfirmasi;
- trace tiap RO: raw input, eligibility, policy ID bila dikecualikan, deadline, timeliness, formula terpilih, nilai per RO, dan warning/error;
- NKKW, NKCRO, IKPA-CO, kontribusi bobot 25%;
- timestamp kalkulasi.

---

## 8. Kalender kerja dan reminder

### 8.1 Deadline kanonis

Buat satu utilitas bersama:

```ts
calculateFifthWorkingDayOfNextMonth(fiscalYear, reportingMonth, workdayCalendar)
```

Aturan:

- Mulai dari tanggal 1 bulan berikutnya.
- Hitung hanya tanggal yang ditandai hari kerja pada kalender aktif.
- Hari kerja kelima menjadi deadline.
- Semua engine, tabel, strip deadline, reminder, ekspor, dan dashboard memanggil utilitas ini.

Hapus/retire implementasi yang menggunakan:

- tanggal `YYYY-MM-05` pada bulan laporan;
- penghitungan Mon–Fri tanpa kalender libur;
- deadline hardcoded tunggal pada dashboard.

### 8.2 Reminder

Untuk setiap periode dan satker, buat event deadline output berdasarkan deadline kanonis. Jadwal default:

- H-3 hari kerja.
- H-1 hari kerja.
- H-0 pada awal jam kerja.
- H+1 bila ada RO included yang belum dilaporkan, terlambat, atau belum terkonfirmasi.

Reminder menyebut jumlah RO bermasalah dan link filter langsung ke bulan terkait. RO yang dikecualikan tidak dihitung sebagai masalah reminder.

---

## 9. Dashboard, ekspor, import, dan riwayat

### 9.1 Dashboard

Kartu Capaian Output menampilkan:

- nilai indikator dan kontribusi 25%;
- NKKW dan NKCRO;
- periode/rule set;
- `x` RO dinilai, `y` RO dikecualikan, `z` belum terkonfirmasi;
- deep-link ke halaman dengan bulan/filter sama;
- status `incomplete` bila input penting belum lengkap.

### 9.2 Ekspor

XLSX/PDF harus memiliki dua bagian terpisah:

1. **RO Dinilai**: formula, nilai, ketepatan, status konfirmasi.
2. **RO Dikecualikan dari objek penilaian**: kode RO, data mentah, kategori, dasar, policy ID, periode efektif.

Ringkasan wajib menyebut penyebut agregat, misalnya `NKCRO dihitung dari 4 RO; 1 RO dikecualikan fairness`.

### 9.3 Import

Template input laporan tetap menerima semua RO, termasuk RO Khusus. Operator tidak mengisi status pengecualian final pada template laporan.

Saat preview import, sistem memanggil resolver dan memberi informasi:

- `RO ini akan dinilai`;
- atau `RO ini dikecualikan berdasarkan policy <referensi>`.

Admin memiliki template import terpisah untuk policy fairness massal. Import policy harus melewati validasi dan status awal `draft`, bukan langsung published.

### 9.4 Riwayat/snapshot

Snapshot menyimpan hasil eligibility saat perhitungan berlangsung dan `rule_set_version`. Snapshot lama tidak berubah ketika policy baru diterbitkan. Sediakan aksi recalculation eksplisit dengan label versi policy baru jika diperlukan.

---

## 10. Validasi, keamanan, dan audit

### 10.1 Validasi data

- `month`: 1–12.
- `PCRO`, `TPCRO`: 0–100 dengan presisi yang konsisten.
- `RVRO`: >= 0.
- `volumeDipa`: > 0 untuk Formula 2 pada RO included.
- `reportedAt`: wajib saat submit; bukan fallback otomatis.
- Kode RO unik dalam kombinasi organisasi + tahun + bulan, kecuali model bisnis mendukung versi laporan; bila ada versi, gunakan revision history, jangan upsert yang menghapus jejak.
- Pattern regex fairness harus dibatasi panjang/kompleksitas dan diuji aman.
- Periode efektif awal tidak boleh lebih besar dari periode akhir.

### 10.2 Audit event

Catat minimal:

```text
output_report_created
output_report_updated
output_report_submitted
output_report_confirmed
output_report_reported_at_corrected
fairness_proposal_created
fairness_proposal_submitted
fairness_proposal_approved
fairness_proposal_rejected
fairness_policy_created
fairness_policy_updated
fairness_policy_previewed
fairness_policy_published
fairness_policy_retired
output_calculation_run
```

Audit menyimpan actor, role, organisasi/scope, before/after, alasan, policy/rule set version, dan timestamp.

---

## 11. Test cases dan acceptance criteria

### 11.1 Perhitungan formula

| ID | Skenario | Hasil yang wajib |
|---|---|---|
| CO-01 | Juli, confirmed, PCRO 50, TPCRO 50 | Formula 1; nilai 100 |
| CO-02 | Juli, confirmed, PCRO 34, TPCRO 42 | Formula 1; nilai 80,95 setelah pembulatan dua desimal |
| CO-03 | Juli, confirmed, PCRO 100, RVRO 2, volume 2 | Formula 2; nilai 100 |
| CO-04 | Desember, confirmed, PCRO 40, RVRO 2, volume 4 | Formula 2; nilai 50, bukan 100 otomatis |
| CO-05 | Non-Desember, not confirmed, PCRO/RVRO valid | Nilai Capaian RO 0; formula `ZERO_UNCONFIRMED` |
| CO-06 | PCRO 0, TPCRO 0, confirmed | Nilai Capaian RO 0; tidak error 0/0 dan tidak skip |
| CO-07 | PCRO 25, TPCRO 0, confirmed | Blocking validation/error `TPCRO_MUST_BE_GT_ZERO...`; hasil tidak complete |
| CO-08 | RVRO lebih besar dari volume dan cap rule aktif | Nilai Formula 2 maksimal 100; trace menyebut cap |

### 11.2 Ketepatan waktu

| ID | Skenario | Hasil yang wajib |
|---|---|---|
| CO-09 | Laporan periode Juli pada hari kerja ke-5 Agustus | Ketepatan waktu 100 |
| CO-10 | Laporan satu tanggal setelah deadline | Ketepatan waktu 0 |
| CO-11 | `reportedAt` kosong | Status belum dilaporkan/incomplete; tidak boleh otomatis 100 |
| CO-12 | Ada libur/cuti bersama pada bulan berikutnya | Deadline bergeser mengikuti Kalender Hari Kerja aktif |

### 11.3 Fairness treatment

| ID | Skenario | Hasil yang wajib |
|---|---|---|
| CO-13 | Empat RO normal nilai 100; `FAN.ZZ1` dikecualikan | NKCRO = 100 dari penyebut 4; FAN.ZZ1 muncul sebagai excluded |
| CO-14 | Sama seperti CO-13 tetapi policy belum published | FAN.ZZ1 tetap included dan mempengaruhi skor sesuai datanya |
| CO-15 | Policy efektif hanya Mei–Agustus | Pengecualian hanya bekerja dalam bulan tersebut |
| CO-16 | Operator membuat proposal | Tidak mengubah nilai actual sebelum approval/policy aktif |
| CO-17 | Dua policy konflik dengan scope dan prioritas sama | Publish ditolak dengan pesan konflik |
| CO-18 | Snapshot Juni dibuat sebelum policy baru terbit | Snapshot Juni tidak berubah otomatis |

### 11.4 Integrasi

- Nilai pada halaman operator, dashboard, API, ekspor, dan snapshot harus identik untuk konteks tahun/bulan/rule set yang sama.
- Detail dashboard harus menunjukkan RO dikecualikan dan alasan ringkas.
- Reminder tidak mengingatkan RO excluded sebagai keterlambatan.
- Filter bulan dari dashboard membuka menu output pada bulan yang sama.
- Tidak ada path engine yang memakai fallback `reportedAt = deadline`.
- Tidak ada path engine yang memberi Desember nilai 100 otomatis.
- Tidak ada path engine yang mengabaikan `PCRO/TPCRO` untuk Formula 1.

---

## 12. Urutan implementasi

### P0 — sebelum perhitungan dipakai

1. Buat kalender kerja kanonis dan utilitas deadline hari kerja ke-5 bulan berikutnya.
2. Tambahkan input/lifecycle `reportedAt`, submit, dan konfirmasi; hilangkan fallback tanggal.
3. Ubah engine ke flow Formula 1/Formula 2 dan gate `confirmed`.
4. Tangani PCRO=0/TPCRO=0 sesuai aturan.
5. Pastikan agregasi hanya untuk periode terpilih.
6. Tambahkan trace kalkulasi per RO dan test CO-01 s.d. CO-12.

### P1 — fairness treatment

1. Migrasi tabel policy dan resolver eligibility tunggal.
2. Terapkan resolver ke engine, UI operator, dashboard, ekspor, import, dan history.
3. Buat halaman Admin Fairness Treatment lengkap dengan preview/publish/audit.
4. Tampilkan badge dan rincian excluded pada UI operator.
5. Tambahkan test CO-13 s.d. CO-18.

### P2 — penguatan operasional

1. Workflow proposal Operator dan approval Admin.
2. Import policy fairness massal.
3. Reminder H-3/H-1/H-0/H+1 berbasis deadline kanonis.
4. Perbandingan dampak policy antarversi dan laporan audit yang lebih lengkap.

---

## 13. Definition of Done

Fitur dinyatakan selesai hanya jika seluruh kondisi berikut terpenuhi:

- Formula 1, Formula 2, ketepatan 5 hari kerja, konfirmasi, dan PCRO=0 diuji otomatis dan lulus.
- Tidak ada nilai tepat waktu otomatis akibat `reportedAt` kosong.
- Desember tidak diberi 100 otomatis.
- RO Khusus yang terkena policy published dikeluarkan dari pembilang dan penyebut tanpa menghapus data.
- Operator tidak dapat membuat pengecualian final sendiri.
- Admin dapat draft, preview, publish, retire, dan audit policy fairness.
- Semua layar/perhitungan menggunakan resolver fairness dan kalkulator deadline yang sama.
- Dashboard, ekspor, reminder, dan snapshot menjelaskan jumlah/identitas RO excluded serta versi policy.
- Nilai actual tidak berubah secara diam-diam setelah perubahan policy; perubahan dapat ditelusuri dari audit dan rule set version.
- UI menggunakan Bahasa Indonesia yang jelas, menampilkan dasar/periode pengecualian, dan membedakan data belum lengkap dari nilai 0 yang valid.
