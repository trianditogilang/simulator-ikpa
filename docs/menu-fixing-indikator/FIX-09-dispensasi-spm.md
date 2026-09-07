# FIX-09 — Perbaikan Menu Dispensasi SPM

**Untuk:** AI Agent Developer (implementasi sekarang) + catatan Admin Policy (halaman admin belakangan).  
**Produk:** Simulator Penilaian IKPA Satker.  
**Halaman utama:** `/operator/data/spm-dispensation`  
**Bahasa UI:** Indonesia. Timezone: `Asia/Jakarta`.  
**Status tiket:** WAJIB dikerjakan di sprint ini untuk operator + engine. Halaman admin **jangan diimplementasi sekarang**, tetapi semua parameter di bawah harus sudah *admin-ready* (sumber kebenaran = `rule_set`, bukan hardcoded UI).

Dokumen ini **mandiri**. Jangan mencari PRD/FSD/TSD/PDF lain. Semua rumus, bucket, copy UI, file, tes, dan DoD ada di sini.

---

## 0. Cara agent mengerjakan

1. Baca seluruh dokumen ini dulu. Jangan menebak rumus.
2. Perbaiki engine + halaman operator + tes. Jangan sentuh UI Admin Policy kecuali file seed/`rule_set` default.
3. Banner halaman **wajib** memakai hasil engine yang sama dengan Dashboard. Dilarang hitung bucket di komponen UI.
4. Setelah merge, operator harus bisa memakai menu tanpa buka Simulasi untuk mengerti: berapa rasio permil, kategori berapa, berapa poin yang akan dipotong, dan apa yang harus dilakukan agar tidak dipotong.

---

## 1. Konteks bisnis (wajib dipahami)

Dispensasi SPM **bukan** indikator berbobot. Tidak ada bobot 10%/15%/dst.

Ini **pengurang nilai IKPA akhir**.

Di materi pelatihan Pusdiklat, ini disebut “indikator ke-7”. Di aplikasi, tujuh indikator berbobot adalah: Revisi DIPA, Deviasi Hal. III, Penyerapan, Kontraktual, Tagihan, UP/TUP, Capaian Output. Dispensasi tampil sebagai **baris pengurang** di Dashboard (boleh baris ke-8), dengan:

- `weight = 0`
- `rawScore = deduction` (nilai pengurang, positif)
- `weighted = −deduction`
- label UI: **Pengurang**, bukan “Nilai indikator”

Rumus resmi:

```
rasio_permil = (jumlah SPM dispensasi akhir tahun / jumlah SPM terbit Triwulan IV) × 1000
nilai_IKPA_akhir = nilai_IKPA_tujuh_indikator − pengurang_dispensasi
```

- Pembilang: cacah (jumlah lembar) SPM yang diterbitkan dengan dispensasi akhir tahun.
- Penyebut: cacah (jumlah lembar) seluruh SPM yang terbit di Triwulan IV (Oktober–Desember tahun anggaran berjalan).
- **Bukan** nominal rupiah. Jangan menambah kolom nilai SPM untuk rumus ini.
- Satuan rasio: **permil** (‰), per 1.000 SPM. Contoh: 5‰ = 5 SPM dispensasi dari 1.000 SPM Q4.

Nilai akhir:

```
Nilai IKPA akhir = Nilai IKPA − Pengurang dari indikator Dispensasi SPM
```

### 1.1 Tabel kategori resmi (kunci, jangan diubah)

Batas inklusif. Bandingkan rasio yang sudah dibulatkan **2 desimal** (lihat §2) ke tabel ini.

| Kategori | Rasio dispensasi SPM (‰) | Pengurang nilai IKPA |
|---:|---|---:|
| 1 | 0,00 (tidak ada dispensasi) | 0,00 |
| 2 | 0,01 – 0,09 | 0,25 |
| 3 | 0,10 – 0,99 | 0,50 |
| 4 | 1,00 – 4,99 | 0,75 |
| 5 | ≥ 5,00 | 1,00 |

Catatan presisi vs kode lama:

- Jangan pakai 0,099 / 0,999 / 4,999 sebagai batas tabel.
- Setelah rasio dibulatkan 2 desimal: `0,09` masih kategori 2; `0,10` kategori 3; `0,99` kategori 3; `1,00` kategori 4; `4,99` kategori 4; `5,00` kategori 5.
- Rasio persis `0,00` hanya jika pembilang 0 (atau total 0 → fallback 0, lihat §2).

