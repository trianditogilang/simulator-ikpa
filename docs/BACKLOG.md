# BACKLOG — Simulator Penilaian IKPA

Dokumen ini adalah tracker operasional pelaksanaan [TASK-LIST-Simulator-IKPA.md](TASK-LIST-Simulator-IKPA.md). Setiap agent wajib memperbaruinya ketika mulai, terblokir, membutuhkan perbaikan, atau menyelesaikan task.

## Aturan Status

| Status | Arti |
|---|---|
| `Ready` | Dependensi terpenuhi dan task dapat diambil |
| `In Progress` | Sedang dikerjakan oleh satu agent |
| `Blocked` | Tidak dapat dilanjutkan; penyebab dan next action wajib dicatat |
| `Needs Fix` | Implementasi tersedia tetapi verifikasi/DoD belum lulus |
| `Completed` | Scope, DoD, verifikasi, DEVLOG, dan checkbox task sudah lengkap |

## Aturan Pembaruan Agent

- Gunakan satu baris per task ID; perbarui baris yang sama, jangan membuat duplikat.
- Isi `Owner/Role` dan `Model` ketika task mulai dikerjakan.
- Status `Completed` hanya boleh diberikan setelah verifikasi lulus.
- Cantumkan file implementasi; file metadata `TASK-LIST`, `BACKLOG`, dan `DEVLOG` tidak perlu diulang pada kolom file.
- Bukti dapat berupa command test/build/lint, hasil review dokumen, screenshot/prototype acceptance, atau tautan artefak yang relevan.
- Setiap perubahan status wajib memiliki entri pendamping di `DEVLOG.md`.

## Tracker

| Task ID | Status | Task | Owner/Role | Model | Started | Updated/Completed | File implementasi | Bukti/Catatan |
|---|---|---|---|---|---|---|---|---|
| F0-12 | Completed | Buat katalog mock scenario | Primary Agent / UI/UX Designer | Luna Max | 2026-08-31 | 2026-08-31 | `docs/mock-scenarios.md` | Katalog 9 scenario wajib dengan data minimum, expected UI desktop/mobile, CTA, pemulihan, accessibility, dan scope guardrail; audit cakupan, placeholder, link, dan diff check lulus. |
| F0-11 | Completed | Definisikan kontrak frontend bersama | Primary Agent / Solution Architect | Sol Medium | 2026-08-31 | 2026-08-31 | `packages/contracts/src/index.ts`; `packages/contracts/src/schemas.ts`; `packages/contracts/src/schemas.test.ts` | Zod schema dan inferred type untuk akses eksklusif, konteks global, indikator, snapshot, policy dinamis, delivery, pagination, filter, serta structured error tersedia tanpa dependensi UI/database; typecheck, smoke test 1/1, lint, build, dan diff check lulus. |
| F0-10 | Completed | Tetapkan kebijakan retensi dan klasifikasi data | Primary Agent / Security Agent | Sol Medium | 2026-08-31 | 2026-08-31 | `docs/data-retention-and-classification.md` | Dokumen 299 baris; baseline regulasi/JRA, empat klasifikasi, retensi audit/snapshot/import/delivery/personal/log, policy dinamis berversi, redaction, legal hold, deletion ledger, dan backup restore ditetapkan; audit lulus. |
| F0-09 | Completed | Putuskan akses ganda Admin/Operator | Primary Agent / Product & IKPA Analyst | Luna Max | 2026-08-31 | 2026-08-31 | `docs/adr/ADR-007-access-precedence.md` | ADR 175 baris; satu email satu jenis akses, redirect deterministik, picker multi-satker, server-side scope validation, session behavior, fail-closed conflict, transaksi, dan audit ditetapkan. |
| F0-08 | Completed | Pilih dependency decimal, XLSX, PDF, dan storage import | Primary Agent / Solution Architect | Sol Medium | 2026-08-31 | 2026-08-31 | `docs/adr/ADR-006-runtime-dependencies.md` | ADR 236 baris; memilih `big.js`, `exceljs`, `@react-pdf/renderer`, serta private R2 direct upload; seluruh dimensi DoD dan audit whitespace lulus. |
| F0-07 | Completed | Tetapkan struktur monorepo dan package manager | Primary Agent / Solution Architect | Luna Max | 2026-08-31 | 2026-08-31 | `docs/adr/ADR-005-repository-structure.md` | ADR 321 baris; npm workspaces, mapping `apps/web`, boundary package, dependency direction, server/browser boundary, dan migration sequence ditetapkan; audit 0 placeholder. |
| F0-06 | Completed | Putuskan resolver versi rule set | Primary Agent / Solution Architect | Luna Max | 2026-08-31 | 2026-08-31 | `docs/adr/ADR-004-rule-set-resolution.md` | ADR 312 baris; effective range half-open, publish/retire, overlap, rollback, no-rule, stale context, dan snapshot pinning ditetapkan; audit 0 placeholder. |
| F0-05 | Completed | Putuskan semantik lead time termasuk H-0 | Primary Agent / Solution Architect | Luna Max | 2026-08-31 | 2026-08-31 | `docs/adr/ADR-003-reminder-lead-days.md` | ADR 261 baris; `allowedLeadDays`/`requiredLeadDays`, H-0, timezone, deadline time, error contract, migrasi, dan follow-up ditetapkan; audit 0 placeholder. |
| F0-04 | Completed | Putuskan versioning kalender kerja | Primary Agent / Solution Architect | Luna Max | 2026-08-31 | 2026-08-31 | `docs/adr/ADR-002-workday-versioning.md` | ADR 289 baris; calendar version terpisah immutable, binding rule set, referensi snapshot/delivery, lifecycle, migration, dan delete policy; audit 0 placeholder. |
| F0-03 | Completed | Putuskan interpretasi kalender kerja dan H+17/H-0 | Primary Agent / Product & IKPA Analyst | Luna Max | 2026-08-31 | 2026-08-31 | `docs/adr/ADR-001-workday-boundaries.md` | ADR 170 baris; start-exclusive/end-inclusive, LocalDate, timezone, override, H-0, dan contoh boundary tervalidasi. |
| F0-02 | Completed | Dokumentasikan status verifikasi parameter IKPA 2026 | Primary Agent / Product & IKPA Analyst | Sol Medium | 2026-08-31 | 2026-08-31 | `docs/regulatory-verification-2026.md` | 66 parameter unik: 44 verified, 22 needs_verification; 7 sumber resmi; 0 placeholder. |
| F0-01 | Completed | Buat matriks traceability requirement-ke-fitur | Primary Agent / Product & IKPA Analyst | Sol Medium | 2026-08-31 | 2026-08-31 | `docs/traceability-matrix.md` | 199 baris pemetaan; 131 task ID unik tervalidasi; 0 referensi task invalid; 0 placeholder. |
| DOC-001 | Completed | Tetapkan protokol wajib pembaruan backlog dan devlog | Primary Agent / Technical Writer | Sol Medium | 2026-08-31 | 2026-08-31 | `docs/TASK-LIST-Simulator-IKPA.md`; `docs/BACKLOG.md`; `docs/DEVLOG.md` | Protokol, template, status, dan pengecualian metadata telah ditambahkan. |

## Catatan Sinkronisasi

- Jika status di tracker berbeda dengan checkbox task list, gunakan status yang paling konservatif dan perbaiki keduanya sebelum pekerjaan berikutnya dimulai.
- `DEVLOG.md` adalah catatan kronologis append-only; BACKLOG adalah status terkini.
