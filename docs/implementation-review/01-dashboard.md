# 01 — Dashboard Operator (`/operator/dashboard`)

**Anchor:** `docs/implementation-review/00-system-overview.md` | **Tanggal:** 2026-09-05
**Aturan:** hanya modul ini. Apa yang ditulis di sini = perilaku code aktual, bukan PRD. Tanpa vonis regulasi.

## 1. Tujuan modul (menurut code)

Merakit 8 baris (7 indikator berbobot + SPM Dispensasi pengurang) menjadi total IKPA, menampilkan gap vs target, 5 rekomendasi prioritas, 1 deadline terdekat, dan tombol `Simpan skenario IKPA`. Bukan tempat menghitung per indikator (itu workspace `penyerapan/deviasi/up-tup` + halaman `data/*`).

## 2. Implementation status

| Area | Status | Bukti |
|---|---|---|
| Total + gap + 8 baris | IMPLEMENTED (dengan hardcode, lihat §6) | `server/dashboard.ts:119-194`, `routes/operator/dashboard.tsx:131-143` |
| Top-5 rekomendasi + Lihat semua | IMPLEMENTED (slice client) | `dashboard.tsx:42,147-156` |
| Simpan skenario IKPA | IMPLEMENTED (tanpa asumsi) | `dashboard.tsx:44-64` |
| Deadline terdekat | HARDCODED / PLACEHOLDER | `server/dashboard.ts:213-221` (selalu Output 2026-09-07) |
| Target, tahun, periode, rule label | HARDCODED | target `95.00` (:127, :132), tahun `2026` (:18, :105, :127), `periodMonth ?? 8` (:118), `ruleSetVersion: "PER-5/PB/2024"` (:177) |
| Tren YTD, kontribusi waterfall, kelengkapan data | NOT IMPLEMENTED di Dashboard (mock mati) | `mocks/operator-dashboard.ts:219-273` (`completeness`, `scoreHistory` tak dibaca route ini) |
| No-DB fallback | IMPLEMENTED (angka demo) | `server/dashboard.ts:82-103` (`totalScore: 94.2`, indicators `[]`) |

## 3. User flow (aktual)

1. Guard `routes/operator/route.tsx:12-51` (`beforeLoad`): unauthenticated→`/sign-in`, unmapped→`/access-pending`, admin→`/admin-kppn/dashboard`, multi-scope tanpa org→`/select-organization`. Lolos → `ActiveContextProvider`.
2. Shell `components/layout/operator-shell.tsx:12-37` render `OperatorNavigation` + `ActiveContextHeader` + `<main>`.
3. Route `loader` (`dashboard.tsx:12-21`) ambil `activeOrganizationId` dari context, panggil `fetchOperatorDashboard(activeOrgId)` **tanpa `periodMonth`** → server pakai default bulan 8.
4. Server hitung + persist snapshot actual (side effect tiap kunjungan), kembalikan total/indikator/rekomendasi/deadline.
5. UI render `ScoreCard` (total/target/gap) + `DeadlinePanel` + grid 8 `IndicatorCard` + `RecommendationList` (top-5).
6. Klik kartu → `INDICATOR_ROUTES[code]` via `window.location.href` (full reload, bukan TanStack `Link`). Klik rekomendasi → route server (`RECOMMENDATION_ROUTES`). `Lihat semua (N)` → `/operator/analysis`.
7. `Simpan skenario IKPA` → `executeSimulation({simulationType:"scenario", period: bulan-klien-saat-ini, name dated})` → pesan sukses + link `/operator/history`.

## 4. Komponen UI penting

