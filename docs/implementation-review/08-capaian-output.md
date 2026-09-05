# 09 — Capaian Output (bobot 25%)

**Anchor:** `00-system-overview.md`, `01-dashboard.md` | **Tanggal:** 2026-09-05
**Mode:** INSPECT → TRACE → DOCUMENT. Tanpa vonis regulasi, tanpa ubahan code/docs operasional.


## 1. Module Purpose

Menilai ketepatan pelaporan (30%) + capaian volume (70%) per RO bulanan. Satu halaman `/operator/data/output-achievement` (selector bulan, ringkasan PCRO/TPCRO, strip tenggat 5 HK + badge tepat/terlambat/belum + saran (CORR-06), drawer CRUD + tombol Konfirmasi). Tanpa workspace what-if; skenario hanya via Dashboard.

## 2. Implementation Status


| Aspek                                      | Status                                                         |
| ------------------------------------------ | -------------------------------------------------------------- |
| CRUD RO + konfirmasi + soft-delete + audit | IMPLEMENTED                                                    |
| Engine 30/70 + Desember-100 + bobot 25     | IMPLEMENTED (dengan input mati, §7–8)                          |
| Ketepatan waktu nyata                      | NOT IMPLEMENTED (`reportedAt` tak pernah diisi → selalu tepat) |
| Filter konfirmasi di skor                  | NOT IMPLEMENTED (draft ikut dinilai)                           |
| PCRO/TPCRO di skor                         | NOT IMPLEMENTED (engine pakai RVRO/volume)                     |
| Strip 5 HK + badge + saran                 | IMPLEMENTED (estimasi Mon–Fri + flag confirmed)                |
| Dashboard 1 baris + rekomendasi            | IMPLEMENTED                                                    |
| Riwayat perbandingan                       | IMPLEMENTED (via snapshot umum)                                |
| Export (sheet RO + ringkasan)              | IMPLEMENTED                                                    |
| Reminder 5 HK terjadwal                    | PARTIAL (policy seed ada; strip hanya baca)                    |


## 3. Source Code Map


| Lapisan           | File                                                                                                                                                                                                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine            | `packages/ikpa-engine/src/indicators/output-achievement.ts` (`calculateOutputAchievement`)                                                                                                                                                                                                                                                   |
| Skema engine      | `packages/ikpa-engine/src/schemas.ts:96-107` (`outputReportSchema{id,period 1–12,target,realized,reportedDate,deadlineDate}`, `outputAchievementInputSchema`)                                                                                                                                                                                |
| Aturan            | bobot `output_achievement:"25"` (`rule-set.ts`); warning `OUT-004` Desember                                                                                                                                                                                                                                                                  |
| Mapping DB→Engine | `apps/web/src/server/simulation/calculate.ts:349-361` (`target=volumeDipa`, `realized=rvro`, `reportedDate=reportedAt ?? YYYY-MM-05`, `deadlineDate=YYYY-MM-05`)                                                                                                                                                                             |
| Strip             | `apps/web/src/lib/simulation/tagihan-output-reminder.ts:101-161` (`outputDeadline`, `buildOutputSummary`) + test                                                                                                                                                                                                                             |
| UI halaman        | `apps/web/src/routes/operator/data/output-achievement.tsx` (593 baris; pills bulan lokal, 3 kartu, strip §375+, tabel RO, drawer tanpa input tanggal)                                                                                                                                                                                        |
| Service/API       | `apps/web/src/services/output-achievement-service.ts` (`fetch/save/verify/remove`); `apps/web/src/server/output-achievement.ts` (4 ServerFn + FY2026 + fallback kosong); `server/domains/output-achievement.{queries,mutations}.ts` (Zod 18,4/8,4 + range RVRO≤volume/PCRO-TPCRO 0–100 + upsert (FY,roCode,month) + `confirmOutput` + audit) |
| Schema DB         | `packages/db/src/schema/output-reports.ts` (`output_reports{roCode,month,rvro,volumeDipa,pcro,tpcro,reportedAt?,confirmed,…}`)                                                                                                                                                                                                               |
| Reminder seed     | `packages/db/src/seed.ts:241-258` (`output_report_monthly`, recommended, `workdays_after_month_end:5`, lead 2–5)                                                                                                                                                                                                                             |
| Dashboard         | `server/dashboard.ts`, `dashboard.tsx:25-34` (`CAPAIAN_OUTPUT → /operator/data/output-achievement`)                                                                                                                                                                                                                                          |


