# 02 — Revisi DIPA (bobot 10%)

**Anchor:** `00-system-overview.md`, `01-dashboard.md` | **Tanggal:** 2026-09-05
**Mode:** INSPECT → TRACE → DOCUMENT. Tanpa vonis regulasi, tanpa ubahan code/docs operasional.

## 1. Module Purpose

Halaman `/operator/data/budget-revisions` mengelola dua hal: (a) alokasi pagu per akun 51/52/53/57, (b) histori pengesahan revisi DIPA. Hanya (b) yang menjadi input skor indikator Revisi DIPA; (a) dipakai indikator lain (bobot proporsi Deviasi, denominator Penyerapan) dan sebagai angka banner/total. Tidak ada workspace what-if Revisi (by design PRE-F13: skenario gabungan hanya dari Dashboard).

## 2. Implementation Status

| Aspek | Status |
|---|---|
| CRUD pagu + revisi scoped + soft-delete + audit | IMPLEMENTED |
| Hitung skor Revisi via engine + tampil di Dashboard | IMPLEMENTED |
| Semester split, bucket, rata-rata tahunan, kontribusi | IMPLEMENTED (apa adanya, §8) |
| Klasifikasi kode revisi objek penilaian (14 kode) | NOT IMPLEMENTED (semua baris dihitung) |
| Flag eligible / ringkasan per-semester / proyeksi NKRA di UI | NOT IMPLEMENTED |
| Reminder khusus revisi | PARTIAL (policy seed ada, tanpa strip/peringatan khusus di halaman ini) |
| Riwayat perbandingan | IMPLEMENTED (via snapshot umum) |
| Export | IMPLEMENTED (sheet mentah Pagu/Revisi + ringkasan 8) |
| Panduan | MOCK (teks statis, bertentangan dgn bucket engine) |

## 3. Source Code Map

| Lapisan | File |
|---|---|
| UI halaman | `apps/web/src/routes/operator/data/budget-revisions.tsx` (555 baris) |
| Service tipis | `apps/web/src/services/budget-revisions-service.ts` (passthrough 5 fn) |
| ServerFn | `apps/web/src/server/budget-revisions.ts` (`listBudgetsAndRevisionsFn`, `upsertBudgetFn`, `createRevisionFn`, `deleteRevisionFn`, `deleteBudgetFn` + FY auto-init 2026 + no-DB fallback) |
| Query/mutasi | `apps/web/src/server/domains/budget-revisions.queries.ts` (`listBudgets`, `listRevisions`, `previewRevisionEligibility` mati), `apps/web/src/server/domains/budget-revisions.mutations.ts` (Zod + upsert/soft-delete + `writeAudit`) |
| Engine | `packages/ikpa-engine/src/indicators/dipa-revision.ts` (`calculateDipaRevision`, `getScore`), `schemas.ts:14-18` (`dipaRevisionInputSchema`), `rule-set.ts:157-171,203-218` (bucket + `revisionEligibilityCodes` + warning `REV-005`) |
| Mapping DB→Engine | `apps/web/src/server/simulation/calculate.ts:313-321` |
| Schema DB | `packages/db/src/schema/budget-revisions.ts` (`budgets`, `dipa_revisions`) |
| Dashboard | `apps/web/src/server/dashboard.ts:135-168` (petakan 7 + baris dispensasi), `routes/operator/dashboard.tsx:25-34` (`REVISI_DIPA → /operator/data/budget-revisions`) |
| Reminder seed | `packages/db/src/seed.ts:183-201` (`dipa_revision_quarterly`, mandatory, calendar_day) |
| Export | `apps/web/src/server/exports/operator-xlsx.ts:51-52,113-114` (sheet Pagu/Revisi), import parser `server/import/parser.ts:96,209-221` (terarsip, UI disabled) |
| Mock mati | `apps/web/src/mocks/budget-revisions.ts` (tak diimpor halaman), `mocks/guides.ts:11-22` (teks panduan), `mocks/operator-dashboard.ts:79-91` (contoh kartu) |

