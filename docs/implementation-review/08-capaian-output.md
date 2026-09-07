# 08 — Capaian Output (bobot 25%)

**Anchor:** `00-system-overview.md`, `01-dashboard.md` | **Tanggal:** 2026-09-07
**Mode:** INSPECT → TRACE → DOCUMENT. Tanpa vonis regulasi, tanpa ubahan code/docs operasional.
**Catatan instruksi:** dokumen `08-capaian-output.md` versi lama dianggap usang; file ini direplace penuh dari trace implementasi aktual (FIX-CO-01) dengan template identik `07-uptup_kkp.md`.

## 1. Module Purpose

Menilai ketepatan pelaporan (30% = NK-ROKW) + capaian RO (70% = NK-CRO) per RO bulanan dengan dual-formula + fairness treatment. Satu permukaan utama `/operator/data/output-achievement` (selector pills bulan, 4 kartu kanonis Ponytail, strip reminder 5 Hari Kerja wajib, tabel RO 7 kolom + 4 tab filter, drawer CRUD dengan live preview formula, modal fairness/proposal satker, modal panduan PER-5/Pusdiklat) + permukaan admin `/admin-kppn/policy/fairness`. Tanpa workspace what-if terpisah; simulasi/forecast belum memakai asumsi Output. Indikator berbobot terbesar (25 poin) — satu-satunya dengan Formel F1/F2 + gate konfirmasi + PCRO-0 + deadline kanonis kalender kerja + filter dikecualikan.

## 2. Implementation Status

| Aspek | Status |
|---|---|
| CRUD RO (kode/nama/bulan/RVRO/volumeDipa/PCRO/TPCRO/tanggal lapor/konfirmasi) + upsert scoped + soft-delete + audit | IMPLEMENTED |
| Engine 30/70 + Formula 1 (PCRO/TPCRO) / Formula 2 (RVRO/Volume) + Zero-PCRO + Confirmed-gate + Fairness + bobot 25 | IMPLEMENTED (§7–9) |
| Ketepatan waktu kanonis 5 HK (kalender kerja + libur nasional) | IMPLEMENTED (`calculateFifthWorkingDayOfNextMonth`, §10) |
| Filter konfirmasi & fairness di skor (draft=0; excluded dikeluarkan pembilang & penyebut) | IMPLEMENTED |
| PCRO/TPCRO & RVRO/volume dipakai sesuai periode & PCRO | IMPLEMENTED (F1 vs F2) |
| Strip 5 HK wajib per bulan + badge Tepat/Terlambat/Belum + saran + rincian Tepat/Terlambat/Menunggu | IMPLEMENTED |
| Fairness satker (proposal per RO/bulan + admin policy + resolver) | IMPLEMENTED |
| Dashboard 1 baris + rekomendasi | IMPLEMENTED |
| Riwayat perbandingan | IMPLEMENTED (via snapshot umum) |
| Export (sheet RO + ringkasan) | IMPLEMENTED |
| Reminder 5 HK terjadwal | PARTIAL (strip kanonis + seed `output_report_monthly` recommended + skeleton scheduler; tanpa jadwal H-5/H-2 terkirim) |
| Panduan formula PER-5/Pusdiklat | IMPLEMENTED (modal + golden case) |

## 3. Source Code Map

| Lapisan | File |
|---|---|
| Engine | `packages/ikpa-engine/src/indicators/output-achievement.ts` (`calculateOutputAchievement`, evalPeriod, Fairness, Zero-PCRO, F1/F2, 30/70, pending-warning) |
| Skema engine | `packages/ikpa-engine/src/schemas.ts:108-129` (`outputReportSchema{id,roCode?,period 1–12,pcro/tpcro/rvro/volumeDipa?,reportedDate nullable,deadlineDate,confirmed?,isExcluded?}`, `outputAchievementInputSchema{reports[],evalPeriod?}`) + `workday-calendar.ts:112-120` (`calculateFifthWorkingDayOfNextMonth`, `isWorkday`, `addWorkdays`) |
| Aturan | `packages/ikpa-engine/src/rule-set.ts:159-168,221-234` (bobot 25; `rounding half_up 2`; warna `OUT-004` di `assumptionWarnings`) |
| Mapping DB→Engine | `apps/web/src/server/simulation/calculate.ts:452-486` (`resolveOutputAssessmentEligibility` + `calculateFifthWorkingDayOfNextMonth(year,month,{holidays,workdays})` → `reportedDate/reportedAtISO`, `deadlineDate`, `confirmed`, `isExcluded`) |
| Resolver fairness | `apps/web/src/server/policy/fairness-resolver.ts` (`matchRoCode{exact,list,prefix,regex}`, `resolveOutputAssessmentEligibility` + fallback `FAN.ZZ1`) |
| UI halaman | `apps/web/src/routes/operator/data/output-achievement.tsx` (~1680 baris; pills 12 bulan, 4 kartu, strip kanonis, 4 tab filter `all/evaluated/excluded/action_needed`, `DomainDataTable` 8 kolom, `DomainFormDrawer` + `liveDrawerPreview`, modal Fairness + modal Panduan) |
| Service/API | `apps/web/src/services/output-achievement-service.ts` (`fetchOutputReports/save/verify/remove` + `submit/removeFairnessProposal/fetchFairness*`); `apps/web/src/server/output-achievement.ts` (9 ServerFn: `listOutputReportsFn/upsert/confirm/delete` + `create/deleteFairness*` + `listFairnessPolicies/Proposals/review/listAll` + FY2026 auto-init + fallback) + `server/domains/output-achievement.{queries,mutations}.ts` |
| Schema DB | `packages/db/src/schema/output-reports.ts` (`output_reports{roCode,roName?,month,rvro/volumeDipa 18,4,pcro/tpcro 8,4,reportedAt?,confirmed,confirmedAt/By,…}`) ; `assessment-exclusion.ts` (`assessment_exclusion_policies{matchType,roMatchValue jsonb,scopeType,year,1–12,basisReference,…status}` + `assessment_exclusion_proposals{orgId,fyId,roCode,month?,category,basisReference,operatorNote,status}`) |
| Seed | `packages/db/src/seed.ts:241-259` (`output_report_monthly` recommended, `workdays_after_month_end:5`, lead `[5,2]`); `:380-407` (policy `FAN.ZZ1` nasional published) + `workdays` 17 libur nasional 2026 |
| Dashboard | `server/dashboard.ts`, `dashboard.tsx:25-34` (`CAPAIAN_OUTPUT → /operator/data/output-achievement`) |
| Admin | `apps/web/src/routes/admin-kppn/policy/fairness.tsx` + `server/domains/output-achievement.mutations.ts:421-576` (`upsertFairnessPolicy/reviewFairnessProposal`) |