## 4. User Flow

Pills bulan lokal (12, state halaman — bukan konteks global) → 3 kartu (RO terdaftar + terkonfirmasi/draft; rata-rata PCRO vs TPCRO display; Batas Konfirmasi 5 HK "via OMSPAN") → strip (tenggat hasil `outputDeadline`, badge tepat/terlambat/belum + saran + link; detail di §16) → tabel RO bulan terpilih (kode, PCRO, TPCRO, RVRO/volume, badge Terkonfirmasi/Draft, aksi Konfirmasi + Hapus) + search kode → drawer (kode, bulan, RVRO, volume, PCRO, TPCRO, checkbox konfirmasi; **tanpa input tanggal lapor**) → `saveOutputReport` → invalidate; `Konfirmasi` → `verifyOutputReport` (set true saja); hapus via `confirm()`. Dampak skor via Dashboard.

## 5. Input Inventory


| Input          | Type                     | Required | Default      | Validation                                   | Source                                                              | Digunakan Calculation?                           |
| -------------- | ------------------------ | -------- | ------------ | -------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| `roCode`       | text                     | Ya       | `""`         | trim, 1–32                                   | drawer                                                              | TIDAK (id)                                       |
| `month`        | select pills/drawer 1–12 | Ya       | bulan sistem | int 1–12                                     | pills/drawer                                                        | YA (`period`; Des→100 otomatis)                  |
| `rvro`         | numeric 18,4             | Ya       | `""`→0       | FE `parseFloat||0`; BE range `0≤rvro≤volume` | drawer                                                              | YA (`realized`)                                  |
| `volumeDipa`   | numeric 18,4             | Ya       | `""`→0       | FE sama; BE ≥0 (implisit via rv≤vol)         | drawer                                                              | YA (`target`; 0 → periode dilewati + warning)    |
| `pcro`         | numeric 8,4              | Ya       | `""`→0       | FE sama; BE 0–100                            | drawer                                                              | TIDAK (display + export saja) → GAP              |
| `tpcro`        | numeric 8,4              | Ya       | `""`→0       | FE sama; BE 0–100                            | drawer                                                              | TIDAK → GAP                                      |
| `confirmed`    | checkbox                 | Tidak    | false        | boolean                                      | drawer + tombol Konfirmasi                                          | TIDAK di engine (strip saja) → GAP               |
| `reportedAt`   | datetime                 | —        | null selalu  | ISO|null (nullable)                          | TAK ADA input (service field ada, UI tak kirim; konfirmasi tak set) | MATI → selalu fallback = deadline → tepat selalu |
| `search`/bulan | text/int                 | Tidak    | —            | client                                       | toolbar/pills                                                       | TIDAK (filter tampil)                            |


## 6. Validation Rules

- FE: `parseFloat||0` + `toFixed(4)` (non-numerik → 0 diam-diam).
- BE (`mutations.ts:9-61`): regex 18,4/8,4 (negatif lolos regex, ditolak range); `RVRO 0..volume`, `PCRO/TPCRO 0..100`; upsert unik (FY,roCode,month); `confirmOutput` hanya `confirmed=true` (tanpa tanggal); scope FY + audit (create/update/confirm/delete_output). Tanpa cek: `reportedAt` wajib, volume&gt;0 (0 diizinkan → skip-warning), duplikat lintas FY, tanggal lapor ≤ deadline.

## 7. Business Rules

