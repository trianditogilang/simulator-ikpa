# Spesifikasi Implementasi Perbaikan — Pengelolaan UP/TUP & KKP

**Status:** Instruksi implementasi mandiri untuk AI Developer

**Tujuan:** Memperbaiki menu, engine, data model, Admin Policy, dan pengalaman Operator untuk indikator IKPA **Pengelolaan UP dan TUP**. Dokumen ini adalah spesifikasi implementasi; developer harus dapat bekerja langsung dari dokumen ini tanpa membaca dokumen lain.

> **Prinsip produk:** Aplikasi adalah simulator/pengendalian internal, bukan nilai resmi OMSPAN/KPPN. Namun formula, data, policy penyesuaian, versi aturan, dan hasil kalkulasi harus transparan, dapat diaudit, dan tidak menyesatkan pengguna.

---

## 1. Ringkasan Keputusan

### 1.1 Masalah yang harus diperbaiki

Implementasi saat ini tidak dapat digunakan sebagai simulator IKPA UP/TUP yang andal karena:

1. Enam jenis transaksi (`UP`, `TUP`, `GUP`, `GUP_NIHIL`, `PTUP`, `SETORAN_TUP`) di-collapse menjadi dua jenis (`UP`/`TUP`) saat masuk engine.
2. Ketepatan waktu dihitung dari count transaksi umum yang settled <=30 hari, bukan dari GUP/GUP Nihil/PTUP terhadap SP2D sebelumnya.
3. %GUP disebulankan tidak memakai nominal GUP/UP, tanggal SP2D sebelumnya, dan jumlah hari dalam bulan.
4. Setoran TUP tidak dihitung berdasarkan nominal setoran dibanding total TUP setahun.
5. KKP memakai penyebut yang salah: nominal KKP dibandingkan nominal tunai, bukan plafon UP KKP bulanan yang disetahunkan.
6. KKP kosong saat ini dapat memberi angka 100, padahal apabila tidak ada transaksi KKP, komponen KKP tidak dihitung dan tunai dikonversi sesuai case yang berlaku.
7. Tidak ada mekanisme policy exception/fairness treatment berversi.
8. `referenceSp2dAt` diminta pada form, tetapi belum dipakai engine.
9. Final score dapat lebih dari 100 dan belum dikendalikan sesuai policy.
10. Validasi nominal, keterhubungan referensi, urutan tanggal, duplikasi, dan batas periode belum memadai.

### 1.2 Target hasil

Setelah perbaikan:

- Nilai UP/TUP memakai rumus kanonis pada bagian 2.
- Semua tipe transaksi tetap dipertahankan sampai layer engine.
- Policy fairness dapat dibuat sebagai draft, dipreview, diterbitkan, dipensiunkan, dan diaudit oleh Admin KPPN.
- Operator tidak dapat mengubah policy, tetapi dapat melihat policy yang memengaruhi transaksi dan skor.
- Snapshot menyimpan versi rule set dan daftar policy penyesuaian yang diterapkan.
- Hasil ekspor/dashboard/workspace memiliki nilai yang sama untuk input dan rule set yang sama.

---

## 2. Rumus Kanonis dan Aturan Penilaian

### 2.1 Struktur nilai indikator

Bobot indikator Pengelolaan UP dan TUP terhadap total IKPA adalah **10%**.

```text
Nilai indikator UP/TUP = (0,90 × NK_TUNAI) + (0,10 × NK_KKP)
Kontribusi terhadap IKPA = Nilai indikator UP/TUP × 0,10
```

Nilai UP/TUP tunai:

```text
NK_TUNAI = (0,50 × NK_KETEPATAN_WAKTU)
         + (0,25 × NK_GUP_DISEBULANKAN)
         + (0,25 × NK_SETORAN_TUP)
```

### 2.2 Ketepatan waktu — bobot tunai 50%

**Objek:** setiap transaksi bertipe `GUP`, `GUP_NIHIL`, dan `PTUP` yang memiliki SP2D saat ini dan referensi SP2D sebelumnya.

**Nilai per objek:**

```text
100 apabila disampaikan/terbit tepat waktu dalam jangka 1 bulan dari SP2D sebelumnya.
0 apabila terlambat.
```

**Nilai komponen:**

```text
NK_KETEPATAN_WAKTU = Σ nilai_objek / jumlah_objek_eligible
```

**Aturan data dan perhitungan:**