## 4. User Flow

1. Sidebar `Revisi DIPA` → `/operator/data/budget-revisions` (guard operator, `ActiveContextProvider`).
2. `loader` → `fetchBudgetAndRevisions(activeOrgId)` → banner `Total Pagu Aktif TA {year}` (`reduce` client atas `budgets[].amount`), 4 kartu akun (51/52/53/57 + tombol Edit per kartu), tabel `Daftar Pengesahan & Riwayat Revisi DIPA` (`DomainDataTable`: search kode/catatan, kolom tanggal/kode/pagu-sebelum/sesudah/perubahan/catatan/aksi hapus).
3. `+ Atur Pagu / Edit` → `DomainFormDrawer` pagu (select akun, nominal `FormattedNumberInput`, tanggal efektif) → `handleSaveBudget` → `saveBudget` → `router.invalidate()` → pesan sukses 4 detik.
4. `+ Tambah` (tabel) → drawer revisi (kode text, tanggal date default hari-ini, pagu-sebelum/sesudah prefill total pagu, catatan max 500) → `handleCreateRevision` → `addRevision` → invalidate.
5. Hapus → `confirm()` native → `removeRevision(id)` → invalidate.
6. Skor tidak dihitung di halaman ini (tanpa kartu skor/strip/`?`/drawer rumus). Hasil terlihat setelah buka Dashboard (yang memicu `calculateAndPersistSnapshot` actual) atau History/Export. `previewRevisionEligibility` dan flag eligible tidak tampil di mana pun.

Empty/error: tabel kosong → empty state `DomainDataTable`; gagal fetch → error boundary (tanpa try/catch di loader); mutasi gagal → banner `role=alert` merah; sukses → `<output>` hijau auto-hilang.

## 5. Input Inventory

| Input | Type | Required | Default | Validation | Source | Digunakan Calculation? |
|---|---|---|---|---|---|---|
| `revisionCode` | text | Ya | `""` | FE: `required`, trim; BE: `min(1).max(32)` | drawer revisi | TIDAK (dihitung semua, tanpa filter kode) → GAP |
| `revisionDate` | date | Ya | hari-ini `YYYY-MM-DD` | FE: `required`; BE: `z.iso.date()` | drawer revisi | YA (hanya penentu semester) |
| `paguBefore` | numeric string | Ya | prefill total pagu | FE: `parseFloat\|\|0` + `toFixed(2)`; BE: regex decimal 18,2 (izinkan negatif) | drawer revisi | TIDAK → GAP |
| `paguAfter` | numeric string | Ya | prefill total pagu | sama dengan di atas | drawer revisi | TIDAK → GAP |
| `notes` | textarea 500 | Tidak | `""` | `max(500)` | drawer revisi | TIDAK |
| `budgetAccount` | select 51/52/53/57 | Ya | `"51"` | enum | drawer pagu | TIDAK untuk skor revisi (dipakai indikator lain) |
| `budgetAmount` | numeric string | Ya | `""` | FE `parseFloat\|\|0`; BE decimal 18,2 | drawer pagu | TIDAK untuk skor revisi |
| `budgetEffectiveDate` | date | Ya | hari-ini | `z.iso.date()` | drawer pagu | TIDAK |
| `search` | text | Tidak | `""` | client `includes` kode/catatan | toolbar tabel | TIDAK |

## 6. Validation Rules

- Frontend: atribut `required` + `FormattedNumberInput` (grup titik id-ID, nilai mentah polos ke server) + `parseFloat(v)||0` + `toFixed(2)`. Kelemahan: string non-numerik diam-diam jadi `0.00`; negatif lolos.
- Backend (`budget-revisions.mutations.ts:9-27`, duplikat di `server/budget-revisions.ts:20-36`): `decimal18_2 = /^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/`, `accountCode enum`, `revisionCode 1..32`, `notes ≤500`, `date ISO`. `strictObject` + `fiscalYearId uuid` (diisi server dari FY aktif, bukan dari klien). Gagal → Zod throw → banner merah.
- Otorisasi: `assertFy`/`assertFiscalYearAccess` (org-scope + FY milik org) + `getOrInitFiscalYear(2026)` auto-create FY bila ada 1 published rule set 2026.
- Tanpa validasi: kode terhadap `revisionEligibilityCodes`, tanggal dalam tahun anggaran, duplikat kode/tanggal, `paguAfter≥0` vs negatif (regex izinkan `-`), relasi pagu vs revisi.

