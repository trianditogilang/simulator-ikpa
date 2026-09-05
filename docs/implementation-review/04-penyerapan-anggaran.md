# 04 — Penyerapan Anggaran (bobot 20%)

**Anchor:** `00-system-overview.md`, `01-dashboard.md` | **Tanggal:** 2026-09-05
**Mode:** INSPECT → TRACE → DOCUMENT. Tanpa vonis regulasi, tanpa ubahan code/docs operasional.
**Catatan instruksi:** perintah menyebut "Deviasi" tetapi file diminta `04-penyerapan-anggaran.md` — dokumen ini memeriksa **Penyerapan Anggaran** sesuai nama file (Deviasi sudah di `03`).

## 1. Module Purpose

Menilai proporsi realisasi kumulatif per triwulan terhadap pagu tahunan per akun (51/52/53/57) terhadap target triwulanan rule set. Dua permukaan berbagi tabel `realizations`: (a) halaman data `/operator/data/rpd-realization` (ubah aktual RPD+Realisasi), (b) workspace `/operator/penyerapan` (CORR-02: aktual YTD terkunci + rencana kuning sisa tahun + skor via engine + banner BLU). RPD tidak dipakai skor penyerapan (hanya realisasi + pagu).

## 2. Implementation Status

| Aspek | Status |
|---|---|
| CRUD Realisasi (+RPD berbagi halaman) scoped + audit | IMPLEMENTED |
| Engine penyerapan (target/TW/cap/rata-rata/bobot 20) | IMPLEMENTED |
| Workspace `/operator/penyerapan` (skor/aktual/delta/gap + rencana) | IMPLEMENTED |
| Pengecualian BLU = 100 warning | IMPLEMENTED |
| Dashboard 1 baris + rekomendasi | IMPLEMENTED |
| Riwayat perbandingan | IMPLEMENTED (via snapshot umum) |
| Export (sheet Realisasi + ringkasan) | IMPLEMENTED |
| Reminder khusus gap penyerapan | NOT IMPLEMENTED (tanpa policy seed; tanpa strip) |
| Simpan skenario dari workspace | NOT IMPLEMENTED (hanya via Dashboard) |

## 3. Source Code Map

| Lapisan | File |
|---|---|
| Engine | `packages/ikpa-engine/src/indicators/absorption.ts` (`calculateAbsorption`) |
| Skema engine | `packages/ikpa-engine/src/schemas.ts:31-39` (`absorptionQuarterSchema` quarter 1–4, `absorptionInputSchema`) |
| Aturan/target | `packages/ikpa-engine/src/rule-set.ts:157-166,186-191` (bobot 20; target 51:20/50/75/95, 52:15/50/70/90, 53:10/40/70/90, 57:25/50/75/95; warning `ABS-006`) |
| Mapping DB→Engine | `apps/web/src/server/simulation/calculate.ts:203-242,326` (realisasi Σ3 bulan/TW; budget tahunan penuh per TW) |
| Workspace lib | `apps/web/src/lib/simulation/penyerapan-workspace.ts` (`buildAbsorptionQuarters`, `calcPenyerapanScore`, `accountQuarterScore`, `quarterTarget`, `quarterOfMonth`, `QUARTER_MONTHS`) + test 7 |
| Workspace UI | `apps/web/src/routes/operator/penyerapan.tsx` (488 baris; loader budget+RPD+settings.isBlu) |
| Data UI | `apps/web/src/routes/operator/data/rpd-realization.tsx` (drawers + pills bulan + link ke workspace) |
| Service/API | `services/rpd-realization-service.ts`, `services/budget-revisions-service.ts`, `services/settings-service.ts`; `server/rpd-realization.ts`, `server/domains/rpd-realization.*`, `server/domains/settings.*` |
| Schema DB | `packages/db/src/schema/rpd-realizations.ts` (`realizations`), `budget-revisions.ts` (`budgets`), `identity.ts`/`fiscal-years.ts` (`organizations.isBlu`) |
| Dashboard | `apps/web/src/server/dashboard.ts`, `routes/operator/dashboard.tsx:25-34` (`PENYERAPAN → /operator/penyerapan`) |
| Panduan/mock | `mocks/guides.ts` g-03, `mocks/analysis.ts`, `mocks/operator-dashboard.ts` (contoh kartu) |

## 4. User Flow

