# 09 — Dispensasi SPM (pengurang, bobot 0)

**Anchor:** `00-system-overview.md`, `01-dashboard.md` | **Tanggal:** 2026-09-05
**Mode:** INSPECT → TRACE → DOCUMENT. Tanpa vonis regulasi, tanpa ubahan code/docs operasional.
**Catatan penomoran:** repo sudah berisi `09-capaian-output.md`; file ini `09-dispensasi-spm.md` sesuai permintaan (duplikat nomor disengaja mengikuti instruksi).

## 1. Module Purpose

Mencatat SPM Triwulan IV (Okt–Des) + flag dispensasi; menghitung rasio permil → pengurang nilai IKPA total (bukan indikator berbobot). Satu halaman `/operator/data/spm-dispensation` (banner potensi pengurang, tabel + toggle, drawer) + panel asumsi dipakai Simulasi legacy + forecast/scenario server. Pengurang tampil sebagai baris ke-8 Dashboard.

## 2. Implementation Status

| Aspek | Status |
|---|---|
| CRUD SPM Q4 + toggle + Q4-guard + soft-delete + audit | IMPLEMENTED |
| Engine rasio permil + bucket + golden 0.75 | IMPLEMENTED |
| Banner estimasi pengurang di halaman | PARTIAL (bucket UI salah, §7) |
| Panel asumsi dispensasi + preview | IMPLEMENTED (bucket benar) |
| Dashboard baris pengurang (`total = Σ7 − pengurang`) | IMPLEMENTED |
| Riwayat perbandingan | IMPLEMENTED (via snapshot umum) |
| Export (sheet SPM Q4 + ringkasan) | IMPLEMENTED |
| Reminder risiko dispensasi | PARTIAL (policy seed ada; tanpa strip di halaman) |

## 3. Source Code Map

| Lapisan | File |
|---|---|
| Engine | `packages/ikpa-engine/src/indicators/spm-dispensation.ts` (`calculateSpmDispensation` → `{deduction,ratio,trace,warnings}`) |
| Skema engine | `packages/ikpa-engine/src/schemas.ts:109-112` (`spmDispensationInputSchema{dispensationCount,totalSpmQ4}`); orkestrator `calculate.ts:75-92` (`total = subtotal − deduction`, round half-up) |
| Aturan | `packages/ikpa-engine/src/rule-set.ts:179-185` (bucket permil 0→0 / 0.01–0.099→0.25 / 0.1–0.999→0.50 / 1–4.999→0.75 / ≥5→1.00) |
| Mapping DB→Engine | `apps/web/src/server/simulation/calculate.ts:362-372` (count `isDispensasi` / total; asumsi scenario gantikan) |
| Preview benar | `apps/web/src/lib/simulation/dispensasi-assumptions.ts` (`calcDispensasiPreview`, bucket selaras) + test 11; `components/operator/dispensasi-assumption-panel.tsx` |
| UI halaman | `apps/web/src/routes/operator/data/spm-dispensation.tsx` (396 baris; banner `estimatedDeduction` SALAH + toggle + drawer + Q4-guard FE) |
| Service/API | `apps/web/src/services/spm-dispensation-service.ts` (`fetch/add/edit/remove`); `apps/web/src/server/spm-dispensation.ts` (4 ServerFn + FY2026); `server/domains/spm-dispensation.{queries,mutations}.ts` (Zod + `isQ4` Okt–Des + audit) |
| Schema DB | `packages/db/src/schema/spm-q4.ts` (`spm_q4{referenceNumber,issuedAt,isDispensasi,…}`) |
| Reminder seed | `packages/db/src/seed.ts:259-276` (`spm_dispensation_q4`, mandatory, `end_of_year_schedule`, lead 7–21) |
| Dashboard | `server/dashboard.ts:179-194` (baris `spm_dispensasi` weight 0, weighted negatif); `dashboard.tsx:25-34` (`SPM_DISPENSASI → /operator/data/spm-dispensation`) |