## 7. Business Rules

**Rule ID:** REV-BR-001 — Semesterisasi hitung
Trigger: tiap `calculateAndPersistSnapshot`. Input: `dipaRevisions[].revisionDate` (non-deleted, FY aktif). Condition: `new Date(d).getMonth()<6` → S1 else S2. Processing: `filter().length` per semester (`calculate.ts:313-321`). Output: `{semester1Revisions, semester2Revisions}`. Ref: `server/simulation/calculate.ts:313-321`.

**Rule ID:** REV-BR-002 — Semua baris dihitung (tanpa filter kode)
Trigger/Condition: tidak ada cek `revisionCode` vs `revisionEligibilityCodes` di query, mapping, maupun engine. Output: DIPA-AWAL pun ikut menambah hitungan. Ref: tidak ada pemanggilan `previewRevisionEligibility` (dead, `budget-revisions.queries.ts:57-63`).

**Rule ID:** REV-BR-003 — Bucket per semester
Trigger: `calculateDipaRevision`. Condition/Processing: first-match `revisions≥min && ≤max` (`dipa-revision.ts:8-21`). Output: skor S1, S2. Ref: bucket `rule-set.ts:167-171`.

**Rule ID:** REV-BR-004 — Agregasi tahunan + kontribusi
Processing: `annual=(S1+S2)/2`; `weighted=annual×weight/100` (`dipa-revision.ts:79-96`). Output: `score`, `weightedContribution`, `status:"complete"`. Bobot `weights.dipa_revision="10"`.

**Rule ID:** REV-BR-005 — Incomplete hanya bila undefined
Condition: `semester1Revisions===undefined||semester2===undefined` → `{score:null, weighted:null, status:"incomplete"}` (`dipa-revision.ts:39-53`). Praktik: server selalu kirim angka (0 bila kosong) → revisi tak pernah incomplete via jalur nyata.

**Rule ID:** REV-BR-006 — Soft-delete + audit
Processing: `deletedAt=now` (bukan hard delete); `writeAudit(create/update/delete_budget, create/delete_revision)` dengan before/after. Ref: `budget-revisions.mutations.ts:46-214`.

**Rule ID:** REV-BR-007 — Upsert pagu unik per (FY, akun)
Processing: ada → update amount/effectiveAt; tidak → insert (`mutations.ts:56-112`).

**Rule ID:** REV-BR-008 — FY 2026 auto-init
Condition: FY org-2026 absen + ada published rule set 2026 → insert FY. Ref: `server/budget-revisions.ts:46-79` (duplikat di `dashboard.ts`, `calculate.ts` mengharuskan FY ada).

## 8. Calculation Logic

Input engine (`schemas.ts:14-18`): `{semester1Revisions: int≥0, semester2Revisions: int≥0, hasBudgetChange: boolean[]}`. Server mengisi `hasBudgetChange = revisionRows.map(()=>true)` — selalu `true` per baris, dan **tidak dibaca engine sama sekali** (dead field). `revisionCode/paguBefore/paguAfter` tidak diteruskan ke engine.

## 9. Formula & Variables

Persis code (`dipa-revision.ts:55-96`):
`scoreS1 = bucketMatch(S1)`; `scoreS2 = bucketMatch(S2)`; `annual = (scoreS1+scoreS2)/2`; `weighted = annual × parseFloat(weights.dipa_revision)/100`. Trace 4 langkah: `Nilai Revisi Semester 1/2`, `Nilai Revisi DIPA Tahunan "(Nilai S1+Nilai S2)/2"`, `Nilai Tertimbang "Nilai Tahunan × Bobot"`. Warning: semua `assumptionWarnings` berprefix `REV-` disalin mentah (kini `REV-005: Kode revisi objek memakai daftar sementara`).