## 4. User Flow

**Pills bulan (state lokal halaman):** 12 pills Januari–Desember (`selectedMonth = new Date().getMonth()+1`) → loader `fetchOutputReports` + `fetchFairnessProposals` → `monthData = outputs.filter(m==selectedMonth)` → engine lokal `calculateOutputAchievement(reports, evalPeriod=selectedMonth)` → 4 kartu.
**4 kartu Ponytail:** (1) RO Objek Penilaian `evaluated/total` + `excluded` purple, (2) NK-ROKW 30% `nkkwScore` + `timely/late/pending`, (3) NK-CRO 70% + avg PCRO/TPCRO display, (4) IKPA-CO & Kontribusi `finalScore` + `weightedContribution`.
**Strip Reminder kanonis:** `canonicalDeadline = calculateFifthWorkingDayOfNextMonth(year, selectedMonth, {holidays})` (EOM + 5 workdays loncat weekend+libur) → panel biru/kuning `Batas Konfirmasi Bulan X: DD-MM-YYYY (Hari Kerja ke-5 M+1)` + badge Tepat/Terlambat/Menunggu.
**Tabel + 4 tab filter:** `all/evaluated/excluded/action_needed` + search `roCode/roName` → kolom: Kode & Nama RO | Objek Penilaian `Dinilai/Dikecualikan` | Formula NK-CRO `Draft/0(PCRO 0%)/Formula1/Formula2/—` | PCRO/Target | RVRO/Volume | Ketepatan `Tepat(100)/Terlambat(0)/Belum(—)/—` | Status Konfirmasi | Aksi `Edit/Konfirmasi/Fairness/Hapus` → `DomainDataTable`.
**Drawer (Create/Edit):** `roCode` upper, `month` select, `roName?`, `volumeDipa` integer, `rvro` integer, `tpcro` 0–100 max 2 desimal, `pcro` 0–100 max 2 desimal, `reportedDate` type=date + tombol Hari Ini, `confirmed` checkbox + `liveDrawerPreview` card (badge EXCLUDED/UNCONFIRMED/ZERO_PCRO/FORMULA_1/FORMULA_2 + step `min((x/y)*100,100)` + skor + deskripsi). `handleSaveOutput` → `stripTrailingDecimals` + `Math.round(vol/rv)` + `saveOutputReport` → `router.invalidate()`. `Konfirmasi` → `verifyOutputReport(id)`; `Hapus` → `confirm()` → `removeOutputReport`.
**Fairness Modal:** selector `Dikecualikan/Dinilai` → kode, bulan (null=sepanjang tahun), kategori `ro_khusus/keadaan_kahar/kebijakan_pusat`, basis, catatan, attachment → `submitFairnessProposal` (upsert idempotent per `(org,fy,roCode)` + purge duplikat) atau `removeFairnessProposal` (nonaktif = hapus bersih) → list proposal di bawah. Dampak fairness: `excluded` RO tidak masuk pembilang & penyebut NK-ROKW & NK-CRO (tetap tampil di tabel purple).
**Panduan:** tombol `Panduan Formula (PER-5)` → modal Pusdiklat §4.3 golden case.

## 5. Input Inventory