## 4. User Flow

Banner (Potensi Pengurang −X.XX Poin dari `estimatedDeduction` UI) + `Tambah SPM Q4` → tabel (Nomor, Tanggal, badge Dispensasi/Normal, aksi toggle + hapus) + search nomor → drawer (nomor, tanggal default 2026-11-15, checkbox dispensasi default true) → FE guard Okt–Des → `addSpmDispensasi` → invalidate; toggle `Set Normal/Dispensasi` → `editSpmDispensasi`; hapus via `confirm()`. Panel asumsi (di Simulasi, bukan halaman ini): 2 angka + preview rasio/bucket/dampak. Dampak resmi via Dashboard.

## 5. Input Inventory

| Input | Type | Required | Default | Validation | Source | Digunakan Calculation? |
|---|---|---|---|---|---|---|
| `referenceNumber` | text | Ya | `""` | trim, 1–64 | drawer | TIDAK (id) |
| `issuedAt` | date | Ya | 2026-11-15 | FE Okt–Des; BE `isQ4` Okt–Des via `getMonth` | drawer | TIDAK langsung (guard keanggotaan Q4 saja) |
| `isDispensasi` | checkbox/toggle | Tidak | true (drawer) | boolean | drawer + toggle | YA (pembilang) |
| Asumsi `dispensationCount/totalSpmQ4` | number | — | 0/0 | `≥0`, `disp≤total` (panel); server `floor,≥0` | panel Simulasi | YA (scenario/forecast gantikan count DB) |
| `search` | text | Tidak | — | client nomor | toolbar | TIDAK |

## 6. Validation Rules

- FE: tanggal Okt–Des ( pesan ID), nomor trim.
- BE (`mutations.ts:9-47`): nomor 1–64, ISO date, boolean; `isQ4` tolak non-Okt–Des (timezone-naif `getMonth`). Scope FY + audit. Tanpa cek: duplikat nomor, tanggal masa depan/lewat tahun, `disp≤total` (tak relevan per-baris), nominal SPM (kolom tak ada — rasio dari cacah, bukan nilai!).

## 7. Business Rules

**Rule ID:** DIS-BR-001 — Rasio permil dari cacah (bukan nominal)
`ratio = disp/total×1000`, round half-up 3 desimal (`spm-dispensation.ts:43-60`). Total 0 → `{deduction 0, ratio 0}` + warning ID (`:19-41`).

**Rule ID:** DIS-BR-002 — Bucket pengurang (inklusif, first-match + fallback max)
`0–0.009→0; 0.01–0.099→0.25; 0.1–0.999→0.50; 1–4.999→0.75; 5–9999→1.00` (`rule-set.ts:179-185`; compare `gte/lte` string via `DecimalCalc`, `:66-88`). Celah presisi: rasio 0.0095→round 0.010 → tier 0.25 (batas desimal, bukan kontinu).

**Rule ID:** DIS-BR-003 — Pengurang total (bukan bobot)
Orkestrator: `total = round_half_up(subtotal − deduction)`; `total=null` bila ada indikator incomplete (`calculate.ts:83-92`). Dashboard duplikat: baris weight 0, `rawScore=deduction`, `weighted=−deduction`, `deltaPoints=−deduction`.

**Rule ID:** DIS-BR-004 — Banner UI pakai bucket SALAH
Halaman (`spm-dispensation.tsx:65-70`): `disp==0→0; ratio≤50→0.5; ≤100→0.75; else 1.0` — tanpa tier 0/0.25, threshold 50/100 vs 1/5 engine. Golden 24/5200 = 4.615‰ → banner 0.5, engine 0.75 (selisih 0.25 poin tampil). Panel asumsi (`dispensasi-assumptions.ts:59-65`) benar selaras engine.

**Rule ID:** DIS-BR-005 — Q4-guard Okt–Des (FE + BE, naive)
FE + `isQ4` tolak Jan–Sep (`mutations.ts:32-47`). Batas via `getMonth` lokal (UTC vs WIB bisa geser 1 hari di perbatasan bulan).

