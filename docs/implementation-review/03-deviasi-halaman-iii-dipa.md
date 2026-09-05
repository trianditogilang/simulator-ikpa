# 03 — Deviasi Halaman III DIPA (bobot 15%)

**Anchor:** `00-system-overview.md`, `01-dashboard.md` | **Tanggal:** 2026-09-05
**Mode:** INSPECT → TRACE → DOCUMENT. Tanpa vonis regulasi, tanpa ubahan code/docs operasional.

## 1. Module Purpose

Menilai kesesuaian realisasi bulanan terhadap RPD Hal III DIPA per akun (51/52/53/57), tertimbang proporsi pagu, periode Jan–Nov. Dua permukaan: (a) halaman data `/operator/data/rpd-realization` (ubah aktual, juga dipakai Penyerapan), (b) workspace simulasi `/operator/deviasi` (CORR-03: aktual terkunci + rencana kuning sisa tahun + skor via engine). Tidak ada panel asumsi khusus (PRE-F13-07 hanya UP/TUP + Dispensasi).

## 2. Implementation Status

| Aspek | Status |
|---|---|
| CRUD RPD + Realisasi scoped + soft-delete + audit | IMPLEMENTED |
| Engine deviasi + bobot 15 + ambang 5 + Jan–Nov | IMPLEMENTED (linear apa adanya, §8) |
| Workspace `/operator/deviasi` (skor/aktual/delta/rata-rata + rencana) | IMPLEMENTED |
| Halaman data bulanan + status deviasi per akun | IMPLEMENTED (formula UI ≠ engine pada RPD=0, §10) |
| Dashboard 1 baris + rekomendasi | IMPLEMENTED |
| Riwayat perbandingan | IMPLEMENTED (via snapshot umum) |
| Export (sheet RPD/Realisasi + ringkasan) | IMPLEMENTED |
| Reminder khusus Pemutakhiran RPD | NOT IMPLEMENTED (tanpa policy seed; tanpa strip di halaman) |
| Kurva rule-set terkonfigurasi | NOT IMPLEMENTED (linear hardcode, tanpa tabel kurva) |
| Simpan skenario dari workspace | NOT IMPLEMENTED (hanya via Dashboard) |

## 3. Source Code Map

| Lapisan | File |
|---|---|
| Engine | `packages/ikpa-engine/src/indicators/rpd-deviation.ts` (`calculateRpdDeviation`) |
| Skema engine | `packages/ikpa-engine/src/schemas.ts:20-29` (`rpdDeviationMonthSchema` month 1–11, `rpdDeviationInputSchema`) |
| Aturan | `packages/ikpa-engine/src/rule-set.ts` (bobot `rpd_deviation:"15"`; **tanpa** field kurva deviasi; warning `DEV-004` linear-asumsi) |
| Mapping DB→Engine | `apps/web/src/server/simulation/calculate.ts:179-201,322-325` (11 bulan selalu, `budgetByType` = pagu tahunan) |
| Workspace lib | `apps/web/src/lib/simulation/deviasi-workspace.ts` (`buildDeviationInput`, `calcDeviasiScore`, `deviationOf`, `paguWeights`) + `deviasi-workspace.test.ts` (6 test) |
| Workspace UI | `apps/web/src/routes/operator/deviasi.tsx` (511 baris; loader gabung budget+RPD) |
| Data UI | `apps/web/src/routes/operator/data/rpd-realization.tsx` (628 baris; pills bulan dua-arah via ActiveContext) |
| Service | `apps/web/src/services/rpd-realization-service.ts` (`fetchRpdAndRealizations/saveRpdLine/saveRealization/batchSaveRpdRealization`), `services/budget-revisions-service.ts` (pagu) |
| ServerFn | `apps/web/src/server/rpd-realization.ts` (`listRpdAndRealizationFn`, `upsertRpdFn/RealizationFn`, `batchUpsertRpdRealizationFn`, FY auto-init 2026, fallback kosong) |
| Query/mutasi | `apps/web/src/server/domains/rpd-realization.queries.ts`, `rpd-realization.mutations.ts` (Zod + upsert + batch ≤100 + audit) |
| Schema DB | `packages/db/src/schema/rpd-realizations.ts` (`rpd_lines`, `realizations`) |
| Dashboard | `apps/web/src/server/dashboard.ts:135-168`, `routes/operator/dashboard.tsx:25-34` (`DEV_HAL_III → /operator/deviasi`) |
| Panduan/mock | `mocks/guides.ts:23-33` (g-02), `mocks/rpd-realization.ts` (dead mock), `mocks/operator-dashboard.ts:92-103` (contoh kartu) |
| Export | `apps/web/src/server/exports/operator-xlsx.ts` (sheet RPD/Realisasi + Ringkasan), `operator-pdf.tsx`, `admin-aggregate.ts` |