**Halaman data:** pills bulan dua-arah → tabel 4 akun (RPD/Real/Deviasi/Penyerapan%) → drawer tambah/ubah RPD atau Realisasi (akun+bulan+nominal) → save → invalidate → link `Lihat skor Penyerapan →`.
**Workspace:** header + `?` dialog (target Rp, PA, TW, rata-rata, target 2026, aktual-tak-tertimpa) → banner BLU bila `isBlu` → banner tanpa-pagu bila perlu → 4 kartu (Skor indikator, Skor aktual, Dampak rencana, Gap ke 100) → tabel aktual terkunci per akun (Pagu Netto, Realisasi s.d. bulan berjalan 🔒, Target TW berjalan, PA TW berjalan) + `Ubah aktual` → tabel rencana kuning sisa bulan (bulan × 4 akun, Reset) → catatan pola-Excel + link Pagu. Tanpa tombol simpan.

## 5. Input Inventory

| Input | Type | Required | Default | Validation | Source | Digunakan Calculation? |
|---|---|---|---|---|---|---|
| Realisasi bulan/akun | numeric string | Ya (bila isi) | 0 bila absen | FE `parseFloat\|\|0`+`toFixed(2)`; BE decimal 18,2, month 1–12, enum | drawer/batch + loader | YA (Σ per TW) |
| Pagu akun 51–57 | numeric string | Ya (bila isi) | 0 | budget Zod | `budget-revisions` | YA (denominator + penimbang TW) |
| Rencana bulan/akun sisa tahun | numeric string | Tidak | kosong→0 | `>0?raw:0`, bulan 1–12 | sel kuning | YA (halaman ini saja) |
| `isBlu` | boolean | — | false (catch→false) | settings Zod | `organizations.isBlu` via settings-service | YA (short-circuit 100) |
| RPD | numeric | — | — | — | halaman sama | TIDAK untuk penyerapan |
| Bulan berjalan | month | — | konteks/sistem | ActiveContext | header/pills | YA (batas aktual vs rencana; Des → plan kosong) |

## 6. Validation Rules

Sama dengan Deviasi untuk realisasi (decimal 18,2 izinkan negatif; month 1–12; enum akun; batch ≤100; scope FY; audit). Workspace: rencana `>0` else 0 (negatif/kosong → 0, bukan tolak). `isBlu` gagal fetch → `false` diam-diam (catch di loader :39-44).

## 7. Business Rules

**Rule ID:** PEN-BR-001 — Agregat TW kumulatif dari realisasi bulanan
Trigger: server + workspace. Processing server: per TW jumlah `realRows` 3 bulan (`calculate.ts:213-242`); workspace: `m≤cur→actual else plan`, Σ per TW (`penyerapan-workspace.ts:40-64`). Pagu = tahunan penuh tiap TW (bukan prorata). Ref terkait.

**Rule ID:** PEN-BR-002 — Skor akun per TW + cap 100
Processing: `pct=(realized/budget)×100`; `scoreAcc=(pct/target)×100`, `min(>,100)` (`absorption.ts:86-88`); akun `budget≤0` dilewati (tak bobot). Ref.

**Rule ID:** PEN-BR-003 — Skor TW tertimbang pagu
Processing: `qScore=Σ(scoreAcc×budget)/Σbudget` TW (`absorption.ts:107-122`); TW tanpa pagu → dilewati (`validQuartersCount` tak tambah).

**Rule ID:** PEN-BR-004 — Skor indikator = rata-rata 4 TW
Processing: `final=ΣqScore/validCount`, `round(>,2)` (`absorption.ts:125-139`); TW masa depan (realisasi 0) ikut menekan rata-rata. `weighted=final×20/100`.

**Rule ID:** PEN-BR-005 — BLU dikecualikan
Condition: `isBlu==true` → `{score:"100", weighted:20, status:"warning"}` + `ABS-008` (`absorption.ts:21-45`). Banner workspace (:255-260).

**Rule ID:** PEN-BR-006 — Kosong
Condition: `quarters.length==0` → `{score:"0", incomplete}` + warning ID (`absorption.ts:47-58`). Praktik: server/workspace selalu kirim 4 TW → tak terjangkau; DB kosong → 4 TW nol → skor 0 complete (bukan incomplete).