| Komponen | File | Props / perilaku aktual |
|---|---|---|
| `OperatorDashboardPage` | `routes/operator/dashboard.tsx:36-159` | `h1 sr-only`, `INDICATOR_ROUTES` 8 kode→route, `topActions = slice(0,5)`, save state lokal |
| `ScoreCard` | `components/operator/score-card.tsx:18-148` | total/target/gap via `formatNumber`/`formatPointDelta`; badge `Data Lengkap/Estimasi/Belum Lengkap`; `—` hanya bila `incomplete` (tak pernah dikirim server); disclaimer bukan-nilai-resmi; 3 tombol (Simpan/Input/Buka Simulasi) |
| `IndicatorCard` | `components/operator/indicator-card.tsx:11-104` | chip `Bobot N%` vs `Faktor Pengurang`; `statusLabel + " · Estimasi"`; `Skor Terbobot` + `Nilai Asli` (non-deduction); `onDetailClick` tak dipakai route ini (pakai `onClick` tak terdefinisi di props → kartu tak bisa diklik, hanya tombol tak ada — navigasi via wrapper? aktual: `onClick` diteruskan sebagai DOM prop, bukan handler kartu) |
| `RecommendationList` | `components/operator/recommendation-list.tsx:13-132` | empty state "Tidak Ada Tindakan Kritis"; `Lihat semua (N)` hanya bila `totalCount > actions.length`; tombol `Buka {domain}` |
| `DeadlinePanel` | `components/operator/deadline-panel.tsx:10-96` | `Hari Ini!` bila 0 else `N Hari Kerja Lagi`; urgent bila `danger`/`<=2`; tombol selalu bertuliskan `Buka Data Tagihan` walau route = output-achievement |
| `OperatorShell` / nav / header | `components/layout/operator-shell.tsx`, `operator-navigation.tsx`, `active-context.tsx` | sidebar 8 label + Reminder + Lainnya; header konteks (satker/tahun/periode) tampil tetapi **periode/tahun tak dikonsumsi loader dashboard** |

Catatan `IndicatorCard`: route memanggil `<IndicatorCard onClick={...}>` (:133-141) padahal props hanya definisikan `onDetailClick` — `onClick` jatuh sebagai `...props` DOM `div`, sehingga klik kartu tetap navigasi (via div onClick) meski tak sesuai kontrak props. Fungsi benar, tipe longgar.

## 5. Data yang ditampilkan → sumbernya

| Tampil | Sumber |
|---|---|
| Nilai IKPA, gap | `calculateAndPersistSnapshot(..., {simulationType:"actual", targetScore:"95.00"})` → `output.totalScore`; `gap = total - 95.0` (`dashboard.ts:119-133,170-173`) |
| 7 baris indikator | `output.indicators[].{key,score,weight,label}` → `rawScore/weightedScore=(raw×weight)/100` (:135-168); `null score` → `isEstimated`, skor 0, status `incomplete`, summary `Estimasi — belum ada data` |
| Baris ke-8 Dispensasi | `output.dispensationDeduction` → `rawScore=deduction`, `weightedScore=-deduction` (:179-194) |
| Status kartu | threshold client: `>=90 complete/Optimal`, `>=75 warning/Perlu Perhatian`, else `danger/Kritis` (:148-161) |
| Rekomendasi | `output.recommendations[]` dari `generateRecommendations` (:195-212); `deadlineDays: 5` hardcode, `deadlineDate: rec.deadline ?? "2026-09-15"`, `impactPoints: parseFloat(rec.potentialGain||"1.00")` |
| Deadline terdekat | **Hardcode server** (:213-221), bukan scheduler/policies/DB |
| Rule label, update time | `"PER-5/PB/2024"` hardcode; `lastUpdated = now.toLocaleDateString("id-ID")`, bukan `updated_at` DB |
| Target | `95.0` hardcode; bukan `organizations.targetIkpa` dari Settings |

## 6. Trace angka IKPA (wajib: dari mana → diproses apa → formula apa → simpan di mana → tampil bagaimana)

