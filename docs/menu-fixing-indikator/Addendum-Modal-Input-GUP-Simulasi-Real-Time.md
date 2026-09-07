# Addendum — Simulasi dan Saran Real-Time pada Modal Input GUP

**Tujuan:** Menyempurnakan modal `Ubah Transaksi UP / TUP / GUP` agar saat operator memasukkan nominal dan tanggal GUP, sistem langsung menampilkan informasi dan saran GUP secara otomatis **sebelum data disimpan**.

Dokumen ini merupakan pelengkap spesifikasi `Spesifikasi Penyempurnaan Simulasi GUP — Analisis dan Rekomendasi`. Fokusnya khusus modal input/edit transaksi, bukan halaman simulasi rencana sisa tahun.

---

## 1. Prinsip Implementasi

1. Modal adalah **micro-simulation** atau pre-save guidance; bukan halaman simulasi penuh.
2. Semua perhitungan harus memakai nilai form yang sedang diedit (`draft values`), bukan nilai transaksi tersimpan.
3. Perubahan nominal GUP, tanggal referensi, atau tanggal SP2D saat ini harus memperbarui informasi secara langsung.
4. Informasi ini tidak boleh menulis/mengubah data aktual sampai pengguna memilih `Simpan Data`.
5. Jangan mengulang seluruh tabel simulasi 28/30/31 hari di modal. Modal harus singkat, fokus, dan dapat dipindai cepat.
6. Gunakan engine/pure function analisis GUP yang sama dengan halaman simulasi utama agar rumus dan rekomendasi selalu konsisten.
7. Semua nominal, tanggal, jumlah hari, dan nama bulan harus berasal dari input/konfigurasi aktif; tidak boleh hardcode nilai contoh.
8. Jangan menyatakan GUP “diterima/ditolak KPPN”. Gunakan istilah aman: `memenuhi batas minimum`, `perlu penyesuaian`, `tepat waktu`, dan `target kualitas GUP`.

---

## 2. Kondisi Tampil

Panel informasi GUP hanya ditampilkan bila `Jenis Transaksi = Ganti UP (GUP Revolving)`.

| Jenis transaksi | Tampilan panel |
|---|---|
| `GUP Revolving` | Tampilkan panel simulasi dan saran GUP real-time |
| `UP` | Tampilkan bantuan khusus UP bila sudah ada; jangan tampilkan analisis GUP disebulankan |
| `TUP` | Tampilkan bantuan khusus TUP bila sudah ada; jangan tampilkan analisis GUP disebulankan |
| `PTUP` | Ikuti rule/analisis PTUP tersendiri bila tersedia |
| `GUP Nihil` | Gunakan penilaian ketepatan waktu bila relevan, tetapi jangan memakai rasio nominal GUP biasa tanpa kebijakan eksplisit |
| `Setoran TUP` | Jangan tampilkan analisis GUP |

Jika pengguna mengubah tipe dari GUP ke tipe lain, hapus/hide state analisis GUP dan jangan mempertahankan warning GUP yang sudah tidak relevan.

---

## 3. Data yang Digunakan

### Data form modal

| Field UI | Kontrak data | Wajib untuk analisis | Catatan |
|---|---|---:|---|
| Nominal Transaksi (Rp) | `draftGupAmount` | Ya | Harus > 0 |
| Tanggal SP2D Asal / Referensi | `draftPreviousSp2dDate` | Ya | Merujuk SP2D GUP sebelumnya |
| Tanggal SP2D Saat Ini | `draftCurrentSp2dDate` | Ya | Rencana/aktual SP2D GUP yang sedang diinput |
| Jenis Transaksi | `draftTransactionType` | Ya | Harus `GUP_REVOLVING` |

### Data konteks yang tidak perlu ditampilkan sebagai input baru

| Data konteks | Kontrak data | Sumber |
|---|---|---|
| Nilai UP aktif | `activeUpAmount` | Data UP satker/periode aktif atau rule/source data yang sudah ada |
| Rasio minimum GUP | `minGupRatio` | Rule set aktif; default kebijakan bila belum tersedia |
| Target GUP disebulankan | `optimalAnnualizedRatio` | Rule set aktif; default 100% bila belum ada konfigurasi |
| Timezone | `Asia/Jakarta` | Konfigurasi aplikasi |

**Penting:** Jangan meminta pengguna mengetik nilai UP ulang di modal GUP bila nilai UP aktif sudah bisa diperoleh dari state/data aplikasi. Namun, tampilkan nilai UP tersebut di panel sebagai konteks agar operator dapat memverifikasi dasar perhitungan.

