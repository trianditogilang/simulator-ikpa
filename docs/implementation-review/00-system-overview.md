# 00 — System Overview (Context Anchor)

**Tanggal:** 2026-09-05 | **Scope:** re-grounding global, bukan audit formula regulasi
**Source of truth:** source code aktual. BACKLOG/TASK-LIST/DEVLOG/`future_plan.md` hanya petunjuk riwayat.
**Stop rule:** berhenti setelah file ini. Jangan lanjut ke dokumentasi Dashboard/indikator.

## 1. Ringkasan arsitektur

Monorepo npm workspaces (`simpatik-v0`), diverifikasi di `package.json`:

- `apps/web` — TanStack Start + React 19 + TanStack Router (file-based `src/routes`), Tailwind v4, Radix/shadcn, Recharts, react-hook-form + Zod, Clerk `@clerk/tanstack-react-start`, Vitest.
- `packages/ikpa-engine` — pure TypeScript, 7 indikator + pengurang dispensasi + `calculateIkpa` + `recommendations` + `rule-set`. Tanpa akses DB/HTTP/React.
- `packages/policy-reminder` — `workday-calendar`, `rule-set-resolver`, `deadline-calculator` (DSL bounded, tanpa `eval`), `compliance-guard`, `scheduler` (idempotency sha256 16-char).
- `packages/access-control` — `sync-user`, `access-resolver` (ADR-007), `scope-guard` (`assertOperatorOrgScope`/`assertAdminKppnScope`), `manage-access` (proteksi admin terakhir).
- `packages/db` — Drizzle ORM + Neon (`client.ts`, `drizzle.config.ts`), `src/schema/*.ts` (22 file incl. `relations.ts`, `index.ts`), `seed.ts` (KPPN-032 Malang, satker 411782, rule set 2026.1), migrasi `drizzle/0000_quiet_hiroim.sql`.
- `packages/contracts` — DTO/Zod lintas layer (`schemas.ts`, `index.ts`).
- `packages/ui` — `status-badge`, `rule-set-badge`, `context-header/selector`, `loading/error/empty/incomplete-state`, `simulation-disclaimer`, `policy-lock-alert`.
- `packages/access-control`, `packages/contracts` dikonsumsi server `apps/web/src/server`.

Pola backend: TanStack `createServerFn` di `src/server/*.ts` + `src/server/domains/*.queries|mutations.ts`, dipanggil via tipis `src/services/*-service.ts` dari route `loader`/`action`. Validasi Zod di server, scope guard wajib, audit via `src/server/audit/write-audit.ts`.

Auth: Clerk middleware (`src/start.ts`, `src/routes/__root.tsx`) → `src/server/auth-session.server.ts` + `access.server.ts` → guard `beforeLoad` di `routes/operator/route.tsx` dan `routes/admin-kppn/route.tsx`. Active-org via cookie HttpOnly (`active-context.ts`, `components/layout/active-context.tsx`). Tanpa role PPK/Bendahara/KPA (sesuai PRD MVP).

Penyimpanan: Neon PostgreSQL (Drizzle). Nominal `numeric(18,2)`, skor `numeric(8,4)`. File import disimpan base64 sementara di `import_jobs` (tanpa R2; R2 hanya rencana di `future_plan.md`). Email/QStash: handler ada (`src/server/qstash/handler.ts`, `routes/api/qstash/daily|send.ts`, `routes/api/jobs/import/process.ts`) tetapi simplified — verifikasi signature header-compare + dev-fallback, bukan JWT Upstash penuh; dep `resend`/`@upstash/qstash`/`exceljs`/`@react-pdf/renderer` **tidak ada** di `apps/web/package.json` (export/import pakai `Function('m','return import(m)')` fallback CSV/teks).

State management: tanpa Redux/Zustand. Kombinasi TanStack Router `loader` (server fetch per halaman) + `useState` lokal + `ActiveContext` (org/tahun/periode) + service re-fetch + `router.invalidate()`.