- `referenceSp2dAt` wajib untuk `GUP`, `GUP_NIHIL`, dan `PTUP`.
- `sp2dAt` adalah tanggal SP2D transaksi saat ini.
- `referenceSp2dAt` adalah tanggal SP2D UP/GUP/TUP sebelumnya sesuai rantai transaksi yang relevan.
- Batas satu bulan dihitung menggunakan parameter `timelinessWindow` dalam rule set, bukan angka 30 yang di-hardcode.
- Default interpretasi harus disimpan eksplisit dalam rule set, misalnya `same_day_next_month` (tanggal yang sama pada bulan berikutnya; gunakan tanggal terakhir bulan apabila tanggal tersebut tidak tersedia). Jangan memakai `<=30 hari` kecuali policy resmi yang aktif memang menentukannya.
- Penalti sisa UP/TUP yang belum disetorkan sampai 31 Desember harus dimodelkan terpisah dan dapat dikonfigurasi melalui rule set. Jangan menyembunyikan penalti di count transaksi umum.
- Bila belum cukup data untuk menentukan objek eligible, tampilkan `incomplete`, bukan otomatis 100.

### 2.3 %GUP disebulankan — bobot tunai 25%

**Objek:** setiap transaksi bertipe `GUP` bernominal positif yang memiliki UP dasar dan SP2D sebelumnya yang valid.

```text
persentase_gup = nilai_GUP / nilai_UP_dasar × 100
faktor_hari = hari_dalam_bulan / selisih_hari_antar_SP2D_GUP
nilai_gup_disebulankan = persentase_gup × faktor_hari
```

```text
NK_GUP_DISEBULANKAN = rata-rata nilai_gup_disebulankan seluruh GUP eligible
```

**Aturan penting:**

- Nominal harus dipakai; count transaksi tidak boleh dipakai sebagai pengganti nominal.
- `nilai_UP_dasar` harus dapat ditelusuri. Tambahkan relasi `sourceUpTransactionId` untuk GUP bila diperlukan, atau implementasikan resolver rantai UP/GUP yang deterministik dan tampilkan sumber nominalnya.
- `selisih_hari_antar_SP2D_GUP` menggunakan tanggal referensi dan tanggal GUP saat ini.
- `hari_dalam_bulan` secara normal adalah jumlah hari kalender pada bulan yang menjadi dasar interval, sesuai parameter rule set (`28`, `29`, `30`, atau `31`). Definisi bulan basis harus eksplisit dan konsisten: gunakan bulan dari `referenceSp2dAt`.
- Nilai komponen dan/atau nilai objek harus mengikuti kebijakan cap yang tersimpan di rule set. Default yang disarankan untuk simulator: tampilkan nilai mentah dan nilai yang dipakai; gunakan cap 100 apabila rule set menetapkannya.
- GUP Nihil tidak masuk pembilang/penyebut %GUP karena tidak memiliki nilai GUP positif; tetap masuk komponen ketepatan waktu.
- Jika GUP = 0, UP dasar <=0, referensi tidak valid, atau tanggal saat ini tidak lebih besar dari referensi, data invalid/incomplete. Jangan menghasilkan `Infinity`, angka negatif, atau otomatis 100.

### 2.4 Kinerja setoran TUP — bobot tunai 25%

Gunakan nominal tahunan:

```text
persentase_setoran_TUP = total_nominal_SETORAN_TUP / total_nominal_TUP × 100
NK_SETORAN_TUP = 100 - persentase_setoran_TUP
```

**Catatan:** Formula di atas adalah formula nilai kinerja yang harus diimplementasikan, sehingga semakin besar setoran sisa TUP, semakin rendah skornya. Tampilkan juga persentase setoran agar pengguna memahami sebab penurunan nilai.

**Aturan:**

- Gunakan semua transaksi `TUP` dan `SETORAN_TUP` dalam tahun anggaran yang sama serta scope satker yang sama.
- Keterhubungan setoran dengan TUP asal sangat disarankan melalui `sourceTupTransactionId`; bila belum tersedia, tetap hitung agregat tahunan dan tandai “alokasi ke TUP asal belum ditelusuri”.
- Tolak setoran melebihi TUP yang dirujuk jika relasi asal sudah tersedia.
- Bila tidak terdapat TUP sama sekali, status komponen harus `not_applicable` atau mengikuti parameter eksplisit di rule set. Jangan diam-diam mengembalikan 100 tanpa trace.

### 2.5 Penggunaan UP KKP — bobot indikator 10%

**Input wajib:** plafon UP KKP per bulan yang ditetapkan KPPN (`monthlyKkpCeiling`).

```text
UP_KKP_tahunan = monthlyKkpCeiling × 12
Target_TW = persentase_target_TW × UP_KKP_tahunan
Realisasi_TW = total nominal transaksi KKP kumulatif sampai akhir TW
Nilai_TW = 110 apabila Realisasi_TW >= Target_TW; selain itu 100
NK_KKP = rata-rata Nilai_TW pada triwulan yang eligible/dievaluasi
```

