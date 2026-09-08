# 08 — Capaian Output (bobot 25%)

**Anchor:** `00-system-overview.md`, `01-dashboard.md` | **Tanggal:** 2026-09-08
**Mode:** INSPECT → TRACE → DOCUMENT. Tanpa vonis regulasi, tanpa ubahan code/docs operasional.

## 1. Module Purpose

Halaman `/operator/data/output-achievement` mengelola data pelaporan Rincian Output (RO) bulanan (Januari s.d. Desember) dan menghitung nilai kinerja Indikator Capaian Output (IKPA-CO) yang merupakan indikator dengan bobot terbesar dalam IKPA (bobot 25%) berdasarkan PER-5/PB/2024 dan Petunjuk Teknis IKPA TA 2026.

Indikator ini mengevaluasi dua subkomponen utama:
1. **Ketepatan Waktu Pelaporan RO (NK-ROKW, bobot 30%)**: Menilai kedisiplinan satker dalam melaporkan data capaian output paling lambat pada hari kerja ke-5 bulan berikutnya ($5\text{ HK M+1}$).
2. **Capaian Rincian Output (NK-CRO, bobot 70%)**: Menilai tingkat capaian keluaran fisik dan progres pelaksanaan anggaran per RO menggunakan mekanisme *Dual-Formula*:
   - **Formula 1 (Januari–November & $\text{PCRO} < 100\%$)**: $\min\left(\frac{\text{PCRO}}{\text{TPCRO}} \times 100, 100\right)$
   - **Formula 2 (Desember atau $\text{PCRO} \ge 100\%$)**: $\min\left(\frac{\text{RVRO}}{\text{Target Volume RO DIPA}} \times 100, 100\right)$

Modul ini juga mengintegrasikan perlakuan keadilan (*Fairness Treatment* / Pengecualian Penilaian) untuk RO Khusus (seperti penugasan strategis pusat `FAN.ZZ1`, keadaan kahar, atau kebijakan khusus Kemenkeu/KPPN) di mana RO yang dikecualikan dikeluarkan penuh dari pembilang dan penyebut kedua subkomponen tanpa menghapus data historis transaksi.

## 2. Implementation Status

| Aspek | Status |
|---|---|
| CRUD Laporan RO (Kode/Nama RO, Bulan, Target Volume DIPA, RVRO, PCRO, TPCRO, Tanggal Lapor, Status Konfirmasi) | IMPLEMENTED |
| Validasi Integer Murni (Volume DIPA & RVRO) dan Format Dinamis Tanpa Trailing Zeros | IMPLEMENTED |
| Engine Dual-Formula 2026 (Formula 1 PCRO/TPCRO vs Formula 2 RVRO/Volume DIPA) | IMPLEMENTED (§7–9) |
| Aturan Khusus PCRO = 0% $\rightarrow 0.00$ & Scope Gate Konfirmasi (Draft $\rightarrow 0.00$) | IMPLEMENTED |
| Ketepatan Waktu Kanonis 5 Hari Kerja M+1 (`calculateFifthWorkingDayOfNextMonth` + Kalender Libur Nasional) | IMPLEMENTED (§7, §10) |
| Pengecualian Penilaian (Fairness Treatment: Operator Proposal & Admin Policy Resolver) | IMPLEMENTED (§7, §12) |
| Idempotent Upsert & Clean Delete Deaktivasi Usulan Fairness Satker | IMPLEMENTED |
| UI Ponytail: 4 Top Score Cards, Strip Reminder 5 HK Kanonis, 4 Filter Tabs, Tabel Interaktif | IMPLEMENTED |
| Form Drawer Input dengan Grid Target (Kiri) vs Realisasi (Kanan) & Real-Time Live Preview Formula | IMPLEMENTED |
| Modal Usulan Pengecualian (Fairness) & Modal Panduan Formula Pusdiklat PER-5 | IMPLEMENTED |
| Admin Fairness Policy Management & Review Usulan Satker (`/admin-kppn/policy/fairness`) | IMPLEMENTED |
| Dashboard Integration (Kartu Capaian Output, Rekomendasi Taktis, Snapshot Engine) | IMPLEMENTED |
| Export Excel (Sheet Capaian Output per RO + Sheet Ringkasan 8 Indikator) & PDF Report | IMPLEMENTED |
| Reminder Terjadwal Otomatis (Scheduler Cron H-5/H-2 Terkirim) | PARTIAL (Strip kanonis & seed policy ada, cron worker skeleton) |

## 3. Source Code Map

| Lapisan | File |
|---|---|
| Engine Kalkulasi | `packages/ikpa-engine/src/indicators/output-achievement.ts` (`calculateOutputAchievement`, evaluasi period, Dual-Formula F1/F2, PCRO 0%, Gate Konfirmasi, Fairness Resolver, Bobot 30/70, DecimalCalc string arithmetic) |
| Skema Engine & Kalender Kerja | `packages/ikpa-engine/src/schemas.ts:108-129` (`outputReportSchema`, `outputAchievementInputSchema`), `packages/ikpa-engine/src/utils/workday-calendar.ts` (`calculateFifthWorkingDayOfNextMonth`, `isWorkday`, `addWorkdays`, `countWorkdays`) |
| Rule Set & Bobot | `packages/ikpa-engine/src/rule-set.ts:159-168,221-234` (Bobot `output_achievement = 25`, subkomponen 30/70, rounding `half_up 2`) |
| Mapping DB $\rightarrow$ Engine | `apps/web/src/server/simulation/calculate.ts:452-486` (Integrasi snapshot simulasi, resolve eligibility, mapping deadline kanonis 5 HK, reportedAt ISO date, confirmed status) |
| Resolver Kebijakan Fairness | `apps/web/src/server/policy/fairness-resolver.ts` (`resolveOutputAssessmentEligibility`, `matchRoCode` exact/list/prefix/regex, prioritas usulan operator vs policy KPPN/Pusat vs fallback `FAN.ZZ1`) |
| UI Halaman Operator | `apps/web/src/routes/operator/data/output-achievement.tsx` (Pills selector 12 bulan, 4 Ponytail metric cards, canonical reminder strip 5 HK, 4 filter tabs, `DomainDataTable` 8 kolom, `DomainFormDrawer` grid target/realisasi + live preview formula, modal fairness, modal panduan Pusdiklat) |
| Komponen Input & Formatter | `apps/web/src/components/data/formatted-number-input.tsx` (Separasi ribuan real-time, `allowDecimal={false}` untuk integer murni), `apps/web/src/lib/format.ts` (`stripTrailingDecimals`, `formatDynamicNumber`, `formatDynamicPercent`, `formatDateDDMMYYYY`) |
| Service Frontend | `apps/web/src/services/output-achievement-service.ts` (`fetchOutputReports`, `saveOutputReport`, `verifyOutputReport`, `removeOutputReport`, `submitFairnessProposal`, `removeFairnessProposal`, `fetchFairnessProposals`, `fetchFairnessPolicies`) |
| Server Functions (ServerFn) | `apps/web/src/server/output-achievement.ts` (9 ServerFn: `listOutputReportsFn`, `upsertOutputReportFn`, `confirmOutputReportFn`, `deleteOutputReportFn`, `createFairnessProposalFn`, `deleteFairnessProposalFn`, `listFairnessPoliciesFn`, `listFairnessProposalsFn`, `upsertFairnessPolicyFn`, `reviewFairnessProposalFn`, `listAllFairnessProposalsFn`) |
| Domain Queries & Mutations | `apps/web/src/server/domains/output-achievement.queries.ts` (`listOutputsWithEligibility`, `listFairnessPolicies`, `listFairnessProposals`), `apps/web/src/server/domains/output-achievement.mutations.ts` (`upsertOutput`, `confirmOutput`, `softDeleteOutput`, `createFairnessProposal`, `deleteFairnessProposal`, `upsertFairnessPolicy`, `reviewFairnessProposal` + Zod + integer checks + audit logs) |
| Skema Database | `packages/db/src/schema/output-reports.ts` (`output_reports`), `packages/db/src/schema/assessment-exclusion.ts` (`assessment_exclusion_policies`, `assessment_exclusion_proposals`), `packages/db/src/schema/workdays.ts` (`workdays`) |
| Database Seed | `packages/db/src/seed.ts:241-259` (Reminder policy `output_report_monthly` lead [5,2]), `:299-337` (17 Hari Libur Nasional 2026), `:380-407` (Fairness policy `FAN.ZZ1` nasional) |
| Halaman Admin Fairness | `apps/web/src/routes/admin-kppn/policy/fairness.tsx` (CRUD Kebijakan Fairness KPPN/Nasional & Review Usulan Satker) |
| Dashboard & Integrasi | `apps/web/src/server/dashboard.ts:53-61,135-168`, `apps/web/src/routes/operator/dashboard.tsx` (`CAPAIAN_OUTPUT` $\rightarrow$ `/operator/data/output-achievement`) |
| Export & History | `apps/web/src/server/exports/operator-xlsx.ts` (Sheet Capaian Output mentah + Sheet Ringkasan 8 Indikator), `apps/web/src/server/exports/operator-pdf.tsx`, `apps/web/src/routes/operator/history.tsx` |
| Automated Tests | `packages/ikpa-engine/src/indicators/output-achievement.test.ts` (18 unit tests: Golden Pusdiklat 95.56, F1/F2, Cap 100, PCRO 0%, Draft Gate, Fairness Excluded, Kalender 5 HK), `packages/ikpa-engine/src/utils/workday-calendar.test.ts`, `apps/web/src/components/data/formatted-number-input.test.ts`, `apps/web/src/lib/format.test.ts` |

