# Spesifikasi Penyempurnaan Simulasi GUP — Analisis dan Rekomendasi

**Tujuan dokumen:** Instruksi implementasi untuk AI coding agent agar menyempurnakan halaman frontend **“Simulasi Rencana Sisa Tahun (GUP + KKP) · Interaktif”** tanpa mengganti kalkulasi, komponen, atau alur simulasi yang sudah berjalan baik.

**Prioritas:** Tingkatkan kualitas bagian **Hasil Analisis GUP** agar memberikan keputusan yang mudah dipahami dan rekomendasi nominal/tanggal yang dapat langsung ditindaklanjuti oleh satker.

**Prinsip utama:** Semua tanggal dan nominal berasal dari input pengguna/satker. Jangan hardcode contoh tanggal, nama KPPN, jam cut-off, tahun, jumlah hari bulan, atau nominal tertentu.

---

## 1. Batas Perubahan

### Tetap pertahankan

- Halaman dan judul yang sudah ada: `Simulasi Rencana Sisa Tahun (GUP + KKP) · Interaktif`.
- Mekanisme simulasi yang tidak mengubah data aktual database.
- Input eksisting:
  - `Nilai UP (Rp)`
  - `Nilai Rencana GUP (Rp)`
  - `Tanggal GUP Sebelumnya`
  - `Tanggal Rencana GUP (SP2D)`
- Tombol `Reset Simulasi`, tombol reset asumsi, kartu dampak total, integrasi kalkulasi KKP, serta visual/table simulasi 28/30/31 hari yang telah ada.
- Perhitungan skor GUP existing sebagai komponen nilai UP/TUP dan dampaknya pada total IKPA.
- Informasi bahwa simulasi bersifat internal/estimasi, bukan nilai resmi.

### Tambahkan

- Modul hasil analisis GUP yang deterministik, transparan, dan berbasis aturan.
- Status kelayakan operasional GUP yang dipisahkan dari status kualitas/optimalitas IKPA.
- Rekomendasi angka minimum dan/atau tanggal target yang otomatis dihitung.
- Penjelasan rumus ringkas, alasan status, dan kondisi yang harus diperbaiki.
- Validasi input dan edge cases tanggal/nominal.
- Generalisasi penuh untuk semua tanggal yang dimasukkan satker.

### Jangan lakukan

- Jangan menulis bahwa pengajuan “disetujui/ditolak KPPN” atau “terekam ke database KPPN”. Aplikasi ini adalah simulator internal.
- Jangan hardcode `31 hari`, `Januari`, tanggal contoh, atau nama KPPN tertentu.
- Jangan mengubah nilai transaksi aktual hanya karena pengguna sedang menjalankan simulasi.
- Jangan menghapus tabel simulasi 28/30/31 hari; cukup jadikan sebagai alat bantu sekunder/collapsible.
- Jangan menyatakan bahwa nominal 100% UP pasti menghasilkan IKPA optimal jika rencana tanggal sudah melewati batas satu bulan.

---

## 2. Definisi Data dan Parameter

Gunakan nama field yang sesuai dengan codebase saat ini; nama berikut adalah kontrak logika.

| Parameter | Tipe | Sumber | Ketentuan |
|---|---|---|---|
| `upAmount` | number | Input `Nilai UP (Rp)` | Harus lebih dari 0 |
| `plannedGupAmount` | number | Input `Nilai Rencana GUP (Rp)` | Harus lebih dari 0 dan tidak melebihi `upAmount` untuk simulasi standar |
| `previousSp2dDate` | date | Input `Tanggal GUP Sebelumnya` | Tanggal valid |
| `plannedSp2dDate` | date | Input `Tanggal Rencana GUP (SP2D)` | Harus sesudah `previousSp2dDate` |
| `referenceMonthDays` | integer | Turunan tanggal | Jumlah hari kalender pada **bulan dari `previousSp2dDate`**: 28, 29, 30, atau 31 |
| `intervalDays` | integer | Turunan tanggal | Selisih hari kalender: `plannedSp2dDate - previousSp2dDate` |
| `minGupRatio` | number | Rule set/config | Default `0.50`; jangan hardcode di UI bila rule set sudah tersedia |
| `optimalAnnualizedRatio` | number | Rule set/config | Default `1.00` atau 100% |
| `timeLimitDays` | integer | Turunan/config | Default sama dengan `referenceMonthDays` |

