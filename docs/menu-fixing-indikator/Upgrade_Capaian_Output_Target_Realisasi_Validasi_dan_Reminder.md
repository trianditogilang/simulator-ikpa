# Instruksi Implementasi — Upgrade Capaian Output: Target, Realisasi, Validasi, Fairness, dan Reminder

**Tujuan:** Dokumen mandiri untuk AI agent/developer. Implementasikan seluruh perubahan tanpa memerlukan referensi dokumen lain.

**Status prioritas:** P0. Menu Capaian Output tidak boleh disebut siap produksi sebelum item P0 selesai.

**Prinsip produk:** Aplikasi adalah simulator/pengendalian internal, bukan pengganti SAKTI atau MyIntress. Namun alur, terminologi, tabel, dan validasi dibuat familiar bagi operator yang menggunakan SAKTI/MyIntress.

---

## 1. Hasil akhir yang harus dicapai

Menu Capaian Output harus mendukung alur berikut:

```text
Susun Target Kinerja Tahunan
→ Kirim/aktifkan Target Kinerja
→ Pemutakhiran Target pada open period triwulanan
→ Input Realisasi Kinerja bulanan
→ Validasi otomatis PCRO/RVRO/PPA
→ Perbaikan atau konfirmasi atas temuan
→ Kirim Laporan Realisasi
→ Konfirmasi laporan
→ Hitung IKPA Capaian Output
→ Tampilkan dashboard, early warning, reminder, history, dan export
```

Menu dan data harus membedakan secara tegas:

1. **Target Kinerja:** rencana fisik/output, disusun per bulan untuk setahun dan dapat dimutakhirkan per triwulan.
2. **Realisasi Kinerja:** capaian aktual yang diinput/dilaporkan bulanan.
3. **Validasi:** pemeriksaan kualitas dan konsistensi data sebelum laporan final dikirim.
4. **Fairness Treatment:** pengecualian objek penilaian melalui policy yang disetujui, tanpa menghapus data.
5. **Reminder:** dua event saja: pemutakhiran target triwulanan dan pengisian realisasi bulanan.

---

## 2. Struktur navigasi dan hak akses

### 2.1 Navigasi Operator Satker

```text
Capaian Output
├── Ringkasan Capaian Output
├── Target Kinerja
├── Realisasi Kinerja
├── Validasi & Konfirmasi
├── Fairness Treatment
└── Riwayat & Ekspor
```

### 2.2 Navigasi Admin KPPN

```text
Admin Policy
├── Rule Set IKPA
├── Fairness Treatment
├── Validation Policy Capaian Output
├── Jadwal Target Kinerja Output
├── Reminder Policy
├── Kalender Hari Kerja
└── Audit & Riwayat Versi
```

### 2.3 Hak akses

| Aktivitas | Operator Satker | Admin KPPN |
|---|:---:|:---:|
| Menyusun target tahunan satker | Ya | Read-only |
| Memutakhirkan target pada open period | Ya | Read-only |
| Input/simpan/kirim realisasi | Ya | Read-only |
| Konfirmasi laporan realisasi | Ya, bila role aplikasi saat ini belum dipisah; wajib tercatat aktornya | Read-only |
| Melihat hasil validasi | Ya | Ya, dalam scope KPPN |
| Mengisi alasan atas warning/konfirmasi wajib | Ya | Ya, saat review bila diperlukan |
| Mengubah action/severity validasi | Tidak | Ya melalui policy/versioning |
| Mengatur threshold anomali | Tidak | Ya melalui rule set |
| Membuat usulan fairness | Ya | Ya |
| Menyetujui/publish fairness | Tidak | Ya |
| Mengatur deadline dan jadwal event reminder | Tidak | Ya |
| Mengatur penerima tambahan/jam pengiriman dalam batas policy | Ya | Ya |

**Aturan keamanan:** Operator tidak boleh dapat mengubah status pengecualian final, rule validasi, threshold anomali, deadline, atau policy reminder. Admin tidak boleh mengubah nilai realisasi/data operasional satker pada MVP.

---

## 3. Modul Target Kinerja

### 3.1 Tujuan

Membantu operator menyusun target capaian output satu tahun per RO, mendistribusikan target per bulan, melihat akumulasi, menyelaraskan target dengan rencana penyerapan anggaran, dan memutakhirkan target pada jadwal triwulanan yang dibuka oleh Admin Policy.

### 3.2 Tampilan yang harus dibuat

Gunakan pola tabel yang familiar dengan aplikasi SAKTI, tetapi dengan UI modern dan sederhana.

Header:

```text
[Tahun Anggaran] [Rincian Output/RO] [Versi Target Aktif] [Status Open Period]

Target Volume DIPA: 590 siswa
Pagu RO: Rp xxx
Satuan: Siswa
Metode pengukuran: Jumlah siswa menerima layanan
Status target: Draft / Terkirim / Terkunci / Perlu Pemutakhiran
```

Tabel pengisian per bulan:

| Bulan | Target RVRO Bulanan | Target PCRO Bulanan | Target RVRO Kumulatif | Target PCRO Kumulatif | RPD Kumulatif RO | Gap Target Output–RPD | Status |
|---|---:|---:|---:|---:|---:|---:|---|
| Jan | Input | Otomatis/input | Otomatis | Otomatis | Read-only | Otomatis | Draft/Terkunci |
| Feb | Input | Otomatis/input | Otomatis | Otomatis | Read-only | Otomatis | Draft/Terkunci |
| ... | ... | ... | ... | ... | ... | ... | ... |
| Des | Input | Otomatis/input | Total volume | 100% | Read-only | Otomatis | Draft/Terkunci |