## 4. User Flow

1. **Akses Menu**: Operator membuka menu `Capaian Output` di sidebar $\rightarrow$ diarahkan ke `/operator/data/output-achievement` (terproteksi scope satker dan tahun anggaran aktif).
2. **Pemilihan Periode Bulan**: Operator memilih salah satu dari 12 pills bulan (`Januari` s.d. `Desember`, default: bulan kalender saat ini). Pilihan bulan langsung menyaring data transaksi lokal dan mengevaluasi kalkulasi engine untuk bulan tersebut (`evalPeriod = selectedMonth`).
3. **4 Top Metric Cards (Ponytail Style)**:
   - **Card 1 (Kiri)**: `Objek Penilaian RO` $\rightarrow$ Jumlah RO Dinilai dari Total RO bulan terpilih + badge ungu jumlah RO Dikecualikan (*Fairness*).
   - **Card 2**: `Ketepatan Waktu (NK-ROKW - 30%)` $\rightarrow$ Skor NK-ROKW bulan berjalan dengan rincian jumlah RO Tepat Waktu, Terlambat, dan Menunggu Lapor.
   - **Card 3**: `Capaian RO (NK-CRO - 70%)` $\rightarrow$ Skor rata-rata NK-CRO bulan berjalan beserta indikator rata-rata PCRO vs rata-rata TPCRO.
   - **Card 4 (Kanan)**: `IKPA Capaian Output & Kontribusi` $\rightarrow$ Nilai Akhir IKPA-CO (skala 100) dan Poin Kontribusi IKPA (maksimal 25.00 pts).
4. **Strip Reminder 5 Hari Kerja Kanonis**:
   - Menghitung tanggal batas kanonis secara dinamis: `calculateFifthWorkingDayOfNextMonth(year, selectedMonth, holidays)` (contoh: untuk periode Juli 2026 $\rightarrow$ batas adalah Jumat, 07-08-2026).
   - Menampilkan status agregat satker (Tepat Waktu, Terlambat, Menunggu Konfirmasi, atau Belum Lapor) dan panduan aksi tindak lanjut.
5. **4 Tab Filter & Tabel Data (`DomainDataTable`)**:
   - Filter Tabs: `Semua`, `Dinilai (Normal)`, `Dikecualikan (Fairness)`, `Butuh Tindakan (Draft / Belum Lapor)`.
   - Pencarian real-time berdasarkan Kode RO atau Nama RO.
   - Kolom Tabel: (1) No., (2) Kode & Nama RO, (3) Objek Penilaian, (4) Formula NK-CRO, (5) PCRO / Target, (6) RVRO / Volume, (7) Ketepatan Lapor, (8) Status Konfirmasi, (9) Aksi (`Edit`, `Konfirmasi`, `Fairness`, `Hapus`).
6. **Form Drawer Tambah/Ubah Data RO (`DomainFormDrawer`)**:
   - Tombol `+ Catat Capaian RO` atau klik ikon pensil Edit pada baris tabel.
   - Layout Grid 2-Kolom:
     - **Kolom Kiri (Target)**: `Target Volume RO DIPA` (`FormattedNumberInput` integer murni tanpa desimal) dan `Target PCRO (TPCRO)` (desimal max 100, max 2 desimal).
     - **Kolom Kanan (Realisasi & Progres)**: `Realisasi Volume (RVRO)` (integer murni $\le \text{Volume DIPA}$) dan `Progres Capaian RO (PCRO)` (desimal max 100, max 2 desimal).
   - Date picker `Tanggal Pelaporan` berformat `DD-MM-YYYY` dengan tombol quick action `Hari Ini`.
   - Checkbox `Konfirmasi Laporan Capaian Output`.
   - **Live Drawer Formula Preview Card**: Preview real-time formula yang akan diterapkan (`ZERO_UNCONFIRMED`, `ZERO_PCRO`, `FORMULA_1`, `FORMULA_2`, atau `EXCLUDED`), rincian rasio matematis, estimasi skor NK-CRO, dan dampak ketepatan waktu.
   - Tombol `Simpan Data` terkunci (`isSubmitDisabled`) jika Kode RO kosong atau field wajib belum lengkap.
   - Penyimpanan memicu `upsertOutputReportFn` $\rightarrow$ `router.invalidate()` $\rightarrow$ banner feedback hijau 4 detik.
7. **Modal Usulan Pengecualian (*Fairness Treatment*)**:
   - Klik tombol `Fairness` pada baris tabel atau tombol kelola usulan.
   - Toggle status: `Dikecualikan (Fairness)` vs `Dinilai (Normal)`.
   - Form: Kode RO, Periode Bulan (Spesifik Bulan atau Sepanjang Tahun), Kategori Usulan (`ro_khusus`, `keadaan_kahar`, `kebijakan_pusat`), Dasar Kebijakan, Catatan Penjelasan, dan Tautan Dokumen Pendukung.
   - Tombol `Simpan`: Melakukan *idempotent upsert* pada tabel proposal; jika dinonaktifkan kembali ke "Dinilai", record usulan dihapus bersih (*clean delete*) sehingga tabel database tetap ramping.
8. **Modal Panduan Formula (PER-5/Pusdiklat)**:
   - Tombol `Panduan Formula (PER-5)` membuka dialog modal berisi penjelasan resmi subkomponen 30/70, syarat aktivasi Formula 1 vs Formula 2, aturan PCRO 0%, dan tabel contoh kasus resmi Pusdiklat.

## 5. Input Inventory