| Input | Type | Required | Default | Validation | Source | Digunakan Calculation? |
|---|---|---|---|---|---|---|
| `roCode` | text 1–32 | Ya | `""`→upper | trim, Zod min1 max32 | drawer | TIDAK (id) — dipakai `matchRoCode` untuk fairness |
| `roName` | text 0–255 | Tidak | null | max255 | drawer | TIDAK (display) |
| `month` | select 1–12 | Ya | `selectedMonth` | int 1–12 | pills + drawer | YA (`period`; Des → F2 paksa §7) |
| `volumeDipa` | integer string 18,0 | Ya | `100` | FE `allowDecimal false` + BE integer + `rv≤vol`; TPCRO kosong→0 | drawer | YA (F2 `rvro/volumeDipa`) |
| `rvro` | integer string 18,0 | Ya | `""→0` | sama + `0≤rv≤vol` | drawer | YA (F2) |
| `pcro` | decimal 8,2 | Ya | `""→0` | 0–100, max 2 desimal, max 100 | drawer | YA (F1 `pcro/tpcro`; gate F2 `pcro≥100`) |
| `tpcro` | decimal 8,2 | Ya | `80` | sama | drawer | YA (F1) |
| `reportedDate` | date `YYYY-MM-DD` | Tidak | `today` / `""` | `z.iso.datetime offset` nullable; FE date picker | drawer | YA (`reportedDate ≤ deadlineDate`; null→pending) |
| `confirmed` | checkbox | Tidak | false | boolean | drawer + tombol Konfirmasi | YA (gate → 0) |
| Fairness `category/basis/…` | select/text | Ya (basis) | `ro_khusus` / `Fairness treatment…` | Zod 1–255/1000/500; `roCode` upper | modal fairness | YA (via `isExcluded`) |
| `search`/`activeTabFilter` | text/enum | Tidak | — | client | toolbar | TIDAK (filter tampil) |

## 6. Validation Rules

- BE (`output-achievement.mutations.ts:17-35,63-72`): `dec4` & `dec84` regex `^-?(?:0\|[1-9]\d*)(?:\.\d{1,4})?$` (negatif lolos regex ditolak range), `RVRO 0..volume` + `Number.isInteger(rv/vol)`, `PCRO/TPCRO 0..100` (parseFloat). Upsert unik `(fyId,roCode,month)` (update bila ada). `reportedAt`转为 `Date` bila ada; `confirmed` → set `confirmedAt/By`. Fairness proposal Zod `roCode 1–32`, `basisReference 1–255`, `month? 1–12 nullable`.
- FE: `FormattedNumberInput` `allowDecimal false` untuk volume/RVRO (reject titik/koma), `maxDecimals 2` + `max 100` untuk PCRO/TPCRO; `stripTrailingDecimals` buang `.00` sebelum simpan; `handleSaveOutput` guard `!roCode.trim()` tanpa banner; `isSubmitDisabled={!roCode.trim()}` di drawer; proposal modal disable Simpan bila kosong. Live preview clamp display `Math.min(ratio,100).toFixed(2)` (mirror engine tanpa DecimalCalc).
- Scope FY + audit (`writeAudit` create/update/confirm/delete_output + create/update/delete_proposal + policy). Tanpa cek: duplikat lintas FY, tanggal lapor ≤ deadline (dinilai 0 bukan ditolak), volume 0 khusus (warning bukan error).

## 7. Business Rules

**Rule ID:** OUT-BR-001 — Ketepatan kanonis 5 Hari Kerja M+1 (string-compare)
`isTimely = reportedDate ≤ deadlineDate` (ISO `YYYY-MM-DD`, `output-achievement.ts:89`) → 100 else 0. `deadlineDate = calculateFifthWorkingDayOfNextMonth(fy.year, month, {holidays,workdays})` (`workday-calendar.ts:112-120`: `addWorkdays(EOM,5)` loncat Sat/Sun + `holidays[]` + override `workdays[]`). `reportedDate` null → tak masuk `timelinessTotal` & `validTimelinessCount`; `hasPendingTimeliness=true` → status `warning` (bukan `incomplete`). Praktik: null tidak lagi fallback `YYYY-MM-05` → tidak selalu tepat.

**Rule ID:** OUT-BR-002 — Formula 1 (Jan–Nov & PCRO < 100%): `min((PCRO/TPCRO)*100,100)`
Bila `confirmed && pcro!="0" && period!=12 && pcro <100` → `ratio=pcro/tpcro*100`, cap 100, round half-up 4→2 (`:164-181`). `tpcro ≤0` → warning `TPCRO_MUST_BE_GT_ZERO…` + capaian 0.00 (tanpa throw). Satu-satunya jalur PCRO/TPCRO dipakai.

**Rule ID:** OUT-BR-003 — Formula 2 (Desember atau PCRO ≥100%): `min((RVRO/VolumeDIPA)*100,100)`
Bila `confirmed && pcro!="0" && (period==12 || pcro≥100)` → pakai volume (`:144-162`). `volumeDipa ≤0` → warning `VOLUME_DIPA…` + 0.00. Tidak ada asumsi 100 otomatis — Des dihitung nyata (CO-04 `2/4→50`). Semua capaian cap 100.