Jika nilai UP aktif tidak ditemukan atau nol, jangan menghitung. Tampilkan pesan neutral:

```text
Analisis GUP akan tersedia setelah nilai UP aktif untuk periode ini tersedia.
```

Simpan transaksi tetap mengikuti validasi data aplikasi saat ini; keputusan apakah penyimpanan boleh dilanjutkan mengikuti policy produk yang berlaku.

---

## 4. Rumus dan Derivasi

Gunakan fungsi yang sama dengan halaman simulasi utama, misalnya:

```ts
analyzeGupPlan({
  upAmount: activeUpAmount,
  plannedGupAmount: draftGupAmount,
  previousSp2dDate: draftPreviousSp2dDate,
  plannedSp2dDate: draftCurrentSp2dDate,
  minGupRatio: activeRuleSet.minGupRatio,
  optimalAnnualizedRatio: activeRuleSet.optimalAnnualizedRatio,
});
```

Rumus utama:

```ts
const rawGupRatio = draftGupAmount / activeUpAmount;
const intervalDays = calendarDayDiff(
  draftPreviousSp2dDate,
  draftCurrentSp2dDate,
);
const referenceMonthDays = daysInMonth(draftPreviousSp2dDate);
const annualizedGupRatio = rawGupRatio * (referenceMonthDays / intervalDays);
const annualizedGupPercent = annualizedGupRatio * 100;

const minGupAmount = activeUpAmount * minGupRatio;
const latestOnTimeDate = addCalendarMonths(draftPreviousSp2dDate, 1);
const isOnTime = draftCurrentSp2dDate <= latestOnTimeDate;
const isMinimumAmountMet = draftGupAmount >= minGupAmount;
const isProportional = annualizedGupRatio >= optimalAnnualizedRatio;
```

Perhitungan rekomendasi:

```ts
const minimumAmountForOptimalAtCurrentDate = ceilToRupiah(
  activeUpAmount * optimalAnnualizedRatio *
    (intervalDays / referenceMonthDays),
);

const maxIntervalForCurrentAmount = Math.floor(
  (rawGupRatio * referenceMonthDays) / optimalAnnualizedRatio,
);

const latestOptimalDateForCurrentAmount = addDays(
  draftPreviousSp2dDate,
  maxIntervalForCurrentAmount,
);

const maxIntervalForMinimumAmount = Math.floor(
  (minGupRatio * referenceMonthDays) / optimalAnnualizedRatio,
);

const latestOptimalDateForMinimumAmount = addDays(
  draftPreviousSp2dDate,
  maxIntervalForMinimumAmount,
);
```

Gunakan **hari kalender** dan `date-only arithmetic`. Bulan referensi selalu bulan dari `Tanggal SP2D Asal / Referensi`. Ini harus otomatis benar untuk Februari 28 atau 29 hari.

---

## 5. Struktur UI Modal

Pertahankan modal dan urutan input yang sudah ada. Ubah panel statis `Informasi Komponen GUP` menjadi panel dinamis yang memiliki tiga state:

1. State edukasi: data belum lengkap.
2. State analisis: data lengkap dan valid.
3. State error: ada input yang tidak valid.

### Layout desktop/modal saat data lengkap

Letakkan panel tepat di bawah dua field tanggal dan sebelum footer tombol.

```text
┌────────────────────────────────────────────────────────────────┐
│ Informasi & Simulasi GUP                                        │
│ Berdasarkan UP aktif Rp{activeUpAmount}                         │
│                                                                │
│ [Status nominal]       [Status waktu]       [Kualitas GUP]     │
│ Memenuhi minimum       Tepat waktu           94,72%             │
│ ≥ {minGupRatio}% UP    Batas: {latestDate}   Target: 100%       │
│                                                                │
│ ⚠ Nilai GUP belum proporsional terhadap interval SP2D.         │
│ Dengan nominal {gupAmount} dan interval {intervalDays} hari,   │
│ nilai GUP disebulankan mencapai {annualizedGupPercent}.        │
│                                                                │
│ Saran                                                         │
│ • Jika tanggal tetap {currentDate}, gunakan GUP minimal        │
│   {minimumAmountForOptimalAtCurrentDate}.                       │
│ • Jika nominal tetap {gupAmount}, targetkan SP2D paling lambat │
│   {latestOptimalDateForCurrentAmount}.                          │
│                                                                │
│ ▸ Lihat dasar perhitungan                                      │
└────────────────────────────────────────────────────────────────┘
```