### 1.2 Golden case resmi (kunci tes)

Data slide Pusdiklat (bukan 5.200):

- SPM dispensasi = **24**
- Total SPM Triwulan IV = **5.214**
- Rasio = `24 / 5214 × 1000 = 4,603759...` → tampil **4,60‰**
- 4,60 masuk kategori 4 → pengurang **0,75**
- Nilai IKPA sebelum pengurang = **97,25**
- Nilai IKPA akhir = `97,25 − 0,75 = 96,50`

Dilarang memakai 5.200 atau hasil 4,615 / 4,62 sebagai golden utama. 4,62 boleh disebut di komentar tes sebagai “varian pembulatan lama”, bukan expected.

Ucapan lisan “4,40” **salah**. Jangan di-code.

### 1.3 Strategi satker (wajib tampil di UI operator)

Tiga tindakan pengendalian, bukan dekorasi:

1. **Pantau progres kegiatan vs batas akhir SPM.** Surat/petunjuk batas akhir penyampaian SPM akhir tahun biasanya terbit Oktober atau November. Satker harus memetakan pekerjaan ke batas itu, jangan menunggu Desember.
2. **Mitigasi risiko pembayaran akhir tahun.** Identifikasi pekerjaan yang pembayarannya condong ke akhir tahun; siapkan mitigasi agar tidak perlu dispensasi SPM ke DJPb.
3. **Hitung prognosis belanja dan cairkan tepat waktu.** Jangan tumpuk pencairan di Desember. Eksekusi yang bisa dilakukan Oktober/November (atau jauh lebih awal) harus dieksekusi lebih awal.

Target operasional: pengurang **0,00** (kategori 1).

---

## 2. Aturan kalkulasi yang harus di-code

Implementasi hanya di engine. UI, Dashboard, Simulasi, export, PDF, XLSX **hanya menampilkan** hasil engine.

### 2.1 Input engine

```ts
{
  dispensationCount: integer >= 0,  // jumlah SPM berflag dispensasi
  totalSpmQ4: integer >= 0          // jumlah seluruh SPM Q4 (normal + dispensasi)
}
```

Sumber actual:

- `totalSpmQ4` = count baris `spm_q4` non-deleted, `issuedAt` di Oktober–Desember, `fiscalYearId` aktif.
- `dispensationCount` = subset dengan `isDispensasi = true`.

Sumber forecast/scenario: overlay asumsi `{ dispensationCount, totalSpmQ4 }` **menggantikan** count DB (bukan menambah).

### 2.2 Langkah hitung

1. Jika `totalSpmQ4 === 0`:
   - `ratio = 0`
   - `deduction = 0`
   - `status = complete` (bukan incomplete, bukan Estimasi)
   - warning: `"Belum ada SPM Triwulan IV. Pengurang dispensasi dihitung 0."`
2. Jika `dispensationCount > totalSpmQ4`: **tolak di server** (validasi), jangan dihitung. Jangan silently cap atau hasilkan rasio > 1000‰ dari data rusak.
3. `ratioRaw = dispensationCount / totalSpmQ4 * 1000`
4. `ratio = round_half_up(ratioRaw, 2)` → contoh 4,603759… menjadi **4,60**
5. Lookup bucket pada `ratio` (2 desimal) dengan tabel §1.1
6. `deduction` = nilai pengurang bucket (0 / 0,25 / 0,50 / 0,75 / 1,00)
7. Orkestrator IKPA: `total = round_half_up(subtotal_7_indikator − deduction, 2)`
8. Jika salah satu dari 7 indikator incomplete: `total = null` (Estimasi) **tetap tampilkan** `deduction` terpisah. Jangan menyembunyikan pengurang.

### 2.3 Bucket di `rule_set` (bukan hardcoded di UI)

Ganti implementasi lama yang memakai `0–0.009 / 0.01–0.099 / 0.1–0.999 / 1–4.999 / ≥5`.

Default 2026 yang harus ada di `rule_set.config_json.dispensation.deductionBuckets`:

```json
{
  "ratioScale": 2,
  "ratioMultiplier": 1000,
  "rounding": "HALF_UP",
  "countBasis": "document_count",
  "q4Months": [10, 11, 12],
  "deductionBuckets": [
    { "minPermille": 0,    "maxPermille": 0,    "deduction": 0,    "category": 1, "label": "Tidak ada dispensasi" },
    { "minPermille": 0.01, "maxPermille": 0.09, "deduction": 0.25, "category": 2, "label": "Sangat rendah" },
    { "minPermille": 0.10, "maxPermille": 0.99, "deduction": 0.50, "category": 3, "label": "Rendah" },
    { "minPermille": 1.00, "maxPermille": 4.99, "deduction": 0.75, "category": 4, "label": "Sedang" },
    { "minPermille": 5.00, "maxPermille": null, "deduction": 1.00, "category": 5, "label": "Tinggi" }
  ]
}
```

Lookup: first-match inklusif `minPermille <= ratio <= maxPermille`; jika `maxPermille === null` maka `ratio >= minPermille`. Jika tidak ketemu (seharusnya tidak terjadi), fallback kategori 5 dan tulis warning engine.

Kategori 1 hanya untuk `ratio === 0` (setelah round 2 desimal). Jangan pakai rentang `0–0,009`.

### 2.4 Yang dilarang

- Menghitung bucket di `spm-dispensation.tsx` dengan `ratio <= 50 / <= 100`. Itu bug: memperlakukan permil sebagai persen. **Hapus fungsi `estimatedDeduction` lokal.**
- Memakai floating point JS biasa untuk rasio uang/skor. Tetap `DecimalCalc` / string decimal.
- Menganggap Q4 kosong = data incomplete yang menahan total IKPA. Q4 kosong = pengurang 0 + warning.
- Default checkbox dispensasi = `true` pada form tambah.

---

## 3. File yang harus disentuh

Kerjakan di file ini (path sesuai repo saat inspeksi). Jika path bergeser, cari symbol di kolom kanan.

| Lapisan | Path / symbol | Tindakan |
|---|---|---|
| Engine | `packages/ikpa-engine/src/indicators/spm-dispensation.ts` → `calculateSpmDispensation` | Round 2 desimal; bucket resmi; trace ID |
| Rule set | `packages/ikpa-engine/src/rule-set.ts` (bucket dispensasi) | Ganti batas 0,09 / 0,99 / 4,99 |
| Skema | `packages/ikpa-engine/src/schemas.ts` `spmDispensationInputSchema` | Tetap 2 integer ≥ 0 |
| Orkestrator | `packages/ikpa-engine/src/calculate.ts` | `total = subtotal − deduction`, half-up 2 |
| Mapping actual/scenario | `apps/web/src/server/simulation/calculate.ts` | Count DB vs asumsi; tolak disp>total |
| Preview asumsi | `apps/web/src/lib/simulation/dispensasi-assumptions.ts` → `calcDispensasiPreview` | Panggil engine, jangan duplikasi bucket |
| Panel simulasi | `apps/web/src/components/operator/dispensasi-assumption-panel.tsx` | Copy UI §5.3 |
| **Halaman operator** | `apps/web/src/routes/operator/data/spm-dispensation.tsx` | Rebuild UI §5; hapus banner salah |
| Service | `apps/web/src/services/spm-dispensation-service.ts` | Tetap CRUD |
| ServerFn | `apps/web/src/server/spm-dispensation.ts` | Jangan hardcode FY di copy jika tahun aktif sudah ada |
| Domain | `apps/web/src/server/domains/spm-dispensation.mutations.ts` | Unique nomor, Q4 timezone WIB, default false |
| DB | `packages/db/src/schema/spm-q4.ts` | Unique `(fiscal_year_id, reference_number)` non-deleted |
| Seed reminder | `packages/db/src/seed.ts` event `spm_dispensation_q4` | Copy + jadwal §6 |
| Dashboard | `apps/web/src/server/dashboard.ts` + `dashboard.tsx` | Label pengurang; route benar |
| Rekomendasi | peta `RECOMMENDATION_ROUTES` | Tambah kunci `spm_dispensasi` → `/operator/data/spm-dispensation` |
| Tes | `spm-dispensation.test.ts`, `dispensasi-assumptions.test.ts` | Golden 24/5214 |