## 10. Threshold / Weight / Period / Rounding

- Bobot `10` (`default2026RuleSet.weights`). Invarian total 7 bobot = 100 (`rule-set.ts:68-85`).
- Bucket default (`rule-set.ts:167-171`): `0–1→110`, `2→100`, `3–999→50`. Catatan: `110 > 100` tanpa cap di indikator ini.
- Periode: non-kumulatif per semester kalender (Jan–Jun / Jul–Des via `getMonth`), tahunan = rata-rata 50/50. Sesuai PRD `50% S1 + 50% S2`.
- Rounding: tidak ada di indikator; pembulatan akhir di orkestrator `roundHalfUp(total, fractionDigits=2)` (`calculate.ts:88-91`). Skor revisi disimpan sebagai `"75"`, `"80"`, `"105"`, `"110"` (string, bisa `.5` bila campuran ganjil? tidak — bucket genap semua sehingga annual selalu bulat/`.0`; `.5` mustahil dengan bucket kini).
- Nilai 0 revisi → `110` (maksimum, bukan nol). Di luar bucket (`>999`/negatif mustahil via count) → `0` (fallback `getScore`).
- `revisionEligibilityCodes` 14 kode (`201…239`) tersimpan di rule set tetapi tak dikonsumsi.

## 11. Calculation Examples (engine aktual, `default2026RuleSet`)

### Normal Case — golden TSD/PRD 80
Input: S1=1, S2=3 → `bucket(1)=110`, `bucket(3)=50` → `annual=(110+50)/2=80` → `weighted=80×10/100=8.0`. `status:complete`. Inilah angka `revisi DIPA tahunan 80` pada PRD:628/FSD:1122.

### Boundary Case
S1=1→110 vs S1=2→100: `S1=1,S2=2 → (110+100)/2=105 → weighted 10.5`. S2=2→100 vs S2=3→50: `S1=2,S2=2 → 100 → 10.0`; `S1=2,S2=3 → 75 → 7.5` (golden test `dipa-revision.test.ts:6-18`).

### Edge/Invalid Case
(a) DB kosong: `revisionRows=[]` → S1=0,S2=0 → `110,110 → annual 110 → weighted 11.0 complete` — halaman kosong tetap menyumbang 11 poin (bukan estimasi). (b) `undefined` (hanya via unit test, tak terjadi via server): → `{score:null, weighted:null, incomplete}` → Dashboard petakan jadi Estimasi 0. (c) `revisionCode=""` → ditolak Zod `min(1)`; `paguBefore="abc"` → FE jadi `0.00` lalu lolos; `amount="-5"` → lolos regex (negatif diizinkan). (d) DIPA-AWAL dihitung: seed/fallback 1 baris `DIPA-AWAL` → S1=1 → minimal `105` bila S2=0.

## 12. Data Model & Persistence

`budgets{id, fiscalYearId→fiscalYears, accountCode, amount numeric(18,2), effectiveAt date, createdBy, deletedAt, createdAt, updatedAt}` + indeks FY/akun/tanggal. `dipa_revisions{id, fiscalYearId, revisionDate date, revisionCode text, paguBefore/paguAfter numeric(18,2), notes text?, createdBy, deletedAt, ...}` + indeks FY/tanggal. Diterima: field drawer; diproses: semester count; disimpan: baris + audit `audit_logs{entityType budgets/dipa_revisions}`; diperbarui: upsert pagu / soft-delete; diambil: `listBudgets/listRevisions` (`deletedAt IS NULL`, tanpa order eksplisit) → halaman, engine, export.

## 13. API / Service