### Aturan tanggal

1. Gunakan perbedaan **hari kalender**, bukan hari kerja, untuk interval GUP disebulankan.
2. `referenceMonthDays` harus dihitung dari bulan dan tahun `previousSp2dDate`.
3. Perhitungan harus otomatis benar untuk Februari tahun kabisat (29 hari).
4. `latestOnTimeDate = addCalendarMonths(previousSp2dDate, 1)`.
5. Status tepat waktu jika `plannedSp2dDate <= latestOnTimeDate`.
6. Hindari masalah timezone: normalisasi kedua input ke local calendar date sebelum menghitung selisih hari. Jangan menghitung dengan timestamp UTC yang dapat menggeser tanggal.
7. Jika sistem nanti memiliki kalender operasional/cut-off KPPN, tampilkan sebagai **warning terpisah**; jangan diam-diam mengubah tanggal simulasi atau formula dasar.

---

## 3. Rumus Perhitungan

Gunakan pembagian sebagai rasio di engine; format persen hanya di presentation layer.

```ts
const rawGupRatio = plannedGupAmount / upAmount;
const intervalDays = calendarDayDiff(previousSp2dDate, plannedSp2dDate);
const referenceMonthDays = daysInMonth(previousSp2dDate);
const annualizedGupRatio = rawGupRatio * (referenceMonthDays / intervalDays);
const annualizedGupPercent = annualizedGupRatio * 100;

const minGupAmount = upAmount * minGupRatio;
const isMinimumAmountMet = plannedGupAmount >= minGupAmount;
const isOnTime = plannedSp2dDate <= addCalendarMonths(previousSp2dDate, 1);
const isProportional = annualizedGupRatio >= optimalAnnualizedRatio;
```

### Batas dan rekomendasi nilai

```ts
// Nilai minimum agar tepat 100% disebulankan pada tanggal rencana
const minimumAmountForOptimalAtPlannedDate = Math.min(
  upAmount,
  upAmount * optimalAnnualizedRatio * (intervalDays / referenceMonthDays),
);

// Nominal minimum yang memenuhi syarat nominal dan proporsional
const recommendedMinimumAmount = Math.min(
  upAmount,
  Math.max(minGupAmount, minimumAmountForOptimalAtPlannedDate),
);

// Selisih hari maksimum agar nilai GUP saat ini mencapai 100% disebulankan
const maxIntervalForCurrentAmount = Math.floor(
  rawGupRatio * referenceMonthDays / optimalAnnualizedRatio,
);

// Selisih hari maksimum untuk GUP minimal (misalnya 50% UP)
const maxIntervalForMinimumAmount = Math.floor(
  minGupRatio * referenceMonthDays / optimalAnnualizedRatio,
);

const latestOptimalDateForCurrentAmount = addDays(
  previousSp2dDate,
  maxIntervalForCurrentAmount,
);

const latestOptimalDateForMinimumAmount = addDays(
  previousSp2dDate,
  maxIntervalForMinimumAmount,
);
```

### Nilai tampilan

- Format rupiah: locale `id-ID`, tanpa digit desimal bila nominal bulat; gunakan 2 digit bila hasil rekomendasi pecahan.
- Rekomendasi nominal sebaiknya **dibulatkan ke atas** ke rupiah penuh agar tidak menghasilkan nilai tepat di bawah ambang akibat pembulatan.
- Format persen: dua digit desimal, misalnya `94,72%`.
- Format tanggal: `dd MMMM yyyy` untuk analisis lengkap, misalnya `25 Mei 2026`; input boleh tetap `dd/MM/yyyy`.
- Jangan membulatkan nilai sebelum logika perbandingan. Bandingkan nilai presisi di engine; pembulatan hanya untuk tampilan.

---

## 4. Mesin Status Analisis

Tentukan dua status yang terpisah agar pengguna tidak menyamakan kelayakan nominal GUP dengan optimalitas nilai IKPA.

### 4.1 Status kelayakan rencana GUP