## 4. User Flow

**Halaman data** (`/operator/data/rpd-realization`): pills bulan (Jan–Des, dua-arah dengan dropdown header via `setPeriod`) → tabel 4 akun bulan terpilih (RPD, Realisasi, Deviasi%, Penyerapan%, status safe/warning/danger) + tombol Ubah per sel → drawer RPD / drawer Realisasi (select akun, select bulan, nominal) → save → `router.invalidate()` → link `Lihat skor Penyerapan →` ke workspace. Ringkasan total bulan + `avgMonthDev` tampil (formula total, bukan engine).
**Workspace** (`/operator/deviasi`): header + `?` dialog rumus → 4 kartu (Skor indikator, Skor aktual, Dampak rencana, Rata-rata deviasi) → section aktual terkunci Jan–s.d. bulan berjalan (tabel deviasi per akun + 🔒 + tooltip nominal + proporsi pagu) + link `Ubah aktual` → section rencana kuning sisa tahun (per bulan × 4 akun × 2 input RPD/Real, Reset bila ada) → catatan kuning-tak-timpa-DB + Des-tak-dihitung + link Pagu. Tanpa tombol simpan (skor hanya di halaman ini).
Empty/error: tanpa pagu → banner `Belum ada pagu` + link; Nov/Des → `planMonths` kosong + pesan; gagal loader → boundary; mutasi gagal → banner merah; sukses → hijau 4 dtk.

## 5. Input Inventory

| Input | Type | Required | Default | Validation | Source | Digunakan Calculation? |
|---|---|---|---|---|---|---|
| RPD bulan/akun | numeric string | Ya (bila isi) | `"0"` bila absen | FE `parseFloat\|\|0`+`toFixed(2)`; BE decimal 18,2, month 1–12, enum akun | drawer RPD / batch | YA (`planned`) |
| Realisasi bulan/akun | numeric string | Ya (bila isi) | `"0"` | sama | drawer Realisasi / batch | YA (`realized`) |
| Pagu akun 51–57 | numeric string | Ya (bila isi) | `"0"` | budget-revisions Zod |悬 `budget-revisions` | YA (hanya bobot proporsi, bukan target) |
| Rencana RPD sisa tahun | numeric string | Tidak | kosong→0 | `Number>0?raw:0`, bulan 1–11, akun valid | sel kuning workspace | YA (halaman ini saja, tak persist) |
| Rencana Realisasi sisa | numeric string | Tidak | kosong→0 | sama | sel kuning workspace | YA (sama) |
| Bulan terpilih | month 1–12 | — | konteks/sistem | ActiveContext | pills/header | YA (batas aktual vs rencana di workspace; Des=12 tak bangun bulan) |
| `search`/filter tabel | text | Tidak | — | client | toolbar | TIDAK |

## 6. Validation Rules