`budget-revisions-service.ts` passthrough penuh ke `server/budget-revisions.ts`: `fetchBudgetAndRevisions→listBudgetsAndRevisionsFn(GET)`, `saveBudget→upsertBudgetFn`, `addRevision→createRevisionFn`, `removeRevision→deleteRevisionFn`, `removeBudget→deleteBudgetFn` (UI tak panggil deleteBudget — dead path UI). Tanpa-DB: list kembalikan 3 pagu (51/52/53, tanpa 57) + 1 revisi `DIPA-AWAL`; mutasi kembalikan `{success:true}` tanpa tulis (silent no-op).

## 14. End-to-End Data Flow

`drawer → service → ServerFn → assertScope → getOrInitFiscalYear(2026) → Zod → upsert/insert + audit → router.invalidate() → loader baca ulang → (terpisah) Dashboard load → calculateAndPersistSnapshot baca revisionRows → semester count → calculateDipaRevision → Dashboard/History/Export`. Revisi tak picu reminder/scheduler apa pun secara langsung.

## 15. Dashboard Integration

Sumber sama (`calculateAndPersistSnapshot` actual). Petakan di `dashboard.ts:135-168`: `rawScore=parseFloat(score)`, `weighted=(raw×weight)/100` (duplikat hitungan engine, konsisten aritmetika), status `≥90 complete / ≥75 warning / else danger`, `deltaPoints:0` statis, rute `REVISI_DIPA→/operator/data/budget-revisions`. Estimasi teoretis bila `score null` (tak terjadi nyata). Baris revisi ikut tentukan `dataStatus estimated` dan rekomendasi engine (`Kendalikan Revisi DIPA`, deep-link `budget-revisions`).

## 16. Reminder Integration — PARTIAL

Seed `dipa_revision_quarterly` (mandatory, `calendar_day`, lead 5–14, default `[14,7,3,1]`, penerima `ppk,kpa`) ada di DB bila seed dijalankan, sehingga muncul generik di Reminder Center. Tetapi: tanpa strip/CTA di halaman Revisi, tanpa peringatan ambang ke-1/ke-2 (FSD:528 minta, tak ada), `nearestDeadline` Dashboard hardcode Output (bukan revisi), deadline DSL `quarterly_deadline` tak dipecah di `deadline-calculator` seed-description saja. Status: kebijakan terdaftar, pemicu event revisi tidak terimplementasi di UI/logika halaman.

## 17. History Integration — IMPLEMENTED

Tiap Dashboard load persist `simulations{type:actual}` + `scoreSnapshots{breakdownJson: output}` yang memuat `indicators[dipa_revision]` + `ruleSetVersion/Id` + `inputHash`. `history.tsx:28-51` uraikan 8 baris termasuk revisi; banding 2 snapshot tampilkan kontribusi revisi. Lineage via `simulation_overrides` hanya untuk scenario Ramalan (revisi tak punya asumsi khusus).

## 18. Report/Export Integration — IMPLEMENTED (mentah + ringkasan)

`operator-xlsx.ts:51-52,113-114`: sheet `Pagu` + `Revisi` (kolom mentah tanggal/kode/pagu) + (PRE-F13-05) sheet Ringkasan 8 baris memuat revisi; `operator-pdf.tsx` baris revisi + total berformula; `admin-aggregate.ts` kolom revisi agregat. Sumber = tabel scoped yang sama + snapshot; sanitasi injeksi `'`; tanpa URL publik (base64). Copy `reports.tsx:52` masih tulis "7 indikator" (discrepancy copy, bukan angka).

## 19. Error Handling

Loader tanpa try/catch (gagal auth/org/FY → throw ke boundary). Mutasi: Zod/scope/FY error → banner merah; sukses → hijau 4 dtk. Hapus pakai `confirm()` sinkron (terblokir bila dialog diblokir browser). `formatRupiah(parseFloat)` throw `RangeError` bila amount korup (mungkin crash render baris). Tanpa-DB: mutasi diam-diam sukses palsu.

## 20. Edge Cases