Target default harus berasal dari rule set:

| Triwulan | Target kumulatif default |
|---|---:|
| I | 1% |
| II | 5% |
| III | 9% |
| IV | 12,5% |

**Case KKP:**

| Kondisi | Perlakuan nilai |
|---|---|
| Tidak memiliki UP KKP | Komponen KKP tidak dihitung; gunakan mekanisme konversi tunai sesuai parameter policy |
| KKP sudah ada, namun belum diterbitkan bank / belum dapat digunakan | Komponen KKP tidak dihitung; gunakan mekanisme konversi tunai sesuai parameter policy |
| Ada KKP, tetapi belum terdapat transaksi KKP | Komponen KKP tidak dihitung; gunakan mekanisme konversi tunai sesuai parameter policy |
| Ada transaksi KKP, belum mencapai target | NK KKP = 100 |
| Ada transaksi KKP, mencapai/melebihi target | NK KKP = 110 |

**Konversi tanpa KKP:** Jangan memberikan 10 poin KKP otomatis. Buat `kkpCase` eksplisit di engine dan rule set untuk menentukan formula konversi. Default yang harus dipakai sampai ada policy berbeda:

```text
Jika KKP tidak eligible/dihitung:
Nilai indikator = NK_TUNAI × 0,90
```

Tampilkan jelas label “Komponen KKP tidak dihitung — konversi 90%”. Jangan menampilkan komponen KKP sebagai 100 apabila tidak ada transaksi.

### 2.6 Cap dan pembulatan

- Seluruh parameter cap dan mode pembulatan berada di rule set, tidak di hardcode.
- Rekomendasi default: `NK_TUNAI` dan `NK_KKP` boleh memiliki nilai sampai 110 jika kebijakan mengizinkan; **nilai indikator UP/TUP setelah komposisi harus di-cap maksimum 100** apabila policy mengatur nilai maksimum indikator 100.
- Simpan nilai mentah, nilai setelah cap, dan alasan cap dalam formula trace.
- Gunakan Decimal/integer Rupiah, bukan JavaScript floating point, untuk nominal dan perhitungan uang.

---

## 3. Fairness Treatment / Policy Adjustment

### 3.1 Kebijakan yang harus didukung

Sistem harus mendukung penyesuaian berikut sebagai policy berversi:

```text
Nama: Penyesuaian THR 2026 — Pengelolaan UP dan TUP
Objek tanggal: SP2D UP/GUP/TUP sebelumnya (referenceSp2dAt)
Rentang objek: 18 Februari 2026 s.d. 17 Maret 2026, inklusif
Komponen terdampak:
- Ketepatan Waktu
- %GUP Disebulankan
Mekanisme:
- Jumlah hari sebulan untuk perhitungan diperlakukan sebagai 7 hari kalender
Komponen yang tidak terdampak:
- Setoran TUP
- Penggunaan KKP
```

Policy ini hanya diterapkan jika `referenceSp2dAt` berada pada rentang tanggal di atas. Jangan menguji `sp2dAt` saat ini sebagai pengganti, kecuali policy yang diterbitkan secara eksplisit menyebut basis tanggal lain.

### 3.2 Model data policy

Buat tabel generik `scoring_adjustment_policies` agar dapat dipakai indikator lain, dengan minimal field berikut:

```ts
type ScoringAdjustmentPolicy = {
  id: string
  ruleSetId: string
  policyCode: string
  title: string
  description: string
  status: 'draft' | 'published' | 'retired'
  scopeType: 'global' | 'kppn_scope' | 'organization'
  scopeId: string | null
  indicatorKey: 'up_tup'
  effectiveFrom: 'YYYY-MM-DD'
  effectiveTo: 'YYYY-MM-DD'
  anchorDateField: 'reference_sp2d_at' | 'sp2d_at'
  affectedComponents: Array<'timeliness' | 'monthly_gup_percentage' | 'tup_deposit' | 'kkp'>
  adjustmentType: 'override_month_days'
  adjustmentValue: string // contoh: '7'
  calendarType: 'calendar_day'
  legalReference: string
  reason: string
  changeNotes: string
  createdBy: string
  createdAt: string
  publishedBy: string | null
  publishedAt: string | null
  retiredBy: string | null
  retiredAt: string | null
}
```

Tambahkan unique constraint agar policy `published` dengan scope, indikator, komponen, anchor field, dan rentang yang sama tidak dapat diduplikasi secara identik.

### 3.3 Resolver policy

Implementasikan fungsi murni dan unit-testable:

```ts
resolveUpTupAdjustments({
  transaction,
  component,
  fiscalYear,
  ruleSetId,
  organizationId,
  activePolicies,
}): AppliedAdjustment[]
```