Tombol:

```text
[Simpan Draft] [Validasi Distribusi Target] [Preview Dampak] [Kirim Target]
```

### 3.3 Aturan target

- Target dibuat per RO untuk Januari–Desember.
- Target volume tahunan harus sama dengan `volumeDipa` yang berlaku pada RO.
- Jumlah `targetRvroIncremental` Januari–Desember harus sama dengan volume DIPA.
- Jumlah `targetPcroIncremental` Januari–Desember harus sama dengan 100%.
- Sistem menghitung otomatis nilai kumulatif per bulan.
- `targetPcroCumulative` akhir Desember harus 100%.
- `targetRvroCumulative` akhir Desember harus sama dengan volume DIPA.
- Nilai bulan yang sudah berlalu terkunci setelah target versi tersebut aktif, kecuali tersedia proses koreksi berotorisasi dengan alasan dan audit.
- Target aktif dipakai sebagai `TPCRO kumulatif` pada Formula 1 penilaian Capaian Output.
- Target tidak otomatis disamakan dengan RPD. RPD hanya menjadi pembanding/rambu kewajaran.
- Bila gap target output dengan RPD melampaui threshold internal, tampilkan warning dan minta alasan, tetapi jangan otomatis menolak target bila proses bisnis dapat menjelaskannya.

### 3.4 Target dan versi

Gunakan lifecycle berikut:

```text
draft → submitted → active/locked → superseded
```

- `draft`: dapat diedit oleh Operator.
- `submitted`: sudah dikirim/ditandai siap dipakai, menunggu aktivasi sesuai desain aplikasi.
- `active/locked`: menjadi target aktif pada perhitungan; tidak boleh diubah bebas.
- `superseded`: target lama yang digantikan pemutakhiran; tetap disimpan untuk audit dan snapshot.

Setiap versi memuat `version`, `effectiveMonthStart`, `effectiveMonthEnd`, pembuat, waktu kirim, alasan pemutakhiran, dan referensi/bukti bila diperlukan.

### 3.5 Pemutakhiran triwulanan

Buat entitas `target_update_windows` yang dikelola Admin KPPN:

```text
id
fiscal_year_id
quarter
opens_at
closes_at
day_type = workday
source_reference
rule_set_version
status = scheduled | open | closed
created_by / published_by / audit fields
```

Aturan:

1. Admin mengisi tanggal pembukaan dan penutupan open period untuk masing-masing triwulan berdasarkan informasi resmi yang berlaku.
2. Tanggal tidak boleh di-hardcode pada aplikasi.
3. Ketika window berstatus `open`, Operator dapat menekan **Pemutakhiran Target**.
4. Sistem membuat draft versi baru sebagai salinan target aktif.
5. Operator dapat mengubah target periode berjalan dan mendatang sesuai policy; bulan historis yang telah berlalu terkunci.
6. Sistem menampilkan perbandingan versi sebelumnya dan simulasi dampak terhadap TPCRO kumulatif serta nilai Capaian Output.
7. Setelah dikirim, target versi baru menjadi aktif untuk periode efektifnya dan versi sebelumnya menjadi `superseded`.
8. Jika window tutup, tombol edit target dinonaktifkan dan UI menunjukkan instruksi tindak lanjut sesuai policy/KPPN.

---

## 4. Modul Realisasi Kinerja

### 4.1 Tujuan

Mencatat realisasi capaian output setiap bulan, menampilkan target sebagai referensi read-only, menjalankan validasi otomatis sebelum kirim, merekam bukti dan timestamp pelaporan, serta mendukung konfirmasi laporan.

### 4.2 Tampilan form

Buat halaman/form dengan susunan target di kiri dan realisasi di kanan agar mirip pola yang pengguna kenal.

```text
RO terpilih: [Kode RO — Nama RO]                Periode: [Juli 2026]
Status: Draft / Perlu Perbaikan / Perlu Konfirmasi / Siap Kirim / Terkirim / Terkonfirmasi

TARGET (read-only)                              REALISASI (input)
Volume DIPA:          [590]                     Tambahan RVRO bulan ini: [41]
Satuan:               [Siswa]                   RVRO kumulatif:          [406]
TPCRO kumulatif:      [68,81%]                  Tambahan PCRO:           [6,95%]
TRVRO kumulatif:      [406]                     PCRO kumulatif:          [68,00%]
RPD kumulatif RO:     [70,00%]                  PPA kumulatif:           [70,00%]
                                                Gap PCRO-PPA:            [-2,00 poin]

Bukti Dokumen:        [Unggah file]
Referensi Capaian:    [Pilih]
Keterangan:           [........................................................]
Catatan Validasi PPK: [........................................................]

Hasil Validasi
[00 Data Valid]
atau
[02 Wajib Konfirmasi: PCRO 68% lebih rendah daripada PPA 70%]

[Simpan Draft] [Hitung Otomatis] [Validasi] [Kirim Laporan]
```

### 4.3 Field realisasi