| Kondisi | `submissionStatus` | Label UI | Severity |
|---|---|---|---|
| Input belum valid | `INCOMPLETE` | Lengkapi data simulasi | neutral |
| `plannedGupAmount < minGupAmount` | `BELOW_MINIMUM` | Nominal belum memenuhi batas minimum | danger |
| `plannedGupAmount >= minGupAmount` dan `isOnTime` dan `isProportional` | `ELIGIBLE_OPTIMAL` | Memenuhi syarat nominal dan proporsional | success |
| `plannedGupAmount >= minGupAmount` dan `isOnTime` dan `!isProportional` | `NOT_PROPORTIONAL` | Nominal belum proporsional terhadap waktu | warning/danger |
| `plannedGupAmount >= minGupAmount` dan `!isOnTime` | `LATE` | Melewati batas satu bulan | warning |

### 4.2 Status kualitas IKPA GUP

| Kondisi | `ikpaQualityStatus` | Label UI |
|---|---|---|
| Input belum valid | `UNAVAILABLE` | Belum dapat dihitung |
| `isOnTime && isProportional` | `OPTIMAL` | IKPA GUP optimal |
| `isOnTime && !isProportional` | `BELOW_OPTIMAL` | IKPA GUP belum optimal |
| `!isOnTime` | `LATE_NOT_OPTIMAL` | IKPA GUP tidak optimal karena terlambat |

### Urutan evaluasi wajib

1. Validasi input terlebih dahulu.
2. Hitung interval hari, jumlah hari bulan referensi, rasio nominal, dan persentase disebulankan.
3. Evaluasi batas minimum nominal.
4. Evaluasi ketepatan waktu.
5. Evaluasi proporsionalitas.
6. Bentuk status dan rekomendasi.

Jangan hanya memakai `annualizedGupPercent >= 100%` untuk menyatakan semuanya aman. Nominal dapat proporsional secara teori namun tetap perlu memenuhi syarat minimum nominal sesuai rule set.

---

## 5. Rekomendasi Berbasis Kondisi

Rekomendasi harus spesifik, singkat, dan actionable. Tampilkan maksimal dua tindakan utama dan satu catatan pendukung.

### A. Nominal di bawah minimum

**Pemicu:** `plannedGupAmount < minGupAmount`.

**Judul:** `Nilai rencana GUP belum memenuhi batas minimum`

**Isi utama:**

```text
Nilai rencana GUP sebesar {plannedGupAmount} masih di bawah batas minimum {minGupRatioPercent} dari UP.
Nilai GUP minimum adalah {minGupAmount}.
```

**Aksi pertama:**

```text
Naikkan nilai rencana GUP minimal menjadi {minGupAmount}.
```

**Aksi kedua:**

```text
Agar nilai minimum tersebut tetap setara {optimalAnnualizedRatioPercent} disebulankan,
rencanakan SP2D paling lambat {latestOptimalDateForMinimumAmount} (selisih {maxIntervalForMinimumAmount} hari kalender dari SP2D sebelumnya).
```

**Jika tanggal rencana juga terlalu lambat:** tambahkan:

```text
Tanggal rencana saat ini melewati batas satu bulan. Memenuhi nominal minimum saja tidak membuat kualitas IKPA GUP optimal; tanggal perlu dimajukan.
```

### B. Nominal memenuhi minimum, tepat waktu, tetapi belum proporsional

**Pemicu:** `isMinimumAmountMet && isOnTime && !isProportional`.

**Judul:** `Nilai GUP belum proporsional terhadap interval SP2D`

**Isi utama:**

```text
Dengan nilai GUP {plannedGupAmount} dan interval {intervalDays} hari kalender,
persentase GUP disebulankan baru mencapai {annualizedGupPercent}.
Target kualitas optimal adalah minimal {optimalAnnualizedRatioPercent}.
```

**Aksi pertama — pertahankan tanggal:**

```text
Jika tanggal SP2D tetap {plannedSp2dDate}, tingkatkan nilai rencana GUP minimal menjadi {minimumAmountForOptimalAtPlannedDate}.
```

**Aksi kedua — pertahankan nominal:**

```text
Jika nilai GUP tetap {plannedGupAmount}, rencanakan SP2D paling lambat {latestOptimalDateForCurrentAmount}.
```

**Catatan:** Jika `latestOptimalDateForCurrentAmount` sudah sebelum tanggal saat ini atau interval maksimal 0 hari, jangan memberikan tanggal yang membingungkan. Tampilkan:

```text
Dengan nominal saat ini, target 100% disebulankan tidak realistis pada interval rencana. Prioritaskan penyesuaian nominal GUP.
```

### C. Nominal memenuhi minimum tetapi terlambat

**Pemicu:** `isMinimumAmountMet && !isOnTime`.

**Judul:** `Rencana SP2D melewati batas satu bulan`

**Isi utama:**

```text
Rencana SP2D {plannedSp2dDate} berada {lateDays} hari kalender setelah batas tepat waktu {latestOnTimeDate}.
Pengajuan dapat memenuhi batas nominal, tetapi kualitas IKPA GUP tidak optimal karena terlambat.
```

**Aksi utama:**

```text
Majukan rencana SP2D paling lambat ke {latestOnTimeDate}.
```

**Catatan penting:**

```text
Menaikkan nilai GUP hingga {upAmount} tidak dapat membuat nilai disebulankan mencapai {optimalAnnualizedRatioPercent} jika interval sudah lebih panjang daripada {referenceMonthDays} hari.
```

Hanya tampilkan catatan ini bila benar secara matematis, yaitu saat `intervalDays > referenceMonthDays`.

### D. Kondisi optimal

**Pemicu:** `isMinimumAmountMet && isOnTime && isProportional`.

**Judul:** `Rencana GUP telah optimal untuk simulasi ini`

**Isi utama:**

```text
Nilai GUP memenuhi batas minimum, rencana SP2D masih dalam batas satu bulan, dan persentase GUP disebulankan mencapai {annualizedGupPercent}.
```

**Catatan:**

```text
Pertahankan kelengkapan dokumen dan verifikasi tanggal pengiriman agar realisasi SP2D tidak bergeser dari rencana.
```

### E. Input tidak valid

**Pemicu:** UP nol, GUP nol/negatif, GUP > UP, tanggal kosong, atau rencana tidak sesudah tanggal sebelumnya.

Tampilkan error inline pada input serta ringkasan analisis:

```text
Hasil analisis belum dapat dibuat. Perbaiki data yang ditandai terlebih dahulu.
```

---

## 6. Desain Frontend yang Disarankan

Sesuaikan dengan tampilan existing pada screenshot: halaman ber-background beige, card putih dengan sudut membulat, input dua kolom desktop, card nilai abu-abu terang, warna hijau untuk aman, merah untuk masalah, dan tombol reset yang sudah tersedia.

### 6.1 Struktur desktop

Letakkan panel analisis **tepat setelah** card `Nilai IKPA Kualitas GUP` existing dan **sebelum** accordion `Tabel Simulasi GUP dengan 28, 30, dan 31 hari yang disebulankan`.

```text
┌───────────────────────────────────────────────────────────────────────┐
│ Nilai IKPA Kualitas GUP                                                │
│ Persentase GUP ... · maks. ... · SP2D ... hari                         │
│ 94,72%                                                                  │
│ Ubah tanggal atau tambah nominal ...                                   │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────── HASIL ANALISIS GUP ───────────────────────┐
│ [ikon severity] Rencana GUP belum proporsional terhadap interval SP2D  │
│                                                                         │
│ [Status rencana]        [Ketepatan waktu]       [GUP disebulankan]     │
│ Nominal perlu ditambah  Tepat waktu              94,72% / target 100%  │
│                                                                         │
│ Penjelasan singkat ...                                                  │
│                                                                         │
│ Saran tindakan                                                         │
│ 1. Jika SP2D tetap {tanggal}: naikkan GUP minimal menjadi {rupiah}.    │
│ 2. Jika GUP tetap {rupiah}: ajukan SP2D paling lambat {tanggal}.       │
│                                                                         │
│ [Lihat dasar perhitungan ▾]                                            │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│ ▸ Tabel Simulasi GUP dengan 28, 30, dan 31 hari yang disebulankan      │
└───────────────────────────────────────────────────────────────────────┘
```

### 6.2 Struktur mobile