**Rule ID:** OUT-BR-004 — Aturan khusus PCRO = 0% → 0.00 tanpa divide
`DecimalCalc.eq(pcro,"0")` → 0.00 langsung (`:140-143`), bahkan bila `tpcro=0` tidak warning F1. Mencegah 0/0.

**Rule ID:** OUT-BR-005 — Gate konfirmasi → 0.00 capaian per RO
`!confirmed` → `ZERO_UNCONFIRMED` 0.00 (`:136-139`). Berlaku untuk ketepatan (tetap dinilai bila ada tanggal) vs capaian (0 walau RVRO/PCRO bagus). Dishared drawer & tabel badge `0 (Draft)`.

**Rule ID:** OUT-BR-006 — Fairness treatment excluded dari pembilang & penyebut
Loop reports filtered `evalPeriod` → `if isExcluded {excludedRoCount++; trace "Dikecualikan"; continue}` (`:68-82`) → `includedRoCount` saja masuk `achievementTotal` & `timelinessTotal`. `includedRoCount==0` → `null/incomplete` + warning `Seluruh … dikecualikan` (`:202-216`). Resolver (`fairness-resolver.ts:87-198`): prioritas 1 proposal aktif org (skip rejected/cancelled, match org+kode+bulan), 2 policy published nasional/kppn/org + `effectiveMonthStart–End` + `matchRoCode`, 3 fallback hardcode `FAN.ZZ1` → `included` default.

**Rule ID:** OUT-BR-007 — Agregat 30/70 per periode bulan (evalPeriod)
`avgTimeliness = timelinessTotal/validTimelinessCount` (0 bila tak ada yang lapor → 0.00), `avgAchievement = achievementTotal/includedRoCount`, `score = 0.3*avgT + 0.7*avgC` round half-up 2, `weighted = score*25/100` (`:219-296`). `subComponents[timeliness 30, achievement 70]` (`weightedContribution` per komponen). Status: `incomplete` bila kosong / excluded semua ; `warning` bila `hasPendingTimeliness` true else `complete` (`:321`). Full trace per RO + 3 agregat + final.

**Rule ID:** OUT-BR-008 — Periode & filter evaluasi
`input.evalPeriod` → `reportsToEvaluate = reports.filter(r.period==evalPeriod)` (`:34-37`); kosong → `null/incomplete` spesifik bulan (`:39-52`). Dashboard & mapping `calculate.ts` tidak pakai `evalPeriod` — semua FY dihitung sebagai `outputAchievement.reports` (agregat FY). Pills halaman = `evalPeriod` lokal.

## 8. Calculation Logic

Input (`schemas.ts:108-129`): `reports[{id,roCode?,period,target?/volumeDipa,realized?/rvro,pcro?,tpcro?,reportedDate nullable,deadlineDate,confirmed?,isExcluded?,…}]` + `evalPeriod?`. Server bangun `reports[]` dari `outputReports` + `workdays` kalender (holiday-aware deadline) + `resolveOutputAssessmentEligibility` (published policies + operator proposals + orgId). Engine langkah: (1) kosong→incomplete, (2) filter evalPeriod, (3) loop per RO: cek excluded → lanjut; hitung ketepatan (null→pending), hitung capaian (ZERO_UNCONFIRMED/ZERO_PCRO/F1/F2 dengan DecimalCalc presisi), (4) excluded-only→incomplete, (5) avg NKKW/NK-CRO, (6) final 30/70 + tertimbang + subComponents + warnings. FE mirror sama via `calculateOutputAchievement` lokal untuk 4 kartu & live preview (tanpa round presisi DecimalCalc untuk preview). Jejak `formulaTrace` 2×N + 3.

## 9. Formula & Variables

Persis code: `tepat_i = reportedDate? (reportedDate ≤ deadlineDate ? 100 : 0) : pending`; `avgT = Σtepat_i / n_validTimeliness` (0 bila 0); `capai_i = !confirmed?0 : pcro==0?0 : (period==12||pcro≥100)? min(rvro/volumeDipa*100,100) : min(pcro/tpcro*100,100)` (cap 100, round4→2, tpcro/vol ≤0 → 0 + warning); `avgC = Σcapai_i / n_included`; `score = 0.3*avgT + 0.7*avgC` (round 2); `weighted = score*25/100`. Deadline `YYYY-MM-DD` string-compare (`deadlineDate = EOM +5 workdays, holiday-aware`). `DecimalCalc` string-arithmetic (satu-satunya indikator pakai DecimalCalc aman, tanpa float).

## 10. Threshold / Weight / Period / Rounding