Urutan resolver:

1. Ambil policy `published` dalam rule set aktif.
2. Saring scope yang mencakup satker.
3. Saring `indicatorKey = up_tup`.
4. Saring apakah `component` termasuk dalam `affectedComponents`.
5. Ambil anchor date berdasarkan `anchorDateField`.
6. Terapkan apabila anchor date berada dalam rentang `effectiveFrom` hingga `effectiveTo`, inklusif.
7. Jika lebih dari satu policy cocok untuk parameter yang sama, gunakan prioritas scope paling spesifik (`organization` > `kppn_scope` > `global`) lalu paling baru diterbitkan; tampilkan warning konflik dan log audit.
8. Kembalikan policy ID/kode/nilai adjustment untuk disimpan pada formula trace.

Untuk policy THR 2026, resolver mengganti `hari_dalam_bulan` menjadi `7` pada dua komponen terdampak.

### 3.4 Integritas historis

- Policy `published` tidak boleh diedit.
- Perubahan dilakukan melalui draft versi baru atau policy baru yang menggantikan policy lama.
- Snapshot wajib menyimpan `ruleSetId`, `ruleSetVersion`, dan `appliedAdjustmentPolicies[]`.
- Snapshot lama tidak dihitung ulang otomatis ketika policy baru diterbitkan.
- Kalkulasi ulang harus eksplisit memilih rule set/policy yang berlaku dan mencatat tindakan tersebut pada audit log.

---

## 4. Perubahan Data Model dan Validasi

### 4.1 Transaksi UP/TUP

Pertahankan enum tipe berikut dan jangan collapse sebelum engine:

```ts
type UpTupTransactionType =
  | 'UP'
  | 'TUP'
  | 'GUP'
  | 'GUP_NIHIL'
  | 'PTUP'
  | 'SETORAN_TUP'
```

Tambahkan/ubah field:

```ts
type UpTupTransaction = {
  id: string
  fiscalYearId: string
  type: UpTupTransactionType
  amount: Decimal
  sp2dAt: 'YYYY-MM-DD'
  referenceSp2dAt: 'YYYY-MM-DD' | null
  sourceUpTransactionId: string | null
  sourceTupTransactionId: string | null
  settlementDate: 'YYYY-MM-DD' | null
  notes: string | null
  deletedAt: string | null
}
```

### 4.2 Konfigurasi plafon KKP

Tambahkan tabel/entitas `up_tup_configurations` per satker dan tahun anggaran:

```ts
type UpTupConfiguration = {
  id: string
  fiscalYearId: string
  hasKkp: boolean
  kkpIssuanceStatus: 'not_available' | 'pending_bank_issuance' | 'active'
  monthlyKkpCeiling: Decimal | null
  evidenceReference: string | null
  effectiveFrom: 'YYYY-MM-DD'
  effectiveTo: 'YYYY-MM-DD' | null
  notes: string | null
}
```

Gunakan riwayat konfigurasi (`effectiveFrom`/`effectiveTo`) bila plafon berubah dalam tahun berjalan. Jika MVP belum mendukung perubahan plafon, tolak lebih dari satu konfigurasi aktif dan tampilkan keterbatasan secara eksplisit.

### 4.3 Validasi wajib

| Kondisi | Validasi yang harus diterapkan |
|---|---|
| Semua nominal | Harus >= 0; gunakan integer Rupiah/Decimal |
| UP, TUP, GUP, PTUP | Nominal harus > 0, kecuali `GUP_NIHIL` yang harus bernilai 0 |
| GUP/GUP Nihil/PTUP | `referenceSp2dAt` wajib |
| GUP/GUP Nihil/PTUP | `sp2dAt` harus setelah `referenceSp2dAt` |
| GUP | `sourceUpTransactionId` wajib atau resolver rantai UP harus berhasil |
| Setoran TUP | `sourceTupTransactionId` wajib jika relasi sudah diaktifkan |
| Setoran TUP | Akumulasi setoran tidak boleh melebihi nilai TUP asal |
| Semua tanggal | Harus berada dalam tahun anggaran, kecuali reference transaction lintas tahun yang secara policy diizinkan |
| KKP aktif | `monthlyKkpCeiling` harus > 0 |
| KKP tidak tersedia/pending | `monthlyKkpCeiling` boleh kosong; transaksi KKP baru tidak boleh diinput tanpa override beralasan/audit |
| Duplikasi | Tolak duplikasi transaksi berdasarkan tipe, nomor referensi bila ada, nominal, dan tanggal yang identik; sediakan warning jika kemiripan tinggi |