1. **Dari mana:** 11 tabel scoped `fiscalYearId` + `workdays` tahun berjalan, dimuat di `server/simulation/calculate.ts:91-169` (`rpdLines, realizations, budgets, dipaRevisions, contracts, spmLs, upTupTransactions, kkpUsages, outputReports, spmQ4, workdays`; filter `deletedAt IS NULL`).
2. **Diproses oleh apa:** mapping → `EngineInput` (:179-372: RPD 11 bulan, pagu per akun, TW agregat Σ3 bulan, kontrak, invoice + kalender, UP/TUP collapse `non-UP/TUP→UP`, KKP fallback `YYYY-MM-15`, output `deadline = YYYY-MM-05`, dispensasi count Q4; asumsi diabaikan karena `simulationType:"actual"`).
3. **Formula apa:** `calculateIkpa(input, parseRuleSet(ruleSets.configJson))` (`packages/ikpa-engine/src/calculate.ts:14-111`): 7× `calculate*(…)` → `weighted = score×weight/100` → `subtotal Σ` → `total = roundHalfUp(subtotal − dispensasiDeduction, fractionDigits)`; `totalScore=null` bila ada indikator `incomplete`; `generateRecommendations` (`recommendations.ts:9-108`, prioritas `weight×gap×urgencyMultiplier(1/2/3)`, sort stabil + tie-break alfabet).
4. **Simpan di mana:** tiap load insert `simulations{type:actual, targetScore:"95.00"}` + `scoreSnapshots{periodEnd: YYYY-MM-01, totalScore, breakdownJson: output, ruleSetVersion, ruleSetId, inputHash}` (`calculate.ts:380-429`; tanpa transaksi — komentar neon-http; tanpa cek duplikat `inputHash`).
5. **Sampai di UI:** server petakan ke `IndicatorScoreItem[]` + total/gap/rekomendasi (`dashboard.ts:135-222`) → `dashboard-service.ts:20-27` passthrough `getOperatorDashboardFn` → `loader` → `ScoreCard/IndicatorCard/RecommendationList` dengan `formatNumber/formatPointDelta` (`lib/format.ts`, id-ID 2 desimal, delta `+/−… poin`).

## 7. Calculation / validation / state / flow / error / edge

- **Validation:** validator serverFn passthrough (`(data?) => data`, :64); `periodMonth` tak divalidasi; otorisasi via `getAccessResolutionForSession` + `assertOperatorOrgScope` (:66-80); `fiscalYear` auto-create bila absen (:18-51, butuh 1 published rule set 2026).
- **State:** tanpa store global. Loader-per-visit + `useState` lokal (saving/message). Periode global (`ActiveContext`, default Jan + sync bulan-berjalan on-mount) **tidak dibaca dashboard**; Tahun tunggal `[2026]` disabled.
- **Data flow:** `loader → dashboard-service → serverFn → calculateAndPersistSnapshot → engine → DB insert → map → UI`. Simpan-skenario: `simulation-service.executeSimulation → runSimulationFn` (jalur sama, `scenario`, tanpa asumsi).
- **Error handling:** loader tanpa try/catch (gagal → error boundary route); server `throw` bila org/FY tak ada; fallback tanpa-DB kembalikan demo; save inline `saveMessage/saveError`.
- **Edge:** semua indikator kosong → `totalScore=null→parseFloat("94.20" fallback?)` — aktual: `parseFloat(null||"94.20")=94.2` sehingga total tetap angka walau `dataStatus:"estimated"`; kartu tunjukkan 0 + Estimasi. `ScoreCard` cabang `incomplete→"—"` mati (server tak kirim `incomplete`). Rekomendasi kosong → empty state sukses. `nearestDeadline` tak pernah `null` di jalur DB.

## 8. Dependency terhadap 8 indikator

Dashboard **tidak query indikator satu per satu**; satu panggilan engine mengembalikan 7 + dispensasi. Ketergantungan penuh pada: `engine/indicators/*` (Revisi, Deviasi, Penyerapan, Kontraktual, Tagihan, UP/TUP, Output, Dispensasi), `engine/rule-set.ts` (bobot/invarian), `server/simulation/calculate.ts` (mapping DB→EngineInput). Workspace client (`lib/simulation/*-workspace.ts`) **tidak dipakai dashboard** — risiko divergensi bila rule published ≠ `default2026RuleSet` (diakui Devlog S94). Deep-link engine (`recommendations.ts:16-24`: deviasi→`rpd-realization`, penyerapan→`rpd-realization`) **berbeda** dari deep-link dashboard server (`dashboard.ts:53-61`: deviasi→`/operator/deviasi`, penyerapan→`/operator/penyerapan`).

## 9. Mock / hardcoded / placeholder

- HARDCODED: target 95, tahun 2026, periode default 8 (load) vs bulan-klien (save), rule label, deadline, `deadlineDays:5`, `deadlineDate ?? "2026-09-15"`, `deltaPoints:0` (7 indikator), tombol `Buka Data Tagihan`, header `Tahun Anggaran 2026`.
- MOCK mati: `mocks/operator-dashboard.ts` (`mockOperatorDashboardNormal/Risky/Incomplete`, `completeness`, `scoreHistory`) — tipe dipakai (`IndicatorScoreItem` dkk.), nilai tak dipakai jalur DB; hanya relevan saat `DATABASE_URL` kosong (fallback 94.2).
- PLACEHOLDER: `summary: "Bobot: N%"`, rekomendasi `indicatorName = indicatorKey` mentah (e.g. `budget_absorption`).
- UNCERTAIN: `periodEnd` snapshot pakai `params.period.value` (8) sementara periode global header bisa berbeda — snapshot berlabel bulan yang tak dipilih user.