- Bobot 25 (terbesar 7 indikator; total 100). Sub 30/70 hardcode `"0.30"/"0.70"` cap di engine (bukan rule set).
- Threshold: ketepatan deadline string `≤` inklusif; capaian cap 100; PCRO gate `≥100` masuk F2; Desember paksa F2.
- Periode: per baris `month` 1–12; filter `evalPeriod` tunggal (pills) → `includedRoCount` penyebut; Dashboard tanpa filter (FY aggregate). Efektif fairness `effectiveMonthStart–End` 1–12 terkait periode.
- Kalender: workday Mon–Fri, `holidays[]` 17 nasional 2026 + DB `workdays`, `addWorkdays(EOM,5)` (UTC, tanpa timezone WIB khusus).
- Rounding: `DecimalCalc.roundHalfUp(4)→roundHalfUp(2)` capaian; avg & final `roundHalfUp(2)`; kontribusi `roundHalfUp(2)`; trace 2 desimal. Live drawer `toFixed(2)` float mirror.
- Nol: tanpa baris / excluded semua → `null/incomplete`; tanpa lapor → `avgT 0.00` + `warning` (bukan incomplete); volume/tpcro 0 → warning + 0 bukan skip; semua pending → `0.00/0.00 → 0.00` warning.

## 11. Calculation Examples (engine aktual)

### Normal Case — Golden Pusdiklat 95.56 (CO-12/CO-18)
3 RO Juli `confirmed` tepat `reported 2026-08-05 ≤ 2026-08-07`: RO1 `100/100→F2 100`, RO2 `100/100→F2 100`, RO3 `34/42→F1 80.95` → `avgT=100`, `avgC=(100+100+80.95)/3=93.65` → `score=0.3*100+0.7*93.65=95.56`, weighted `23.89`, sub 100.00/93.65 (`output-achievement.test.ts:442-493`).

### Boundary Case
`reported==deadline` → tepat (≤). `pcro==100` non-Des → F2 (CO-03 `2/2→100`). `pcro>100` float → F2. `RVRO/volume=150%` → cap 100 (CO-08 `15/10→100`). Des `FAN?` tidak otomatis 100 — `2/4→50` (CO-04). `rv==vol==0` tidak ada; `vol≤0` → 0+warning. `pcro==0 && tpcro==0` → 0 aman (CO-06).

### Edge/Invalid Case
(a) Kosong → null/incomplete + `Tidak ada data…`. (b) `evalPeriod` tanpa data → null/incomplete `Tidak ada … untuk periode bulan X`. (c) Semua `isExcluded` (FAN.ZZ1×N) → null/incomplete `Seluruh (N) RO … dikecualikan`. (d) `!confirmed` → capai 0.00 walau RVRO 100 (CO-05 `30.00`). (e) `reportedDate null` → pending: `avgT` 0.00 + warning (CO-11) — tidak lagi selalu tepat. (f) Terlambat 1 hari `08>07` → NKKW 50.00 (CO-09/10 `85.00`). (g) Fairness 4×100 + 1×FAN excluded → NKKW 100/NK-CRO 100 vs bila not excluded → 80.00 (CO-13/14). (h) `tpcro 0` + `pcro 25` → warning `TPCRO_MUST_BE_GT_ZERO` + 0 (CO-07).

## 12. Data Model & Persistence

`output_reports{id uuid PK, fiscalYearId→fiscal_years, roCode text 1–32, roName text?, month smallint 1–12, rvro numeric18,4 NOT NULL, volumeDipa numeric18,4, pcro 8,4, tpcro 8,4, reportedAt timestamptz?, confirmed bool default false, confirmedAt/By?, createdBy?, deletedAt, createdAt, updatedAt}` + index `fiscalYearId`, `(roCode,month)`, `confirmed`, `deletedAt`. Unik logika `(fy,roCode,month)` via upsert, bukan DB constraint. Tulis upsert + confirm (set true + `confirmedAt/By=now`) + soft-delete + audit `output_reports` 4 aksi; baca non-deleted per FY + join `workdays` & fairness. `assessment_exclusion_policies{id,ruleSetId?,name,indicatorKey default output_achievement,action,category,matchType exact|list|prefix|regex,roMatchValue jsonb,scopeType national|kppn|organization,scopeId?,fiscalYearId?,year 2026,1–12,basisReference,displayReason,allowOperatorProposal,status draft|published}` + `assessment_exclusion_proposals{id,organizationId,fiscalYearId,indicatorKey,roCode,month?,category,basisReference,operatorNote,attachmentRef,status draft|submitted|approved|rejected|…,reviewNote,resolvedPolicyId}`. Fairness tulis idempotent `(org,fy,roCode)` + purge duplikat; baca scoped; admin CRUD policy/review. Tanpa asumsi persist untuk Output.

## 13. API / Service

`output-achievement-service{fetchOutputReports,saveOutputReport,verifyOutputReport,removeOutputReport,submit/removeFairnessProposal,fetchFairnessPolicies/Proposals,saveFairnessPolicy,reviewProposal,fetchAllFairnessProposals}` → `server/output-achievement.ts` 9 ServerFn (`listOutputReportsFn(GET)`, `upsertOutputReportFn(POST)`, `confirmOutputReportFn(POST)`, `deleteOutputReportFn(POST)`, `createFairnessProposalFn`, `deleteFairnessProposalFn`, `listFairnessPoliciesFn(GET)`, `listFairnessProposalsFn(GET)`, `upsertFairnessPolicyFn`, `reviewFairnessProposalFn`, `listAllFairnessProposalsFn`) + FY2026 auto-init (`getOrInitFiscalYear`) + fallback `outputs:[]/holidays:[]` bila tanpa DB → domain `queries{listOutputs,listOutputsWithEligibility+deadline+eligibility,listFairness*}` + `mutations{upsertOutput,confirmOutput,softDeleteOutput,create/deleteFairnessProposal,upsertFairnessPolicy,reviewFairnessProposal}` + Zod + scope `assertOperatorOrgScope/assertAdminKppnScope` + audit. Validator passthrough di ServerFn, Zod domain; tanpa-DB tulis sukses-palsu untuk preview (pola modul lain).