Jangan skip transaksi bertanggal malformed secara diam-diam. Tampilkan error per baris dan keluarkan indikator sebagai `incomplete` bila data penting tidak valid.

---

## 5. Perubahan Engine dan Kontrak Hasil

### 5.1 Input engine

```ts
type UpTupCalculationInput = {
  fiscalYear: number
  periodEnd: 'YYYY-MM-DD'
  ruleSet: UpTupRuleSet
  configuration: UpTupConfiguration | null
  transactions: UpTupTransaction[]
  kkpTransactions: Array<{ id: string; amount: Decimal; usageDate: 'YYYY-MM-DD' }>
  adjustmentPolicies: ScoringAdjustmentPolicy[]
}
```

### 5.2 Parameter rule set minimum

```ts
type UpTupRuleSet = {
  indicatorWeight: Decimal // default 0.10
  cashWeight: Decimal // default 0.90
  kkpWeight: Decimal // default 0.10
  cashComponents: {
    timelinessWeight: Decimal // 0.50
    monthlyGupWeight: Decimal // 0.25
    tupDepositWeight: Decimal // 0.25
    timelinessWindow: {
      mode: 'same_day_next_month' | 'calendar_days'
      value?: number
    }
    monthlyGup: {
      basisMonth: 'reference_sp2d_month'
      capScore: Decimal | null
    }
    tupDeposit: {
      formula: '100_minus_deposit_ratio'
      noTupBehavior: 'not_applicable' | 'score_100' | 'incomplete'
    }
  }
  kkp: {
    targets: [Decimal, Decimal, Decimal, Decimal]
    underTargetScore: Decimal // 100
    meetsTargetScore: Decimal // 110
    noTransactionBehavior: 'exclude_kkp_convert_cash_90'
  }
  finalScoreCap: Decimal | null // default 100
  rounding: { scale: number; mode: 'HALF_UP' | 'HALF_EVEN' | 'DOWN' }
}
```

### 5.3 Output engine

Output harus memisahkan data mentah, skor, policy, warning, dan trace.

```ts
type UpTupCalculationResult = {
  score: Decimal | null
  weightedContribution: Decimal | null
  status: 'complete' | 'warning' | 'incomplete' | 'not_applicable'
  components: {
    cash: ComponentResult
    timeliness: ComponentResult
    monthlyGup: ComponentResult
    tupDeposit: ComponentResult
    kkp: ComponentResult
  }
  kkpCase: 'no_kkp' | 'pending_issuance' | 'no_kkp_transaction' | 'below_target' | 'meets_target'
  appliedPolicies: AppliedAdjustment[]
  warnings: Warning[]
  missingData: MissingData[]
  formulaTrace: FormulaTraceLine[]
}
```

Setiap `FormulaTraceLine` harus dapat menjelaskan:

- ID transaksi dan tipe transaksi.
- Nilai nominal dan tanggal sumber.
- Formula yang dipakai.
- Nilai normal dan nilai setelah adjustment jika ada.
- Policy code/title yang diterapkan.
- Pembulatan dan cap yang diterapkan.

### 5.4 Konsistensi

- Dashboard, halaman `/operator/up-tup`, simulasi, forecast, scenario, riwayat, XLSX, dan PDF wajib memanggil satu engine yang sama.
- Jangan ada perhitungan formula tersendiri di React component.
- Tidak boleh ada default tanggal KKP palsu seperti tanggal 15 untuk data tanpa tanggal. Tanggal penggunaan KKP wajib, atau data ditandai incomplete.
- What-if harus menghasilkan input engine dengan struktur yang sama seperti actual; jangan menggunakan counter fiktif Rp1 juta untuk menggantikan transaksi.

---

## 6. Desain Halaman Operator

### 6.1 Halaman input `/operator/data/up-tup-kkp`

Buat tiga tab:

1. **Transaksi UP/TUP**
2. **Penggunaan KKP**
3. **Konfigurasi UP KKP**

#### Tabel transaksi UP/TUP

Kolom minimum:

- Tipe transaksi
- Nominal
- Tanggal SP2D saat ini
- SP2D sebelumnya/referensi
- Sumber UP/TUP
- Status validasi
- Penyesuaian policy aktif
- Dampak komponen
- Aksi lihat/edit/hapus

Tampilkan badge policy, misalnya:

```text
Fairness THR 2026
Faktor hari: 7 hari kalender
Berlaku karena SP2D sebelumnya: 20-02-2026
Komponen: Ketepatan Waktu, %GUP Disebulankan
```

#### Form transaksi