Jangan buat rumus ketiga di export/PDF. Ambil dari snapshot engine.

---

## 4. Bug yang wajib ditutup (sekarang)

### BUG-1 — Banner halaman salah bucket (P0)

**Sekarang:** `disp==0 → 0; ratio≤50 → 0.5; ratio≤100 → 0.75; else 1.0`.  
**Dampak:** 24/5214 ≈ 4,60‰ ditampilkan pengurang 0,50 padahal resmi 0,75 (selisih 0,25 poin). 1/100 = 10‰ bisa 0,50 di banner vs 1,00 di engine.

**Perbaikan:** Hapus kalkulasi lokal. Banner dan kartu ringkasan memakai `{ ratio, category, deduction }` dari `calculateSpmDispensation` (via loader/server function). Satu sumber angka dengan Dashboard.

### BUG-2 — Default form `isDispensasi = true` (P0)

Setiap SPM Q4 baru otomatis masuk pembilang pengurang.  
**Perbaikan:** default `false` (Normal). Operator mencentang / toggle Dispensasi secara sadar. Saat mengubah Normal → Dispensasi, tampilkan konfirmasi:

> “Menandai SPM ini sebagai dispensasi akan menaikkan rasio permil dan dapat memotong nilai IKPA. Lanjutkan?”

### BUG-3 — Golden test 24/5200 (P1)

Ganti ke 24/5214 → ratio 4,60 → deduction 0,75. Tambah tes orkestrator 97,25 − 0,75 = 96,50.

### BUG-4 — Bucket 3-nines (P1)

`0.1–0.999` dan `1–4.999` tidak sama dengan tabel resmi 0,99 dan 4,99. Samakan ke §1.1 + round 2 desimal.

### BUG-5 — Tidak ada unique nomor SPM (P1)

Dua baris nomor sama bisa menggandakan cacah. Enforce unique per tahun anggaran (soft-delete excluded). Error UI:

> “Nomor SPM sudah tercatat di Triwulan IV tahun ini.”

### BUG-6 — Q4 guard timezone-naif (P1)

`getMonth()` tanpa zona bisa geser 1 hari di batas 1 Oktober / 31 Desember. Parse tanggal bisnis `YYYY-MM-DD` di kalender `Asia/Jakarta`. Bulan harus 10, 11, atau 12 **tahun anggaran aktif**. Tolak Januari–September dan tahun lain.

### BUG-7 — Server menerima `disp > total` pada asumsi (P1)

Panel menolak, server membiarkan. Samakan: validasi Zod `dispensationCount <= totalSpmQ4`.

### BUG-8 — Rekomendasi tidak terpetakan (P2)

Kunci `spm_dispensasi` / `spm_dispensation` tidak ada di `RECOMMENDATION_ROUTES` sehingga CTA jatuh ke `/operator/simulation`. Arahkan ke halaman SPM Dispensasi.

### BUG-9 — Reminder ada di seed, tidak ada di halaman (P2)

Tampilkan strip risiko akhir tahun di halaman (bukan hanya Reminder Center). Copy §6.

### BUG-10 — Header “Triwulan IV 2026” statis (P2)

Pakai tahun anggaran aktif dari konteks satker, bukan literal 2026.

---

## 5. Spesifikasi UI operator (supaya mudah dipakai)

Halaman: `/operator/data/spm-dispensation`  
Judul: **SPM Dispensasi**  
Subtitle: `Pengurang nilai IKPA · bukan indikator berbobot · Triwulan IV {tahun}`

Tujuan pengguna dalam 10 detik: tahu apakah nilai IKPA akan dipotong, berapa besar, dan apa yang harus dilakukan.

### 5.1 Layout desktop

```
[Breadcrumb: Input Data / SPM Dispensasi]
[Judul + helper]                              [Tahun {aktif}]  (+ Tambah SPM Q4)

[Kartu 1 Total SPM Q4] [Kartu 2 SPM Dispensasi] [Kartu 3 Rasio ‰] [Kartu 4 Pengurang]

[Banner status — 1 baris, warna sesuai kategori]

[Strip reminder batas akhir SPM]   (jika periode Okt–Des atau H-21…H-1)

[Toolbar: Cari nomor | Filter Semua/Normal/Dispensasi | {n data}]

[Tabel SPM Q4]
[Pagination]

[Panel bawah 2 kolom]
  Kiri: Cara hitung + tabel kategori (ringkas)
  Kanan: 3 strategi agar tidak dipotong
```