### Ukuran dan hierarchy

- Panel harus lebih informatif daripada panel statis lama, tetapi tidak dominan melebihi input form.
- Gunakan background netral/soft (`slate`/`blue-gray`) untuk informasi normal.
- Gunakan border kiri atau top accent sesuai severity:
  - hijau: optimal;
  - amber: perlu perhatian;
  - merah: nominal di bawah minimum atau tanggal terlambat;
  - abu-abu/biru redup: data belum lengkap.
- Jangan hanya mengandalkan warna; sertakan ikon dan teks status.
- Prioritaskan teks saran dibanding formula.
- `Simpan Data` tetap berada di footer dan selalu terlihat.

### Mobile

- Modal dapat menjadi fullscreen sheet.
- Tiga status dipadatkan menjadi chip/block vertikal, bukan tabel horizontal.
- Saran tetap dibaca vertikal.
- Accordion dasar perhitungan harus tertutup secara default.

---

## 6. State Panel dan Copy UI

### State A — Form GUP belum lengkap

**Kondisi:** Nilai UP belum tersedia, nominal kosong, salah satu tanggal kosong, atau tipe transaksi belum GUP Revolving.

```text
Informasi Komponen GUP
Masukkan nominal GUP, tanggal SP2D referensi, dan tanggal SP2D saat ini untuk melihat simulasi ketepatan waktu serta GUP disebulankan.
```

Jika UP belum tersedia:

```text
Nilai UP aktif belum tersedia sehingga persentase GUP belum dapat dihitung.
```

Tidak tampilkan nominal/tanggal saran saat data belum lengkap.

### State B — Input tanggal tidak valid

**Kondisi:** Tanggal saat ini sama dengan atau sebelum tanggal referensi.

Tampilkan error inline dekat field tanggal dan pada panel:

```text
Tanggal SP2D saat ini harus setelah tanggal SP2D referensi agar interval GUP dapat dihitung.
```

Jangan hitung atau tampilkan `0%`, `Infinity`, `NaN`, atau rekomendasi tanggal.

### State C — Nominal GUP di bawah minimum

**Kondisi:** `draftGupAmount < minGupAmount`.

```text
⚠ Nominal GUP belum memenuhi batas minimum
Nominal {draftGupAmount} setara {rawGupPercent} dari UP aktif dan masih di bawah batas minimum {minGupRatioPercent}.

Saran
• Naikkan nilai GUP minimal menjadi {minGupAmount}.
• Agar nilai minimum tersebut mencapai target {optimalTargetPercent} disebulankan, targetkan SP2D paling lambat {latestOptimalDateForMinimumAmount}.
```

Jika juga terlambat, tambahkan:

```text
Tanggal SP2D saat ini sudah melewati batas tepat waktu {latestOnTimeDate}. Nominal minimum saja tidak cukup untuk membuat kualitas GUP optimal; tanggal perlu dimajukan.
```

### State D — Nominal cukup, tepat waktu, belum proporsional

**Kondisi:** `isMinimumAmountMet && isOnTime && !isProportional`.

```text
⚠ Nilai GUP belum proporsional terhadap interval SP2D
Nominal memenuhi batas minimum dan tanggal masih tepat waktu, tetapi GUP disebulankan baru {annualizedGupPercent} dari target {optimalTargetPercent}.

Saran
• Jika tanggal SP2D tetap {draftCurrentSp2dDate}, gunakan GUP minimal {minimumAmountForOptimalAtCurrentDate}.
• Jika nominal tetap {draftGupAmount}, targetkan SP2D paling lambat {latestOptimalDateForCurrentAmount}.
```

### State E — Nominal cukup, tetapi terlambat

**Kondisi:** `isMinimumAmountMet && !isOnTime`.

```text
⚠ Rencana SP2D melewati batas satu bulan
Tanggal SP2D saat ini melewati batas tepat waktu {latestOnTimeDate} sebanyak {lateDays} hari kalender. Kualitas GUP tidak optimal karena keterlambatan.

Saran
• Majukan tanggal SP2D paling lambat ke {latestOnTimeDate}.
```

Jika `intervalDays > referenceMonthDays`, tambahkan:

```text
Menambah nominal hingga sebesar UP aktif tidak dapat membuat GUP disebulankan mencapai target {optimalTargetPercent} pada interval ini. Perbaikan tanggal diperlukan.
```