- Card analisis tetap berada sebelum accordion tabel simulasi.
- Tiga indikator ringkas boleh berubah menjadi satu kolom atau scroll horizontal, tetapi teks rekomendasi tidak boleh terpotong.
- Dua aksi rekomendasi disajikan sebagai dua blok terpisah: `Pertahankan tanggal` dan `Pertahankan nominal`.
- Tidak gunakan tabel horizontal untuk isi utama analisis.

```text
┌──────────────────────────────────┐
│ ⚠ HASIL ANALISIS GUP              │
│ Nominal belum proporsional        │
│                                  │
│ [Tepat waktu]                     │
│ [94,72% dari target 100%]         │
│                                  │
│ Dengan interval 20 hari ...       │
│                                  │
│ SARAN TINDAKAN                    │
│ Jika tanggal tetap                │
│ Naikkan GUP menjadi Rp ...        │
│                                  │
│ Jika nominal tetap                │
│ Majukan SP2D paling lambat ...    │
│                                  │
│ [Dasar perhitungan ▾]             │
└──────────────────────────────────┘
```

### 6.3 Card ringkasan analisis

Gunakan tiga informasi singkat:

| Elemen | Contoh label | Tampilan |
|---|---|---|
| Status rencana | `Perlu penyesuaian nominal` | badge severity |
| Status waktu | `Tepat waktu` atau `Terlambat {n} hari` | hijau/kuning/merah |
| Kualitas GUP | `94,72% dari target 100%` | angka besar/semibold |

Jangan memakai kombinasi merah/hijau saja. Sertakan ikon dan teks status untuk aksesibilitas.

### 6.4 Dasar perhitungan collapsible

Tambahkan detail yang dapat dibuka pengguna tanpa memenuhi layar awal.

```text
Dasar perhitungan
- Nilai UP: {upAmount}
- Nilai rencana GUP: {plannedGupAmount} ({rawGupPercent} dari UP)
- SP2D sebelumnya: {previousSp2dDate}
- Rencana SP2D: {plannedSp2dDate}
- Selisih: {intervalDays} hari kalender
- Hari bulan referensi: {referenceMonthDays} hari ({referenceMonthName})
- Perhitungan: {rawGupPercent} × {referenceMonthDays}/{intervalDays}
- Persentase GUP disebulankan: {annualizedGupPercent}
- Batas waktu satu bulan: {latestOnTimeDate}
- Batas minimum GUP: {minGupRatioPercent} dari UP = {minGupAmount}
```

Gunakan `referenceMonthName` dari tanggal input, misalnya `Mei`, bukan nama bulan tetap.

---

## 7. Integrasi dengan Card Existing

Card existing saat ini berisi kira-kira:

- Persentase GUP
- Maksimal/tanggal batas
- Jumlah hari disebulankan
- Jumlah hari SP2D
- Nilai `IKPA Kualitas GUP`
- Pesan umum “ubah tanggal lebih cepat atau tambah nilai”
- Margin hari kalender

Sempurnakan dengan aturan berikut.

### Card nilai existing

- Tetap tampilkan nilai persentase GUP disebulankan sebagai angka utama.
- Ubah pesan umum menjadi ringkasan 1 baris yang konsisten dengan `analysisStatus`.
- Jangan memuat seluruh saran panjang di card ini; seluruh uraian dan nominal rekomendasi berada pada card `Hasil Analisis GUP` baru.
- Bila optimal, gunakan warna hijau dan kalimat: `Rencana memenuhi target kualitas GUP.`
- Bila belum proporsional namun tepat waktu, gunakan warna amber/merah dan kalimat: `Nilai GUP perlu ditambah atau tanggal SP2D perlu dimajukan.`
- Bila terlambat, gunakan warna amber/merah dan kalimat: `Rencana SP2D melewati batas satu bulan; kualitas GUP tidak optimal.`
- Margin kalender tetap ditampilkan, tetapi definisinya harus jelas:
  - Jika tepat waktu: `Sisa waktu menuju batas: {n} hari kalender.`
  - Jika terlambat: `Melewati batas: {n} hari kalender.`

### Hindari istilah ambigu

- Jangan gunakan `maks.` tanpa konteks. Ganti menjadi `Batas tepat waktu` atau `SP2D paling lambat`.
- Jangan gunakan `SP2D 20 hari` tanpa subjek. Ganti menjadi `Interval antar-SP2D: 20 hari kalender`.
- Jangan tampilkan `proporsional` tanpa menyebut target `100% disebulankan`.