**Rule ID:** DIS-BR-006 — Asumsi scenario gantikan count
`useDisp = type!=actual && assumptions.dispensasi` → `{floor(disp), floor(total)}` (`calculate.ts:300-372`); panel tolak `disp>total`, server floor-tanpa-tolak (negatif → `max(0,…)`).

## 8. Calculation Logic

Input (`schemas.ts:109-112`): `{dispensationCount int≥0, totalSpmQ4 int≥0}`. Server: count DB (actual) atau asumsi (scenario). Jejak 2 langkah: `Rasio (disp/total)×1000` → `Lookup dispensationBuckets`. `DecimalCalc` string-aman. Peringatan hanya untuk total-0.

## 9. Formula & Variables

Persis code: `ratio = round_half_up(disp/total×1000, 3)`; `deduction = bucket_match(ratio)`; `total_IKPA = round_half_up(Σ7_tertimbang − deduction, 2)`. Dashboard: `weighted_disp = −deduction`.

## 10. Threshold / Weight / Period / Rounding

- Bobot 0 (pengurang absolut, bukan %). Bucket di atas (batas inklusif; presisi 3 desimal menentukan tier).
- Periode: TW IV implisit via guard Okt–Des (tanpa filter tahun di engine — scoped FY).
- Rounding: rasio half-up 3; total half-up 2 (`fractionDigits`). Banner UI `toFixed(2)` atas tier salah.
- Nol: total 0 → 0 + warning (bukan incomplete; total tetap dihitung). disp 0 + total>0 → ratio 0 → tier 0.
- Rasio >9999 → fallback bucket max (1.00); disp>total → panel tolak, server terima (ratio >1000‰ → 1.00).

## 11. Calculation Examples (engine aktual)

### Normal Case — golden 0.75
24/5200 → ratio 4.615‰ ∈ [1,4.999] → `"0.75"` (`spm-dispensation.test.ts:21-33`; PRD:628 "dispensasi 4,62‰ → 0,75"). Total mis. 90.00 − 0.75 = 89.25.

### Boundary Case
1/10000 = 0.100‰ → `"0.50"`; 1/1000 = 1.000‰ → `"0.75"` (test `:35-58`). 0/100 → ratio 0 → `"0"`. 5/1000 = 5.000‰ → `"1.00"`.

### Edge/Invalid Case
(a) Kosong (0/0) → 0 + warning (bukan Estimasi; Dashboard tetap angka). (b) disp>total via server (5/3) → 1666‰ → 1.00 (panel tolak, server terima). (c) Banner vs engine: 1/100 (10‰) → banner 0.5 (≤50) vs engine 1.00 (≥5) — selisih 0.5 poin. (d) Non-Q4 via UI ditolak; via DB langsung (tak ada guard DB-level) ikut dihitung (guard hanya aplikasi).

## 12. Data Model & Persistence

`spm_q4{id, fiscalYearId, referenceNumber text, issuedAt date, isDispensasi bool default false, …}` + indeks. Tulis insert/update-toggle/soft-delete + audit; baca non-deleted per FY. Tanpa nominal/tanggal-bayar (cacah murni). Asumsi panel tak persist kecuali scenario (`simulation_overrides entityType=assumptions`).

## 13. API / Service

`spm-dispensation-service{fetchSpmDispensations,addSpmDispensasi,editSpmDispensasi,removeSpmDispensasi}` → `server/spm-dispensation.ts` (4 ServerFn + FY2026 + fallback) → domain + audit. Validator passthrough; Zod domain. Tanpa-DB: pola sukses-palsu (UNCERTAIN, konsisten modul lain).

## 14. End-to-End Data Flow

`drawer/toggle → service → ServerFn → scope+FY → Zod+isQ4 → tulis+audit → invalidate → loader → (a) tabel/banner-SALAH, (b) Dashboard → calculate.ts count (atau asumsi) → engine bucket → deduction → total/snapshot → baris pengurang + history/export.` Panel benar hanya di Simulasi/scenario.