| Input | Type | Required | Default | Validation | Source | Digunakan Calculation? |
|---|---|---|---|---|---|---|
| `roCode` | text (1–32) | Ya | `""` (auto-uppercase) | Trim, Zod `min(1).max(32)` | Drawer Form / Modal Fairness | YA (ID unik & pencocokan aturan Fairness) |
| `roName` | text (0–255) | Tidak | `null` | Zod `max(255).optional()` | Drawer Form | TIDAK (Tampilan display) |
| `month` | number (1–12) | Ya | `selectedMonth` | Zod `int().min(1).max(12)` | Selector Pills & Drawer Form | YA (Penentu periode evaluasi & syarat Formula 2) |
| `volumeDipa` | numeric string (integer) | Ya | `"100"` | FE: `allowDecimal={false}`, BE: integer murni `dec4`, $>0$ | Drawer Form | YA (Penyebut Formula 2) |
| `rvro` | numeric string (integer) | Ya | `"0"` | FE: `allowDecimal={false}`, BE: integer murni, $0 \le \text{rvro} \le \text{volumeDipa}$ | Drawer Form | YA (Pembilang Formula 2) |
| `pcro` | numeric string (decimal) | Ya | `"0"` | FE: max 100, max 2 desimal, BE: `dec84`, $0 \le \text{pcro} \le 100$ | Drawer Form | YA (Pembilang Formula 1, gate Formula 2 jika $\ge 100\%$, gate PCRO 0%) |
| `tpcro` | numeric string (decimal) | Ya | `"80"` | FE: max 100, max 2 desimal, BE: `dec84`, $0 \le \text{tpcro} \le 100$ | Drawer Form | YA (Penyebut Formula 1) |
| `reportedDate` / `reportedAt` | date (`YYYY-MM-DD` / ISO) | Tidak | `today` / `null` | Zod `iso.datetime offset nullable`, FE Date Picker `DD-MM-YYYY` | Drawer Form | YA (Penentu ketepatan waktu $\le \text{deadlineDate}$) |
| `confirmed` | boolean | Tidak | `false` | Zod `boolean().optional()`, Checkbox / Tombol Konfirmasi | Drawer Form / Tombol Aksi Tabel | YA (Gate konfirmasi: jika `false` capaian $0.00$) |
| `fairnessProposal.category` | select enum | Ya | `"ro_khusus"` | Enum: `ro_khusus`, `keadaan_kahar`, `kebijakan_pusat` | Modal Fairness | YA (Kategori pengecualian) |
| `fairnessProposal.basisReference` | text | Ya | `"Fairness treatment IKPA TA 2026"` | Zod `min(1).max(255)` | Modal Fairness | YA (Trace dasar hukum pengecualian) |
| `fairnessProposal.operatorNote` | textarea | Tidak | `""` | Zod `max(1000).optional()` | Modal Fairness | YA (Alasan display pengecualian) |
| `search` | text | Tidak | `""` | Client string matching `roCode` / `roName` | Toolbar Tabel | TIDAK (Filter tampilan tabel) |
| `activeTabFilter` | enum | Ya | `"all"` | Enum: `all`, `evaluated`, `excluded`, `action_needed` | Filter Tabs UI | TIDAK (Filter tampilan tabel) |

## 6. Validation Rules

- **Frontend (`FormattedNumberInput` & Drawer Form)**:
  - Input `Target Volume RO DIPA` dan `Realisasi Volume (RVRO)` menggunakan `allowDecimal={false}` yang secara aktif menolak pengetikan karakter desimal (titik/koma) via `onKeyDown`, mengatur `inputMode="numeric"`, dan membersihkan fraksi desimal.
  - Input `PCRO` dan `TPCRO` dibatasi secara otomatis maksimal bernilai `100` dan maksimal `2` digit di belakang koma (`maxDecimals={2}`).
  - Utilitas `stripTrailingDecimals` secara otomatis membersihkan angka desimal tak perlu (misal `100.00` disimpan dan ditampilkan menjadi `100`).
  - Separasi ribuan titik (`.`) diterapkan secara dinamis saat mengetik angka (`1.000` $\rightarrow$ `10.000` $\rightarrow$ `100.000`).
  - Tombol `Simpan Data` terkunci (`isSubmitDisabled`) jika Kode RO kosong atau field wajib belum terisi.
- **Backend (`output-achievement.mutations.ts:17-73`)**:
  - Regex desimal ketat: `dec4 = /^-?(?:0|[1-9]\d*)(?:\.\d{1,4})?$/` dan `dec84 = /^-?(?:0|[1-9]\d*)(?:\.\d{1,4})?$/`.
  - Validasi integer murni: `if (!Number.isInteger(rv)) throw new Error("RVRO harus berupa bilangan bulat.")` dan `if (!Number.isInteger(vol)) throw new Error("Target Volume RO DIPA harus berupa bilangan bulat.")`.
  - Validasi rentang angka: $0 \le \text{RVRO} \le \text{Volume DIPA}$, $0 \le \text{PCRO} \le 100$, dan $0 \le \text{TPCRO} \le 100$.
  - Keunikan record: Dikelola secara scoped per `(fiscalYearId, roCode, month)` melalui mekanisme update jika record sudah ada atau insert jika belum ada.
  - Audit Trail: Seluruh mutasi (`create_output`, `update_output`, `confirm_output`, `delete_output`, `create_proposal`, `delete_proposal`) mencatat payload sebelum dan sesudah secara *tamper-proof* di `audit_logs`.
- **Fairness Lifecycle (`output-achievement.mutations.ts:245-385`)**:
  - `createFairnessProposal` melakukan *idempotent upsert* per `(organizationId, fiscalYearId, roCode)` dan membersihkan baris duplikat/orphan.
  - `deleteFairnessProposal` (`removeFairnessProposal`) menghapus bersih data usulan saat dinonaktifkan kembali ke "Dinilai (Normal)".

## 7. Business Rules

**Rule ID:** OUT-BR-001 — Ketepatan Waktu Pelaporan Kanonis 5 Hari Kerja M+1
- **Trigger**: Perhitungan subkomponen NK-ROKW pada engine `calculateOutputAchievement`.
- **Input**: `report.reportedDate`, `report.deadlineDate` (dihitung dari `calculateFifthWorkingDayOfNextMonth(year, month, holidays)`).
- **Condition**:
  - Jika `reportedDate` terisi: Perbandingan string ISO `reportedDate <= deadlineDate`. Jika terpenuhi bernilai $100$, jika lewat bernilai $0$.
  - Jika `reportedDate` null/kosong: Tidak dihitung ke dalam pembagi `validTimelinessCount`, dan memicu flag `hasPendingTimeliness = true` sehingga status indikator menjadi `warning`.
- **Processing**: $\text{NK-ROKW} = \frac{\sum \text{Nilai Ketepatan Waktu}}{\text{Jumlah RO yang Menyampaikan Laporan}}$ (dibulatkan 2 desimal `HALF_UP`).
- **Ref**: `packages/ikpa-engine/src/indicators/output-achievement.ts:87-117`, `packages/ikpa-engine/src/utils/workday-calendar.ts:112-120`.

**Rule ID:** OUT-BR-002 — Formula 1 Capaian RO (Januari–November & $\text{PCRO} < 100\%$)
- **Trigger**: Evaluasi capaian RO pada periode bulan 1 s.d. 11 ketika nilai PCRO belum mencapai 100%.
- **Condition**: `report.confirmed === true && pcro !== "0" && period !== 12 && pcro < 100`.
- **Processing**: $\text{Capaian RO} = \min\left(\frac{\text{PCRO}}{\text{TPCRO}} \times 100, 100\right)$ (dibulatkan 2 desimal `HALF_UP`). Jika $\text{TPCRO} \le 0$ saat $\text{PCRO} > 0$, menghasilkan nilai $0.00$ dengan peringatan `TPCRO_MUST_BE_GT_ZERO_WHEN_PCRO_GT_ZERO`.
- **Output**: Skor capaian RO per rincian output (skala 0 s.d. 100).
- **Ref**: `packages/ikpa-engine/src/indicators/output-achievement.ts:164-182`.