## 10. Source-code evidence

Route/service/server: `apps/web/src/routes/operator/dashboard.tsx` (loader :12-21, `INDICATOR_ROUTES` :25-34, save :44-64); `apps/web/src/services/dashboard-service.ts:20-27`; `apps/web/src/server/dashboard.ts:63-223` (`getOperatorDashboardFn`, `getOrInitFiscalYear`, `RECOMMENDATION_ROUTES`); `apps/web/src/services/simulation-service.ts:36-61` (`executeSimulation`).
Engine: `packages/ikpa-engine/src/calculate.ts:14-111`; `packages/ikpa-engine/src/recommendations.ts:9-108`.
Persist: `apps/web/src/server/simulation/calculate.ts:60-430`.
UI: `components/operator/{score-card,indicator-card,recommendation-list,deadline-panel}.tsx`; `components/layout/{operator-shell,operator-navigation,active-context}.tsx`; `mocks/operator-dashboard.ts:1-61` (tipe); `lib/format.ts:51-90`.
Guard: `routes/operator/route.tsx:6-51`.

## 11. Implementation Gaps

1. Deadline bukan dari reminder scheduler/policy/DB — satu objek statis; status `safe` + angka `5` menyesatkan bila tagihan/output benar-benar kritis.
2. Setiap kunjungan menulis snapshot `actual` baru (tanpa idempoten/`inputHash` check) → `score_snapshots`/`simulations` membengkak; Riwayat tercemar baris auto-load.
3. Periode/tahun/target header vs yang dihitung tidak konsisten (load=Agustus, save=bulan klien, target≠Settings, tahun tunggal).
4. `ruleSetVersion` label statis; `breakdownJson` simpan versi asli (`ruleSetRow.version`) — UI sembunyikan versi sebenarnya dari user.
5. `deltaPoints` 0 permanen untuk 7 indikator; rekomendasi `deadlineDays`/`deadlineDate` default menutupi `rec.deadline=null` dari engine.
6. Navigasi `window.location.href` (reload penuh) di seluruh Dashboard; `IndicatorCard onClick` tak sesuai props.
7. Tanpa tren/kelengkapan data di Dashboard meski PRD minta; mock `scoreHistory/completeness` menganggur.
8. Tanpa-DB tampilkan 94.2 + deadline berbeda (SPM-LS) — angka demo bisa disangka hasil nyata.

## 12. Questions for AI Reviewer

1. Apakah total `Σ(7 kontribusi berbobot) − dispensasi` + `roundHalfUp(fractionDigits)` + `null bila incomplete` di `calculate.ts:70-92` sesuai ketentuan IKPA, dan apakah threshold UI `90/75` + fallback `94.20` + `estimated→0` dapat diterima sebagai presentasi?
2. Apakah `periodMonth default 8`, `target 95.00`, tahun tunggal 2026, dan `periodEnd = YYYY-MM-01` konsisten dengan definisi periode/target PRD/FSD, atau harus dibaca dari `ActiveContext`/`organizations.targetIkpa`?
3. Apakah deadline statis + `deadlineDays:5` + `Buka Data Tagihan` melanggar requirement Reminder Center / deadline berbasis policy + kalender kerja?
4. Apakah auto-persist snapshot actual setiap load + simpan-skenario tanpa asumsi melanggar immutabilitas/lineage snapshot dan retensi di ERD/TSD?
5. Perbedaan deep-link engine vs dashboard (`rpd-realization` vs `/deviasi|/penyerapan`) — mana yang kanonis untuk jejak audit rekomendasi?
6. Apakah label `PER-5/PB/2024` + `lastUpdated=now` memenuhi auditability rule-set-version, mengingat `score_snapshots.ruleSetVersion` menyimpan versi asli?
7. Fallback no-DB 94.2 + mock types dari `mocks/` — apakah boleh tampil di lingkungan audit, atau harus fail-closed?

---
*Berhenti di sini sesuai instruksi. Jangan lanjut ke indikator tanpa perintah.*