| Field | Sifat | Aturan |
|---|---|---|
| RO/kode RO | Read-only setelah dipilih | Berasal dari master RO/target aktif |
| Bulan laporan | Wajib | 1–12; konsisten dengan konteks halaman |
| Volume DIPA | Read-only | Dari target aktif atau revisi DIPA efektif |
| Satuan | Read-only | Menentukan apakah RVRO dapat desimal |
| TPCRO kumulatif | Read-only | Dari target aktif untuk bulan berjalan |
| TRVRO kumulatif | Read-only | Dari target aktif untuk bulan berjalan |
| Tambahan RVRO | Input | Angka aktual bulan berjalan |
| RVRO kumulatif | Otomatis/input terbatas | Akumulasi realisasi; boleh koreksi dengan audit |
| Tambahan PCRO | Input | Kemajuan fisik bulan berjalan |
| PCRO kumulatif | Otomatis/input terbatas | Maksimal 100%; tidak boleh lebih rendah dari bulan sebelumnya tanpa workflow koreksi |
| Bukti dokumen | Wajib kondisional | Wajib untuk konfirmasi/validasi tertentu |
| Referensi capaian | Wajib | Nilai master/enum yang dapat dikonfigurasi |
| Keterangan | Wajib kondisional | Wajib bila ada `confirmation_required` atau warning tertentu |
| Tanggal pelaporan | Sistem-generated | Diisi ketika tombol `Kirim Laporan` ditekan; bukan date picker bebas |
| Status konfirmasi | Sistem lifecycle | Tercatat bersama waktu dan aktor konfirmasi |

### 4.4 Lifecycle laporan

```text
draft
→ validation_failed
→ validation_confirmation_required
→ ready_to_submit
→ submitted
→ confirmed
→ returned_for_correction
```

- Draft boleh disimpan tanpa mengubah skor actual final.
- Laporan dengan blocker masuk `validation_failed` dan tombol Kirim dinonaktifkan.
- Laporan yang memerlukan konfirmasi masuk `validation_confirmation_required`.
- Laporan dapat dikirim bila seluruh blocker selesai dan seluruh alasan/konfirmasi wajib telah dipenuhi.
- Saat `Kirim Laporan`, sistem mengisi `submittedAt` sebagai `reportedAt`.
- Saat `Konfirmasi`, sistem mengisi `confirmedAt`, `confirmedBy`, serta catatan konfirmasi.
- Jangan menggunakan checkbox `confirmed` tanpa lifecycle, timestamp, dan identitas aktor.

### 4.5 Ketepatan waktu

- Deadline untuk laporan bulan `M` adalah hari kerja ke-5 pada bulan `M+1`.
- Gunakan satu fungsi bersama `calculateFifthWorkingDayOfNextMonth()`.
- Fungsi wajib memakai Kalender Hari Kerja aktif: Sabtu, Minggu, libur nasional, dan cuti bersama yang tercatat tidak dihitung sebagai hari kerja.
- `reportedAt` diambil dari waktu sistem saat laporan disubmit.
- Tepat waktu bila `reportedAt <= deadline`; nilai 100.
- Terlambat bila `reportedAt > deadline`; nilai 0.
- Jangan memakai fallback tanggal atau menganggap laporan tanpa timestamp sebagai tepat waktu.

---

## 5. Engine nilai Capaian Output

### 5.1 Bobot

- Bobot indikator Capaian Output terhadap IKPA: 25%.
- Nilai Ketepatan Waktu Pelaporan RO: 30%.
- Nilai Capaian Rincian Output: 70%.

\[
IKPA\text{-}CO = (NK\text{-}ROKW \times 30\%) + (NK\text{-}CRO \times 70\%)
\]

\[
Kontribusi\ IKPA = IKPA\text{-}CO \times 25\%
\]

Bobot, pembulatan, dan cap skor dibaca dari `rule_set`, bukan hardcode.

### 5.2 Perhitungan Capaian RO per RO

Urutan engine wajib:

```text
1. Resolve fairness treatment yang published dan efektif.
2. Bila RO excluded: jangan masuk pembilang atau penyebut NK-ROKW/NK-CRO.
3. Hitung ketepatan waktu dari submittedAt dan deadline kanonis.
4. Bila laporan belum confirmed: Nilai Capaian RO = 0.
5. Bila PCRO kumulatif = 0: Nilai Capaian RO = 0.
6. Bila Desember atau PCRO kumulatif = 100%: gunakan Formula 2.
7. Selain itu pada Januari–November: gunakan Formula 1.
8. Agregasikan hanya RO yang menjadi objek penilaian pada periode terpilih.
```

**Formula 1:** Januari–November, saat PCRO belum 100%.

\[
Nilai\ Capaian\ RO = \frac{PCRO\ kumulatif}{TPCRO\ kumulatif} \times 100
\]

**Formula 2:** Desember atau PCRO sudah 100%.

\[
Nilai\ Capaian\ RO = \frac{RVRO\ kumulatif}{Volume\ RO\ pada\ DIPA} \times 100
\]

Ketentuan:

- Bila PCRO 0%, hasil langsung 0, termasuk bila TPCRO 0%.
- Bila PCRO > 0 tetapi TPCRO = 0, hasil `invalid_target`; jangan lakukan pembagian 0.
- Bila Formula 2 dipakai dan volume DIPA = 0, hasil `invalid_target`; jangan membagi 0.
- Nilai Formula 2 yang melebihi 100 dapat di-cap pada 100 untuk skor, tetapi data actual RVRO tidak boleh dipotong/hilang.
- Pembulatan final menggunakan satu utilitas `decimal/roundHalfUp` yang dipakai oleh preview UI dan engine final.

### 5.3 Fairness treatment

- RO yang berstatus `excluded` policy aktif dikeluarkan dari pembilang **dan penyebut** NK-ROKW dan NK-CRO.
- Data RO excluded tetap tampil, dapat diekspor, dan menyimpan alasan serta referensi policy.
- Jangan memberi nilai 100 secara palsu kepada RO excluded.
- Jangan menghapus data RO excluded.
- Usulan fairness oleh Operator tidak boleh mengubah nilai actual sebelum Admin menyetujui dan menerbitkan policy/exception.
- Hapus fallback hardcode untuk kode tertentu, misalnya `FAN.ZZ1`; semua pengecualian harus berasal dari policy berversi.