### State F — Optimal

**Kondisi:** `isMinimumAmountMet && isOnTime && isProportional`.

```text
✓ Rencana GUP memenuhi target simulasi
Nominal GUP telah memenuhi batas minimum, SP2D masih dalam batas satu bulan, dan GUP disebulankan mencapai {annualizedGupPercent}.

Pastikan kelengkapan dokumen dan tanggal realisasi tidak bergeser dari rencana.
```

---

## 7. Ringkasan Metrik yang Wajib Ditampilkan

Ketika semua data valid, panel minimal menampilkan:

| Metrik | Format | Contoh copy dinamis |
|---|---|---|
| UP aktif | Rupiah | `UP aktif: Rp...` |
| Persentase nominal GUP | Persen | `GUP: 61,11% dari UP` |
| Interval antar-SP2D | Hari kalender | `Interval: 20 hari kalender` |
| Batas tepat waktu | Tanggal | `Batas tepat waktu: 5 Juni 2026` |
| Status waktu | Label | `Tepat waktu` atau `Terlambat 2 hari` |
| GUP disebulankan | Persen | `94,72% dari target 100%` |

Jangan menampilkan semua metrik sebagai paragraf panjang. Gunakan tiga card kecil/chip untuk status utama dan satu kalimat penjelas.

---

## 8. Interaksi yang Dianjurkan

### Quick actions opsional

Tambahkan tindakan klik yang aman, hanya mengubah draft modal dan tidak menyimpan otomatis:

| Tombol | Kondisi tampil | Efek |
|---|---|---|
| `Gunakan nominal minimum` | Nominal saat ini kurang dari rekomendasi | Mengisi `Nominal Transaksi` dengan `recommended amount` |
| `Pakai tanggal optimal` | Tanggal saat ini lebih lambat dari rekomendasi | Mengisi `Tanggal SP2D Saat Ini` dengan `latestOptimalDate` |

Aturan quick action:

- Harus berlabel jelas dan menampilkan nilai yang akan dipakai, misalnya `Gunakan Rp11.612.904`.
- Tidak menekan `Simpan Data` secara otomatis.
- Setelah diklik, recalculation harus langsung berjalan dan status diperbarui.
- Bila codebase belum memiliki pola aman untuk mengubah draft dari helper action, quick action boleh tidak diimplementasikan pada iterasi pertama. Tetap tampilkan saran teks lengkap.

---

## 9. Perilaku Tombol Simpan

### Minimum requirement

- Simpan hanya menyimpan field transaksi yang sudah ada.
- Hasil analisis tidak menjadi field transaksi utama yang diinput manual.
- Bila snapshot/audit calculation tersedia, simpan metadata hasil kalkulasi secara otomatis sesuai arsitektur aplikasi, misalnya versi rule set, rasio yang dihitung, dan timestamp kalkulasi.

### Validasi sebelum simpan

- Tetap jalankan validasi form yang sudah ada.
- Tambahkan validasi wajib untuk GUP: tanggal referensi diperlukan bila engine membutuhkan interval GUP.
- Warning `belum proporsional` sebaiknya **tidak otomatis memblokir** simpan kecuali policy aplikasi yang ditetapkan memang mewajibkannya.
- Error struktural (UP tidak valid, tanggal tidak valid, interval <= 0, nominal <= 0) harus memblokir simpan.

Jika penyimpanan tetap diizinkan saat warning, jangan meminta konfirmasi modal kedua pada MVP kecuali pola UX aplikasi memang sudah menggunakan confirmation dialog. Labelkan dengan jelas bahwa status adalah warning, bukan error.

---

## 10. Accessibility dan UX Detail

- Hubungkan panel dengan input melalui `aria-live="polite"` agar perubahan status dapat diinformasikan kepada screen reader tanpa terlalu agresif.
- Pesan validasi input gunakan `aria-describedby` pada field terkait.
- Semua ukuran dan status disampaikan lewat teks, tidak hanya ikon/warna.
- Pastikan focus trap modal dan tombol close (`X`) tetap bekerja seperti sebelum perubahan.
- Tombol `Simpan Data` tidak tertutup oleh panel informasi pada tinggi layar kecil.
- Format angka dan tanggal mengikuti locale Indonesia.
- Jangan menampilkan formula matematika mentah pada state utama; tempatkan dalam accordion `Dasar perhitungan`.

---