- Backend (`rpd-realization.mutations.ts:9-34`): `dec182` regex (izinkan negatif), `month int 1–12` (12 diterima walau engine abaikan), `accountCode enum 51/52/53/57`, batch `rows 1–100` + `target rpd|realization`. Upsert unik (FY,month,akun) + soft-delete + `writeAudit`. Scope FY milik org.
- Frontend: `parseFloat||0` (non-numerik → 0 diam-diam), negatif lolos, bulan 12 bisa disimpan (orphan deviasi).
- Workspace: kunci rencana bulan 1–11; Desember tak ada input; nilai kosong dihapus dari state (→0 saat bangun input).

## 7. Business Rules

**Rule ID:** DEV-BR-001 — Periode Jan–Nov, Desember abaikan
Trigger: engine + workspace. Condition: `if (monthData.month>11) continue` (`rpd-deviation.ts:62`); workspace loop `m=1..11` (`deviasi-workspace.ts:40`); rencana kunci `month>11` dibuang. Output: Des tak pengaruhi skor walau tersimpan. Ref terkait.

**Rule ID:** DEV-BR-002 — Deviasi per akun + cap 100
Trigger: tiap (bulan,akun). Condition: `planned==0 ? (realized==0?0:100) : |planned-realized|/planned×100`, lalu `min(dev,100)` (`rpd-deviation.ts:73-79`; replika `deviationOf`, `deviasi-workspace.ts:78-81`). Output: `dev_51…57` 2 desimal di trace.

**Rule ID:** DEV-BR-003 — Bobot proporsi pagu tahunan
Processing: `weight_acc = pagu_acc/totalPagu`; `monthDev = Σ(dev_acc×weight_acc)` (`rpd-deviation.ts:81-83`). Pagu = nilai `budgets` tahunan penuh (sumber sama dengan Penyerapan; Netto vs blokir tidak dibedakan di code). Output: jejak `Deviasi Bulan N`.

**Rule ID:** DEV-BR-004 — Rata-rata + skor linear
Processing: `avg = ΣmonthDev/monthsProcessed`; `score = avg≤5 ? 100 : max(0,100-avg)` (`rpd-deviation.ts:115-134`). Tanpa tabel kurva. Ref: dialog workspace (:264-271) nyatakan rumus sama.

**Rule ID:** DEV-BR-005 — Incomplete
Condition: `months` kosong, `totalBudget==0` (+warning EN), `monthsProcessed==0` → null/incomplete; `monthsProcessed<11` → skor valid tetapi `status:"incomplete"` (`rpd-deviation.ts:23-34,42-56,102-113,167`). Praktik server: selalu kirim 11 bulan → status complete kecuali pagu 0.

**Rule ID:** DEV-BR-006 — Aktual vs rencana (workspace only)
Processing: `m≤cur→DB`, `m>cur→rencana`, aktual tak termutasi (snapshot test(Char) di `deviasi-workspace.test.ts:26-35`). Output: `score` (gabung) vs `actualScore` (tanpa rencana) vs `planDelta`.

**Rule ID:** DEV-BR-007 — Status UI halaman data (bukan engine)
Condition: `dev>10→danger`, `>5→warning`, else `safe` (`rpd-realization.tsx:114-116`); `dev = rpd>0 ? |real-rpd|/rpd×100 : 0` (:110-111) — beda dari engine pada RPD=0 (UI 0, engine 100 bila real>0).

## 8. Calculation Logic

Input (`schemas.ts:20-29`): `months[{month 1–11, planned{51…57}, realized{…}}]`, `budgetByType{51…57}` (decimal string). Server bangun 11 entri selalu (nol bila absen) + pagu tahunan (`calculate.ts:179-211,322-325`). Jejak: 11× `Deviasi Bulan N "Sum(Deviasi Akun×(Pagu Akun/Total Pagu))"` + `Rata-rata "Sum/Jumlah Bulan"` + `Nilai "deviasi≤5%?100:100-deviasi"` + `Nilai Tertimbang "Nilai×Bobot"`.