## 2. Struktur folder aktual ( diverifikasi)

```text
apps/web/src/
  routes/ index.tsx, sign-in.tsx, sign-up.tsx, sso-callback.tsx, access-pending.tsx, select-organization.tsx
    operator/ route.tsx(guard), dashboard.tsx, penyerapan.tsx(CORR-02), deviasi.tsx(CORR-03), up-tup.tsx(CORR-04),
      simulation.tsx, analysis.tsx, history.tsx, reports.tsx, reminders.tsx, guides.tsx, settings.tsx, import.tsx(STUB)
      data/ budget-revisions.tsx, rpd-realization.tsx, contracts-invoices.tsx, up-tup-kkp.tsx, output-achievement.tsx, spm-dispensation.tsx
    admin-kppn/ route.tsx(guard), dashboard.tsx, organizations/index.tsx, organizations/$orgId.tsx,
      monitoring/reminders.tsx, reports.tsx, policy/rule-sets/index.tsx, policy/rule-sets/$ruleSetId.tsx,
      policy/reminders.tsx, policy/workdays.tsx, policy/history.tsx, audit-logs.tsx, access.tsx
    api/qstash/daily.ts, api/qstash/send.ts, api/jobs/import/process.ts
  server/ dashboard.ts, simulation.ts, simulation/calculate.ts, reminders.ts, reminders/{config,delivery}.*,
    admin-monitoring.ts, admin-policy.ts, admin-access.ts, admin/monitoring.queries.ts,
    domains/*.queries|mutations.ts (8 domain), audit/write-audit.ts, access*.ts, auth-session*.ts,
    import.ts, import/{parser,process-job}.ts, exports/{operator-xlsx.ts, operator-pdf.tsx, admin-aggregate.ts},
    active-context.ts
  services/ *-service.ts (15 file: 8 domain + simulation, dashboard, reminders, admin-*, settings, import, report)
  lib/simulation/ penyerapan-workspace.ts, deviasi-workspace.ts, up-tup-workspace.ts,
    up-tup-assumptions.ts, dispensasi-assumptions.ts, tagihan-output-reminder.ts (+ *.test.ts), lib/format.ts
  components/layout/ operator-navigation.tsx, operator-shell.tsx, admin-navigation.tsx, admin-shell.tsx,
    public-shell/header.tsx, active-context.tsx
  components/operator|admin|data|auth|access|public/, emails/{reminder,digest,escalation}-email.tsx, mocks/*.ts
packages/{ikpa-engine, policy-reminder, access-control, db, contracts, ui}/src/
docs/ PRD, FSD, TSD, ERD, UI-UX-Design-System, UI-UX-Wireframes, BACKLOG, TASK-LIST, DEVLOG,
  PRE-F13-Koreksi-IA-Operator.md, future_plan.md, IMPLEMENTATION-REVIEW-HANDOFF.md, traceability-matrix.md, dst.
referensi/ *.xlsx (hanya UX ref, tak di-bundle)
```

## 3. Calculation / business-rule layer

- Server canonical: `server/simulation/calculate.ts` (`calculateAndPersistSnapshot`, `CalculateParams.assumptions{upTup,dispensasi}`; actual selalu DB, asumsi hanya forecast/scenario; persist `entityType=assumptions`; hash SHA-256 input; snapshot immutable + `rule_set_version`).
- Client workspaces (CORR-02..04, pola sama): hitung skor di browser via `calculateAbsorption`/`calculateRpdDeviation`/`calculateUpTup` + `default2026RuleSet`; actual DB read-only, rencana kuning state terpisah; `tagihan-output-reminder.ts` (estimasi Senin–Jumat, bukan kalender libur nasional).
- Engine entry: `packages/ikpa-engine/src/{calculate.ts, rule-set.ts, schemas.ts, types.ts, recommendations.ts, indicators/*.ts}` + golden tests per indikator.
- Reminder domain: `policy-reminder` (resolver → deadline DSL → scheduler → compliance guard). Server authoritative preview di `server/reminders/config.*`.