**Rule ID:** OUT-BR-003 — Formula 2 Capaian RO (Desember atau $\text{PCRO} \ge 100\%$)
- **Trigger**: Evaluasi capaian RO pada periode Desember (bulan 12) ATAU ketika nilai PCRO sudah mencapai $\ge 100\%$ pada bulan Januari–November.
- **Condition**: `report.confirmed === true && pcro !== "0" && (period === 12 || pcro >= 100)`.
- **Processing**: $\text{Capaian RO} = \min\left(\frac{\text{RVRO}}{\text{Target Volume RO DIPA}} \times 100, 100\right)$ (dibulatkan 2 desimal `HALF_UP`). Jika $\text{Volume DIPA} \le 0$, menghasilkan nilai $0.00$ dengan peringatan `VOLUME_DIPA_MUST_BE_GT_ZERO`.
- **Output**: Skor capaian RO per rincian output berbasis realisasi fisik (skala 0 s.d. 100).
- **Ref**: `packages/ikpa-engine/src/indicators/output-achievement.ts:144-163`.

**Rule ID:** OUT-BR-004 — Aturan Khusus $\text{PCRO} = 0\%$
- **Trigger**: Pelaporan RO dengan nilai progres capaian $\text{PCRO} = 0\%$.
- **Condition**: `report.confirmed === true && DecimalCalc.eq(pcro, "0")`.
- **Processing**: Menghasilkan nilai capaian $\text{Capaian RO} = 0.00$ secara langsung (`ZERO_PCRO`) tanpa melakukan pembagian numerik (mencegah error pembagian $0/0$).
- **Output**: Skor capaian $0.00$.
- **Ref**: `packages/ikpa-engine/src/indicators/output-achievement.ts:140-143`.

**Rule ID:** OUT-BR-005 — Scope Gate Konfirmasi Capaian Output
- **Trigger**: RO yang belum dikonfirmasi oleh Pejabat Pembuat Komitmen / Operator Satker (`confirmed === false` atau null).
- **Condition**: `!report.confirmed`.
- **Processing**: Menghasilkan nilai capaian $\text{Capaian RO} = 0.00$ secara langsung (`ZERO_UNCONFIRMED: Laporan belum dikonfirmasi -> 0`). Nilai ketepatan waktu tetap dinilai jika tanggal lapor telah diisi.
- **Output**: Skor capaian $0.00$.
- **Ref**: `packages/ikpa-engine/src/indicators/output-achievement.ts:136-139`.

**Rule ID:** OUT-BR-006 — Perlakuan Keadilan (*Fairness Treatment* / Pengecualian Objek Penilaian)
- **Trigger**: RO yang memiliki status pengecualian aktif (`isExcluded === true`).
- **Processing**: RO tersebut dilewati penuh (`continue`) dan **dikeluarkan dari pembilang maupun penyebut** pada perhitungan NK-ROKW dan NK-CRO. Data tetap disimpan dan ditampilkan di UI dengan penanda visual khusus (*Purple Tag*).
- **Fallback / Empty Guard**: Jika seluruh RO pada periode tersebut berstatus dikecualikan (`includedRoCount === 0`), engine mengembalikan `{ score: null, weightedContribution: null, status: "incomplete" }` disertai peringatan informatif.
- **Ref**: `packages/ikpa-engine/src/indicators/output-achievement.ts:68-82,202-216`, `apps/web/src/server/policy/fairness-resolver.ts:87-198`.

**Rule ID:** OUT-BR-007 — Pembobotan Subkomponen 30/70 dan Nilai Akhir IKPA-CO
- **Processing**:
  - $\text{Komponen Ketepatan Waktu (30\%)} = \text{roundHalfUp}(\text{NK-ROKW} \times 0.30, 2)$
  - $\text{Komponen Capaian RO (70\%)} = \text{roundHalfUp}(\text{NK-CRO} \times 0.70, 2)$
  - $\text{Nilai Akhir IKPA-CO} = \text{Komponen Ketepatan} + \text{Komponen Capaian}$ (skala 0 s.d. 100)
  - $\text{Poin Kontribusi IKPA} = \text{roundHalfUp}\left(\frac{\text{Nilai Akhir}}{100} \times 25, 2\right)$ (maksimal 25.00 poin).
- **Ref**: `packages/ikpa-engine/src/indicators/output-achievement.ts:262-297`.

**Rule ID:** OUT-BR-008 — Penilaian Berdasarkan Periode Evaluasi Bulan (`evalPeriod`)
- **Trigger**: Pemanggilan engine dengan parameter `evalPeriod` (1 s.d. 12).
- **Processing**: Engine hanya memfilter dan mengevaluasi laporan yang memiliki `period === evalPeriod`. Jika periode tidak memiliki data, mengembalikan status `incomplete`. (Dashboard menggunakan agregasi seluruh laporan tahun anggaran).
- **Ref**: `packages/ikpa-engine/src/indicators/output-achievement.ts:33-52`.

## 8. Calculation Logic

Engine Capaian Output (`packages/ikpa-engine/src/indicators/output-achievement.ts`) dieksekusi secara murni (*pure function*) menggunakan aritmetika string presisi tinggi `DecimalCalc` tanpa terkena pembulatan floating point JavaScript:
1. **Pemeriksaan Data Masukan**: Memastikan array laporan tersedia dan tidak kosong.
2. **Penyaringan Periode Evaluasi**: Menyaring laporan sesuai parameter `evalPeriod` (jika diberikan).
3. **Iterasi Penilaian per RO**:
   - Memeriksa flag `isExcluded`: Jika ya, catat jejak audit pengecualian dan lewati.
   - Evaluasi Ketepatan Waktu: Bandingkan `reportedDate` terhadap `deadlineDate` ($5\text{ HK M+1}$).
   - Evaluasi Capaian RO:
     - Jika `!confirmed` $\rightarrow 0.00$
     - Jika $\text{PCRO} = 0\%$ $\rightarrow 0.00$
     - Jika $\text{Bulan} = 12$ atau $\text{PCRO} \ge 100\%$ $\rightarrow$ Formula 2 $\min\left(\frac{\text{RVRO}}{\text{Volume}} \times 100, 100\right)$
     - Selainnya (Bulan 1–11 & $\text{PCRO} < 100\%$) $\rightarrow$ Formula 1 $\min\left(\frac{\text{PCRO}}{\text{TPCRO}} \times 100, 100\right)$.
4. **Agregasi Rata-Rata**: Menghitung rata-rata aritmetika NK-ROKW (dibagi jumlah RO yang menyampaikan tanggal lapor) dan NK-CRO (dibagi jumlah seluruh RO yang dinilai).
5. **Kalkulasi Skor Tertimbang**: Mengalikan subkomponen dengan bobot resmi $30\%$ dan $70\%$, lalu mengonversinya ke kontribusi IKPA bobot $25\%$.

## 9. Formula & Variables

Persis implementasi kode sumber (`packages/ikpa-engine/src/indicators/output-achievement.ts`):

$$\text{Tepat}_i = \begin{cases} 100, & \text{jika } \text{reportedDate}_i \le \text{deadlineDate}_i \\ 0, & \text{jika } \text{reportedDate}_i > \text{deadlineDate}_i \end{cases}$$

$$\text{NK-ROKW} = \frac{\sum_{i=1}^{n_{\text{lapor}}} \text{Tepat}_i}{n_{\text{lapor}}}$$