**Rule ID:** OUT-BR-001 — Ketepatan string-compare per RO
`isTimely = reportedDate ≤ deadlineDate` (string ISO, `output-achievement.ts:43-49`) → 100 else 0. Praktik: keduanya `YYYY-MM-05` (fallback) → selalu tepat (lihat OUT-BR-004).

**Rule ID:** OUT-BR-002 — Capaian RVRO/volume + cap 100 + skip target-0
Non-Des: `target==0 → warning + lewati (tak hitung capaian, tetap hitung ketepatan)`; else `min(realized/target×100,100)` round 4→2 (`:81-111`). Des (`period==12`): capaian `100` + warning `OUT-004` (realisasi diabaikan) (`:64-80`).

**Rule ID:** OUT-BR-003 — Agregat 30/70
`avgT = Σtepat/n_lapor`; `avgC = Σcapaian/n_valid`; `score = 0.3 avgT + 0.7 avgC` round 2; `weighted = score×25/100`; `subComponents[timeliness 30, achievement 70]` (`:114-196`). Status: `warning` bila warnings ada else `complete` (kosong → `incomplete` null, `:19-30`).

**Rule ID:** OUT-BR-004 — Fallback tanggal mematikan ketepatan
Mapping: `reportedDate = reportedAt?.slice(0,10) ?? YYYY-MM-05`; `deadlineDate = YYYY-MM-05` (`calculate.ts:349-361`). Karena UI tak tulis `reportedAt`, semua baris tepat-100 permanen.

**Rule ID:** OUT-BR-005 — Draft &amp; PCRO/TPCRO tak memengaruhi skor
Engine tak baca `confirmed/pcro/tpcro` (skema tanpa field). Satu-satunya modul dengan tombol Konfirmasi yang tak berpengaruh ke nilainya sendiri (pengaruh hanya ke strip).

**Rule ID:** OUT-BR-006 — Strip Mon–Fri + confirmed-gate (beda dari engine)
`outputDeadline(y,m) = +5 Mon–Fri dari akhir bulan` (`tagihan-output-reminder.ts:101-107`); `buildOutputSummary`: tak-ada-tanggal/!confirmed → `belum`; reported ≤ deadline → tepat else terlambat; saran + `Tenggat sudah lewat…` (`:117-161`). Deadline strip (akhir-bulan+5 HK) vs engine (tgl-5-bulan-berjalan) — dua definisi (§10).

## 8. Calculation Logic

Input (`schemas.ts:96-107`): `reports[{period,target,realized,reportedDate,deadlineDate}]`. Server isi dari `outputRows` (tanpa filter confirmed; tanpa pcro). Jejak: per RO `Ketepatan` + `Capaian` (+Desember-asumsi) → `Rata-rata Ketepatan` → `Rata-rata Capaian` → `Nilai Akhir (30/70)` → `Tertimbang`. `DecimalCalc` presisi (satu-satunya indikator pakai desimal aman).

## 9. Formula &amp; Variables

Persis code: `tepat_i = (rep_i ≤ dl_i) ? 100 : 0`; `capai_i = period==12 ? 100 : (target==0 ? skip : min(real/target×100,100))`; `avgT = Σtepat/n`; `avgC = Σcapai/n_valid`; `score = 0.3 avgT + 0.7 avgC`; `weighted = score×0.25`. Deadline engine `YYYY-MM-05` bulan-lapor; strip `EOM+5 Mon–Fri`.

## 10. Threshold / Weight / Period / Rounding

- Bobot 25 (terbesar). Sub 30/70 hardcode (`"0.30"/"0.70"`). Cap capaian 100; Des 100-otomatis; target-0 skip.
- Periode: per baris `month` (1–12, Des khusus); tanpa jendela agregat (semua RO FY ikut, rata-rata per-baris bukan per-bulan).
- Rounding: capaian `roundHalfUp(4)→roundHalfUp(2)`; rata-rata &amp; final `roundHalfUp(2)`; kontribusi `roundHalfUp(2)`.
- Nol: tanpa baris → null/incomplete; target-0 → warning + skip capaian (ketepatan tetap); volume-0 + rv-0 → skip (bukan 0/100).
- Negatif lolos regex tetapi `rv>vol`/`0..100` menolak sebagian (negatif PCRO ditolak; negatif RVRO ditolak via `<0`).