## 11. Acceptance Criteria

### Fungsional

- [ ] Saat tipe `GUP Revolving`, panel informasi berubah dari teks statis menjadi simulasi real-time.
- [ ] Saat nominal, tanggal referensi, atau tanggal SP2D saat ini berubah, status dan saran diperbarui tanpa menyimpan data.
- [ ] Perhitungan memakai nilai UP aktif satker/periode; nilai UP tidak diminta ulang pada modal.
- [ ] Analisis menggunakan jumlah hari pada bulan dari tanggal referensi, termasuk Februari tahun kabisat.
- [ ] Sistem membedakan nominal minimum, ketepatan waktu, dan kualitas GUP disebulankan.
- [ ] Sistem memberi rekomendasi nominal bila tanggal dipertahankan dan rekomendasi tanggal bila nominal dipertahankan.
- [ ] Saat interval melebihi satu bulan, sistem menyatakan bahwa perbaikan tanggal diperlukan untuk status optimal.
- [ ] Tidak ada hardcode tanggal, nominal, nama bulan, atau nama KPPN.

### UI

- [ ] Modal yang ada tidak berubah struktur fundamentalnya: judul, tipe transaksi, nominal, dua tanggal, tombol batal/simpan tetap ada.
- [ ] Panel analisis berada di bawah field tanggal dan di atas footer aksi.
- [ ] Panel tetap ringkas dan mudah dipindai; tabel 28/30/31 tidak disalin ke modal.
- [ ] Mobile modal tetap bisa menampilkan seluruh saran dan tombol simpan.
- [ ] State loading, incomplete, valid, warning, error, dan optimal dapat dibedakan dengan teks dan gaya visual.

### Data

- [ ] Mengubah form tidak mengubah database sampai `Simpan Data` berhasil.
- [ ] Error input wajib memblokir simpan.
- [ ] Warning analisis hanya memberi informasi kecuali policy eksplisit menetapkan sebaliknya.

---

## 12. Skenario Uji

| No. | UP aktif | Nominal GUP | Referensi | SP2D saat ini | Hasil yang diharapkan |
|---:|---:|---:|---|---|---|
| 1 | Rp10.000.000 | Rp5.100.000 | 1 Jan 2026 | 15 Jan 2026 | `Optimal`; GUP disebulankan 112,93%; tepat waktu |
| 2 | Rp10.000.000 | Rp6.000.000 | 1 Jan 2026 | 25 Jan 2026 | Tepat waktu, tetapi 77,50%; saran nominal minimal Rp7.741.936 atau tanggal lebih awal |
| 3 | Rp10.000.000 | Rp10.000.000 | 1 Jan 2026 | 2 Feb 2026 | Terlambat; 96,88%; saran memajukan tanggal, bukan hanya menaikkan nominal |
| 4 | Rp10.000.000 | Rp1.000.000 | 1 Jan 2026 | 23 Jan 2026 | Di bawah minimum; saran minimal Rp5.000.000; tanggal maksimal untuk nominal minimum 16 Jan 2026 |
| 5 | Rp18.000.000 | Rp11.000.000 | 5 Mei 2026 | 25 Mei 2026 | 94,72%; tepat waktu; saran nominal Rp11.612.904 atau SP2D maksimal 23 Mei 2026 |
| 6 | Rp10.000.000 | Rp5.000.000 | 1 Feb 2028 | 15 Feb 2028 | Gunakan 29 hari sebagai bulan referensi |
| 7 | Rp10.000.000 | Rp5.000.000 | 15 Mei 2026 | 15 Mei 2026 | Error: tanggal saat ini harus setelah tanggal referensi; tidak menghitung |

---

## 13. Definition of Done

Modal input GUP dianggap selesai bila operator satker dapat memasukkan nominal dan dua tanggal, lalu sebelum menekan `Simpan Data` langsung memahami:

1. nilai GUP tersebut setara berapa persen dari UP aktif;
2. apakah nominal telah memenuhi batas minimum;
3. apakah tanggal SP2D masih tepat waktu;
4. berapa persentase GUP disebulankan;
5. apakah kualitas GUP telah mencapai target;
6. berapa nominal yang perlu digunakan jika tanggal dipertahankan; atau
7. tanggal mana yang perlu dipilih jika nominal dipertahankan.

Semua informasi harus menjadi bantuan simulasi pada draft form, tetap menjaga data aktual, dan memakai formula/rule set yang sama dengan halaman simulasi utama.