---

## 6. Validation Engine 00–08

### 6.1 Prinsip

Validation Engine terpisah dari Engine Nilai IKPA.

- Berjalan ketika field berubah pada form (**early warning real-time**).
- Berjalan kembali saat Simpan, Validasi, Kirim Laporan, dan Konfirmasi.
- Menghasilkan hasil terstruktur yang disimpan bersama laporan.
- Status validasi dipakai oleh UI, lifecycle, scheduler, dashboard, export, dan audit.
- Tidak boleh hanya berupa teks warning di frontend.

### 6.2 Input yang diperlukan

Validation Engine harus menerima:

```ts
{
  fiscalYear,
  organizationId,
  roCode,
  month,
  isPriorityNational,
  unitRule,
  volumeDipa,
  pcroCumulative,
  tpcroCumulative,
  rvroCumulative,
  realizedBudgetCumulativeByRo,
  budgetAmountByRo,
  ppaCumulative,
  confirmed,
  fairnessStatus,
  evidenceStatus,
  ruleSetVersion
}
```

### 6.3 Kode, kondisi, dan action

| Kode | Kondisi | Severity default | Action | Dampak Kirim |
|---|---|---|---|---|
| 00 | Tidak ada temuan validasi | `valid` | Data Valid | Boleh kirim |
| 01 | `PPA > 0` dan `PCRO = 0` | `blocking` | Wajib diperbaiki | Ditolak sampai diperbaiki/policy sah berlaku |
| 02 | `PCRO < PPA` | `confirmation_required` | Wajib konfirmasi | Butuh alasan dan review sesuai policy |
| 03 | `PCRO = 100` dan `RVRO = 0` | `correctable` default | Bisa diperbaiki | Default: warning kuat; Admin dapat menjadikannya blocker per policy/metode ukur |
| 04 | `PCRO = 100` dan `RVRO < volumeDipa` | `blocking` | Wajib diperbaiki | Ditolak |
| 05 | `RVRO > 0` dan `PPA = 0` | `confirmation_required` | Wajib konfirmasi | Butuh alasan/bukti; tidak otomatis dianggap salah |
| 06 | RVRO desimal dan satuan RO tidak mengizinkan desimal | `correctable` | Bisa diperbaiki | Tolak/simpan sesuai policy satuan; jangan diberlakukan global |
| 07 | `RVRO > volumeDipa` | `confirmation_required` | Wajib konfirmasi | Data actual tetap dapat disimpan; perlu alasan dan review; skor Formula 2 dapat cap 100 |
| 08 | `RVRO >= volumeDipa` dan `PCRO < 100` | `confirmation_required` | Wajib konfirmasi | Butuh review metode ukur/progres/bukti |

**Penting:** Rule 07 tidak boleh diperlakukan sebagai hard reject universal. Angka RVRO aktual mungkin memang melebihi volume DIPA dan harus bisa ditelusuri/ditindaklanjuti; yang dibatasi adalah skor, bukan penghapusan fakta data.

### 6.4 Status hasil validasi

```ts
type ValidationSeverity =
  | 'valid'
  | 'info'
  | 'warning'
  | 'correctable'
  | 'confirmation_required'
  | 'blocking';

type OutputValidationResult = {
  code: '00' | '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08';
  severity: ValidationSeverity;
  status: 'passed' | 'failed' | 'not_evaluable' | 'resolved';
  title: string;
  message: string;
  affectedFields: string[];
  requiresOperatorNote: boolean;
  requiresEvidence: boolean;
  requiresPPKReview: boolean;
  requiresKPPNFollowUp: boolean;
  policyVersion: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
};
```

### 6.5 Perilaku UI validasi

- Tampilkan hasil validasi langsung di bawah field relevan dan pada panel ringkasan.
- `blocking`: warna merah, jelaskan field mana yang harus diperbaiki, tombol Kirim nonaktif.
- `confirmation_required`: warna biru/kuning, tampilkan form alasan, bukti, dan status review.
- `correctable`: tampilkan rekomendasi koreksi; Admin dapat menentukan apakah tetap dapat dikirim.
- `not_evaluable`: tampilkan “PPA belum tersedia per RO; validasi tidak dapat dilakukan”, bukan “Data Valid”.
- Simpan setiap hasil validasi dan resolusinya pada riwayat laporan.

---

## 7. Integrasi PPA/realisasi anggaran per RO

### 7.1 Keputusan arsitektur

Validasi 01, 02, dan 05 serta early warning anomali PCRO–PPA **tidak boleh mengambil angka dari kartu indikator Penyerapan Anggaran satker secara langsung**. Kartu itu umumnya agregat per akun/jenis belanja, sedangkan validasi Capaian Output membutuhkan PPA pada tingkat RO.

Buat data layer/aggregat khusus realisasi anggaran per RO.

### 7.2 Model data

```text
ro_budget_realizations
- id
- fiscal_year_id
- organization_id
- ro_code
- month
- budget_amount_ro
- realized_amount_monthly
- realized_amount_cumulative
- ppa_monthly
- ppa_cumulative
- source_type: manual | import_sakti | import_omspan | account_allocation
- source_reference
- source_snapshot_at
- allocation_method
- verification_status: unverified | verified | estimated
- created_at / updated_at / audit fields
```

Rumus:

\[
PPA\ kumulatif = \frac{Realisasi\ Anggaran\ Kumulatif\ RO}{Pagu\ Anggaran\ RO} \times 100
\]

\[
Gap\ PCRO\text{-}PPA = PCRO\ kumulatif - PPA\ kumulatif
\]

### 7.3 Sumber data dan label kualitas