## 9. Formula & Variables

Persis code: `dev_acc = planned==0 ? (realized==0?0:100) : min(100,|planned-realized|/planned×100)`; `monthDev = Σ dev_acc×(pagu_acc/Σpagu)`; `avg = ΣmonthDev/n`; `score = avg≤5?100:max(0,100-avg)`; `weighted = score×15/100`. Variabel tampil 2 desimal (`fractionDigits=2`); komputasi internal float JS (`parseFloat`), bukan desimal presisi.

## 10. Threshold / Weight / Period / Rounding

- Bobot `15`. Ambang `5` (inklusif →100). Cap deviasi akun 100; floor skor 0. Tanpa cap atas selain 100.
- Periode Jan–Nov; Des hard-exclude; pembagi = bulan dalam input (server 11 selalu; workspace 11 selalu termasuk bulan-nol) — bukan hanya bulan terisi.
- Rounding: `toFixed(2)` di trace/skor/weighted; `DecimalCalc` tidak dipakai di indikator ini (float biasa). Kontribusi akhir dibulatkan lagi di orkestrator.
- Nol: RPD 0 + Real 0 → 0 (baik); RPD 0 + Real>0 → 100 (buruk, cap). Total pagu 0 → incomplete + warning Inggris (satu-satunya warning EN di engine revisi/deviasi).
- Bulan 12 tersimpan tetapi tak pernah dibaca deviasi (masih dibaca Penyerapan TW4).

## 11. Calculation Examples (engine aktual, bobot 15)

### Normal Case — di bawah ambang → 100
Input (test emas): pagu 51=100,52=100; Jan RPD 100/100, Real 98/97 → dev 2.0 & 3.0 → month 2.5 → avg 2.5 ≤5 → `score "100.00"`, `weighted "15.00"`, status `incomplete` bila hanya 1 bulan di input (test `rpd-deviation.test.ts:6-22`). Via server (11 bulan, 10 bulan nol) avg = 2.5/11 ≈ 0.23 → tetap 100.

### Boundary Case — tepat/lewat ambang
Avg tepat 5 → 100. Avg 50 (RPD 100→Real 50 semua akun): `score = 100-50 = "50.00"`, weighted 7.50 (test `:24-40`). Nol-denominator: RPD semua 0, Real 51=10 → dev 100×bobot 0.5 → avg 50 → skor 50 (test `:42-60`).

### Edge/Invalid Case
(a) Pagu total 0 → `{score:null, incomplete}` + warning EN → Dashboard Estimasi 0. (b) DB kosong via server: 11 bulan 0/0 + pagu 0 → (a); bila pagu ada + RPD/Real kosong → semua dev 0 → avg 0 → skor 100 complete (data kosong = sempurna). (c) RPD=0,Real=500 → dev 100 (cap; tanpa cap akan 500). (d) Bulan 12 terisi → diabaikan. (e) Negatif `-100` lolos validasi → `|−100−0|/−100` negatif → dev negatif (tak di-clamp bawah!) — perilaku tak terdefinisi, butuh putusan reviewer.

## 12. Data Model & Persistence

`tabel rpd_lines{id, fiscalYearId, month smallint, accountCode, amount numeric(18,2), createdBy, deletedAt…}` + `realizations(idem)` + indeks (FY), (month,account), deletedAt. Upsert per (FY,month,akun); batch ≤100 per target; soft-delete; audit `rpd_lines/realizations`. Rencana workspace tidak persist (state React `planRpd/planReal` key `"m:acc"`). Pagu persist di `budgets` (dokumen 02).

## 13. API / Service