## 15. Dashboard Integration — IMPLEMENTED (sumber sama)

Satu engine actual; baris ke-8 weight 0 + status `warning Pengurang / complete Tanpa pengurang`; rekomendasi engine tak ada khusus dispensasi (tak masuk 7 kunci rekomendasi — UNCERTAIN apakah dispensasi dapat rekomendasi; peta `RECOMMENDATION_ROUTES` tanpa `spm_dispensasi` → fallback `/operator/simulation`).

## 16. Reminder Integration — PARTIAL

Seed `spm_dispensation_q4` mandatory (`end_of_year_schedule`, lead 7–21, default `[21,14,7,3,1]`) → Reminder Center generik + skeleton. Tanpa strip/peringatan di halaman (bahkan banner salah tier); `nearestDeadline` hardcode Output. Risiko akhir tahun hanya terbaca via banner.

## 17. History Integration — IMPLEMENTED

`dispensationDeduction + ratio + trace + versi` per snapshot; Dashboard petakan ulang; compare History tampilkan baris pengurang negatif. Asumsi scenario tersimpan sebagai override-row.

## 18. Report/Export Integration — IMPLEMENTED

Sheet SPM Q4 mentah (nomor/tanggal/flag) + Ringkasan 8 + PDF berformula + agregat Admin; sanitasi; base64. Copy "7 indikator" sama. Angka PDF/XLSX ringkasan dari snapshot (benar) vs banner halaman (salah) — dua sumber berbeda.

## 19. Error Handling

Loader tanpa try/catch; mutasi → banner; non-Q4 → pesan FE + throw BE; hapus `confirm()`; tanpa-DB UNCERTAIN. `disp>total` server diam (panel cerewet, server permisif).

## 20. Edge Cases

- Q4 kosong → pengurang 0 (bukan Estimasi) — akhir tahun tanpa data = tanpa denda.
- Toggle tanpa jejak nilai (flag saja; audit before/after cukup).
- Duplikat nomor, tanggal 31-Des vs 1-Jan (batas `getMonth`), masa depan Okt–Des tahun berjalan (tak dicek) — semua ikut cacah.
- Rasio presisi 3-desimal di perbatasan tier (0.0095/0.0995/0.9995/4.9995).
- Panel `total 0 + disp>0` → pesan "isi total dulu" (valid, bukan error).

## 21. Mock/Hardcoded/Placeholder Findings (8)

1. HARDCODED: 5 bucket + rasio ×1000 + round 3 + total half-up 2 + seed lead/default.
2. SALAH: banner `≤50/≤100` (ganti bucket engine) — satu-satunya preview halaman yang divergen dari panel-nya sendiri.
3. HARDCODED: FY2026; default drawer 2026-11-15 + checked; header `Triwulan IV 2026` statis.
4. Dead-ish: nominal SPM (tak ada kolom — by design cacah, tetapi FSD sebut "permil terhadap SPM Q4" ambigu nilai-vs-cacah).
5. Tanpa strip/saran dispensasi (modul tanpa CORR-06).
6. Rekomendasi dispensasi UNCERTAIN (tak ada kunci di peta rute).
7. Tanpa-DB fallback UNCERTAIN; mock lama (verifikasi sisa bila perlu).
8. TODO implisit: selaraskan banner, tolak disp>total di server, unique nomor, guard DB-level Okt–Des, label "cacah bukan nilai".

## 22. Source Code Evidence