- Saat user memilih `GUP`, `GUP_NIHIL`, atau `PTUP`, field SP2D sebelumnya wajib dan diberi helper text.
- Saat memilih `GUP`, tampilkan pilihan UP sumber/rantai referensi dan preview %GUP disebulankan.
- Saat memilih `SETORAN_TUP`, tampilkan pilihan TUP sumber dan sisa nominal yang masih dapat disetor.
- Preview hanya bersifat informasi; skor resmi tetap dihitung server.
- Perlihatkan validasi inline sebelum simpan.

#### Konfigurasi UP KKP

Field minimum:

- Status KKP: Tidak memiliki / Menunggu penerbitan bank / Aktif.
- Plafon UP KKP per bulan.
- Tanggal efektif.
- Referensi/dokumen dasar (opsional tetapi dianjurkan).

Di bawah form, tampilkan simulasi target tahunan dan per TW berdasarkan plafon yang diisi.

### 6.2 Workspace `/operator/up-tup`

Tampilkan urutan informasi berikut:

1. Nilai indikator UP/TUP, kontribusi bobot 10%, status data, rule set version.
2. Kartu NK Tunai, NK KKP, dan case KKP yang dipakai.
3. Tiga kartu tunai: Ketepatan Waktu, %GUP Disebulankan, Setoran TUP.
4. Tabel objek transaksi pembentuk nilai.
5. Panel “Penyesuaian policy yang diterapkan”.
6. Rekomendasi tindakan.
7. What-if yang menggunakan transaksi/plafon nyata, bukan counter fiktif.

#### Panel policy operator

Panel read-only harus menampilkan:

- Kode dan judul policy.
- Komponen terdampak.
- Rentang tanggal objek.
- Parameter yang diubah, contoh: `Jumlah hari sebulan: 28 -> 7 hari kalender`.
- Jumlah transaksi yang terdampak.
- Dasar kebijakan.
- Link/drawer “Lihat detail formula”.

#### Rekomendasi tindakan

Saran harus berasal dari data nyata. Contoh:

- “GUP Rp65.000.000 dengan SP2D sebelumnya 25-02-2026 perlu diterbitkan paling lambat [tanggal policy] agar memenuhi ketepatan waktu.”
- “%GUP disebulankan saat ini 78,40; tambah nominal GUP atau percepat pengajuan agar menuju 100.”
- “Setoran TUP Rp10.100.000.000 dari total TUP Rp56.000.000.000 menurunkan NK setoran menjadi 81,96.”
- “Target KKP TW III Rp54.000.000; realisasi kumulatif Rp35.000.000; gap Rp19.000.000.”

Jangan memberi rekomendasi KKP jika case KKP adalah `no_kkp`, `pending_issuance`, atau `no_kkp_transaction` tanpa menjelaskan konversi 90% yang sedang dipakai.

---

## 7. Desain Halaman Admin KPPN

### 7.1 Menu baru

Tambahkan menu:

```text
Admin Policy
└── Penyesuaian Penilaian
```

URL yang disarankan:

```text
/admin-kppn/policy/scoring-adjustments
/admin-kppn/policy/scoring-adjustments/:id
```

### 7.2 Daftar policy

Tabel daftar:

- Kode policy
- Judul
- Indikator
- Komponen terdampak
- Scope
- Rentang objek
- Status
- Rule set version
- Publisher dan tanggal publish
- Aksi: lihat, duplikasi sebagai draft, retire

Filter:

- Tahun anggaran
- Rule set
- Indikator
- Status
- Scope
- Rentang tanggal

### 7.3 Form draft policy

Untuk membuat fairness treatment THR, form harus memuat:

1. Tahun anggaran dan rule set tujuan.
2. Judul/kode policy.
3. Scope: global, cakupan KPPN, atau satu satker.
4. Indikator: Pengelolaan UP dan TUP.
5. Komponen terdampak: checklist Ketepatan Waktu dan %GUP Disebulankan.
6. Basis tanggal objek: `SP2D sebelumnya/referensi`.
7. Rentang tanggal objek: 18-02-2026 sampai 17-03-2026.
8. Jenis penyesuaian: Override jumlah hari sebulan.
9. Nilai penyesuaian: 7.
10. Basis hari: hari kalender.
11. Dasar kebijakan/surat.
12. Alasan penyesuaian.
13. Catatan perubahan.

Field terkait regulasi wajib diisi sebelum policy dapat dikirim untuk review/publish.

### 7.4 Preview dampak sebelum publish

Tombol **Preview Dampak** wajib tersedia sebelum Publish.

Preview menampilkan:

- Jumlah satker yang masuk scope.
- Jumlah transaksi yang memenuhi policy.
- Daftar transaksi terdampak: satker, tipe, ID, tanggal referensi, tanggal SP2D sekarang, komponen, nilai sebelum/selepas adjustment.
- Distribusi perubahan nilai indikator per satker.
- Warning data yang belum lengkap/invalid.
- Konflik dengan policy aktif lain.