Mobile: kartu 2×2, banner, strip, list card (bukan tabel lebar), FAB `+ Tambah`, panel cara hitung/strategi sebagai accordion.

### 5.2 Kartu ringkasan (wajib)

| Kartu | Isi | Catatan |
|---|---|---|
| Total SPM Q4 | integer | penyebut |
| SPM Dispensasi | integer | pembilang; 0 = hijau |
| Rasio | `X,XX‰` | 2 desimal; helper “per 1.000 SPM Q4” |
| Pengurang | `−0,00` s.d. `−1,00` poin | merah jika > 0; `0,00` hijau |

Di bawah kartu pengurang, teks kecil:

`Nilai IKPA akhir = nilai 7 indikator − {deduction}`

Jika Dashboard/actual sudah punya subtotal, boleh tampilkan pratinjau:

`Pratinjau: {subtotal} − {deduction} = {akhir}`  
Jika subtotal null: jangan mengarang angka; tulis `Pengurang {deduction} poin akan dipotong dari nilai IKPA setelah 7 indikator lengkap.`

### 5.3 Banner status (satu-satunya “potensi pengurang”)

Gunakan `deduction` engine, bukan rumus UI.

| Kondisi | Variant | Copy |
|---|---|---|
| total Q4 = 0 | info | Belum ada SPM Triwulan IV. Pengurang dihitung 0 sampai data Q4 diisi. |
| deduction = 0 | success | Tidak ada dispensasi SPM. Nilai IKPA tidak dipotong dari indikator ini. |
| deduction = 0,25 | warning | Rasio {ratio}‰ · Kategori 2 · Pengurang 0,25 poin. |
| deduction = 0,50 | warning | Rasio {ratio}‰ · Kategori 3 · Pengurang 0,50 poin. |
| deduction = 0,75 | danger | Rasio {ratio}‰ · Kategori 4 · Pengurang 0,75 poin. |
| deduction = 1,00 | danger | Rasio {ratio}‰ · Kategori 5 · Pengurang 1,00 poin. |

Dilarang: “Potensi Pengurang −0,50” yang tidak sama dengan Dashboard.

### 5.4 Strip reminder (wajib di halaman ini)

Tampil jika bulan konteks ≥ Oktober atau `nearestDeadline` event `spm_dispensation_q4` dalam 21 hari.

Copy:

> **Batas akhir SPM tahun anggaran.** Petunjuk DJPb biasanya terbit Oktober/November. Selesaikan kegiatan dan SPM sebelum batas itu. Dispensasi ke DJPb memotong nilai IKPA.

CTA: `Lihat reminder` → `/operator/reminders` filter event dispensasi.  
CTA sekunder: `3 cara menghindari potongan` → scroll ke panel strategi.

### 5.5 Tabel

Kolom:

1. Nomor SPM (`referenceNumber`)
2. Tanggal terbit (`issuedAt`, format `D MMM YYYY`)
3. Status: badge `Normal` (netral) / `Dispensasi` (warning)
4. Aksi: `Tandai dispensasi` atau `Set normal`; `Hapus`

Filter: Semua | Normal | Dispensasi. Search: nomor, case-insensitive.

Empty state (0 baris):

> Belum ada SPM Triwulan IV. Tambahkan setiap SPM yang terbit Oktober–Desember, lalu tandai hanya yang benar-benar diterbitkan dengan dispensasi akhir tahun.

Helper di empty state: “Yang dihitung adalah jumlah lembar SPM, bukan nilai rupiah.”

Hapus: `confirm()` dengan copy:

> Hapus SPM {nomor}? Data terhapus dari perhitungan rasio Triwulan IV.

Soft-delete tetap.

### 5.6 Drawer tambah/edit

Field:

| Field | Wajib | Default | Validasi | Helper |
|---|---|---|---|---|
| Nomor SPM | Ya | kosong | trim 1–64, unique per FY | Nomor pada dokumen SPM |
| Tanggal terbit | Ya | hari ini jika Okt–Des; jika di luar Q4 biarkan kosong (jangan 2026-11-15 hardcode) | hanya tgl di Okt–Des tahun aktif | Hanya SPM Triwulan IV yang dihitung |
| Dispensasi akhir tahun | Tidak | **tidak dicentang** | boolean | Centang hanya jika SPM ini terbit dengan dispensasi DJPb |

Error tanggal non-Q4:

> Tanggal harus pada Oktober–Desember {tahun}. Penyebut rasio hanya SPM Triwulan IV.

Jangan hardcode `Triwulan IV 2026` atau default tanggal `2026-11-15`.

Setelah simpan: invalidate query, tutup drawer, fokus ke banner/kartu (bukan toast saja). Toast OK: `SPM {nomor} disimpan.`

### 5.7 Panel “Cara hitung” (kiri)

Tampilkan rumus apa adanya:

```
Rasio (‰) = SPM dispensasi ÷ SPM Triwulan IV × 1.000
Pengurang diambil dari kategori rasio
Nilai IKPA akhir = Nilai IKPA − Pengurang
```

Contoh resmi di UI (boleh collapsible “Lihat contoh”):

> Satker A: 24 SPM dispensasi, 5.214 SPM Q4 → 4,60‰ → kategori 4 → pengurang 0,75. Jika nilai IKPA 97,25 maka nilai akhir 96,50.

Tabel kategori mini (5 baris) sama dengan §1.1. Highlight baris kategori satker saat ini.

Teks: `5‰ artinya 5 SPM dispensasi dari 1.000 SPM yang terbit.`

### 5.8 Panel strategi (kanan) — wajib, bukan backlog

Judul: **Agar nilai IKPA tidak dipotong**

1. **Pantau progres vs batas akhir SPM.** Petakan penyelesaian kegiatan ke batas penyampaian SPM akhir tahun (biasanya diumumkan Oktober/November). Jangan menunggu Desember.
2. **Mitigasi pembayaran akhir tahun.** Identifikasi pekerjaan yang risikonya cair di penghujung tahun; siapkan rencana agar tidak perlu dispensasi.
3. **Prognosis belanja, cairkan lebih awal.** Hitung sisa belanja dan eksekusi di Oktober/November (atau sejak awal tahun). Penumpukan pencairan Desember adalah penyebab klasik dispensasi.

Jika `deduction > 0`, tambah 1 kalimat di atas list:

> Saat ini satker Anda pada kategori {n} (pengurang {deduction} poin). Turunkan jumlah SPM dispensasi atau selesaikan SPM Q4 tanpa dispensasi untuk mengurangi potongan.

Jangan janji “nilai resmi KPPN”. Disclaimer kecil di kaki halaman:

> Simulasi internal, bukan nilai resmi OMSPAN/KPPN.

### 5.9 Copy Dashboard

Baris pengurang:

- Nama: `Dispensasi SPM`
- Nilai tampilan: `−0,75` atau `0,00`
- Status: `Tanpa pengurang` jika 0; `Pengurang {x} poin` jika > 0
- Klik kartu → `/operator/data/spm-dispensation`
- Jangan tulis bobot `%`

Rekomendasi jika deduction ≥ 0,50:

> Kurangi SPM dispensasi akhir tahun. Buka menu SPM Dispensasi, cek rasio permil, dan percepat penyelesaian SPM sebelum batas akhir tahun.

### 5.10 Panel asumsi di Simulasi

Tetap 2 angka: `Jumlah SPM dispensasi` dan `Total SPM Q4`. Preview **harus** memanggil engine yang sama.

Label: `Pratinjau pengurang (bukan bobot)`.  
Tampilkan rasio ‰, kategori, pengurang.  
Validasi: kedua ≥ 0, dispensasi ≤ total, integer.

---

## 6. Reminder (operator sekarang, admin belakangan)

Event seed: `spm_dispensation_q4`

| Field | Nilai default 2026 |
|---|---|
| indicator_key | `spm_dispensasi` |
| category | `recommended` (bukan mandatory kecuali Admin Policy mengubahnya nanti) |
| day_type | `calendar_day` atau `end_of_year_schedule` yang sudah ada |
| default points | H-21, H-14, H-7, H-3, H-1 sebelum **31 Desember {tahun}** |
| lead range operator | H-1 s.d. H-30 |
| judul email/UI | Batas akhir SPM — cegah dispensasi |
| body singkat | Dispensasi SPM memotong nilai IKPA s.d. 1 poin. Selesaikan SPM Triwulan IV tanpa dispensasi. Rasio = SPM dispensasi ÷ SPM Q4 × 1000. |