| Kondisi data | Implementasi | Label pada UI |
|---|---|---|
| Export sumber memiliki realisasi per RO | Import langsung | `Terverifikasi — direct RO mapping` |
| Realisasi hanya tersedia per akun | Mapping akun–RO dan metode alokasi | `Estimasi — account allocation` |
| Satu akun membiayai beberapa RO | Pilih metode alokasi dan simpan basisnya | `Estimasi — metode alokasi tercatat` |
| PPA belum tersedia | Jangan jalankan rule berbasis PPA sebagai valid | `Tidak dapat dievaluasi` |

Jika PPA memakai `account_allocation`, hasil validasi harus berstatus warning/estimasi dan tidak boleh diperlakukan sebagai penolakan formal tanpa review manusia.

### 7.4 Master RO

Tambahkan atribut master RO:

```text
ro_code
ro_name
unit
unit_allows_decimal
max_decimal_places
is_priority_national
budget_amount_ro
measurement_method
reporting_method
```

`is_priority_national` dan aturan desimal harus berasal dari master/policy Admin, bukan checkbox bebas Operator di form realisasi.

---

## 8. Early warning anomali PCRO–PPA

### 8.1 Rumus

\[
Gap = PCRO\ kumulatif - PPA\ kumulatif
\]

### 8.2 Threshold default yang dapat dikonfigurasi

| Jenis RO | Terlalu tinggi | Terlalu rendah |
|---|---:|---:|
| Output Prioritas Nasional | `Gap > +5` poin | `Gap < -5` poin |
| Output Non-Prioritas Nasional | `Gap > +20` poin | `Gap < -20` poin |

### 8.3 Perilaku

- PCRO lebih cepat dari PPA: `ANOMALI_CAPAIAN_TERLALU_TINGGI`.
- PPA lebih cepat dari PCRO: `ANOMALI_CAPAIAN_TERLALU_RENDAH`.
- Anomali adalah early warning dan bahan konfirmasi; bukan pengurang nilai IKPA otomatis.
- Tampilkan alasan bisnis yang dapat dipilih Operator, misalnya pembayaran termin tertunda, output telah disalurkan sebelum pembayaran, uang muka, kegiatan belum menghasilkan output fisik, atau sebab lain.
- Anomali tampil dalam Dashboard, menu Validasi, detail RO, export, dan email reminder bila belum ditindaklanjuti.
- Threshold wajib dibaca dari rule set/versioned validation policy.

---

## 9. Fairness Treatment

### 9.1 Prinsip

Fairness adalah pengecualian objek penilaian, bukan pengubahan angka realisasi dan bukan penghapusan RO.

Contoh: RO Khusus yang ditetapkan tidak menjadi objek Capaian Output tetap disimpan/tampil, tetapi dikeluarkan dari pembilang dan penyebut nilai Capaian RO serta ketepatan waktu.

### 9.2 Workflow

```text
Operator membuat usulan
→ draft/submitted
→ tidak memengaruhi nilai actual
→ Admin mereview
→ approved/rejected
→ Admin publish policy/exception
→ resolver menerapkan policy pada periode efektif
→ snapshot baru memakai policy baru
```

### 9.3 UI Operator

- Badge: `Dinilai`, `Dikecualikan Fairness`, atau `Usulan Menunggu Review`.
- Jika dikecualikan, tampilkan dasar, policy version, periode efektif, dan alasan.
- Jika masih proposal, tampilkan dampak hanya sebagai **simulasi**, tidak pada nilai actual.

### 9.4 UI Admin

Admin dapat membuat draft, preview dampak, publish, retire, dan mengaudit policy fairness. Policy harus memiliki scope, RO/pattern kode, tahun/periode efektif, alasan, dasar kebijakan, dan versi.

---

## 10. Reminder Center — hanya dua event

### 10.1 Prinsip

Buat dua event reminder Capaian Output saja:

1. **Pemutakhiran Target Kinerja triwulanan.**
2. **Pengisian Realisasi Kinerja bulanan.**

Keduanya tampil di Reminder Center, dikonfigurasi melalui Admin Policy, dapat dipantau Admin KPPN, dan benar-benar dikirim ke email pengguna terdaftar.

### 10.2 Event A — Pemutakhiran Target Kinerja triwulanan

```text
eventType: output_target_update_due
indicatorKey: output_achievement
name: Pemutakhiran Target Kinerja Output
category: recommended
schedule: H-10, H-3, H-0
dayType: workday
deadlineSource: target_update_window.closes_at
```

Aturan:

- Deadline berasal dari `target_update_windows` yang dipublish Admin; jangan hardcode tanggal.
- `H-10`, `H-3`, dan `H-0` adalah hari kerja relatif terhadap tanggal penutupan open period.
- Jika suatu jadwal sudah berlalu saat policy baru dipublish, jangan mengirim reminder yang tertinggal secara massal; hanya jadwalkan titik berikutnya atau kirim satu notifikasi status bila Admin memilihnya.
- Event dipicu untuk satker yang memiliki target draft/belum lengkap/belum dimutakhirkan pada window aktif.
- Jangan kirim jika target sudah terkirim, lengkap, dan tidak memerlukan pemutakhiran.

Isi email minimum:

```text
Subjek: [IKPA] Pemutakhiran Target Kinerja Output — H-3

Periode pemutakhiran target kinerja output [TW/Tahun] akan berakhir pada [tanggal].

Status satker:
- RO belum memiliki target lengkap: [n]
- RO dengan total TPCRO tidak 100%: [n]
- RO dengan total TRVRO tidak sama dengan volume DIPA: [n]
- RO perlu ditinjau karena revisi DIPA: [n]

Tindakan: buka menu Capaian Output > Target Kinerja.
[Deep link]
```