| Bagian | File → function/component → purpose |
|---|---|
| Kalkulasi | `packages/ikpa-engine/src/indicators/spm-dispensation.ts` → `calculateSpmDispensation` |
| Skema/aturan/orkestrator | `packages/ikpa-engine/src/schemas.ts:109-112`; `rule-set.ts:179-185`; `calculate.ts:75-92` |
| Mapping | `apps/web/src/server/simulation/calculate.ts:362-372` (+ asumsi `:300-301`) |
| Preview benar/salah | `lib/simulation/dispensasi-assumptions.ts:26-73` → `calcDispensasiPreview` (benar); `routes/operator/data/spm-dispensation.tsx:58-70` → banner (salah) |
| Panel | `components/operator/dispensasi-assumption-panel.tsx` |
| UI | `routes/operator/data/spm-dispensation.tsx:42-142,144-205` → toggle/drawer/tabel |
| Service/API/validasi | `services/spm-dispensation-service.ts`; `server/spm-dispensation.ts`; `server/domains/spm-dispensation.{queries,mutations}.ts:9-47` |
| DB | `packages/db/src/schema/spm-q4.ts` → `spm_q4` |
| Reminder seed | `packages/db/src/seed.ts:259-276` |
| Dashboard/History/Export | `server/dashboard.ts:179-194`, `dashboard.tsx`, `history.tsx`, `exports/*` |
| Test | `spm-dispensation.test.ts` (3: nol, golden 4.615→0.75, batas), `dispensasi-assumptions.test.ts` (11) |

## 23. Documentation Discrepancies

1. PRD:256 bucket vs code cocok, tetapi PRD:628 "4,62‰" vs test "4.615" (beda pembulatan narasi, hasil sama 0.75).
2. BACKLOG PRE-F13-05/07 klaim ringkasan-8 + panel-selesai — benar, tetapi banner halaman lolos dengan bucket salah (tak tercakup DoD).
3. BACKLOG F6-10/F9-08/F11-08 "ratio preview" — preview benar ada di panel, yang tampil di halaman justru yang salah.
4. FSD "permil terhadap SPM Q4" ambigu cacah-vs-nilai; code = cacah (perlu ketegasan reviewer).
5. `fitur.md` tetap tidak ada.

## 24. Implementation Gaps (6)

1. Banner halaman tier salah (0.5/0.75/1.0 atas 50/100) vs engine/panel — pengguna membaca denda yang salah hingga buka Dashboard.
2. Tanpa strip/saran risiko akhir tahun di halaman (padahal seed mandatory H-21…H-1).
3. Tanpa guard `disp≤total` di server; tanpa unique nomor; tanpa guard DB-level Q4.
4. Tanpa kolom nominal (tak bisa verifikasi "permil nilai" bila regulasi maksud nilai).
5. Rekomendasi dispensasi tak terpetakan (peta rute tanpa kunci) — fallback Simulasi generik.
6. Batas bulan naive + presisi tier 3-desimal tanpa dokumentasi UI.

## 25. Questions for AI Reviewer

1. Apakah `ratio = cacah_disp/cacah_Q4×1000 (round 3)`, bucket `0/0.01–0.099/0.1–0.999/1–4.999/≥5 → 0/0.25/0.50/0.75/1.00`, `total = Σ7 − deduction` sudah sesuai regulasi — khususnya cacah-vs-nilai dan batas inklusif + presisi?
2. Apakah banner halaman harus diselaraskan ke bucket engine sekarang (bug presentasi, bukan regulasi), dan angka mana yang menjadi rujukan audit sementara?
3. Apakah `disp>total`, duplikat nomor, non-Q4-langsung-DB, masa depan, dan batas-bulan-naive perlu ditolak sebelum go-live?
4. Apakah ketiadaan strip/saran + rekomendasi-tak-petakan + `nearestDeadline` hardcode memenuhi reminder risiko dispensasi mandatory?
5. Apakah Q4-kosong → 0 (bukan incomplete/Estimasi) dan Des-only-guard cukup, atau perlu jendela tanggal akhir-tahun resmi?
6. Apakah panel asumsi (benar) vs banner (salah) perlu digabungkan ke halaman ini agar pengguna tak harus ke Simulasi?
7. Apakah fallback `total 0 → 0 + warning` + rasio >9999 → max-bucket sudah tepat untuk audit?

---
*Berhenti di sini. Jangan lanjut ke indikator berikutnya tanpa perintah.*