`rpd-realization-service.ts` → `server/rpd-realization.ts`: `listRpdAndRealizationFn(GET)` (fallback tanpa-DB = `{rpdLines:[],realizations:[]}` — kosong, bukan demo), `upsertRpdFn/upsertRealizationFn`, `batchUpsertRpdRealizationFn`. Workspace `deviasi.tsx:30-33` panggil `fetchBudgetAndRevisions + fetchRpdAndRealizations` paralel. Mutasi tanpa-DB: cek pola budget (kemungkinan sukses-palsu, verifikasi di deep-inspection RPD bila perlu — UNCERTAIN).

## 14. End-to-End Data Flow

`drawer pills (RPD/Real) → service → ServerFn → scope+FY2026 → Zod → upsert+audit → invalidate → loader → (a) tabel aktual, (b) workspace aktual-terkunci + rencana-lokal → buildDeviationInput(11 bln) → calculateRpdDeviation(default2026RuleSet) → kartu skor. Terpisah: Dashboard load → calculate.ts bangun 11 bln dari DB (nol-default) → engine sama → total/snapshot → kartu DEV_HAL_III + rekomendasi + history/export.` Rencana workspace tidak mengalir ke Dashboard/History/DB.

## 15. Dashboard Integration — IMPLEMENTED (sumber sama, periode beda)

`calculateAndPersistSnapshot(actual, periodMonth default 8)` memakai mapping §8 yang sama; petakan `dashboard.ts:135-168` (threshold 90/75, `deltaPoints:0`, rute `/operator/deviasi`). Rekomendasi engine `Sesuaikan Deviasi RPD` (deep-link `rpd-realization`) dipetakan ulang dashboard ke `/operator/deviasi`. Periode: Dashboard selalu bulan 8 (tanpa baca konteks) sedangkan workspace baca periode global — angka bisa beda walau rumus sama (bukan bug rumus, beda input).

## 16. Reminder Integration — NOT IMPLEMENTED

PRD:260 baris `Pemutakhiran RPD | Recommended | H-10,H-3 | H-1..20` — tetapi `seed.ts` hanya 5 policy (dipa, tagihan, UP/TUP, output, dispensasi): tanpa policy `rpd_deviation`. Akibat: Reminder Center tak punya event RPD; halaman data/workspace tanpa strip/peringatan (CORR-06 hanya Tagihan/Output); `nearestDeadline` Dashboard hardcode Output. Status kebijakan: kebutuhan terdaftar di PRD, tak ada di DB seed maupun UI.

## 17. History Integration — IMPLEMENTED

Snapshot `breakdownJson.indicators[rpd_deviation]` + trace + `ruleSetVersion` tersimpan tiap Dashboard load; `history.tsx:28-51` bandingkan kontribusi deviasi 2 snapshot. Rencana workspace tak tersimpan (kecuali user tekan Simpan skenario di Dashboard — itu menyimpan hasil DB aktual, bukan rencana kuning).

## 18. Report/Export Integration — IMPLEMENTED

Sheet mentah RPD + Realisasi + (PRE-F13-05) Ringkasan 8 + PDF + agregat Admin membaca tabel scoped yang sama + snapshot; sanitasi injeksi; base64 terautentikasi. Copy `reports.tsx:52` masih "7 indikator" (discrepancy copy, angka sudah 8).

## 19. Error Handling

Loader tanpa try/catch (dua fetch paralel — satu gagal → halaman gagal). Mutasi → banner merah/hijau. `toMonthly` buang akun/bulan di luar domain diam-diam. `parseAmount` ubah korup → 0. Total pagu 0 → engine warning EN mentah (bocor ke `warnings[]` snapshot). Tanpa-DB = data kosong (bukan error) → banner `Belum ada pagu`.

## 20. Edge Cases