### 10.3 Event B — Pengisian Realisasi Kinerja bulanan

```text
eventType: output_realization_report_due
indicatorKey: output_achievement
name: Pengisian Realisasi Kinerja Output
defaultCategory: mandatory_internal
schedule: H-5, H-2, H-0
dayType: workday
deadlineSource: fifth_working_day_of_next_month
```

Aturan:

- Deadline untuk realisasi bulan `M` adalah hari kerja ke-5 pada bulan `M+1`.
- `H-5`, `H-2`, dan `H-0` dihitung sebagai hari kerja mundur dari deadline menggunakan kalender kerja aktif.
- H-5 dapat berada pada bulan pelaporan sebelumnya; sistem tetap menghitung dengan kalender kerja yang sama.
- Event hanya berlaku untuk RO `included`/objek penilaian.
- RO yang dikecualikan fairness tidak memicu reminder.
- Event tidak dikirim bila seluruh RO objek penilaian untuk periode itu sudah submitted dan confirmed sesuai status yang dipersyaratkan policy.
- Bila laporan sudah dikirim tetapi belum dikonfirmasi, email H-2/H-0 menyebutkan jumlah laporan yang masih menunggu konfirmasi.

Isi email minimum:

```text
Subjek: [IKPA] Pengisian Realisasi Kinerja Output — H-2

Batas pelaporan Capaian Output periode [bulan tahun] adalah [tanggal deadline].

Status satker:
- RO belum dikirim: [n]
- RO sudah dikirim, belum dikonfirmasi: [n]
- RO memiliki blocker validasi: [n]
- RO memerlukan konfirmasi validasi: [n]
- RO dikecualikan fairness: [n]

Tindakan: buka menu Capaian Output > Realisasi Kinerja.
[Deep link]
```

### 10.4 Penerima email

Penerima utama adalah seluruh email aktif yang termapping sebagai Operator Satker pada organisasi terkait.

Konfigurasi tambahan di Reminder Center:

- Operator dapat menambah email penerima internal yang valid jika policy mengizinkan.
- Admin menentukan penerima wajib dan apakah event dapat dinonaktifkan.
- Untuk event realisasi bulanan, penerima wajib minimal Operator Satker aktif; tambahkan PPK bila data/mapping tersedia dan policy menetapkannya.
- Jangan mengirim email ke alamat yang belum diverifikasi atau sudah nonaktif.

### 10.5 Tampilan Reminder Center

Tampilkan tabel:

| Event | Status | Deadline berikutnya | Jadwal | Penerima | Konfigurasi Satker | Aksi |
|---|---|---|---|---|---|---|
| Pemutakhiran Target Kinerja | Aktif | Tanggal open period terdekat | H-10, H-3, H-0 | Operator Satker | Jam/penerima tambahan | Kelola |
| Pengisian Realisasi Kinerja | Aktif | Hari kerja ke-5 bulan berikutnya | H-5, H-2, H-0 | Operator Satker, PPK sesuai policy | Jam/penerima tambahan | Kelola |

Operator boleh mengubah:

- jam kirim;
- penerima tambahan;
- kanal/digest jika tersedia;
- pesan internal tambahan.

Operator tidak boleh mengubah:

- rumus deadline;
- hari kerja menjadi hari kalender;
- titik H-10/H-3/H-0 atau H-5/H-2/H-0;
- penerima wajib;
- status mandatory event realisasi, bila Admin menguncinya.

---

## 11. Scheduler, email provider, dan delivery log

### 11.1 Arsitektur wajib

```text
Data target/realisasi berubah atau jadwal harian berjalan
→ resolver policy + kalender kerja + eligibility fairness
→ hitung deadline/event yang relevan
→ buat kandidat reminder
→ cek kondisi kelayakan dan apakah kasus sudah selesai
→ cek idempotency key
→ masukkan delivery ke queue
→ worker aman mengirim email provider
→ simpan status delivery dan audit
```

Gunakan scheduler/queue yang sudah digunakan aplikasi atau implementasikan dengan:

- Cron terjadwal.
- Upstash QStash untuk queue dan pemanggilan job aman.
- Resend sebagai email provider.
- React Email/template email bila stack tersebut telah tersedia.

### 11.2 Jadwal worker

- Worker evaluasi reminder minimal sekali setiap hari kerja, pukul 07.00 WIB.
- Worker delivery dapat berjalan segera setelah event dibuat atau per interval yang aman.
- H-0 dapat dikirim pukul 07.00 WIB agar operator masih memiliki waktu pada hari deadline.
- Timezone default: `Asia/Jakarta`; timezone satker dapat digunakan bila fitur tersebut tersedia dan disetujui policy.

### 11.3 Tabel yang diperlukan

```text
reminder_policies
- id
- rule_set_id
- event_type
- indicator_key
- category
- deadline_formula
- day_type
- schedule_json
- required_recipients_json
- allow_disable
- allow_recipient_override
- active
- version

org_reminder_configs
- id
- organization_id
- reminder_policy_id
- enabled
- send_time
- timezone
- additional_recipients_json
- custom_message
- updated_by / updated_at

notification_deliveries
- id
- organization_id
- reminder_policy_id
- event_type
- ro_code nullable
- fiscal_year
- period_month nullable
- scheduled_for
- sent_at nullable
- recipient_email
- provider_message_id nullable
- idempotency_key unique
- status: queued | sent | failed | skipped | cancelled
- failure_reason nullable
- payload_json
- rule_set_version
- created_at / updated_at
```

### 11.4 Idempotensi dan pembatalan

Buat `idempotency_key` unik:

```text
{eventType}:{organizationId}:{roCode-or-all}:{fiscalYear}:{period}:{scheduledFor}:{recipientEmail}
```

Aturan:

- Satu jadwal dan penerima tidak boleh menghasilkan dua email.
- Jika target/realisasi sudah lengkap sebelum waktu kirim, delivery menjadi `skipped`.
- Jika RO menjadi excluded fairness sebelum pengiriman, reminder RO tersebut menjadi `cancelled`/`skipped`.
- Jika email gagal, worker dapat retry dengan batas retry dan exponential backoff.
- Semua retry memakai idempotency key yang sama.
- Jangan retry email permanent failure, alamat invalid, atau policy disabled.

### 11.5 Environment dan keamanan

Tambahkan environment variable server-side:

```text
RESEND_API_KEY=
RESEND_FROM_EMAIL=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
APP_BASE_URL=
REMINDER_CRON_SECRET=
```

- Jangan pernah mengekspos API key ke browser.
- Endpoint cron/job wajib memverifikasi signature QStash atau `REMINDER_CRON_SECRET`.
- Gunakan domain email yang sudah diverifikasi pada provider.
- Catat provider message ID, tetapi jangan menyimpan isi sensitif bukti capaian pada email/log delivery.

---

## 12. Dashboard, riwayat, export, dan Admin monitoring

### 12.1 Dashboard Operator

Kartu Capaian Output harus konsisten dengan bulan/periode yang dipilih.

Tampilkan:

- NK-ROKW, NK-CRO, nilai IKPA-CO, dan kontribusi bobot 25%.
- Jumlah RO terdaftar, dinilai, fairness excluded, belum kirim, belum konfirmasi, blocker validasi, dan confirmation required.
- Deadline pelaporan dan deadline target update berikutnya.
- Status target aktif/version dan status open period.
- Deep link dengan bulan/filter yang sama.

Jangan mencampur nilai bulanan pada halaman detail dengan agregat FY pada dashboard tanpa label. Sediakan pilihan jelas: `Bulan Ini`, `YTD`, atau `Tahunan`.

### 12.2 Dashboard Admin KPPN

Tampilkan per satker:

- target belum lengkap atau belum dimutakhirkan;
- laporan realisasi belum dikirim/terkonfirmasi;
- jumlah blocker dan konfirmasi wajib;
- anomali PCRO–PPA;
- usulan fairness menunggu review;
- reminder queued/sent/failed/skipped;
- policy/reminder version yang digunakan.

### 12.3 Riwayat dan export

Snapshot harus menyimpan:

- versi target efektif;
- rule set version;
- validation results;
- fairness policy/eligibility;
- PPA source dan verification status;
- trace Formula 1/Formula 2;
- deadline dan status ketepatan.

Export XLSX/PDF harus memiliki bagian terpisah:

1. Target Kinerja per RO dan versi target.
2. Realisasi Kinerja per RO/bulan.
3. Hasil validasi 00–08 dan resolusinya.
4. RO dikecualikan fairness beserta dasar policy.
5. PPA source/method dan anomali PCRO–PPA.
6. Ringkasan jadwal/status reminder.

---

## 13. Perubahan model data minimum

Implementasikan atau migrasikan entitas berikut:

```text
output_target_plans
output_target_plan_versions (opsional bila version di tabel utama tidak cukup)
target_update_windows
output_reports (realisasi; pisahkan dari target)
output_validation_results
ro_budget_realizations
ro_master_attributes / output_ro_master
assessment_exclusion_policies
assessment_exclusion_proposals
reminder_policies
org_reminder_configs
notification_deliveries
workdays
audit_logs
```

Jangan menggunakan upsert yang menimpa jejak realisasi atau target lama tanpa history. Untuk koreksi, simpan revision/audit record.

---

## 14. Test cases wajib

### 14.1 Target

| ID | Skenario | Ekspektasi |
|---|---|---|
| TAR-01 | Total target RVRO Jan–Des = volume DIPA | Lolos validasi |
| TAR-02 | Total target PCRO Jan–Des = 100% | Lolos validasi |
| TAR-03 | Total target volume berbeda dengan volume DIPA | Blocker target; tidak dapat dikirim |
| TAR-04 | Total TPCRO ≠ 100% | Blocker target; tidak dapat dikirim |
| TAR-05 | Operator memutakhirkan target saat window open | Terbuat versi baru dan audit |
| TAR-06 | Operator mencoba mengubah target saat window closed | Ditolak, tanpa perubahan data |
| TAR-07 | Target perubahan menyentuh bulan historis terkunci | Ditolak atau workflow koreksi berotorisasi |

### 14.2 Realisasi dan nilai

| ID | Skenario | Ekspektasi |
|---|---|---|
| REAL-01 | Non-Desember PCRO 34, TPCRO 42 | Formula 1 = 80,95 |
| REAL-02 | Non-Desember PCRO 100, RVRO 2, volume 2 | Formula 2 = 100 |
| REAL-03 | Desember PCRO 40, RVRO 2, volume 4 | Formula 2 = 50; bukan 100 otomatis |
| REAL-04 | PCRO 0 dan TPCRO 0 | Nilai Capaian RO = 0 |
| REAL-05 | Report belum confirmed | Nilai Capaian RO = 0 |
| REAL-06 | Submit tepat pada deadline 5 HK | Ketepatan = 100 |
| REAL-07 | Submit melewati deadline | Ketepatan = 0 |
| REAL-08 | Tidak ada submittedAt | Tidak boleh dianggap tepat waktu |

### 14.3 Validasi 00–08