Halaman operator menampilkan strip §5.4. Jangan hardcode `nearestDeadline` ke Capaian Output saja; event dispensasi harus bisa jadi deadline terdekat di Q4.

**Catatan admin (nanti):** Admin Policy boleh:

- mengubah kategori mandatory/recommended/optional
- mengubah titik H-n dalam min/max lead
- menambah event kedua: “surat batas akhir SPM terbit” bertipe `event_based` (tanggal diisi per tahun, default kosong sampai KPPN set)
- **tidak** boleh mengubah rumus permil tanpa menerbitkan `rule_set` baru

Jangan implementasi layar admin di tiket ini. Cukup pastikan seed + schema JSON mendukung field di atas.

---

## 7. Validasi backend

`issuedAt`: string tanggal `YYYY-MM-DD`, bulan ∈ {10,11,12}, tahun = fiscal year satker.  
`referenceNumber`: trim, 1–64, unique per `fiscal_year_id` di antara baris `deleted_at IS NULL`.  
`isDispensasi`: boolean, default `false`.  
Asumsi scenario: `Number.isInteger`, `>= 0`, `dispensationCount <= totalSpmQ4`.

Timezone: interpretasi tanggal bisnis di `Asia/Jakarta`, jangan `Date#getMonth()` UTC.

Audit: insert / toggle / soft-delete menulis `before_json` / `after_json` termasuk flag dispensasi.

---

## 8. Tes yang harus hijau

Unit engine:

1. `0 / 100 → ratio 0,00 → deduction 0,00` (kategori 1)
2. `0 / 0 → ratio 0,00 → deduction 0,00 + warning` (bukan incomplete)
3. **Golden:** `24 / 5214 → ratio 4,60 → deduction 0,75`
4. Orkestrator: subtotal `97,25` − `0,75` = `96,50`
5. `1 / 10000 = 0,10 → 0,50` (batas bawah kategori 3)
6. `1 / 1000 = 1,00 → 0,75` (batas bawah kategori 4)
7. `5 / 1000 = 5,00 → 1,00` (batas bawah kategori 5)
8. `26 / 5214 ≈ 4,99 → 0,75` (masih kategori 4; hitung exact lalu round 2)
9. Banner/UI: tidak ada fungsi lokal `estimatedDeduction`; komponen test memastikan props `deduction` dari engine

Hitung kasus 8 di tes dengan engine, jangan hardcode rasio salah.

Component/E2E ringkas:

- Tambah SPM default **bukan** dispensasi
- Toggle ke dispensasi memunculkan confirm
- Tanggal 30 September ditolak
- Duplikat nomor ditolak
- Kartu rasio/pengurang berubah setelah toggle dan **sama** dengan angka Dashboard

---

## 9. Jejak perhitungan (formulaTrace)

Minimal 3 langkah, bahasa Indonesia:

1. `Rasio permil = {disp} / {total} × 1000 = {ratio}`
2. `Kategori {n} (rentang {min}–{max}‰) → pengurang {deduction}`
3. `Nilai IKPA akhir = {subtotal} − {deduction} = {total}`

Snapshot menyimpan `dispensationDeduction`, `ratio`, `category`, `trace`, `ruleSetVersion`.

---

## 10. Catatan untuk halaman Admin Policy (nanti, jangan dikerjakan sekarang)

Simpan ini di tiket admin. Agent admin harus paham tanpa dokumen lain.

### 10.1 Prinsip

Dispensasi SPM di layar admin adalah **konfigurasi pengurang**, bukan editor bobot indikator. Jangan taruh slider bobot 0–100% untuk item ini. Jumlah 7 bobot tetap harus = 1 **tanpa** dispensasi.

### 10.2 Layar Rule Set — seksi “Pengurang Dispensasi SPM”

Tampilkan:

- Penjelasan 2 kalimat: pengurang akhir; rumus permil cacah SPM Q4.
- Field `ratioMultiplier` default 1000 (boleh dibaca, kunci jika bukan draft).
- Field `ratioScale` default 2.
- Editor tabel 5 bucket: min, max (kosong = ∞), deduction, label, category.
- Validasi publish: tidak overlap, tidak bolong dari 0 sampai ∞, deduction monoton tidak turun, tepat satu bucket untuk 0,00.
- Preview kalkulator di panel kanan: input 24 dan 5214 → harus 4,60 dan 0,75 pada default 2026. Jika admin mengubah bucket, preview mengikuti draft.
- Golden case tertanam sebagai tes verifikasi publish: jika tahun 2026 dan bucket default, `24/5214` wajib 0,75 atau publish ditolak dengan pesan jelas.

### 10.3 Yang boleh / tidak boleh diubah admin tanpa regulasi baru

Boleh (draft → publish versi baru):

- batas min/max permil
- besar pengurang per kategori
- titik reminder H-n
- kategori reminder (mandatory/recommended/optional)
- tanggal event “batas akhir SPM” per tahun

Tidak boleh dari UI biasa (hanya engineer + change_notes regulasi):

- mengganti cacah menjadi nominal rupiah (`countBasis`)
- mengganti penyebut selain SPM Q4
- memasukkan dispensasi ke rumus tertimbang 7 indikator

Setiap publish wajib `change_notes` dan `source_regulation`. Snapshot lama tidak dihitung ulang.

### 10.4 Copy admin yang harus muncul

> Pengurang ini dipotong setelah tujuh indikator berbobot. Contoh resmi: 24 SPM dispensasi / 5.214 SPM Q4 = 4,60‰ → kategori 4 → −0,75 poin. Nilai 97,25 menjadi 96,50.

### 10.5 Monitoring KPPN (nanti)

Kolom daftar satker: `Pengurang dispensasi`, `Rasio ‰`, badge kategori. Filter `pengurang > 0`. Jangan rata-rata bobot. Sortir satker berisiko Q4 = rasio tertinggi.

---

## 11. Definition of Done

- [ ] Tidak ada kalkulasi bucket di file UI halaman SPM Dispensasi.
- [ ] Banner, kartu, Dashboard, Simulasi, export memakai angka engine yang sama untuk dataset yang sama.
- [ ] Default SPM baru = Normal (`isDispensasi false`).
- [ ] Unique nomor + Q4 guard WIB + `disp ≤ total` di server.
- [ ] Tes golden `24/5214 → 4,60 → 0,75` dan `97,25 − 0,75 = 96,50` hijau.
- [ ] Bucket rule set = tabel §1.1 (0 / 0,01–0,09 / 0,10–0,99 / 1,00–4,99 / ≥5,00).
- [ ] Halaman menampilkan rumus, tabel kategori, contoh 96,50, dan 3 strategi.
- [ ] Strip reminder Q4 tampil di halaman.
- [ ] CTA rekomendasi dispensasi menuju `/operator/data/spm-dispensation`.
- [ ] Tahun di header = tahun anggaran aktif, bukan literal 2026.
- [ ] Disclaimer simulasi internal tetap ada.
- [ ] Tidak ada UI Admin Policy baru di PR ini; seed/rule_set default sudah sesuai §2.3 dan §6.

---

## 12. Di luar tiket ini

- Integrasi OMSPAN/SPAN.
- Kolom nominal rupiah SPM.
- Mengubah 7 bobot indikator lain.
- Membangun halaman `/admin-kppn/policy/rule-sets` seksi dispensasi (hanya disiapkan datanya).
- Mengganti nomor indikator pelatihan “ke-7” di seluruh panduan; cukup di halaman ini tulis: “Pengurang IKPA (materi pelatihan: indikator dispensasi SPM).”

---

## 13. Pesan commit / PR (usulan)

```
fix(ikpa): selaraskan dispensasi SPM ke rumus permil dan UI pengurang

- Hapus bucket banner ≤50/≤100; pakai engine
- Bucket resmi 0 / 0.01-0.09 / 0.10-0.99 / 1-4.99 / ≥5
- Golden 24/5214 = 4.60‰ → 0.75; 97.25-0.75 = 96.50
- Default flag normal, unique nomor, Q4 WIB
- Kartu rasio + strategi pengendalian di halaman operator
```