## 11. Calculation Examples (engine aktual)

### Normal Case — 67.50 (test emas)

Jan: target 100/real 50 tepat + Feb: 200/250 (cap 100) terlambat → avgT=(100+0)/2=50; avgC=(50+100)/2=75 → `0.3×50+0.7×75 = 67.50` complete, sub 50.00/75.00 (`output-achievement.test.ts:16-56`).

### Boundary Case

Rep tepat di deadline (`==`) → tepat (inklusif `≤`). Real 125% → cap 100. Target 0 → skip + warning, status `warning` (test `:81-111`: avgT 100, avgC 100 → 100.00 warning).

### Edge/Invalid Case

(a) Kosong → null/incomplete (Dashboard Estimasi). (b) Via UI nyata: 3 RO (2 draft + 1 confirmed, semua tanpa tanggal) → engine: tepat 3/3=100, capaian dari RVRO/vol → draft ikut penuh (konfirmasi irrelevant). (c) Des: real 0 → capaian 100 + OUT-004 (test `:58-79`). (d) Strip vs engine: RO confirmed dilaporkan (tak tercatat kapan) → strip `belum?tepat?` dari `reportedAt` null → `belum`; engine → tepat (fallback). Keduanya "benar" menurut definisinya sendiri — divergen total. (e) Deadline beda: RO Januari engine `2026-01-05` vs strip `2026-02-06` (EOM Jan + 5 Mon–Fri) — Januari tak pernah tepat-di-strip bila rep tgl 10 Jan tetapi tepat-di-engine.

## 12. Data Model &amp; Persistence

`output_reports{id, fiscalYearId, roCode, month smallint, rvro numeric(18,4), volumeDipa numeric(18,4), pcro/tpcro numeric(8,4), reportedAt timestamptz?, confirmed bool default false, …}` + indeks (FY),(roCode,month),confirmed. Tulis upsert (FY,roCode,month) + konfirmasi + soft-delete + audit; baca non-deleted per FY. `reportedAt` kolom ada, tak pernah ditulis UI (service terima `reportedAt?` tetapi route tak kirim).

## 13. API / Service

`output-achievement-service{fetchOutputReports,saveOutputReport(no-reportedAt),verifyOutputReport,removeOutputReport}` → `server/output-achievement.ts` (4 ServerFn + FY2026 + fallback `outputs:[]`) → domain + audit. Validator passthrough; Zod domain. Tanpa-DB: baca kosong; tulis sukses-palsu (pola modul lain).

## 14. End-to-End Data Flow

`drawer (RO/bulan/RVRO/vol/PCRO/TPCRO/confirmed) → service → ServerFn → scope+FY → Zod+range → upsert+audit → invalidate → loader → (a) tabel/3 kartu (PCRO display), (b) strip Mon–Fri + confirmed, (c) Dashboard → calculate.ts (RVRO/vol + fallback-tanggal, tanpa confirmed/PCRO) → engine 30/70 → kartu CAPAIAN_OUTPUT + rekomendasi + history/export.` Tanggal lapor tak mengalir dari mana pun (kolom selalu null via UI).

## 15. Dashboard Integration — IMPLEMENTED (sumber sama)

Satu engine actual; threshold 90/75; rute `/operator/data/output-achievement`; rekomendasi `Tingkatkan Capaian Output` (deep-link `output-achievement` — konsisten). Kartu tak tunjukkan Tepat-vs-Draft (agregat buta konfirmasi).

## 16. Reminder Integration — PARTIAL

Strip per-bulan (tenggat + badge + saran + link) + seed `output_report_monthly` recommended → Reminder Center generik + scheduler skeleton. Tanpa jadwal H-3/H-1/H-0 terkirim; `nearestDeadline` Dashboard hardcode Output `2026-09-07` (tunggal, bukan per-bulan). Deadline strip vs engine vs seed-DSL (`workdays_after_month_end:5`) = tiga definisi (EOM+5 Mon–Fri vs tgl-5 vs DSL — butuh kanonisasi).