- 0 revisi → skor maksimum 110 (kontribusi 11) — "kosong = sempurna" by bucket.
- DIPA-AWAL dihitung sebagai revisi ke-1 (S1=1) — insentif menghapus baris awal untuk skor.
- Semester batas 30 Jun vs 1 Jul via `getMonth` lokal server (timezone UTC vs WIB bisa geser hari-batas 1 hari; tak dinormalisasi).
- `revisionDate` masa depan/tahun lain tetap dihitung (tanpa validasi tahun anggaran).
- Duplikat kode/tanggal diizinkan (tiap baris +1).
- Pagu negatif/lonceng `paguBefore/After` bebas (tak pengaruhi skor, hanya tampil delta).
- Akun 57 absen di fallback (3 pagu) vs 4 kartu UI (kartu 57 tampil Rp0).

## 21. Mock/Hardcoded/Placeholder Findings (10)

1. HARDCODED bucket+weight di `default2026RuleSet` (aturan: tanpa deploy ganti via Admin Policy — IMPLEMENTED sebagai config, nilai awal hardcode).
2. HARDCODED tahun 2026 + auto-init di 3 tempat; header `TA {year}` dinamis dari FY tetapi mutasi selalu 2026.
3. MOCK `mocks/budget-revisions.ts` — tak diimpor siapa pun (dead mock, ciri F3-09).
4. MOCK fallback `server/budget-revisions.ts:101-136` (3 pagu + DIPA-AWAL) saat tanpa DB.
5. PLACEHOLDER `previewRevisionEligibility` — diekspor, nol pemanggil.
6. PLACEHOLDER `hasBudgetChange: map(()=>true)` — dead field engine.
7. PLACEHOLDER `revisionEligibilityCodes` 14 kode + warning `REV-005` — tersimpan, tak dikonsumsi.
8. MOCK panduan `guides.ts:20` ("1→100, >1→80") bertentangan bucket (`0-1→110, 2→100, ≥3→50`).
9. HARDCODED prefill `paguBefore/After = totalPagu` + default tanggal hari-ini.
10. TODO implisit: tanpa edit revisi (hanya tambah/hapus), tanpa `removeBudget` di UI, tanpa order tabel, tanpa flag eligible/NKRA (FSD:296-297,528 minta).

## 22. Source Code Evidence

| Bagian | File → function/component → purpose |
|---|---|
| Halaman | `routes/operator/data/budget-revisions.tsx` → `BudgetRevisionsPage` + `handleCreateRevision/handleSaveBudget/handleDeleteRevision` → CRUD UI |
| Service | `services/budget-revisions-service.ts` → `fetchBudgetAndRevisions/saveBudget/addRevision/removeRevision/removeBudget` → passthrough ServerFn |
| API | `server/budget-revisions.ts` → `listBudgetsAndRevisionsFn/upsertBudgetFn/createRevisionFn/deleteRevisionFn/deleteBudgetFn` → scope + FY + fallback |
| Validasi | `server/domains/budget-revisions.mutations.ts` → `upsertBudgetSchema/createRevisionSchema(decimal18_2)` + `upsertBudget/createRevision/softDelete*` → Zod + audit |
| Query | `server/domains/budget-revisions.queries.ts` → `listBudgets/listRevisions/previewRevisionEligibility` → scoped read |
| Kalkulasi | `packages/ikpa-engine/src/indicators/dipa-revision.ts` → `calculateDipaRevision/getScore` → bucket + rata-rata + kontribusi |
| Skema engine | `packages/ikpa-engine/src/schemas.ts:14-18` → `dipaRevisionInputSchema` → kontrak input |
| Aturan | `packages/ikpa-engine/src/rule-set.ts:157-171,203-218,223-232` → `default2026RuleSet` + kode eligible + warning |
| Mapping | `server/simulation/calculate.ts:313-321` → semester count + `hasBudgetChange` |
| DB | `packages/db/src/schema/budget-revisions.ts` → `budgets/dipaRevisions` → persistensi |
| Dashboard | `server/dashboard.ts:53-61,135-168` → rute + petakan skor/status |
| History | `routes/operator/history.tsx:28-51` + `services/simulation-service.ts:63-69` → banding snapshot |
| Reminder | `packages/db/src/seed.ts:183-201` → policy `dipa_revision_quarterly` |
| Export | `server/exports/operator-xlsx.ts:51-52,113-114` → sheet Pagu/Revisi |
| Test | `packages/ikpa-engine/src/indicators/dipa-revision.test.ts` → golden 75 + incomplete |