Admin tidak dapat mem-publish bila preview gagal dibuat atau terdapat konflik policy yang belum diselesaikan.

### 7.5 Publish, retire, dan audit

- Publish adalah aksi irreversible dan harus memakai dialog konfirmasi.
- Dialog memuat policy lengkap, scope, periode, parameter, dasar kebijakan, serta jumlah transaksi terdampak dari preview terakhir.
- Publish menghasilkan audit log dengan before/after, actor, timestamp, rule set version, policy ID, dan hasil preview hash.
- Policy `published` read-only.
- Aksi `Retire` tidak menghapus policy atau snapshot; hanya mencegah policy diterapkan pada perhitungan baru setelah tanggal retire.
- Jika perlu koreksi, sediakan **Duplikasi sebagai Draft**, bukan edit langsung pada policy published.

### 7.6 Hak akses

| Aksi | Operator Satker | Admin KPPN |
|---|---:|---:|
| Melihat policy yang berlaku pada satker sendiri | Ya | Ya |
| Melihat policy semua satker dalam scope | Tidak | Ya |
| Membuat/edit draft policy | Tidak | Ya |
| Preview dampak policy | Tidak | Ya |
| Publish/retire policy | Tidak | Ya, dengan audit dan konfirmasi |
| Mengubah policy published | Tidak | Tidak |
| Duplikasi policy published menjadi draft | Tidak | Ya |

---

## 8. Reminder dan Kalender

- Reminder GUP/PTUP harus menggunakan rule set yang sama dengan engine.
- Deadline normal mengikuti `timelinessWindow` rule set.
- Jika fairness policy memengaruhi interpretasi periode ketepatan waktu, reminder harus menampilkan policy yang aktif dan menghitung deadline sesuai policy tersebut.
- Jangan memakai kalender hari biasa yang di-hardcode jika rule set memerlukan hari kerja; parameter `calendar_day`/`workday` harus eksplisit.
- Jadwal reminder default yang disarankan: H-7, H-3, H-1 untuk event yang eligible, tetapi angka ini harus bisa dikonfigurasi policy.
- Reminder tidak boleh menampilkan deadline “pasti” bila `referenceSp2dAt` belum terisi atau invalid; tampilkan aksi “Lengkapi SP2D sebelumnya”.

---

## 9. Migrasi Data dan Backward Compatibility

1. Buat migrasi schema untuk relasi sumber transaksi, konfigurasi KKP, dan scoring adjustment policy.
2. Jangan menghapus data lama.
3. Tandai data lama yang tidak memiliki referensi/rantai transaksi sebagai `needs_review`.
4. Jangan menghasilkan skor seolah lengkap dari data lama yang tidak cukup; status harus `incomplete` dengan daftar perbaikan data.
5. Migrasikan rule set hardcoded ke record rule set terbit, termasuk bobot, target KKP, cap, dan aturan case KKP.
6. Hapus penggunaan fallback tanggal KKP buatan.
7. Hapus/matikan fungsi collapse tipe DB menjadi `UP/TUP` setelah engine baru aktif.
8. Jalankan shadow calculation pada dataset lama dan simpan perbedaan hasil untuk review internal sebelum switch production.

---

## 10. Acceptance Criteria dan Test Wajib

### 10.1 Golden test rumus dasar

1. **GUP disebulankan normal**
   - UP Rp100.000.000; GUP Rp65.000.000.
   - Referensi 25-02-2023; GUP sekarang 16-03-2023.
   - Hari bulan basis = 28; selisih = 19.
   - Hasil = 95,79.

2. **Setoran TUP**
   - Total TUP Rp56.000.000.000; total setoran Rp10.100.000.000.
   - Persentase setoran = 18,03.
   - NK setoran = 81,97 (sesuai mode pembulatan rule set).

3. **KKP empat TW**
   - Plafon bulanan Rp50.000.000; plafon setahun Rp600.000.000.
   - Realisasi kumulatif: Rp4 juta, Rp35 juta, Rp57 juta, Rp70 juta.
   - Skor TW: 100, 110, 110, 100.
   - NK KKP = 105.

4. **Case KKP tanpa transaksi**
   - Status KKP aktif tetapi transaksi KKP kosong.
   - KKP tidak dihitung; hasil mengikuti konversi tunai 90%; tidak boleh ada NK KKP 100 buatan.

5. **Batas waktu next-month**
   - Uji tanggal 31 Januari menuju Februari non-kabisat dan kabisat.
   - Uji tepat batas dan satu hari melewati batas.

### 10.2 Golden test fairness THR 2026