---

## 8. Perilaku Interaktif

1. Setiap perubahan nominal atau tanggal harus memperbarui:
   - persentase GUP,
   - selisih hari,
   - jumlah hari bulan referensi,
   - batas tepat waktu,
   - kualitas GUP,
   - status analisis,
   - semua angka rekomendasi,
   - dampak total simulasi.
2. Gunakan debounce ringan untuk input nominal jika diperlukan, namun perubahan tanggal harus terasa langsung.
3. `Reset` pada blok `Atur Asumsi UP/TUP` mengembalikan field GUP ke baseline simulasi yang sudah ada.
4. `Reset Simulasi` mengembalikan seluruh GUP + KKP ke baseline aplikasi.
5. Tidak ada update database aktual saat input simulasi berubah.
6. Bila pengguna memilih menyimpan skenario di fitur aplikasi yang sudah tersedia, simpan input dan hasil analisis sebagai snapshot agar dapat ditelusuri dengan rule set versi aktif.

---

## 9. Edge Cases dan Validasi

| Kasus | Perilaku yang diharapkan |
|---|---|
| `upAmount <= 0` | Error: `Nilai UP harus lebih dari Rp0.` Jangan menghitung rasio |
| `plannedGupAmount <= 0` | Error: `Nilai rencana GUP harus lebih dari Rp0.` |
| `plannedGupAmount > upAmount` | Error atau warning policy: `Nilai rencana GUP tidak boleh melebihi nilai UP.` |
| Tanggal sebelumnya kosong | Error inline, analisis unavailable |
| Tanggal rencana kosong | Error inline, analisis unavailable |
| Rencana = tanggal sebelumnya | Error: interval harus lebih dari 0 hari untuk perhitungan |
| Rencana sebelum tanggal sebelumnya | Error: tanggal rencana harus setelah SP2D sebelumnya |
| Februari tahun kabisat | `daysInMonth` menghasilkan 29 hari |
| Interval > jumlah hari bulan referensi | Status tepat waktu terlambat; jangan menyarankan nominal > UP sebagai solusi optimal |
| `minimumAmountForOptimalAtPlannedDate > upAmount` | Tampilkan bahwa tanggal perlu dimajukan; nominal tidak dapat menyelesaikan masalah dalam batas UP |
| Rekomendasi nominal sedikit di bawah 50% karena rumus proporsional | Gunakan nilai terbesar dari batas minimum dan batas proporsional |
| Nilai tepat pada ambang | Perlakukan sebagai memenuhi: `>=` |
| Perbedaan timezone | Gunakan date-only calendar arithmetic |

---

## 10. Acceptance Criteria

Implementasi dianggap selesai jika semua poin berikut terpenuhi.

### Kalkulasi

- [ ] `annualizedGupRatio` mengikuti rumus `GUP / UP × hari bulan referensi / selisih hari`.
- [ ] Jumlah hari bulan referensi diambil dari bulan `Tanggal GUP Sebelumnya`.
- [ ] Februari tahun kabisat dihitung 29 hari.
- [ ] Status tepat waktu dihitung dari `Tanggal GUP Sebelumnya + 1 bulan kalender`.
- [ ] Tidak ada pembagian dengan nol.
- [ ] Rekomendasi nominal dan tanggal dihitung dari input aktif, tanpa tanggal/nominal hardcode.
- [ ] Rekomendasi nominal dibulatkan ke atas.

### Analisis

- [ ] Ada pemisahan yang jelas antara status nominal/kelayakan rencana, ketepatan waktu, dan kualitas IKPA GUP.
- [ ] Jika GUP kurang dari minimum, sistem menampilkan nominal minimum dan tanggal maksimal untuk nominal minimum.
- [ ] Jika GUP minimum terpenuhi tetapi belum proporsional, sistem memberi dua alternatif: naikkan nominal atau majukan tanggal.
- [ ] Jika terlambat, sistem menegaskan bahwa tanggal harus dimajukan untuk optimalitas; tidak memberi kesan nominal saja selalu cukup.
- [ ] Jika optimal, sistem menampilkan status sukses dan penjelasan singkat.
- [ ] Card analisis tidak menyatakan hasil resmi atau keputusan KPPN.