**Rule ID:** PEN-BR-007 — Tampilan aktual workspace
`qtd` = Σ aktual s.d. bulan berjalan dalam TW berjalan; `pa=accountQuarterScore(qtd,pagu,target)` (0 bila salah satu ≤0) — replika engine untuk tabel, bukan skor final.

## 8. Calculation Logic

Input (`schemas.ts:31-39`): `quarters[{quarter 1–4, realized{51…57}, budget{…}}]` + `isBlu` argumen terpisah. Jejak: `Mulai TWn` + per akun `Min(100,(realized/budget)×100/target×100)` + `Nilai Akhir TWn` + `Nilai Penyerapan (Rata-rata)`. Warning `ABS-006` selalu ditempel bila ada di config.

## 9. Formula & Variables

Persis code: `pct_acc = realized/budget×100`; `scoreAcc = min(100, pct_acc/target_acc,q×100)`; `qScore = Σ(scoreAcc×budget_acc)/Σbudget_acc`; `final = (ΣqScore)/n_valid`; `weighted = final×parseFloat(weights.budget_absorption)/100`. Util `parseDecimal/round/mul/div` (`utils.ts`), `round()` = half-up `toFixed`.

## 10. Threshold / Weight / Period / Rounding

- Bobot `20`. Target default (`rule-set.ts:186-191`): 51:20/50/75/95; 52:15/50/70/90; 53:10/40/70/90; 57:25/50/75/95 (Sheet1 manual TW1=100 diabaikan — Devlog S99).
- Periode triwulanan kumulatif Jan–Mar/Apr–Jun/Jul–Sep/Okt–Des; denominator selalu pagu tahunan (bukan pagu TW). Cap akun 100; tanpa floor selain 0 implisit; rata-rata tanpa bobot antar-TW (TW kecil = TW besar).
- Rounding: per akun `round(4)`, final `round(2)`, weighted `round(2 default)`.
- Nol: budget 0 → akun dilewati; realized 0 → `accountQuarterScore` UI 0; engine `pct=0 → scoreAcc=0`. Semua TW nol → final 0.
- Negatif lolos → `pct` negatif → `scoreAcc` negatif menekan TW (tak di-clamp bawah per akun; final bisa negatif? `round` tak clamp — UNCERTAIN, butuh uji).

## 11. Calculation Examples (engine aktual, target 2026)

### Normal Case — golden 92.67
Q1: pagu 51=1000/52=1000; real 51=200 (20%→100), 52=128.01 (12.801%→85.34) → qScore=(100×1000+85.34×1000)/2000=92.67 → final (1 TW valid) `92.67`, weighted 18.53 (test `absorption.test.ts:17-42`; PRD:628 "penyerapan Q1 92,67").

### Boundary Case — cap 100
Q1 51: real 300/pagu 1000 = 30% > target 20 → `min(100,150)=100` → skor `"100.00"` (test `:44-69`). Campuran S99: Q1=50 + Q2..Q4=0 → final 12.5 (rata-rata 4 TW termasuk masa depan nol).

### Edge/Invalid Case
(a) Full-target (200/500/750/950 atas pagu 1000 per TW berjalan) → 100 + kontribusi 20 (workspace test `:63-73`). (b) DB kosong → 4 TW 0 → skor 0 complete (Dashboard tampil 0, bukan Estimasi — beda dari deviasi-pagu-0). (c) `quarters=[]` langsung → skor 0 incomplete (hanya unit test). (d) BLU true → 100 warning walau realisasi 0. (e) Rencana workspace hanya lokal: actualScore vs score → `planDelta`; Desember → plan kosong → skor = aktual.

## 12. Data Model & Persistence

`realizations{id, fiscalYearId, month, accountCode, amount numeric(18,2), …}` (+ indeks) dibaca sebagai Σ TW; `budgets` sebagai denominator/penimbang; `organizations.isBlu` via settings. Tulis via upsert/batch + audit; rencana workspace tak persist. Periode snapshot `periodEnd YYYY-MM-01` dari Dashboard (default bulan 8).

## 13. API / Service

`rpd-realization-service` (fetch/save/batch) + `budget-revisions-service` (pagu) + `settings-service.fetchSatkerSettings` (isBlu) → `server/rpd-realization.ts` + `domains/*` + `domains/settings.*`. Workspace loader 3 sumber paralel (budget, RPD, settings). Tanpa-DB: RPD/real kosong; settings catch → isBlu false.