$$\text{Capaian}_i = \begin{cases} 0.00, & \text{jika } \text{confirmed}_i = \text{false} \\ 0.00, & \text{jika } \text{PCRO}_i = 0\% \\ \min\left(\frac{\text{RVRO}_i}{\text{VolumeDIPA}_i} \times 100, 100\right), & \text{jika } \text{periode}_i = 12 \lor \text{PCRO}_i \ge 100\% \\ \min\left(\frac{\text{PCRO}_i}{\text{TPCRO}_i} \times 100, 100\right), & \text{jika } \text{periode}_i \in [1..11] \land \text{PCRO}_i < 100\% \end{cases}$$

$$\text{NK-CRO} = \frac{\sum_{i=1}^{n_{\text{dinilai}}} \text{Capaian}_i}{n_{\text{dinilai}}}$$

$$\text{Skor IKPA-CO} = (\text{NK-ROKW} \times 30\%) + (\text{NK-CRO} \times 70\%)$$

$$\text{Kontribusi IKPA} = \frac{\text{Skor IKPA-CO}}{100} \times 25$$

## 10. Threshold / Weight / Period / Rounding

- **Bobot Indikator**: $25\%$ terhadap total nilai IKPA (bobot terbesar dari 7 indikator IKPA 2026).
- **Bobot Subkomponen**: $30\%$ untuk Ketepatan Waktu Pelaporan (NK-ROKW) dan $70\%$ untuk Capaian Rincian Output (NK-CRO).
- **Batas Cap Maksimal**: Capaian per RO dibatasi maksimal $100.00$; Skor Akhir IKPA-CO dibatasi maksimal $100.00$; Poin Kontribusi maksimal $25.00$ poin.
- **Periode Batas Waktu (*Deadline*)**: Hari Kerja ke-5 bulan berikutnya ($5\text{ HK M+1}$), dihitung secara dinamis dari akhir bulan pelaporan dengan melompati hari Sabtu, Minggu, dan seluruh hari libur nasional resmi KPPN TA 2026 (`calculateFifthWorkingDayOfNextMonth`).
- **Aturan Pembulatan**: Pembulatan setengah ke atas (`HALF_UP`) dengan presisi 2 angka di belakang koma untuk skor subkomponen, skor akhir, dan poin kontribusi.
- **Toleransi Zero Denominator**: Jika TPCRO $\le 0$ atau Volume DIPA $\le 0$, engine tidak melempar exception/crash, melainkan menghasilkan nilai $0.00$ dan menyematkan pesan peringatan terstruktur pada `warnings`.

## 11. Calculation Examples (engine aktual, `default2026RuleSet`)

### Normal Case — Golden Test Pusdiklat (Nilai 95.56, Kontribusi 23.89)
Satker memiliki 3 RO pada periode Juli 2026, seluruhnya berstatus terkonfirmasi dan dilaporkan tepat waktu pada `05-08-2026` (batas waktu $5\text{ HK}$: `07-08-2026`):
- **RO 1 (001)**: $\text{PCRO} = 100\%$, $\text{Volume} = 100$, $\text{RVRO} = 100 \rightarrow$ Menggunakan Formula 2: $\frac{100}{100} \times 100 = 100.00$
- **RO 2 (002)**: $\text{PCRO} = 100\%$, $\text{Volume} = 50$, $\text{RVRO} = 50 \rightarrow$ Menggunakan Formula 2: $\frac{50}{50} \times 100 = 100.00$
- **RO 3 (003)**: $\text{PCRO} = 34\%$, $\text{TPCRO} = 42\% \rightarrow$ Menggunakan Formula 1: $\frac{34}{42} \times 100 = 80.9523 \rightarrow 80.95$
- **Agregasi**:
  - $\text{NK-ROKW} = \frac{100 + 100 + 100}{3} = 100.00$
  - $\text{NK-CRO} = \frac{100 + 100 + 80.95}{3} = 93.65$
  - $\text{Skor Akhir} = (100.00 \times 0.30) + (93.65 \times 0.70) = 30.00 + 65.56 = 95.56$
  - $\text{Kontribusi IKPA} = \frac{95.56}{100} \times 25 = 23.89\text{ poin}$.

### Boundary Case
1. **Lapor Tepat pada Batas Hari Kerja ke-5**: `reportedDate = 2026-08-07` dan `deadlineDate = 2026-08-07` $\rightarrow$ Evaluasi `reportedDate <= deadlineDate` bernilai `true` $\rightarrow$ Nilai Ketepatan Waktu = $100$.
2. **Aktivasi Formula 2 pada Bulan Non-Desember**: Pada bulan Oktober, RO dengan $\text{PCRO} = 100\%$ otomatis beralih dari Formula 1 ke Formula 2 berbasis rasio RVRO terhadap Volume DIPA.
3. **Realisasi Melebihi Target Volume DIPA**: $\text{RVRO} = 150$, $\text{Volume DIPA} = 100 \rightarrow$ Rasio $150\%$ di-cap maksimal menjadi $100.00$.
4. **Desember dengan Capaian Parsial**: Pada bulan Desember, RO dengan $\text{RVRO} = 2$ dan $\text{Volume DIPA} = 4$ menghasilkan $\text{Capaian} = \frac{2}{4} \times 100 = 50.00$ (tidak diasumsikan 100 otomatis).

### Edge/Invalid Case
1. **Laporan Belum Dikonfirmasi (Draft)**: RO dengan $\text{RVRO} = 100$ dan $\text{Volume} = 100$, dilaporkan tepat waktu tetapi `confirmed = false` $\rightarrow \text{NK-ROKW} = 100.00$, $\text{NK-CRO} = 0.00 \rightarrow \text{Skor Akhir} = 30.00$.
2. **Progres Capaian $\text{PCRO} = 0\%$**: RO terkonfirmasi dengan $\text{PCRO} = 0\%$ dan $\text{TPCRO} = 0\% \rightarrow$ Langsung dievaluasi sebagai `ZERO_PCRO` bernilai $0.00$ tanpa warning deviasi nol.
3. **Pengecualian Keadilan (*Fairness*)**: Dari 5 RO, 4 RO bernilai 100 dan 1 RO `FAN.ZZ1` bernilai 0 tetapi dikecualikan $\rightarrow$ Penyebut menjadi 4, sehingga $\text{NK-ROKW} = 100.00$ dan $\text{NK-CRO} = 100.00$ (tanpa tereduksi menjadi 80.00).
4. **Seluruh RO Dikecualikan**: Jika seluruh RO pada bulan tersebut berstatus `isExcluded` $\rightarrow$ Engine mengembalikan `{ score: null, status: "incomplete" }` dengan peringatan informatif.
5. **Keterlambatan Pelaporan 1 Hari**: Laporan disampaikan pada `08-08-2026` melewati batas `07-08-2026` $\rightarrow \text{Ketepatan Waktu} = 0$, sehingga mereduksi NK-ROKW secara proporsional.

## 12. Data Model & Persistence

- **Tabel `output_reports` (`packages/db/src/schema/output-reports.ts`)**:
  - `id` (uuid, Primary Key)
  - `fiscalYearId` (uuid, Foreign Key $\rightarrow$ `fiscal_years.id`)
  - `roCode` (text, 1–32 karakter, uppercase)
  - `roName` (text, opsional)
  - `month` (smallint, 1–12)
  - `rvro` (numeric 18,4, Not Null — tersimpan sebagai integer)
  - `volumeDipa` (numeric 18,4, Not Null — tersimpan sebagai integer)
  - `pcro` (numeric 8,4, Not Null — tersimpan max 2 desimal)
  - `tpcro` (numeric 8,4, Not Null — tersimpan max 2 desimal)
  - `reportedAt` (timestamptz, opsional/nullable)
  - `confirmed` (boolean, default false)
  - `confirmedAt` (timestamptz, opsional), `confirmedBy` (text, opsional)
  - `createdBy` (text), `deletedAt` (timestamptz, soft delete), `createdAt`, `updatedAt`.
  - Indeks: `fiscalYearId`, `(roCode, month)`, `confirmed`, `deletedAt`.