1. `referenceSp2dAt = 2026-02-18` -> policy diterapkan.
2. `referenceSp2dAt = 2026-03-17` -> policy diterapkan.
3. `referenceSp2dAt = 2026-02-17` -> policy tidak diterapkan.
4. `referenceSp2dAt = 2026-03-18` -> policy tidak diterapkan.
5. Policy hanya mengubah Ketepatan Waktu dan %GUP Disebulankan; skor Setoran TUP dan KKP identik dengan kalkulasi normal.
6. Trace memuat `UPT-FAIR-THR-2026-01`, nilai normal hari bulan, nilai override 7, dan alasan aplikasi policy.
7. Policy scope organisasi mengalahkan policy global jika keduanya cocok; konflik tercatat.

### 10.3 Test validasi

- GUP tanpa referensi ditolak.
- PTUP tanpa referensi ditolak.
- GUP dengan `sp2dAt <= referenceSp2dAt` ditolak.
- GUP Nihil dengan nominal selain 0 ditolak.
- Nominal negatif ditolak.
- Setoran melebihi TUP sumber ditolak.
- KKP aktif tanpa plafon bulanan ditandai incomplete.
- Tanggal KKP kosong tidak boleh diganti otomatis menjadi tanggal 15.
- Input tanggal malformed menghasilkan error terstruktur dan tidak diskip diam-diam.

### 10.4 Test UI/E2E

- Operator melihat badge fairness untuk transaksi yang eligible.
- Operator tidak menemukan tombol tambah/edit/publish policy.
- Admin dapat membuat draft, menjalankan preview, dan publish setelah konfirmasi.
- Publish mengubah perhitungan baru namun tidak mengubah snapshot lama.
- Dashboard, workspace, simulasi, XLSX, dan PDF menampilkan skor serta policy yang sama.
- What-if memakai transaksi/rantai/plafon nyata dan hasil sama dengan engine server.

---

## 11. Urutan Implementasi

### P0 — Wajib sebelum dipakai untuk penilaian

1. Ganti engine dengan rumus kanonis UP/TUP/KKP.
2. Hentikan collapse enam tipe transaksi.
3. Aktifkan penggunaan `referenceSp2dAt` dan relasi sumber UP/TUP.
4. Tambah konfigurasi plafon UP KKP bulanan.
5. Perbaiki case KKP tanpa transaksi agar tidak memberi nilai 100 otomatis.
6. Terapkan cap/pembulatan dari rule set.
7. Tambah validasi tanggal, nominal, referensi, dan duplikasi.
8. Tambah golden tests rumus dasar.

### P1 — Wajib untuk fairness treatment dan audit

1. Tambah `scoring_adjustment_policies`.
2. Buat policy resolver dan formula trace.
3. Implementasikan policy THR 2026 dengan parameter 7 hari kalender.
4. Buat halaman Admin Penyesuaian Penilaian: draft, preview dampak, publish, retire, audit.
5. Tampilkan policy read-only untuk Operator.
6. Simpan applied policy pada snapshot/export.
7. Tambah test fairness boundaries dan historical integrity.

### P2 — Penguatan usability

1. Rekomendasi tindakan per transaksi dan gap KKP.
2. Reminder terintegrasi dengan policy adjustment.
3. Import template untuk UP/TUP/KKP dengan validasi baris.
4. Riwayat plafon KKP bila ada perubahan di tengah tahun.
5. Perbandingan “nilai normal vs nilai setelah policy” khusus audit/admin, bukan sebagai nilai resmi operator.

---

## 12. Definition of Done

Pekerjaan dianggap selesai hanya jika seluruh kondisi berikut terpenuhi:

- Engine menghasilkan contoh GUP 65% × 28/19 = 95,79.
- Engine menghasilkan NK setoran TUP sebagai `100 - (setoran/TUP × 100)`.
- Engine KKP menggunakan plafon UP KKP bulanan × 12 dan realisasi kumulatif per TW.
- Tidak ada lagi KKP kosong yang diam-diam menghasilkan skor 100.
- Tidak ada lagi collapse transaksi GUP/PTUP/setoran menjadi UP.
- Fairness policy THR 2026 dapat dipublish Admin, otomatis diterapkan hanya pada objek referensi 18-02-2026 s.d. 17-03-2026, dan hanya pada dua komponen yang ditentukan.
- Operator dapat memahami mengapa suatu policy diterapkan tanpa dapat memodifikasi policy.
- Setiap hasil skor dapat ditelusuri ke transaksi, formula, rule set, policy adjustment, dan audit log.
- Dashboard/workspace/simulasi/export konsisten memakai engine yang sama.
- Seluruh golden test, validation test, dan E2E test pada bagian 10 lulus.