## 4. Tabel modul (status awal = observasi kode, bukan vonis regulasi)

| Modul | Lokasi code utama | Dependency | Database/API terkait | Status awal | Perlu inspeksi mendalam |
|---|---|---|---|---|---|
| Dashboard Operator | `routes/operator/dashboard.tsx`, `server/dashboard.ts`, `components/operator/{score-card,indicator-card,recommendation-list}.tsx`, `services/dashboard-service.ts`, `mocks/operator-dashboard.ts` | ikpa-engine, recommendations, ActiveContext | `fiscal_years`, `rule_sets`, `simulations`, `score_snapshots` via `calculateAndPersistSnapshot` | 8 baris + pengurang + top-5 + Simpan skenario (CORR-05); copy laporan masih tulis "7 indikator" | Ya — estimasi vs actual, rute rekomendasi, gap/target |
| Revisi DIPA | `routes/operator/data/budget-revisions.tsx`, `server/domains/budget-revisions.*`, `services/budget-revisions-service.ts`, `engine/indicators/dipa-revision.ts` | access-guard, audit | `budgets`, `dipa_revisions` | CRUD scoped riil; belum punya workspace what-if (by design PRE-F13) | Ya — eligibility kode revisi, semester |
| Deviasi Hal III | `routes/operator/deviasi.tsx` (workspace) + `routes/operator/data/rpd-realization.tsx` (ubah aktual), `lib/simulation/deviasi-workspace.ts`, `engine/indicators/rpd-deviation.ts` | shared pagu Netto dgn Penyerapan | `rpd_lines`, `realizations`, `budgets` | Workspace Jan–Nov riil; Des sengaja tak dibangun; pagu Netto | Ya — proporsi pagu, kurva >5% |
| Penyerapan | `routes/operator/penyerapan.tsx`, `lib/simulation/penyerapan-workspace.ts`, `engine/indicators/absorption.ts` | rule set target per akun | `realizations`, `budgets` | Workspace actual-terkunci + rencana kuning riil; Sheet1 TW1 manual diabaikan | Ya — rata-rata 4 TW, cap 100 |
| Belanja Kontraktual | `routes/operator/data/contracts-invoices.tsx` (tab kontrak, berbagi route dgn Tagihan), `server/domains/contracts-invoices.*`, `engine/indicators/contractual.ts` | — | `contracts` | Belum workspace khusus; nav Berbagi href (duplikat highlight sementara) | Ya — 3 komponen 20/40/40, eligibility 53, termin |
| Penyelesaian Tagihan | Route sama di atas (tab SPM-LS) + `lib/simulation/tagihan-output-reminder.ts`, `engine/indicators/invoice-timeliness.ts` | strip reminder CORR-06 | `spm_ls` (+ `contracts`) | Strip H+17 wajib riil (estimasi Mon–Fri); saran sebut nomor SPM | Ya — H+17 inklusivitas, kalender kerja vs estimasi |
| UP/TUP & KKP | `routes/operator/up-tup.tsx` (workspace) + `routes/operator/data/up-tup-kkp.tsx` (tab data), `lib/simulation/{up-tup-workspace,up-tup-assumptions}.ts`, `components/operator/up-tup-assumption-panel.tsx`, `engine/indicators/up-tup.ts` | reuse panel; reminder GUP/PTUP | `up_tup_transactions`, `kkp_usages` | Workspace + panel what-if riil; collapse DB type mirror server | Ya — mapping GUP/PTUP/Setoran→UP/TUP, target KKP Q |
| Capaian Output | `routes/operator/data/output-achievement.tsx` + strip CORR-06, `server/domains/output-achievement.*`, `engine/indicators/output-achievement.ts` | — | `output_reports` | Strip 5 HK wajib riil; badge tepat/terlambat/belum | Ya — konfirmasi, PCRO/TPCRO, Desember |
| Dispensasi SPM | `routes/operator/data/spm-dispensation.tsx`, `lib/simulation/dispensasi-assumptions.ts`, `components/operator/dispensasi-assumption-panel.tsx`, `engine/indicators/spm-dispensation.ts` | panel asumsi ke-2 | `spm_q4` | CRUD Q4 + panel rasio permil riil | Ya — bucket permil, zero-denominator |
| Reminder Center | `routes/operator/reminders.tsx`, `server/reminders*.ts`, `services/reminders-service.ts` | policy-reminder pkg, compliance guard | `reminder_policies`, `org_reminder_configs`, `notification_deliveries`, `workdays`, `rule_sets` | Loader+mutasi riil (preview server-authoritative, reset default) | Ya — mandatory lock, lead range, recipient wajib |
| Riwayat & Perbandingan | `routes/operator/history.tsx`, `server/simulation.ts`, `services/simulation-service.ts` | snapshot immutable | `simulations`, `simulation_overrides`, `score_snapshots` | Loader riil (mock dibuang); compare 2 item 8 baris | Ya — lineage, soft-delete, stale rule set |
| Laporan & Export | `routes/operator/reports.tsx`, `routes/admin-kppn/reports.tsx`, `server/exports/*`, `services/report-service.ts` | base64 blob download, sanitasi `'` | snapshot + seluruh domain scoped | XLSX 10-sheet + PDF + agregat Admin ada; tanpa dep exceljs/react-pdf (fallback) | Ya — kelengkapan 8 baris, agregat scoped |
| Panduan IKPA | `routes/operator/guides.tsx`, `mocks/guides.ts` | statis | — (rule set version hanya label) | Mock-statis, bukan DB; 8 topik tampil | Tidak prioritas — sinkronisasi dgn rule set |
| Pengaturan | `routes/operator/settings.tsx`, `server/domains/settings.*` + `server/settings.ts`, `services/settings-service.ts` | onboarding `/access-pending` | `organizations`, `fiscal_years`, `user_accesses` | Loader+mutasi riil + audit `onboard_satker/update_settings` | Ya ringan — BLU, target, timezone |
| Simulasi legacy | `routes/operator/simulation.tsx`, `components/operator/simulation-result.tsx` | assumptions (bukan overrides) | via `calculate.ts` | Tetap terdaftar tapi tak di-link sidebar (arsip IA di `future_plan.md`) | Ya — pastikan tak divergen dari workspace |
| Analisis legacy | `routes/operator/analysis.tsx`, `mocks/analysis.ts` | list penuh dari loader dashboard | — | Tetap terdaftar; dijangkau via "Lihat semua" | Ya ringan — duplikasi ranking dgn engine |
| Import | `routes/operator/import.tsx` (STUB nonaktif), `server/import*.ts`, `services/import-service.ts`, `routes/api/jobs/import/process.ts` | parser 6 domain, QStash | `import_jobs` (stop-tulis) | UI disabled sengaja (hemat storage); backend utuh tak dipanggil | Ya saat restore — R2, exceljs, TTL |
| Admin KPPN | `routes/admin-kppn/*`, `server/admin-*.ts`, `services/admin-*-service.ts` | scope guard KPPN | seluruh satker scope + `audit_logs`, `rule_sets`, `user_accesses` | Klaim integrasi riil F11-12..14; handoff sebut sebagian masih mock/fallback | Ya — verifikasi per halaman mana mock vs riil |
| Auth & Akses | `routes/__root.tsx`, `start.ts`, `server/access*.ts`, `packages/access-control/*` | Clerk | `users`, `user_accesses`, `kppn_scopes`, `organizations` | Guard operator/admin + org-picker + pending page riil | Ya — multi-scope, admin-terakhir |