## 17. History Integration — IMPLEMENTED

`breakdownJson.indicators[output_achievement]` (+sub 30/70 + trace + versi) per snapshot; compare History. Per-RO &amp; status konfirmasi tak berversi terpisah (hanya agregat).

## 18. Report/Export Integration — IMPLEMENTED

Sheet RO mentah (termasuk PCRO/TPCRO/confirmed/reportedAt) + Ringkasan 8 + PDF + agregat Admin; sanitasi; base64. Copy "7 indikator" sama. Ironi: kolom yang diekspor (PCRO/TPCRO/confirmed) justru yang tak dipakai skor.

## 19. Error Handling

Loader tanpa try/catch; mutasi → banner; `confirm()` hapus; range-error → banner (RVRO&gt;vol, PCRO/TPCRO). Tanpa-DB sukses-palsu. `reportedAt` null → strip `belum` (jujur) vs engine tepat (menyesatkan) — dua penanganan null berbeda.

## 20. Edge Cases

- Semua draft → skor penuh bila RVRO baik (konfirmasi tak gate).
- Target-0 → warning + skip (status `warning` walau angka 100).
- Des → 100 otomatis + OUT-004 (satu baris Des cukup untuk 100 capaian parsial).
- Duplikat (FY,RO,bulan) → upsert timpa (riwayat PCRO hilang); RO sama beda bulan = baris terpisah (rata-rata per-baris, RO multi-bulan berbobot ganda).
- Volume-0 + RVRO-0 → skip (bukan 0); volume-0 + RVRO&gt;0 → ditolak (`rv>vol`).
- Pills bulan lokal (bukan konteks global) — Des dipilih tetap tampil walau engine asumsikan.

## 21. Mock/Hardcoded/Placeholder Findings (10)

1. HARDCODED: bobot 25 + 30/70 + Des-100 + deadline `YYYY-MM-05` + round half-up.
2. MATI: `reportedAt` (kolom + service-field ada; UI tak kirim; konfirmasi tak set) → ketepatan lumpuh.
3. DIABAIKAN: `confirmed/pcro/tpcro` di engine (tampil + diekspor, tak dinilai).
4. DIVERGENSI deadline: engine tgl-5 vs strip EOM+5 Mon–Fri vs seed DSL.
5. Warning EN mentah `No output reports found` + `OUT-004` selalu bila ada Des + `Target nol…` per baris.
6. Kartu `Batas Konfirmasi 5 Hari Kerja via OMSPAN` statis; rata-rata PCRO display (bukan skor).
7. Pills bulan lokal tak sinkron konteks global (satu-satunya modul pills-lokal).
8. Dead mock output lama (halaman pakai loader; verifikasi sisa bila perlu).
9. Tanpa-DB baca-kosong/tulis-palsu; tanpa input tanggal (TODO terbesar).
10. TODO implisit: gate confirmed, pakai PCRO/TPCRO vs RVRO, tulis reportedAt saat simpan/konfirmasi, kanonisasi deadline, unik/validasi tanggal.

## 22. Source Code Evidence