### UI/UX

- [ ] Card `Hasil Analisis GUP` berada setelah card nilai existing dan sebelum accordion tabel 28/30/31 hari.
- [ ] Tampilan mengikuti style existing dan responsif di desktop serta mobile.
- [ ] Pesan utama dapat dipahami tanpa membuka detail rumus.
- [ ] Dasar perhitungan dapat dibuka dengan accordion/collapsible.
- [ ] Warna bukan satu-satunya indikator status.
- [ ] Tampilan existing untuk dampak total, reset, dan simulasi KKP tidak rusak.

### Keamanan data

- [ ] Perubahan field simulasi tidak melakukan mutasi data aktual.
- [ ] Bila hasil/skenario disimpan, gunakan mekanisme snapshot yang sudah ada dan sertakan versi rule set.

---

## 11. Contoh Skenario Uji

Gunakan contoh berikut hanya untuk automated tests/demo; jangan dimunculkan sebagai nilai default statis dalam UI produksi.

| Kasus | UP | GUP | SP2D sebelumnya | Rencana SP2D | Ekspektasi utama |
|---|---:|---:|---|---|---|
| Optimal | Rp10.000.000 | Rp5.100.000 | 1 Jan 2026 | 15 Jan 2026 | 112,93%; tepat waktu; memenuhi minimum; optimal |
| Tidak proporsional | Rp10.000.000 | Rp6.000.000 | 1 Jan 2026 | 25 Jan 2026 | 77,50%; tepat waktu; rekomendasi minimum Rp7.741.936 setelah pembulatan ke atas |
| Terlambat | Rp10.000.000 | Rp10.000.000 | 1 Jan 2026 | 2 Feb 2026 | 96,88%; terlambat; jelaskan tanggal harus dimajukan |
| Di bawah minimum | Rp10.000.000 | Rp1.000.000 | 1 Jan 2026 | 23 Jan 2026 | batas minimum Rp5.000.000; batas tanggal untuk GUP 50% adalah 16 Jan 2026 |
| Data screenshot saat ini | Rp18.000.000 | Rp11.000.000 | 5 Mei 2026 | 25 Mei 2026 | 94,72%; tepat waktu; rekomendasi nominal minimum optimal Rp11.612.904 setelah pembulatan ke atas atau tanggal maksimal untuk nominal Rp11.000.000 adalah 23 Mei 2026 |
| Februari kabisat | Rp10.000.000 | Rp5.000.000 | 1 Feb 2028 | 15 Feb 2028 | gunakan 29 hari sebagai bulan referensi |

---

## 12. Catatan Teknis untuk Agent

- Buat pure function teruji, misalnya `analyzeGupPlan(input, ruleConfig): GupAnalysisResult`.
- Pisahkan calculation engine dari React component agar formula mudah diuji dan perubahan rule set tidak mengubah UI.
- Semua parameter kebijakan (`minGupRatio`, `optimalAnnualizedRatio`, dan teks disclaimer) harus dapat berasal dari rule set/config aktif; gunakan default hanya sebagai fallback eksplisit.
- Gunakan type union untuk status, bukan string bebas.
- Tampilkan hasil analisis dari single source of truth agar angka pada card nilai, card analisis, dan dampak total tidak berbeda.
- Gunakan formatter uang/tanggal/persen yang konsisten dengan aplikasi saat ini.
- Sertakan unit tests untuk semua skenario pada bagian `Contoh Skenario Uji` dan semua edge cases penting.

---

## 13. Definition of Done

Selesaikan perubahan ketika pengguna satker dapat mengubah nominal dan tanggal GUP pada halaman simulasi, lalu langsung memahami:

1. apakah nominal GUP sudah memenuhi batas minimum;
2. apakah tanggal rencana masih tepat waktu;
3. berapa persentase GUP disebulankan dan apakah sudah mencapai target;
4. alasan hasil tersebut;
5. nominal minimum yang harus digunakan bila tanggal dipertahankan; dan/atau
6. tanggal paling lambat yang harus dipilih bila nominal dipertahankan.

Hasil harus tetap terhubung ke kalkulasi dampak IKPA total yang sudah ada, tanpa mengubah data aktual satker dan tanpa mengklaimnya sebagai hasil resmi.