## 5. Source Map (lokasi penting)

- Navigasi dikunci: `apps/web/src/components/layout/operator-navigation.tsx` (8 label persis PRE-F13; Belanja Kontraktual + Tagihan berbagi `/operator/data/contracts-invoices`).
- Engine: `packages/ikpa-engine/src/calculate.ts`, `rule-set.ts`, `recommendations.ts`, `indicators/{dipa-revision,rpd-deviation,absorption,contractual,invoice-timeliness,up-tup,output-achievement,spm-dispensation}.ts`.
- Policy/reminder: `packages/policy-reminder/src/{workday-calendar,rule-set-resolver,deadline-calculator,compliance-guard,scheduler}.ts`.
- Akses: `packages/access-control/src/{access-resolver,scope-guard,sync-user,manage-access}.ts`; `apps/web/src/server/{access.server,access,auth-session.server,active-context}.ts`.
- DB: `packages/db/src/schema/{enums,identity,policy,workdays,fiscal-years,budget-revisions,rpd-realizations,contracts,spm-ls,up-tup,kkp,output-reports,spm-q4,simulations,score-snapshots,reminder-configs,notification-deliveries,import-jobs,audit-logs,relations,index}.ts`; `packages/db/src/{client,seed}.ts`.
- Server domain: `apps/web/src/server/domains/*`, `apps/web/src/server/{dashboard,simulation,reminders,admin-monitoring,admin-policy,admin-access}.ts`.
- Client service: `apps/web/src/services/*-service.ts` (15).
- Workspace asumsi: `apps/web/src/lib/simulation/*` (6 lib + 5 test + `lib/format.ts`).
- Email/QStash: `apps/web/src/emails/*`, `apps/web/src/server/qstash/handler.ts`, `apps/web/src/routes/api/qstash/*`.
- Export: `apps/web/src/server/exports/{operator-xlsx.ts,operator-pdf.tsx,admin-aggregate.ts}` (+2 test).
- Kontrak bersama: `packages/contracts/src/{index,schemas}.ts`. UI bersama: `packages/ui/src/components/*`.