## 14. End-to-End Data Flow

`drawer (RO/bulan/volume/rvro/pcro/tpcro/tanggal/confirmed) → service saveOutputReport → ServerFn upsertOutputReportFn → scope+FY → Zod dec4/dec84 + integer + range → Date(reportedAt) → upsert(audit) → invalidate → loader fetchOutputReports+fetchFairnessProposals → (a) tabel/4 kartu/strip (engine lokal `evalPeriod=selectedMonth`), (b) fairness modal list, (c) Dashboard → calculate.ts (resolve eligibility + 5-HK deadline holiday-aware + reportedAtISO + confirmed/isExcluded) → engine 30/70 → kartu CAPAIAN_OUTPUT + rekomendasi + history/export`. Fairness: `modal proposal → createFairnessProposalFn → upsert idempotent + purge → loader eligibility → engine continue(skip)`. Admin: `upsertFairnessPolicy/review` → eligibility terpengaruh next load. Tanggal lapor kini mengalir penuh `reportedDate → reportedAt → ISO string → deadline compare`.

## 15. Dashboard Integration — IMPLEMENTED (sumber sama, periode FY)

Satu engine actual via `calculateAndPersistSnapshot`; threshold warna 90/75 (umum); rute `CAPAIAN_OUTPUT → /operator/data/output-achievement`; rekomendasi kontekstual `Tingkatkan Capaian Output` (deep-link `output-achievement` konsisten). Kartu Dashboard tunjukkan skor agregat FY (tanpa `evalPeriod`) sehingga bisa beda dengan kartu halaman `selectedMonth`; rincian tepat/draft & fairness tidak di-breakdown di kartu (agregat buta — detail di halaman). History/Snapshot pakai snapshot umum `breakdownJson`.

## 16. Reminder Integration — PARTIAL (kanonis tapi tanpa jadwal terkirim)

Strip per-bulan kanonis `calculateFifthWorkingDayOfNextMonth` + badge + saran + rincian `timely/late/pending` + teks `DD-MM-YYYY (Hari Kerja ke-5 M+1)` + seed `output_report_monthly` recommended → Reminder Center generik + `org_reminder_configs` + scheduler skeleton (seperti modul lain). Lead policy `[5,2]` hari kerja, `workdays_after_month_end:5`, dayType `workday`. Tanpa jadwal H-5/H-2 terkirim dari halaman; `nearestDeadline` Dashboard hardcode bila ada masih FY lama (verifikasi). Deadline kini tunggal kanonis (workday-aware), bukan 3 definisi lama.

## 17. History Integration — IMPLEMENTED

`breakdownJson.indicators[output_achievement]` (+`subComponents[timeliness 30,achievement 70]` + `formulaTrace 2×N+3` + `warnings` + `status complete|warning|incomplete` + `excluded` trace) per snapshot; compare History men-trace agregat. Per-RO & per-bulan & status konfirmasi/fairness tak berversi terpisah di snapshot header (hanya agregat FY); namun `roCode` ter-trace per langkah. Asumsi panel tak ada (tak persist) — konsisten.

## 18. Report/Export Integration — IMPLEMENTED

Sheet RO mentah (`roCode/roName/month/pcro/tpcro/rvro/volumeDipa/reportedAt/confirmed/eligibility/deadlineDate`) + Ringkasan 8 + PDF + agregat Admin; sanitasi; base64. Export kini berguna: kolom yang diekspor (PCRO/TPCRO/confirmed/reportedAt/isExcluded) justru yang dinilai engine — ironi lama teratasi. Copy "7 indikator" sama.

## 19. Error Handling

Loader `Promise.all(fetchOutputs+fetchProposals)` tanpa try/catch (error propagate ke route error boundary). Mutasi → banner merah + preserve state; `createFairnessProposal` tanpa basis → early return tanpa banner (guard); validasi BE → throw `RVRO harus…/harus bulat/PCRO 0..100`; duplikat proposal → update bukan error; hapus via `confirm()` lalu `delete`. Tanpa-DB: baca kosong `outputs:[]`, tulis `success:true` palsu (preview offline). `reportedAt` null → strip `Belum Lapor (—)` jujur vs engine `pending` 0 + warning (konsisten, tidak divergen). `deadline` dari DB `workdays` kosong → fallback holiday `[]` → EOM+5 Mon–Fri murni.

## 20. Edge Cases