- **Tabel `assessment_exclusion_policies` & `assessment_exclusion_proposals` (`packages/db/src/schema/assessment-exclusion.ts`)**:
  - Menyimpan kebijakan pengecualian nasional/KPPN serta usulan simulasi pengecualian dari operator satker.
  - Skema proposal mencakup `organizationId`, `fiscalYearId`, `roCode`, `month`, `category`, `basisReference`, `operatorNote`, `attachmentRef`, `status`.

- **Tabel `workdays` (`packages/db/src/schema/workdays.ts`)**:
  - Menyimpan 17 hari libur nasional resmi tahun 2026 untuk penghitungan hari kerja kanonis.

- **Tabel `audit_logs` (`packages/db/src/schema/audit-logs.ts`)**:
  - Mencatat rekam jejak setiap pembuatan, pengubahan, konfirmasi, penghapusan laporan RO, dan usulan fairness.

## 13. API / Service

Lapisan service `output-achievement-service.ts` menghubungkan UI dengan 9 Server Functions di `apps/web/src/server/output-achievement.ts`:
- `fetchOutputReports(orgId)` $\rightarrow$ `listOutputReportsFn(GET)`: Mengambil seluruh data laporan RO non-deleted, hari libur nasional, dan resolver status fairness.
- `saveOutputReport(input)` $\rightarrow$ `upsertOutputReportFn(POST)`: Menyimpan data baru atau memperbarui data RO dengan validasi Zod dan pengecekan integer.
- `verifyOutputReport(id)` $\rightarrow$ `confirmOutputReportFn(POST)`: Menandai konfirmasi laporan RO secara instan.
- `removeOutputReport(id)` $\rightarrow$ `deleteOutputReportFn(POST)`: Melakukan soft-delete pada laporan RO.
- `submitFairnessProposal(input)` $\rightarrow$ `createFairnessProposalFn(POST)`: Menyimpan usulan pengecualian secara idempotent.
- `removeFairnessProposal(id, orgId)` $\rightarrow$ `deleteFairnessProposalFn(POST)`: Menghapus bersih usulan pengecualian saat satker menonaktifkannya.
- `fetchFairnessProposals`, `fetchFairnessPolicies`, `saveFairnessPolicy`, `reviewProposal`: Mengelola data kebijakan dan review admin KPPN.

*Fallback Mode Tanpa Database*: Jika database tidak terhubung, service mengembalikan array kosong `outputs: []` dan `holidays: []`, serta mutasi mengembalikan `{ success: true }` untuk mencegah aplikasi crash saat demo offline.

## 14. End-to-End Data Flow

```
[Operator UI: /operator/data/output-achievement]
  │
  ├─ (1) Pilih Pills Bulan 1..12 (State lokal `selectedMonth`)
  │
  ├─ (2) Input/Edit Form Drawer (Volume, RVRO, PCRO, TPCRO, Tanggal, Konfirmasi)
  │      │
  │      ├─ Live Drawer Formula Preview (Kalkulasi lokal Formula 1 / Formula 2 / Zero / Gate)
  │      └─ Simpan Data ──► output-achievement-service ──► upsertOutputReportFn
  │                             │
  │                             ├─ Assert Operator Scope & FY 2026
  │                             ├─ Zod Schema & Integer Validation (Volume & RVRO bulat murni)
  │                             ├─ Upsert Database (output_reports) & Write Audit Log
  │                             └─ router.invalidate()
  │
  ├─ (3) Modal Usulan Fairness (Simpan / Hapus Usulan)
  │      └─ createFairnessProposalFn ──► Idempotent Upsert / Clean Delete ──► Invalidate
  │
  ├─ (4) Loader Fetching (fetchOutputReports + fetchFairnessProposals + Holidays)
  │      │
  │      ├─ resolveOutputAssessmentEligibility (Pengecualian Satker / Policy / FAN.ZZ1)
  │      ├─ calculateFifthWorkingDayOfNextMonth (Deadline Kanonis 5 HK M+1)
  │      │
  │      ├─ [Engine Lokal Halaman]: calculateOutputAchievement(evalPeriod = selectedMonth)
  │      │   └─ Render 4 Ponytail Metric Cards, Strip Reminder 5 HK, 4 Filter Tabs & DataTable
  │      │
  │      └─ [Dashboard Engine Snapshot]: calculateAndPersistSnapshot(reports FY)
  │           └─ Render Kartu Capaian Output Dashboard, History Snapshot, dan XLSX/PDF Export
```

## 15. Dashboard Integration

- **Pemetaan Indikator**: Dipetakan pada kartu `CAPAIAN_OUTPUT` di halaman Dashboard Utama (`/operator/dashboard` $\rightarrow$ tautan ke `/operator/data/output-achievement`).
- **Skor & Status**: Menampilkan nilai agregat tahunan dari seluruh laporan RO tahun berjalan. Jika skor $\ge 90$ berstatus *Complete (Hijau)*, $\ge 75$ berstatus *Warning (Kuning)*, dan $< 75$ berstatus *Danger (Merah)*.
- **Rekomendasi Dinamis**: Jika nilai subkomponen ketepatan atau capaian di bawah target, engine merekomendasikan aksi taktis: *"Tingkatkan Capaian Output"* dengan deep-link langsung ke halaman pengelolaan data Capaian Output.

## 16. Reminder Integration

- **Strip Reminder Kanonis**: Terintegrasi di bagian atas halaman data Capaian Output dengan menghitung tanggal jatuh tempo $5\text{ HK M+1}$ secara dinamis berdasarkan kalender kerja resmi dan hari libur nasional KPPN.
- **Kebijakan Reminder Terjadwal**: Terdapat konfigurasi seed policy `output_report_monthly` (tipe *Recommended*, lead days `[5, 2]`, target penerima operator dan PPK).
- **Status Notifikasi**: Strip reminder menampilkan jumlah RO yang sudah tepat waktu, terlambat, dan yang masih menunggu konfirmasi.

## 17. History Integration

- **Persistensi Snapshot**: Setiap pembaruan data atau pemuatan dashboard menyimpan snapshot hasil evaluasi engine di tabel `score_snapshots` dalam format `breakdownJson.indicators.output_achievement`.
- **Rincian Snapshot**: Memuat skor akhir, poin kontribusi, subkomponen `timeliness` (30%) dan `achievement` (70%), serta jejak formula audit lengkap per RO.
- **Perbandingan Snapshot**: Fitur riwayat `/operator/history` dapat membandingkan perkembangan nilai Capaian Output antar-waktu.

## 18. Report/Export Integration

- **Ekspor Excel (`operator-xlsx.ts`)**:
  - Menyediakan sheet khusus `Capaian Output` yang memuat seluruh rincian per RO: Kode RO, Nama RO, Bulan, Target Volume DIPA, RVRO, PCRO, TPCRO, Tanggal Pelaporan, Status Konfirmasi, Status Objek Penilaian (*Dinilai / Dikecualikan*), dan Batas Waktu 5 HK.
  - Menyertakan baris Capaian Output pada sheet Ringkasan 8 Indikator IKPA.