## 6. Module Dependency Map

```text
Route loader → services/* → serverFn(server/*) → scope-guard + access-resolver → Drizzle(db) → Neon
Route loader (dashboard/simulation/history) → calculateAndPersistSnapshot → parseRuleSet + calculateIkpa(engine) → score_snapshots
Workspace client (penyerapan/deviasi/up-tup) → ikpa-engine langsung + default2026RuleSet (tanpa server; divergen bila rule published beda)
Reminder page → reminders-service → config.queries/mutations → deadline DSL + workday-calendar + compliance-guard → org_reminder_configs
QStash cron → verifyQStashSignature → handleQStashDaily/Send → notification_deliveries → Resend (dep belum terpasang; kirim belum terverifikasi E2E)
Export page → report-service → exports/* → snapshot + domain tables (scoped org/KPPN)
Admin pages → admin-*-service → admin/monitoring.queries + admin-policy/access → kppn_scope_id filter (read-only satker)
Guides → mocks/guides.ts (terisolasi, tanpa DB)
```

Shared: `write-audit.ts` (seluruh mutasi), `format.ts` (id-ID), `FormattedNumberInput`, `DomainDataTable/Drawer`, `ContextHeader/Selector`, `contracts` schemas, seed `default2026RuleSet`.

## 7. Shared Logic (dipakai >1 modul)