- Semua draft (`!confirmed`) → NK-CRO 0.00 → skor = `0.3*avgT + 0`.
- `PCRO 0 + confirmed` → capaian 0.00 (bukan warning F1/F2) — satu-satunya 0 eksplisit.
- `FAN.ZZ1` tanpa proposal/policy → tetap excluded via fallback hardcode (3rd rule) — RO khusus tidak कभी dinilai bila policy seed hilang.
- Duplikat `(FY,RO,bulan)` → upsert timpa (riwayat PCRO hilang di DB, tapi trace tetap per snapshot); RO sama beda bulan = baris terpisah (rata-rata per-baris, multi-bulan berbobot ganda sesuai evalPeriod).
- `rvro > volume` → cap 100 (bukan error) untuk F2; `rv > vol` untuk F1 tak relevan (F1 pakai pcro). `vol 0 + rv 0` → F2 warning + 0 (bukan skip).
- `reportedDate` masa depan masih `≤ deadline?` bisa tepat-artifisial bila deadline lebih jauh; tidak divalidasi ≤ today.
- Pills bulan lokal `selectedMonth` — Des F2 paksa tetap tampil walau FY belum Desember; DB RO bulan lain tetap tersimpan tapi tak ikut `avg` bulan aktif.
- `matchType regex` panjang >100 → `matchRoCode` return false (guard).
- `workdays` kosong (tanpa seed) → deadline Mon–Fri murni minus Sabtu/Minggu saja (libur nasional diabaikan → toleransi 1–2 hari).

## 21. Mock/Hardcoded/Placeholder Findings (10)

1. HARDCODED: bobot 25 + 30/70 + cap 100 + round `half_up 2` + FY 2026.
2. HARDCODED: `FAN.ZZ1` fallback exact di `fairness-resolver.ts:181-191` + policy seed `FAN.ZZ1` nasional published (`seed.ts:380-407`) — duplikat sadar; bila seed retracted, hardcode tetap exclude.
3. KANONIS BARU: deadline `calculateFifthWorkingDayOfNextMonth` UTC + `holidays[]` 17 libur 2026 + `workdays[]` override (tanpa import hari cuti bersama detail).
4. INTEGER ENFORCEMENT baru (`mutations.ts:67-68`) — `FormattedNumberInput allowDecimal false` + `Math.round(save)` + `Number.isInteger` guard (patch UI-INTEGER-VOL-RVRO).
5. `DecimalCalc` string-arithmetic penuh (tanpa float) — satu-satunya indikator yang sudah presisi.
6. Warning EN → ID campur: `VOLUME_DIPA_MUST_BE_GT_ZERO`, `TPCRO_MUST_BE_GT_ZERO_WHEN_PCRO_GT_ZERO`, `Tidak ada data…` — sudah ID tetapi prefix masih EN.
7. Dead-ish: `publishedPolicies` di-props namun `FAN.ZZ1` hardcode tetap aktif walau policy list kosong (3rd fallback); `allowOperatorProposal` policy flag belum gate (semua proposal diterima).
8. Tanpa-DB fallback OK: list → `outputs:[]/holidays:[]`; save/confirm → `success:true` palsu (pola modul lain — TODO unified).
9. Live preview float `Math.min(...).toFixed(2)` vs engine DecimalCalc bisa beda 0.01 pada fractional edge (accepted, display-only).
10. TODO implisit: FY dinamis (seed cuma 2026), `evalPeriod` vs Dashboard FY gap (belum disatukan), jadwal reminder H-5/H-2 terkirim, validasi `reportedDate ≤ deadline` sebelum simpan vs nilai 0, `target?/realized?` legacy field di skema tapi tak dipakai.

## 22. Source Code Evidence

| Bagian | File → function/component → purpose |
|---|---|
| Kalkulasi | `packages/ikpa-engine/src/indicators/output-achievement.ts` → `calculateOutputAchievement` + `utils/workday-calendar.ts` → `calculateFifthWorkingDayOfNextMonth/addWorkdays/isWorkday` |
| Skema/aturan | `packages/ikpa-engine/src/schemas.ts:108-129`; `rule-set.ts:159-168` (bobot 25) + `assessment-exclusion` DB |
| Mapping | `apps/web/src/server/simulation/calculate.ts:452-486` ; `apps/web/src/server/policy/fairness-resolver.ts` → `resolveOutputAssessmentEligibility/matchRoCode` |
| UI | `apps/web/src/routes/operator/data/output-achievement.tsx` → `OutputAchievementPage` (~1680 baris: pills 12, 4 kartu Ponytail, strip kanonis, 4 tab, 8 kolom tabel, drawer live preview, modal fairness, modal panduan) |
| Service/API/validasi | `services/output-achievement-service.ts`; `server/output-achievement.ts` (9 ServerFn); `server/domains/output-achievement.{queries,mutations}.ts` → `upsertOutput/confirm/softDelete/create/deleteFairness*` + Zod + integer + audit |
| DB | `packages/db/src/schema/output-reports.ts` → `output_reports`; `assessment-exclusion.ts` → `assessment_exclusion_policies/proposals`; `workdays.ts` |
| Seed | `packages/db/src/seed.ts:241-259` (reminder `output_report_monthly`) + `:299-337` (17 libur) + `:380-407` (policy FAN.ZZ1) |
| Dashboard/History/Export | `server/dashboard.ts`, `dashboard.tsx`, `history.tsx`, `exports/operator-xlsx.ts` → `indicators[output_achievement]` + sub 30/70 |
| Test | `output-achievement.test.ts` (18: kosong, F1/F2/cap, draft, PCRO-0, warnings, timeliness, pending-warning, 5-HK kalender, fairness excluded/included, golden Pusdiklat 95.56) + `workday-calendar.test.ts` |