## 23. Documentation Discrepancies

1. BACKLOG F9-03/F11-03 klaim "eligibility preview" — fungsi ada tetapi nol pemanggil, UI tanpa flag (FSD:296 minta tampil).
2. BACKLOG F3-09 sebut "status eligibilitas IKPA" di UI — tidak ada di code halaman.
3. BACKLOG F6-03 "sesuai PER-5" — code tak filter 14 kode (diakui `REV-005 sementara` + PRD:642/TSD:1449 butuh verifikasi formal).
4. Panduan `guides.ts:20` vs bucket engine vs PRD:249 (`0-1→110`) — panduan salah/tua.
5. FSD:297 "ringkasan jumlah revisi objek per semester + proyeksi NKRA" dan :528 "peringatan ambang kedua" — tidak ada.
6. FSD:288 vs code: validasi kode hanya panjang, bukan daftar rule set.
7. `fitur.md` dirujuk instruksi tetapi tidak ada di repo (sudah dicatat di 00).

## 24. Implementation Gaps (7)

1. Tanpa filter kode revisi objek → tiap catatan (termasuk DIPA-AWAL/duplikat/tahun-lain) menambah hitungan semester.
2. Tanpa tampilan skor/proyeksi/ringkasan semester di halaman (user harus ke Dashboard untuk tahu dampak).
3. Tanpa peringatan ambang revisi ke-1/ke-2 dan tanpa integrasi Reminder khusus di halaman.
4. `paguBefore/After/notes` dan seluruh pagu tak berpengaruh ke skor revisi (hanya kosmetik/delta) — potensi bingung "mengapa ubah pagu skor tetap".
5. Skor 110 melebihi skala 100 tanpa cap/penjelasan di UI (kontribusi 11 dari bobot 10).
6. Tanpa-DB mutasi sukses palsu; fallback 57 hilang; mock pagu/revisi mati membingungkan audit.
7. Timezone/batas semester implisit + tanpa validasi tahun/duplikat/masa-depan.

## 25. Questions for AI Reviewer

1. Apakah benar semua `dipa_revisions` dihitung tanpa memandang `revisionCode` (14 kode objek), `paguBefore/After`, dan DIPA-AWAL — atau seharusnya hanya kode objek dengan perubahan pagu yang dihitung (FSD:852)?
2. Apakah bucket `0–1→110, 2→100, ≥3→50`, rata-rata `(S1+S2)/2`, bobot 10, dan skor 110 tanpa cap sudah sesuai regulasi, serta ke mana kelebihan 10 poin di atas 100 seharusnya dinormalisasi?
3. Apakah batas semester kalender Jan–Jun/Jul–Des (via `getMonth`) sudah tepat, termasuk perlakuan revisi lintas tahun/masa depan/duplikat?
4. Apakah `guides.ts:20` ("1→100, >1→80") yang bertentangan dengan engine perlu dikoreksi ke bucket engine, atau engine yang harus menyesuaikan panduan?
5. Apakah reminder `dipa_revision_quarterly` mandatory dengan formula `quarterly_deadline` + event ambang ke-1/ke-2 sudah memadai, dan bolehkah halaman tanpa peringatan ambang?
6. Apakah perilaku "0 revisi = 110" dan "DIPA-AWAL = revisi ke-1" dapat diterima, atau DIPA awal seharusnya dikecualikan dari hitungan?
7. Apakah `hasBudgetChange` (selalu true, tak dipakai) dan `previewRevisionEligibility`/`revisionEligibilityCodes` yang menganggur menandakan rule yang belum diimplementasikan dan harus dilengkapi sebelum go-live (lih. PRD:642)?

---
*Berhenti di sini. Jangan lanjut ke Deviasi Halaman III tanpa perintah.*