- **Ekspor PDF (`operator-pdf.tsx`)**: Menampilkan ringkasan skor dan kontribusi Capaian Output secara transparan.

## 19. Error Handling

- **Validasi Nilai Integer**: Jika pengguna mencoba menginput nilai desimal pada Target Volume DIPA atau RVRO, form drawer menolak input secara langsung dan mutasi server melempar error `RVRO harus berupa bilangan bulat` / `Target Volume RO DIPA harus berupa bilangan bulat`.
- **Validasi Batas Angka**: Penolakan otomatis pada tingkat server dan klien jika RVRO melebihi Volume DIPA atau jika PCRO/TPCRO bernilai negatif atau melebihi 100.
- **Penanganan Denominator Nol**: Jika terdapat RO dengan TPCRO $\le 0$ saat PCRO $> 0$ atau Volume DIPA $\le 0$, engine tidak mengalami error *divide-by-zero*, melainkan menetapkan skor $0.00$ dan menyertakan pesan peringatan terstruktur.
- **Pelaporan Kosong / Pending**: Laporan yang belum diisi tanggal lapor tidak menghasilkan error, melainkan ditandai sebagai `pending` pada subkomponen ketepatan waktu dengan status indikator `warning`.

## 20. Edge Cases

| No | Kasus Khusus / Edge Case | Penanganan Sistem Aktual |
|---|---|---|
| 1 | Laporan RO belum dikonfirmasi (`confirmed: false`) | Skor capaian RO langsung dinilai $0.00$ (`ZERO_UNCONFIRMED`), namun ketepatan waktu tetap dinilai jika ada tanggal lapor. |
| 2 | Progres capaian $\text{PCRO} = 0\%$ | Skor capaian RO langsung dinilai $0.00$ (`ZERO_PCRO`) tanpa pembagian numerik dan tanpa warning deviasi nol. |
| 3 | Realisasi Volume melebihi Target Volume ($\text{RVRO} > \text{Volume DIPA}$) | Rasio capaian Formula 2 di-cap maksimal menjadi $100.00$. |
| 4 | Seluruh RO pada suatu bulan berstatus Dikecualikan (*Fairness*) | Engine mengembalikan skor `null` dengan status `incomplete` dan pesan peringatan bahwa seluruh RO dikecualikan. |
| 5 | RO Khusus `FAN.ZZ1` diinput tanpa kebijakan eksplisit | Resolver fairness secara otomatis mengecualikan RO `FAN.ZZ1` melalui *hardcoded fallback rule* TA 2026. |
| 6 | Tanggal lapor persis pada hari kerja ke-5 ($5\text{ HK}$) | Evaluasi `reportedDate <= deadlineDate` bernilai `true` (inklusif) sehingga dinilai tepat waktu ($100$). |
| 7 | Tanggal lapor melewati batas hari kerja ke-5 | Evaluasi bernilai `false` sehingga nilai ketepatan waktu menjadi $0$. |
| 8 | Operator menonaktifkan usulan fairness satker | Mutasi `removeFairnessProposal` menghapus bersih baris usulan dari database dan mengembalikan status RO menjadi "Dinilai (Normal)". |
| 9 | Target Volume DIPA bernilai 0 pada Formula 2 | Engine memberikan skor capaian $0.00$ dan mencatat warning `VOLUME_DIPA_MUST_BE_GT_ZERO`. |
| 10 | Target TPCRO bernilai 0 saat $\text{PCRO} > 0$ pada Formula 1 | Engine memberikan skor capaian $0.00$ dan mencatat warning `TPCRO_MUST_BE_GT_ZERO_WHEN_PCRO_GT_ZERO`. |

## 21. Mock/Hardcoded/Placeholder Findings (10)

1. **HARDCODED Subkomponen 30/70**: Nilai pembobotan $30\%$ NK-ROKW dan $70\%$ NK-CRO di-hardcode di dalam engine (`output-achievement.ts:263-264`), bukan dibaca dinamis dari rule set.
2. **HARDCODED Bobot 25 IKPA**: Nilai bobot indikator default $25\%$ didefinisikan pada `default2026RuleSet.weights.output_achievement`.
3. **HARDCODED Fallback RO Khusus `FAN.ZZ1`**: Fallback hardcode exact match `FAN.ZZ1` aktif di `fairness-resolver.ts:181-191` jika record database policy tidak ditemukan.
4. **KANONIS Kalender Libur Nasional 2026**: Menggunakan 17 hari libur nasional resmi TA 2026 di `seed.ts:299-337` dan `workdays.ts`.
5. **INTEGER ENFORCEMENT Murni**: Target Volume DIPA dan RVRO ditegakkan sebagai integer murni tanpa desimal di frontend `FormattedNumberInput` dan backend Zod mutations.
6. **DECIMALCALC String Arithmetic**: Engine sepenuhnya menggunakan utilitas `DecimalCalc` untuk menghindari anomali pembulatan floating point JavaScript.
7. **Pills Bulan Lokal vs Dashboard FY**: Tampilan halaman data menyaring berdasarkan pills bulan lokal (`evalPeriod`), sedangkan dashboard menghitung agregasi seluruh laporan tahun anggaran.
8. **Live Preview Float Mirror**: Live preview di drawer menggunakan kalkulasi floating point `Math.min(...).toFixed(2)` untuk kecepatan render, sementara engine kalkulasi final menggunakan `DecimalCalc`.
9. **Offline DB Fallback**: Jika koneksi database terputus, ServerFn mengembalikan fallback array kosong `{ outputs: [], holidays: [] }` dan mutasi sukses semu.
10. **TODO Scheduler Reminder Otomatis**: Pengiriman reminder otomatis H-5 dan H-2 via cron scheduler masih berupa kerangka kerja dan belum mengirimkan email/notifikasi riil ke pengguna.

## 22. Source Code Evidence

| Bagian | File $\rightarrow$ Function / Component $\rightarrow$ Tujuan |
|---|---|
| Engine Kalkulasi | `packages/ikpa-engine/src/indicators/output-achievement.ts` $\rightarrow$ `calculateOutputAchievement` $\rightarrow$ Kalkulasi Dual-Formula, 30/70, PCRO 0%, Gate Konfirmasi, dan Fairness |
| Kalender Kerja Kanonis | `packages/ikpa-engine/src/utils/workday-calendar.ts` $\rightarrow$ `calculateFifthWorkingDayOfNextMonth`, `addWorkdays`, `isWorkday` $\rightarrow$ Penghitungan deadline 5 HK M+1 |
| Skema Input Engine | `packages/ikpa-engine/src/schemas.ts:108-129` $\rightarrow$ `outputReportSchema`, `outputAchievementInputSchema` $\rightarrow$ Kontrak tipe data laporan RO |
| Resolver Fairness | `apps/web/src/server/policy/fairness-resolver.ts` $\rightarrow$ `resolveOutputAssessmentEligibility`, `matchRoCode` $\rightarrow$ Penentuan status pengecualian RO |
| Halaman Operator | `apps/web/src/routes/operator/data/output-achievement.tsx` $\rightarrow$ `OutputAchievementPage` $\rightarrow$ Tampilan utama, selector bulan, 4 kartu metrik, reminder strip, tabel data, drawer, dan modal |
| Komponen Formatted Input | `apps/web/src/components/data/formatted-number-input.tsx` $\rightarrow$ `FormattedNumberInput` $\rightarrow$ Separasi ribuan real-time & proteksi integer murni |
| Formatter Dinamis | `apps/web/src/lib/format.ts` $\rightarrow$ `stripTrailingDecimals`, `formatDateDDMMYYYY` $\rightarrow$ Standardisasi format angka dan tanggal kanonis |
| Service Frontend | `apps/web/src/services/output-achievement-service.ts` $\rightarrow$ `fetchOutputReports`, `saveOutputReport`, `submitFairnessProposal` $\rightarrow$ Passthrough komunikasi ServerFn |
| Server Functions | `apps/web/src/server/output-achievement.ts` $\rightarrow$ `listOutputReportsFn`, `upsertOutputReportFn`, `confirmOutputReportFn` $\rightarrow$ Handler server-side dengan validasi dan otorisasi |
| Mutasi Server & Validasi | `apps/web/src/server/domains/output-achievement.mutations.ts` $\rightarrow$ `upsertOutput`, `createFairnessProposal`, `deleteFairnessProposal` $\rightarrow$ Validasi Zod, integer checks, dan audit logs |
| Query Server | `apps/web/src/server/domains/output-achievement.queries.ts` $\rightarrow$ `listOutputsWithEligibility` $\rightarrow$ Pengambilan data laporan dengan resolver fairness dan deadline |
| Skema Database | `packages/db/src/schema/output-reports.ts` $\rightarrow$ `outputReports`, `assessmentExclusionProposals` $\rightarrow$ Definisi tabel relasional Drizzle ORM |
| Halaman Admin KPPN | `apps/web/src/routes/admin-kppn/policy/fairness.tsx` $\rightarrow$ `FairnessPolicyAdminPage` $\rightarrow$ Pengelolaan kebijakan fairness dan peninjauan usulan satker |
| Unit Test Engine | `packages/ikpa-engine/src/indicators/output-achievement.test.ts` $\rightarrow$ Suite pengujian otomatis mencakup seluruh skenario bisnis dan golden test |