## 14. End-to-End Data Flow

`drawer/batch (realisasi, pagu, BLU di settings) → service → ServerFn → scope+FY2026 → Zod → upsert+audit → invalidate → loader → (a) tabel, (b) workspace aktual+rencana-lokal → buildAbsorptionQuarters(4 TW) → calculateAbsorption(default2026RuleSet) → kartu. Terpisah: Dashboard → calculate.ts Σ-TW dari DB → engine (rule published) → total/snapshot → kartu PENYERAPAN + rekomendasi + history/export.` Rencana kuning tak mengalir ke mana pun selain kartu halaman.

## 15. Dashboard Integration — IMPLEMENTED (sumber sama, periode default)

Satu engine via `calculateAndPersistSnapshot(actual, default month 8)`; petakan threshold 90/75; rute `PENYERAPAN→/operator/penyerapan`. Rekomendasi `Percepat Penyerapan Anggaran` (deep-link engine `rpd-realization` vs dashboard `/operator/penyerapan` — beda seperti deviasi).

## 16. Reminder Integration — NOT IMPLEMENTED

PRD:261 `Gap target penyerapan | Recommended | H-14,H-7 | H-1..30` — seed 5 policy tanpa `budget_absorption`. Tanpa strip/peringatan di workspace/halaman; deadline Dashboard hardcode Output. Rekomendasi engine generik (`Tingkatkan penyerapan…`) satu-satunya sinyal.

## 17. History Integration — IMPLEMENTED

`breakdownJson.indicators[budget_absorption]` + trace per TW/akun + versi rule tersimpan tiap load Dashboard; compare 2 snapshot di History. Rencana workspace tak tersimpan.

## 18. Report/Export Integration — IMPLEMENTED

Sheet Realisasi (+Pagu) mentah + Ringkasan 8 + PDF + agregat Admin dari tabel/snapshot scoped; sanitasi; base64. Copy "7 indikator" sama seperti modul lain (discrepancy copy).

## 19. Error Handling

Loader tanpa try/catch kecuali settings (isBlu fallback false). Mutasi → banner. `parseAmount` korup→0. Tanpa pagu → banner + skor (TW tanpa pagu dilewati; semua nol → 0). BLU → banner + 100.

## 20. Edge Cases

- TW depan nol menekan rata-rata (tengah tahun tak pernah 100 tanpa rencana masa depan) — disengaja per Devlog S99, wajib dipahami reviewer.
- Pagu parsial: akun tanpa pagu hilang dari TW (bobot 0).
- Realisasi > target di-cap 100 per akun (kelebihan hangus).
- Realisasi Desember masuk TW4 (dipakai penuh walau deviasi buang Des).
- `accountQuarterScore` UI 0 bila realized/target/budget ≤0 (tabel bisa 0 sementara skor TW engine hitung `pct/target` yang juga 0 — konsisten untuk nol, beda untuk negatif).
- Multi-baris (FY,month,akun) seharusnya unik via upsert; duplikat historis non-deleted? `find` pertama menang di workspace, Σ di server baca semua → beda bila duplikat kotor (UNCERTAIN — butuh cek unik DB).

## 21. Mock/Hardcoded/Placeholder Findings (8)

1. HARDCODED: bobot 20 + 16 target TW + formula cap + rata-rata-4 + `round` half-up.
2. HARDCODED: FY2026, periode Dashboard default 8 vs workspace global, header `Tahun Anggaran` implisit, target di dialog.
3. Banner BLU statis + skor 100 warning (aturan config, nilai hardcode).
4. Fallback tanpa-DB kosong + `isBlu=false` diam-diam.
5. Dead mock kartu/dashboard contoh; `absorptionPercent` tabel (real/RPD) tak dipakai skor (RPD irrelevant).
6. `Sheet1 TW1=100 diabaikan` (keputusan Devlog, bukan code-comment di engine).
7. Tanpa simpan-rencana/strip-reminder/CTA selain link statis.
8. TODO implisit: tolak negatif, unik (FY,month,akun) di DB level, sinkron periode Dashboard↔workspace.

## 22. Source Code Evidence