- Pagu parsial (mis. hanya 51): bobot akun lain 0 — deviasi akun tanpa pagu tak berpengaruh walau RPD/Real besar.
- RPD 0 + Real>0: engine 100 vs UI-tabel 0 (divergensi tampil).
- Negatif: lolos regex → deviasi negatif menekan avg (memperbaiki skor secara artifisial).
- Bulan 12: bisa diinput, tak dipakai deviasi (dipakai Penyerapan) — user mengira memengaruhi deviasi.
- Masa depan/tahun-lain: tanpa validasi tanggal (hanya month int) — bulan 1–11 apa pun ikut warm-up avg 11.
- `monthsProcessed<11 → incomplete` tak terjangkau via server (selalu 11) — status parsial hanya via panggilan engine langsung/workspace slice test.
- Rencana negatif/dihapus → 0 (bukan "kembali ke aktual").

## 21. Mock/Hardcoded/Placeholder Findings (9)

1. HARDCODED: bobot 15, ambang 5, formula linear `100-avg`, periode 11, exclude-12 (tanpa tabel kurva di `RuleSetConfig`).
2. HARDCODED: FY 2026 auto-init ×3; fallback tanpa-DB kosong (`rpdLines:[]`) — beda dari budget (demo rows).
3. DEAD mock: `mocks/rpd-realization.ts` tak diimpor halaman (ciri F3-10).
4. PLACEHOLDER: `batchSaveRpdRealization` ada di service/server tetapi pemakaian UI tak terverifikasi di trace ini (UNCERTAIN — butuh cek tombol batch di sisa `rpd-realization.tsx:240-628`).
5. DIVERGENSI: status UI-tabel (5/10) vs skor engine (ambang 5) vs status engine (`<11→incomplete`).
6. WARNING EN mentah `Total budget is zero…` + asumsi `DEV-004` selalu menempel di trace.
7. HARDCODED dialog: `÷11 bulan`, `Pagu Netto`, `Des tak dihitung`, `bobot 15%`, `Ambang 5%`.
8. Link `Lihat skor Penyerapan` + `Ubah aktual` + `Pagu & Revisi` hardcode route.
9. TODO implisit: tanpa simpan-rencana, tanpa strip reminder RPD, tanpa breakdown per-akun di Dashboard, tanpa validasi tolak negatif/bulan-12-untuk-deviasi.

## 22. Source Code Evidence

| Bagian | File → function/component → purpose |
|---|---|
| Kalkulasi | `packages/ikpa-engine/src/indicators/rpd-deviation.ts` → `calculateRpdDeviation` → deviasi/bobot/avg/skor |
| Skema | `packages/ikpa-engine/src/schemas.ts:20-29` → month 1–11 + budgetByType |
| Aturan | `packages/ikpa-engine/src/rule-set.ts` → bobot 15 + `DEV-004` (tanpa kurva) |
| Mapping | `apps/web/src/server/simulation/calculate.ts:179-201,322-325` → 11 bulan + pagu tahunan |
| Workspace lib | `apps/web/src/lib/simulation/deviasi-workspace.ts` → `buildDeviationInput/calcDeviasiScore/deviationOf/paguWeights` |
| Workspace UI | `apps/web/src/routes/operator/deviasi.tsx` → `DeviasiPage/toMonthly/planMonths/actualMonths/monthRows` |
| Data UI | `apps/web/src/routes/operator/data/rpd-realization.tsx:74-129,142-196` → pills, deviasi UI, save handler |
| Service/API | `apps/web/src/services/rpd-realization-service.ts` → 4 fn; `apps/web/src/server/rpd-realization.ts` → 4 ServerFn |
| Validasi/persist | `apps/web/src/server/domains/rpd-realization.mutations.ts` → Zod + upsert + batch + audit; `.queries.ts` → scoped read |
| DB | `packages/db/src/schema/rpd-realizations.ts` → `rpd_lines/realizations` |
| Dashboard | `apps/web/src/server/dashboard.ts` + `routes/operator/dashboard.tsx:25-34` |
| History/Export | `apps/web/src/routes/operator/history.tsx:28-51`; `apps/web/src/server/exports/operator-xlsx.ts` |
| Test | `packages/ikpa-engine/src/indicators/rpd-deviation.test.ts` (3), `deviasi-workspace.test.ts` (6) |