| Bagian                   | File → function/component → purpose                                                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kalkulasi                | `packages/ikpa-engine/src/indicators/output-achievement.ts` → `calculateOutputAchievement`                                                                                  |
| Skema/aturan             | `packages/ikpa-engine/src/schemas.ts:96-107`; rule-set bobot 25 + `OUT-004`                                                                                                 |
| Mapping                  | `apps/web/src/server/simulation/calculate.ts:349-361`                                                                                                                       |
| Strip                    | `apps/web/src/lib/simulation/tagihan-output-reminder.ts:101-161` → `outputDeadline/buildOutputSummary`                                                                      |
| UI                       | `apps/web/src/routes/operator/data/output-achievement.tsx:58-112,114-184,186-268,331-373,375+` → pills/kartu/strip/tabel/drawer                                             |
| Service/API/validasi     | `apps/web/src/services/output-achievement-service.ts`; `apps/web/src/server/output-achievement.ts`; `apps/web/src/server/domains/output-achievement.{queries,mutations}.ts` |
| DB                       | `packages/db/src/schema/output-reports.ts` → `output_reports`                                                                                                               |
| Reminder seed            | `packages/db/src/seed.ts:241-258`                                                                                                                                           |
| Dashboard/History/Export | `server/dashboard.ts`, `dashboard.tsx`, `history.tsx`, `exports/operator-xlsx.ts`                                                                                           |
| Test                     | `output-achievement.test.ts` (4: kosong, normal 67.50, Des, target-0) + `tagihan-output-reminder.test.ts`                                                                   |


## 23. Documentation Discrepancies

1. PRD:255/FSD:900/ERD "terkonfirmasi + PCRO/TPCRO" vs code (RVRO/vol, tanpa gate, PCRO display) — BACKLOG F6-09/F9-07/F11-07 klaim selesai/teruji.
2. PRD:269 + FSD deadline 5 HK vs 3 definisi code — BACKLOG F10 klaim selesai.
3. BACKLOG F11-07 "konfirmasi 5 HK dan capaian RO bekerja" — konfirmasi tak pengaruhi skor; tanggal tak tercatat.
4. Panduan output (cek `guides.ts` g-07 saat review Panduan) vs engine 30/70 + Des-asumsi — verifikasi sisa di modul Panduan.
5. `fitur.md` tetap tidak ada.

## 24. Implementation Gaps (7)

1. Ketepatan selalu-100 via UI (tanpa input `reportedAt`; konfirmasi tak set tanggal).
2. Draft dinilai penuh (tanpa gate confirmed) walau tombol Konfirmasi ada.
3. PCRO/TPCRO disimpan-ditampilkan-diekspor tetapi tak dinilai (RVRO/vol yang dipakai).
4. Tiga definisi deadline (tgl-5 vs EOM+5 Mon–Fri vs DSL) + strip-vs-engine divergen.
5. Desember-100-otomatis + OUT-004 (asumsi needs_verification) tanpa pengungkapan UI selain warning.
6. Target-0 skip + status warning-100 membingungkan; pills lokal tak sinkron.
7. Tanpa jadwal H-3/H-1/H-0 terkirim; tanpa input tanggal (blokir go-live ketepatan).

## 25. Questions for AI Reviewer

1. Apakah `tepat = rep ≤ YYYY-MM-05`, `capai = min(RVRO/vol×100,100) (Des=100, target-0 skip)`, `skor = 0.3 avgT + 0.7 avgC`, bobot 25, tanpa gate confirmed, tanpa PCRO/TPCRO sudah sesuai regulasi — khususnya RVRO-vs-PCRO dan konfirmasi?
2. Apakah fallback `reportedAt → deadline` (selalu tepat) + ketiadaan input tanggal berarti ketepatan belum terimplementasi dan memblokir go-live?
3. Mana deadline kanonis: tgl-5 engine vs EOM+5 Mon–Fri strip vs `workdays_after_month_end:5` — dan apakah Mon–Fri cukup vs kalender kerja?
4. Apakah Des-100 (`OUT-004`) + target-0-skip + warning dapat diterima, dan haruskah diungkap di UI/Panduan?
5. Haruskah draft dikecualikan, PCRO/TPCRO dipakai (atau dihapus dari form/export), dan `reportedAt` ditulis saat simpan/konfirmasi?
6. Apakah rata-rata per-baris (RO multi-bulan berbobot ganda) vs per-bulan vs agregat-PCRO yang benar, dan pills-lokal vs konteks-global mana yang kanonis?
7. Apakah reminder recommended H-3/H-1/H-0 + `nearestDeadline` tunggal-hardcode memenuhi kebutuhan tenggat per-bulan?

---

*Berhenti di sini. Jangan lanjut ke indikator berikutnya tanpa perintah.*