| Logic | Lokasi | Dipakai oleh |
|---|---|---|
| `assertOperatorOrgScope` / `assertAdminKppnScope` | `packages/access-control/src/scope-guard.ts` | seluruh server domain, dashboard, export, reminder delivery |
| `resolveUserAccess` (ADR-007) | `packages/access-control/src/access-resolver.ts` | route guard operator/admin, org-picker, access-pending |
| `writeAudit` (redaksi SENSITIVE_KEYS) | `apps/web/src/server/audit/write-audit.ts` | mutasi domain, policy publish, reminder config, akses, import commit |
| `calculateIkpa` + `parseRuleSet` + `default2026RuleSet` | `packages/ikpa-engine` | `calculate.ts` server + 3 workspace client + panel asumsi |
| `recommendations` ranking (bobot×gap×urgensi) | `packages/ikpa-engine/src/recommendations.ts` | dashboard top-5 + analysis full list |
| deadline DSL + `workday-calendar` | `packages/policy-reminder` | reminder config preview, scheduler, strip Tagihan/Output (estimasi), workdays admin |
| `checkCompliance` / Compliance Guard | `packages/policy-reminder/src/compliance-guard.ts` | Reminder Center + (harus dicek) panel admin policy |
| scheduler idempotency + `selectDueDeliveries`/`reEvaluatePending` | `packages/policy-reminder/src/scheduler.ts` | QStash daily/send + retry delivery admin |
| `format.ts` (Rupiah/persen/permil/tanggal WIB) | `apps/web/src/lib/format.ts` | dashboard, tabel domain, export, email |
| `FormattedNumberInput` | `apps/web/src/components/data/formatted-number-input.tsx` | 29 input (domain + workspace + panel + settings + policy) |
| `DomainDataTable` / `DomainFormDrawer` | `apps/web/src/components/data/*` | 6 halaman data + history + reminders |
| `ActiveContext` (org/tahun/periode) | `apps/web/src/components/layout/active-context.tsx` + `server/active-context.ts` | penyerapan + RPD dua-arah; workspace lain belum tentu ikut (Fase-2 tertunda) |

## 8. Documentation Discrepancies (docs vs kode)

1. **`fitur.md` tidak ada.** Instruksi tugas menyebutnya sebagai acuan, tetapi `glob **/fitur.md` = 0 hasil. Jangan jadikan acuan; pakai BACKLOG/DEVLOG/TASK-LIST.
2. **Import "Completed" vs dinonaktifkan.** BACKLOG F12-01..09 + TASK-LIST centang semua, tetapi kode `routes/operator/import.tsx` = stub "Dinonaktifkan Sementara", nav entry dicabut, 8 `onImportClick` dibuang (PRE-F13-08). Backend (`server/import*.ts`, `import-service.ts`, `api/jobs/import/process.ts`, tabel `import_jobs`) utuh tapi tak terpanggil. Status jujur: `Disabled/Deferred (intentional)`, bukan `Implemented`.
3. **Copy "7 indikator" tersisa.** BACKLOG PRE-F13-03/04/05 klaim 8 baris selesai, server `dashboard.ts` + `history.tsx` + export memang 8, tetapi `routes/operator/reports.tsx:52` masih tulis "breakdown 7 indikator". Perlu koreksi copy (bukan rumus).
4. **Nav 8 item ≠ 8 route.** CORR-01 klaim sidebar 8 indikator persis nama, benar di label, tetapi Belanja Kontraktual + Penyelesaian Tagihan berbagi href `/operator/data/contracts-invoices`; Revisi/Kontraktual/Tagihan/Output/Dispensasi belum punya workspace (masih `data/*`). Komentar kode sendiri akui highlight ganda sementara.
5. **Email/QStash "Completed" vs skeleton.** BACKLOG F10-06..08 centang, file ada, tetapi `verifyQStashSignature` = header-compare + dev-fallback (bukan JWT Upstash), dep `resend`/`qstash` tak ada di `package.json`, pengiriman E2E belum terbukti. Status jujur: `Partial/skeleton`.
6. **Export tanpa dep.** F12-06..08 centang, tetapi `exceljs`/`@react-pdf/renderer` tak terinstal; kode pakai `Function('m','return import(m)')` fallback CSV/teks. Klaim "XLSX/PDF" = degradasi graceful, bukan penuh.
7. **Admin "terintegrasi riil" vs fallback.** BACKLOG F11-12..14 centang riil, tetapi `IMPLEMENTATION-REVIEW-HANDOFF.md` (snapshot 4 Sep 2026) nyatakan sebagian halaman Admin masih mock/fallback. Per halaman wajib dibedakan `Implemented` vs `Mock/Static` saat inspeksi mendalam.
8. **Reminder Mon–Fri vs kalender kerja.** `tagihan-output-reminder.ts` labeli jelas "estimasi Senin–Jumat tanpa libur nasional", sedangkan PRD/FSD/TSD wajib kalender `workdays`. Strip CORR-06 benar sebagai UX, bukan pengganti deadline server. Jangan diaudit sebagai formula resmi.
9. **Workspace client pakai `default2026RuleSet`.** Devlog Session 94 akui preview bisa selisih bila rule published beda dari default. Ini `Intentional Change` sementara, bukan bug engine.
10. **Seed scope ganda.** BACKLOG F7-16 tulis KPPN-089/2 admin, kode `seed.ts` tulis KPPN-032 Malang/satker 411782 + cleanup legacy 032/089. Verifikasi seed aktual sebelum pakai angka cakupan di dokumen.