## 23. Documentation Discrepancies

1. PRD:250/FSD: kurva deviasi "dibaca dari rule set" + PRD:642 "kurva di atas 5% belum tervalidasi" — code tanpa field kurva (linear hardcode + `DEV-004`), sehingga klaim "rule set versioned" untuk kurva ini tak terpenuhi.
2. PRD:260 event Pemutakhiran RPD (Recommended H-10/H-3) vs seed 5 policy tanpa RPD — BACKLOG F7-16/F10 klaim selesai tetapi event ini absen.
3. BACKLOG F11-04 "deviasi tertimbang bekerja" — benar untuk engine, tetapi angka deviasi di tabel halaman (`rpd>0?…:0`) ≠ engine (RPD=0→100).
4. Panduan `guides.ts g-02` ("kurva linier turun") kebetulan cocok linear engine, tetapi regulasi vs `DEV-004` masih needs_verification — jangan dibaca sebagai final.
5. `fitur.md` tetap tidak ada (catatan 00).

## 24. Implementation Gaps (7)

1. Tanpa tabel kurva deviasi terkonfigurasi (linear `100-avg` kaku; denda proporsional penuh tanpa lantai bertingkat).
2. Tanpa reminder/event RPD (seed + UI + strip kosong) padahal PRD minta H-10/H-3.
3. Rencana workspace tak tersimpan/tak terbawa ke Dashboard/History (simulasi menguap saat pindah halaman).
4. Bulan 12 dapat diinput tetapi diam-diam tak dipakai deviasi (membingungkan; tak ada peringatan).
5. Negatif lolos → deviasi negatif/tak-terdefinisi; RPD=0 divergen UI vs engine.
6. Data kosong + pagu ada → skor 100 "sempurna" (nol/nol = baik); pagu 0 → incomplete → Dashboard Estimasi 0 (dua "kosong" berlawanan arti).
7. Periode Dashboard (default 8) ≠ periode workspace (global) — angka sama-rumus beda-input tanpa penjelasan di UI.

## 25. Questions for AI Reviewer

1. Apakah `dev=|R−P|/P×100 (cap 100; P=0&R=0→0; P=0&R>0→100)`, `monthDev=Σ dev×pagu/Σ pagu`, `avg=Σ/11 (Jan–Nov, Des buang, bulan-kosong=0)`, `skor=avg≤5?100:max(0,100−avg)`, bobot 15, `toFixed(2)` sudah sesuai regulasi — khususnya linear penuh vs kurva bertingkat dan pembagi 11-selalu vs bulan-berjalan?
2. Apakah pagu tahunan penuh sebagai penimbang (akun tanpa pagu = bobot 0) dan "kosong=0=baik" dapat diterima, serta bagaimana perlakuan akun 57 dan pagu Netto vs blokir?
3. Mana yang benar untuk RPD=0: engine (100 bila real>0) atau tabel UI (0) — dan apakah negatif harus ditolak?
4. Apakah bulan 12 memang dikecualikan total, dan haruskah input bulan 12 dilarang/diingatkan di halaman RPD?
5. Apakah ketiadaan policy/trigger/strip Pemutakhiran RPD (H-10/H-3, H-1..20) memblokir go-live mengingat PRD menandainya Recommended?
6. Apakah status `incomplete` untuk input parsial (`<11 bulan`) dengan skor valid sudah tepat, dan bolehkah Dashboard menampilkan Estimasi-0 sementara workspace menampilkan skor parsial?
7. Apakah rencana kuning yang menguap + periode Dashboard-vs-workspace yang berbeda memerlukan tombol "Simpan rencana Deviasi" / penyelarasan periode sebelum audit nilai?

---
*Berhenti di sini. Jangan lanjut ke Penyerapan tanpa perintah.*