## 23. Documentation Discrepancies

1. PRD §7 / FSD 900 ERD "`target/pcro`" lama (Desember-100 otomatis + `target=volume`) sudah ditimpa code FIX-CO-01 (F1/F2 + PCRO-0 + confirmed gate + fairness) — PRD perlu update § capaian vs modul ini kanonis.
2. PRD:269 + FSD `5 HK` vs code lama 3 definisi (`YYYY-MM-05`/`EOM+5 Mon–Fri`/`DSL`) — SUDAH dikonsolidasi jadi 1 kanonis `EOM+5 workdays holiday-aware` + seed `workdays_after_month_end:5` selaras.
3. BACKLOG F11-07/F9-07/F6-09 klaim lama "konfirmasi 5 HK & capaian RO bekerja" — KINI terbukti benar (gate + F1/F2 + 5 HK implementasi), но test golden 95.56 belum ada di backlog lama.
4. Panduan output `guides.ts` g-07 vs engine 30/70 + F1/F2 + fairness — SUDAH selaras via modal Panduan Pusdiklat di halaman (isi §4.3 golden case).
5. `fitur.md` tetap tidak ada (umum).

## 24. Implementation Gaps (5)

1. Periode pills lokal `selectedMonth` vs Dashboard FY aggregate — skor halaman bisa beda dengan Dashboard untuk FY yang sama (kanonis mana? — FY untuk rekap, bulan untuk drill-down; perlu label eksplisit di Dashboard).
2. Validasi `reportedDate` masa depan / `reportedDate > deadline+bulan` belum ditolak — hanya dinilai 0 (mungkin perlu warning atau block future).
3. `allowOperatorProposal` flag di policy belum enforce — semua proposal satker auto-excluded tanpa approval KPPN (review stub `reviewFairnessProposal` ada tapi tidak gate `calculate`).
4. Reminder jadwal H-5/H-2 `output_report_monthly` belum terkirim otomatis; `nearestDeadline` generik vs per-bulan kanonis per RO; scheduler skeleton sama seperti indikator lain.
5. Tanpa sinkronisasi FY selain 2026 (seed & FY auto-init hardcode 2026); rollover 2027 butuh seed ulang + migrasi workdays.

## 25. Questions for AI Reviewer

1. Apakah `tepat = reportedDate ≤ EOM+5 workdays (loncat weekend+libur nasional KPPN)`, `capai = (F1: pcro/tpcro | F2: rvro/volume, Desember atau pcro≥100, cap 100)`, `gate confirmed→0, pcro==0→0`, `fairness excluded dari pembilang & penyebut kedua komponen`, `skor = 0.3 avgT + 0.7 avgC` bobot 25 sudah sesuai PER-5/Pusdiklat 2026 — khususnya pemisahan F1/F2 & gate konfirmasi & PCRO-0?
2. Apakah penghapusan `fallback YYYY-MM-05` → `pending + warning + avgT 0` (tidak selalu tepat) sudah benar vs harus `incomplete` atau `belum dinilai`?
3. Apakah deadline kanonis `calculateFifthWorkingDayOfNextMonth(EOM+5 workdays)` dengan `holidays 17 nasional + workdays override` cukup, atau perlu kalender cuti bersama + jam KPPN + timezone WIB eksplisit?
4. Apakah Desember harus tetap F2 paksa (bukan 100 otomatis seperti regulasi lama `OUT-004`) dan apakah `tpcro/vol ≤0 → 0 + warning` (bukan skip) dapat diterima & cukup diungkap via trace?
5. Haruskah `allowOperatorProposal=false` tetap auto-exclude FAN.ZZ1 via proposal satker, atau wajib gate `approved` KPPN sebelum `isExcluded=true` mempengaruhi skor?
6. Apakah rata-rata per-baris dalam `evalPeriod` bulan (RO multi-bulan = baris terpisah di bulan masing-masing) sudah benar vs agregat per-RO-terakhir vs FY-average — dan mana yang tampil di Dashboard?
7. Apakah integer enforcement RVRO/volume (`allowDecimal false` + `Math.round` + `isInteger`) sudah sesuai DIPA volume bulat, atau perlu dukung desimal satuan khusus & validasi `reportedAt` wajib saat `confirmed=true`?

---
*Berhenti di sini. Jangan lanjut ke indikator berikutnya tanpa perintah.*