## 9. Areas Requiring Deep Inspection (prioritas tahap berikut)

1. `server/simulation/calculate.ts` (430 baris) — mapping collapse GUP/GUP_NIHIL/PTUP/SETORAN→UP/TUP, KKP fallback mid-month, assumptions vs overrides, hash, isolasi actual/forecast/scenario.
2. `server/dashboard.ts` + `routes/operator/dashboard.tsx` — agregasi 8 baris, null→Estimasi, rekomendasi top-5 vs full, rute deep-link, Simpan skenario IKPA.
3. Workspace trio + lib (`penyerapan/deviasi/up-tup-workspace.ts`, `up-tup-assumptions.ts`, `dispensasi-assumptions.ts`, `tagihan-output-reminder.ts`) — paritas semantik dgn server, target per akun, Jan–Nov vs Des, tabel acuan GUP.
4. `packages/ikpa-engine/src/indicators/*` + `rule-set.ts` — 8 formula vs `default2026RuleSet`; daftar belum-terverifikasi di `regulatory-verification-2026.md` (14 kode revisi, kurva deviasi, bucket kontrak, BLU, KKP, mandatory).
5. Reminder E2E: `packages/policy-reminder/*` + `server/reminders/*` + `server/qstash/*` + `emails/*` + `routes/operator/reminders.tsx` + `admin-kppn/monitoring/reminders.tsx` — mandatory lock, lead range, recipient wajib, idempotency, retry.
6. Admin scope: `server/admin/*`, `routes/admin-kppn/organizations/$orgId.tsx`, `policy/*`, `access.tsx`, `audit-logs.tsx` — buktikan read-only + `kppn_scope_id` per halaman; bedakan mock vs loader riil.
7. Export: `server/exports/*` — kelengkapan 8 baris, scoped, sanitasi injeksi, fallback CSV vs XLSX/PDF asli.
8. Akses: `access-resolver.ts`, `scope-guard.ts`, `manage-access.ts`, `operator/route.tsx`, `admin-kppn/route.tsx`, `access-pending.tsx`, `select-organization.tsx` — multi-satker, admin precedence, proteksi admin terakhir.
9. DB: `packages/db/src/schema/*` + migrasi `0000_quiet_hiroim.sql` vs ERD (25 tabel, enum, index deadline, unique, soft-delete, immutability snapshot/policy).
10. Sisa UI: `simulation.tsx`/`analysis.tsx` legacy vs workspace baru (risiko divergensi), `guides.tsx` mock vs rule set version, `settings.tsx` + onboarding, periode global (`active-context.tsx` — baru Penyerapan+RPD dua-arah).
11. F13 gap: quality/security/deploy/UAT belum mulai (F13-01..14 unchecked, `Depends: PRE-F13 CORR-01..05`); test/lint/build per klaim DEVLOG lulus lokal tetapi handoff sebut ada gagal — wajib re-run saat deep inspection.

---
*Anchor selesai. Tahap berikut memeriksa satu modul per dokumen, selalu silang: kode → BACKLOG/DEVLOG → PRD/FSD/TSD/ERD/wireframe → catat discrepancy. Tanpa ubah kode/backlog/tasklist/devlog/fitur.*