| Bagian | File → function/component → purpose |
|---|---|
| Kalkulasi | `packages/ikpa-engine/src/indicators/absorption.ts` → `calculateAbsorption` |
| Skema/aturan | `packages/ikpa-engine/src/schemas.ts:31-39`; `packages/ikpa-engine/src/rule-set.ts:157-166,186-191`; `packages/ikpa-engine/src/utils.ts` → `parseDecimal/round/mul/div` |
| Mapping | `apps/web/src/server/simulation/calculate.ts:203-242,326` |
| Workspace | `apps/web/src/lib/simulation/penyerapan-workspace.ts` → 6 fn; `apps/web/src/routes/operator/penyerapan.tsx` → `PenyerapanPage/accountRows/planMonths` |
| Data | `apps/web/src/routes/operator/data/rpd-realization.tsx` → pills/drawer/link |
| Service/API/validasi | `services/rpd-realization-service.ts`, `server/rpd-realization.ts`, `server/domains/rpd-realization.*`, `services/settings-service.ts` |
| DB | `packages/db/src/schema/rpd-realizations.ts`, `budget-revisions.ts` |
| Dashboard/History/Export | `server/dashboard.ts`, `dashboard.tsx`, `history.tsx`, `exports/operator-xlsx.ts` |
| Test | `absorption.test.ts` (3: BLU, golden 92.67, cap), `penyerapan-workspace.test.ts` (7) |

## 23. Documentation Discrepancies

1. PRD:250 target per akun vs Sheet1 Excel (51-Q1 10%) — code pakai default 2026 (20) + abaikan Sheet1 (benar per Devlog S99, tetapi Appendix referensi masih membingungkan).
2. PRD:261 event gap-penyerapan vs seed tanpa policy — BACKLOG klaim reminder selesai, event ini absen.
3. BACKLOG F11-04 "refresh impact bekerja" — benar, tetapi dampak hanya terlihat via Dashboard (periode default 8), bukan live di halaman data.
4. Panduan g-03 ("Q1 15%, Q2 40–50%…") generik vs target per-akun code — cocok sebagian, presisi kurang.
5. `fitur.md` tetap tidak ada.

## 24. Implementation Gaps (6)

1. Rata-rata selalu 4 TW (masa depan nol) — skor tengah tahun sistematis rendah tanpa rencana; rencana tak persist sehingga Dashboard tak pernah lihat skenario kuning.
2. Tanpa reminder/strip gap penyerapan (H-14/H-7) di workspace maupun halaman.
3. Denominator pagu tahunan penuh tiap TW (bukan pagu TW/proporsional) — Realisasi TW1 dibandingkan pagu setahun (ketat di awal tahun).
4. Negatif lolos; duplikat (FY,month,akun) berpotensi divergen server-vs-workspace.
5. Periode Dashboard vs workspace tak sinkron; tanpa simpan-rencana.
6. `absorptionPercent` (real/RPD) di tabel tak berkaitan dengan skor (RPD irrelevant) — berpotensi disalahartikan sebagai progres penyerapan.

## 25. Questions for AI Reviewer

1. Apakah `pct=real/budget_tahunan×100`, `scoreAcc=min(100,pct/target_TW×100)`, `qScore=Σ tertimbang pagu`, `final=Σ/4 TW (TW depan nol ikut)`, bobot 20, target 51:20/50/75/95·52:15/50/70/90·53:10/40/70/90·57:25/50/75/95, `round` half-up 2, BLU=100-warning sudah sesuai regulasi — khususnya denominator tahunan vs TW dan rata-rata 4-selalu?
2. Apakah cap-100 per akun tanpa carry-over kelebihan dan tanpa bobot antar-TW sudah tepat?
3. Apakah "DB kosong → 0 complete" (bukan incomplete) dan "rencana menguap" dapat diterima untuk audit, atau rencana harus persist sebagai forecast/scenario?
4. Apakah ketiadaan reminder gap-penyerapan memblokir go-live (PRD: Recommended)?
5. Haruskah negatif ditolak, duplikat (FY,month,akun) di-unique-kan di DB, dan RPD disembunyikan dari tabel penyerapan agar tak disalahartikan?
6. Mana periode kanonis Dashboard (default 8) vs workspace (global) — dan bolehkah Sheet1 TW1=100 diabaikan permanen?
7. Apakah banner/label BLU-100-warning memenuhi keterbukaan pengecualian regulasi di laporan?

---
*Berhenti di sini. Jangan lanjut ke indikator berikutnya tanpa perintah.*