## 23. Documentation Discrepancies

1. **Formula Lama PRD vs Dual-Formula Aktual**: PRD lama mendokumentasikan bahwa bulan Desember otomatis bernilai 100%. Pada implementasi aktual PER-5/PB/2024 (FIX-CO-01), bulan Desember dihitung nyata menggunakan Formula 2 berbasis rasio RVRO terhadap Target Volume DIPA.
2. **Definisi Batas Waktu 5 HK**: Spesifikasi awal memiliki beberapa variasi definisi deadline (tanggal 5 kalender, 5 hari kerja tanpa libur). Saat ini sistem telah sepenuhnya distandarisasi menjadi 1 definisi kanonis: Hari Kerja ke-5 bulan M+1 dengan memperhitungkan hari libur nasional KPPN (`calculateFifthWorkingDayOfNextMonth`).
3. **Standardisasi Istilah Subkomponen**: Nomenklatur lama menggunakan singkatan `NKKW` dan `NKCRO`. Seluruh antarmuka, engine trace, dan dokumen telah distandarisasi menjadi `NK-ROKW` (Ketepatan Waktu Pelaporan RO) dan `NK-CRO` (Capaian Rincian Output).
4. **Format Volume dan RVRO**: Dokumen lama mengizinkan desimal hingga 4 angka pada volume. Berdasarkan standarisasi DIPA dan pengujian operasional, Target Volume DIPA dan RVRO kini diwajibkan berupa bilangan bulat murni (*pure integer*).

## 24. Implementation Gaps (5)

1. **Sinkronisasi Agregasi Periode Bulan vs Dashboard FY**: Selector pills di halaman operator mengevaluasi nilai berdasarkan bulan yang dipilih (`evalPeriod = selectedMonth`), sedangkan Dashboard Utama menampilkan rata-rata agregat seluruh laporan tahun anggaran berjalan. Hal ini dapat menimbulkan perbedaan persepsi jika operator mengira angka di dashboard mewakili bulan terakhir.
2. **Validasi Tanggal Pelaporan Masa Depan**: Sistem saat ini belum menolak pengisian `reportedDate` yang bertanggal di masa depan (*future date*), melainkan tetap menilainya terhadap deadline.
3. **Alur Persetujuan Formal Fairness KPPN**: Pada lingkungan simulasi operator, usulan pengecualian satker langsung aktif mengecualikan RO dari perhitungan (*instant simulation exclusion*). Pada regulasi formal, usulan satker memerlukan persetujuan (*approval*) dari admin KPPN sebelum resmi dikecualikan.
4. **Automated Cron Reminder Dispatcher**: Pemicu pengiriman email/notifikasi pengingat H-5 dan H-2 masih bersifat deklaratif di tabel database dan belum dieksekusi secara otomatis oleh background worker.
5. **Dukungan Satuan RO Non-Integer (Layanan Khusus)**: Penegakan integer murni pada Target Volume DIPA dan RVRO berlaku global untuk seluruh RO, sehingga belum mendukung rincian output dengan satuan khusus (jika di masa depan terdapat RO dengan volume desimal resmi).

## 25. Questions for AI Reviewer

1. Apakah penerapan *Dual-Formula* Capaian RO (Formula 1: $\min\left(\frac{\text{PCRO}}{\text{TPCRO}} \times 100, 100\right)$ untuk Januari–November saat $\text{PCRO} < 100\%$, dan Formula 2: $\min\left(\frac{\text{RVRO}}{\text{Volume DIPA}} \times 100, 100\right)$ untuk Desember atau saat $\text{PCRO} \ge 100\%$) serta perlakuan khusus $\text{PCRO} = 0\% \rightarrow 0.00$ dan Laporan Belum Dikonfirmasi $\rightarrow 0.00$ sudah sepenuhnya presisi dan selaras dengan regulasi PER-5/PB/2024 dan Petunjuk Teknis IKPA TA 2026?
2. Apakah penentuan batas waktu kanonis ketepatan pelaporan menggunakan Hari Kerja ke-5 bulan M+1 ($5\text{ HK M+1}$) dengan melompati hari libur nasional KPPN (`calculateFifthWorkingDayOfNextMonth`) sudah tepat, dan bagaimana perlakuan yang ideal terhadap hari cuti bersama yang ditetapkan mendadak oleh pemerintah?
3. Apakah mekanisme perlakuan keadilan (*Fairness Treatment*) dengan mengeluarkan RO yang dikecualikan secara penuh dari pembilang dan penyebut pada kedua subkomponen (NK-ROKW dan NK-CRO) sudah tepat, dan apakah status usulan simulasi satker boleh langsung mengecualikan RO di tingkat operator sebelum disetujui KPPN?
4. Bagaimana sebaiknya penyelarasan tampilan antara nilai bulanan pada halaman Capaian Output (`evalPeriod = selectedMonth`) dengan nilai tahunan yang ditampilkan pada kartu Dashboard Utama (`aggregate FY`) agar operator tidak mengalami kebingungan angka?
5. Apakah penegakan bilangan bulat murni (*pure integer*) untuk Target Volume RO DIPA dan RVRO sudah sesuai dengan standar data DIPA seluruh kementerian/lembaga, ataukah perlu disediakan pengecualian untuk jenis RO tertentu?
6. Pada evaluasi ketepatan waktu, jika suatu RO belum menyampaikan tanggal lapor (`reportedDate` kosong), sistem saat ini tidak memasukkannya ke dalam pembagi ketepatan waktu namun menandai status indikator sebagai `warning`. Apakah perlakuan ini sudah tepat dibandingkan dengan langsung menganggapnya bernilai 0 atau menetapkan status `incomplete`?
7. Apakah struktur data dan alur antarmuka (Grid Target di kiri, Realisasi di kanan, Live Drawer Preview, dan Filter Tabs) sudah memberikan kenyamanan dan kejelasan maksimal bagi operator satker dalam menyusun strategi pemenuhan target IKPA Capaian Output?

---
*Berhenti di sini. Jangan lanjut ke indikator berikutnya tanpa perintah.*