| ID | Skenario | Ekspektasi |
|---|---|---|
| VAL-00 | Semua data konsisten | 00 valid |
| VAL-01 | PPA 10, PCRO 0 | Blocker, Kirim tidak aktif |
| VAL-02 | PPA 64, PCRO 55 | Confirmation required dan alasan wajib |
| VAL-03 | PCRO 100, RVRO 0 | Correctable/warning sesuai policy |
| VAL-04 | PCRO 100, RVRO < volume | Blocker |
| VAL-05 | RVRO > 0, PPA 0 | Confirmation required |
| VAL-06 | RVRO desimal pada unit integer only | Correctable/block sesuai policy satuan |
| VAL-07 | RVRO > volume | Confirmation required; data tidak dihapus; skor cap 100 bila Formula 2 |
| VAL-08 | RVRO >= volume, PCRO < 100 | Confirmation required |
| VAL-09 | PPA per RO belum tersedia | not_evaluable, bukan valid |

### 14.4 Anomali dan fairness

| ID | Skenario | Ekspektasi |
|---|---|---|
| ANOM-01 | RO PN: PCRO 72, PPA 66 | Anomali tinggi +6 poin |
| ANOM-02 | RO Non-PN: PCRO 40, PPA 80 | Anomali rendah -40 poin |
| FAIR-01 | RO policy excluded | Tidak masuk pembilang/penyebut NK-ROKW dan NK-CRO |
| FAIR-02 | Proposal operator belum approved | Tidak mengubah nilai actual |
| FAIR-03 | Policy effective dari bulan tertentu | Hanya diterapkan pada periode efektif |

### 14.5 Reminder dan email

| ID | Skenario | Ekspektasi |
|---|---|---|
| REM-01 | Window target deadline D | Delivery terjadwal H-10, H-3, H-0 hari kerja |
| REM-02 | Deadline realisasi 5 HK bulan berikutnya | Delivery terjadwal H-5, H-2, H-0 hari kerja |
| REM-03 | Target sudah lengkap sebelum jadwal | Delivery skipped |
| REM-04 | Semua laporan realisasi complete sebelum jadwal | Delivery skipped |
| REM-05 | Reminder diproses ulang | Tidak ada email duplikat karena idempotency key |
| REM-06 | Email provider gagal sementara | Retry tercatat; status failed/sent dapat dipantau |
| REM-07 | RO fairness excluded | Tidak memicu reminder realisasi |
| REM-08 | Alamat penerima nonaktif | Delivery skipped/failed dengan alasan tercatat |

---

## 15. Urutan implementasi

### P0 — wajib sebelum go-live

1. Pisahkan model data Target Kinerja dan Realisasi Kinerja.
2. Implementasi versi target dan `target_update_windows` triwulanan.
3. Jadikan `submittedAt` timestamp sistem; hapus date picker bebas untuk penilaian ketepatan waktu.
4. Implementasi Validation Engine 00–08 serta lifecycle blocker/confirmation required.
5. Buat `ro_budget_realizations` dan integrasi PPA per RO dengan label kualitas sumber data.
6. Selaraskan Engine IKPA, preview UI, dashboard, export, dan snapshot menggunakan modul desimal/resolver yang sama.
7. Pastikan proposal fairness tidak memengaruhi nilai actual sebelum approved/published.
8. Hilangkan hardcode policy/bobot/RO exception; baca dari rule set/policy berversi.

### P1 — reminder benar-benar terkirim

1. Buat dua Reminder Policy sesuai bagian 10.
2. Implementasi Reminder Center untuk dua event tersebut.
3. Implementasi scheduler, queue, provider email, delivery log, retry, dan idempotency.
4. Implementasi email template dan deep link ke halaman Target/Realisasi sesuai masalah.
5. Implementasi dashboard monitoring delivery untuk Operator dan Admin.

### P2 — penguatan UX dan analisis

1. Grafik target output kumulatif vs RPD/PPA kumulatif.
2. Dashboard anomali PCRO–PPA dan daftar prioritas tindakan.
3. Import template target, realisasi, dan PPA per RO.
4. Upload bukti dokumen terkelola dan audit koreksi data.
5. Export lengkap target/realisasi/validasi/fairness/reminder.

---

## 16. Definition of Done

Fitur hanya dinyatakan selesai jika semua kondisi berikut terpenuhi:

- Target Kinerja dan Realisasi Kinerja berada pada halaman/model data yang terpisah tetapi terhubung.
- Target disusun Januari–Desember, total PCRO 100%, dan total RVRO sama dengan volume DIPA.
- Target dapat dimutakhirkan melalui open period triwulanan yang dikonfigurasi Admin dan tersimpan berversi.
- Realisasi bulanan memiliki early warning 00–08 dan tidak dapat dikirim saat ada blocker.
- Validasi berbasis PPA hanya aktif apabila PPA per RO tersedia dan sumbernya jelas.
- Formula 1, Formula 2, PCRO 0, konfirmasi, deadline 5 HK, dan fairness dihitung konsisten dalam engine final.
- RO fairness excluded tidak mengubah pembilang/penyebut, tetapi data tetap tampil/auditable.
- Hanya ada dua event reminder: target triwulanan H-10/H-3/H-0 dan realisasi bulanan H-5/H-2/H-0.
- Reminder terhubung dari Reminder Center ke scheduler, queue, email provider, email penerima aktif, delivery log, retry, dan idempotency.
- Dashboard, export, history, dan email menggunakan periode/policy/rule set yang sama.
- Tidak ada mutasi sukses palsu saat database/email provider tidak tersedia; pengguna harus menerima error yang jujur dan dapat ditindaklanjuti.
- Semua test case pada bagian 14 lulus otomatis.
