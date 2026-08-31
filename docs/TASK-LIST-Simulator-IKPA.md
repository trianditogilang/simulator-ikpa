# TASK LIST — Simulator Penilaian IKPA

**Basis:** PRD v1.3, FSD v1.0, TSD v1.0, ERD v1.0, UI/UX Design System v1.0, dan UI/UX Wireframes v1.0  
**Strategi delivery:** UI-first dengan dummy data yang contract-driven, dilanjutkan backend, kemudian integrasi bertahap per domain   
**Status:** Siap dijadikan backlog implementasi setelah decision gate Fase 0 diselesaikan

> Simulator adalah alat bantu internal, bukan sumber nilai IKPA resmi. Parameter 2026 yang belum diverifikasi tidak boleh dianggap final atau mandatory.

## 1. Cara Menggunakan Task List

- Kerjakan task sesuai dependensi, bukan hanya urutan nomor.
- Task **[Model: Luna Max]** dibatasi maksimal **1–2 file**. File hasil generate, lockfile, dan migration SQL tetap dihitung sebagai file yang disentuh.
- Jika saat eksekusi task Luna ternyata membutuhkan file ketiga, pecah menjadi task baru. Jangan memperluas scope diam-diam.
- Task **[Model: Sol Medium]** dipakai untuk migrasi struktur, perubahan lintas-modul, investigasi regulasi, integrasi kompleks, security review, E2E, atau pekerjaan long-running.
- Pada Fase UI, komponen hanya membaca kontrak dan mock service. Komponen dilarang mengimpor fixture mentah secara langsung agar penggantian ke backend tidak memerlukan rewrite UI.
- Setiap task harus lulus Definition of Done-nya sebelum task dependen dimulai.
- Setiap agent yang menyelesaikan task **wajib** memperbarui `docs/BACKLOG.md` dan menambahkan catatan append-only ke `docs/DEVLOG.md` sebelum menyerahkan hasil.
- Agent juga menandai checkbox task pada file ini setelah seluruh DoD dan verifikasi lulus. Task yang masih gagal verifikasi tidak boleh ditandai selesai.
- `TASK-LIST-Simulator-IKPA.md`, `BACKLOG.md`, dan `DEVLOG.md` adalah **file metadata operasional**. Ketiganya wajib diperbarui tetapi tidak dihitung dalam batas 1–2 file implementasi untuk task Luna Max.
- `src/routeTree.gen.ts`, migration, snapshot, dan file generator lain tidak diedit manual.

### Protokol Penyelesaian Task untuk Semua Agent

Sebelum menyatakan task selesai, agent harus menjalankan urutan berikut:

1. Pastikan scope file, acceptance criteria, dan Definition of Done task terpenuhi.
2. Jalankan verifikasi yang relevan dan catat command serta hasil ringkasnya.
3. Perbarui baris task di `docs/BACKLOG.md` menjadi `Completed`, termasuk tanggal, agent/role, model, file implementasi, dan bukti verifikasi.
4. Tambahkan entri baru di bagian paling atas log `docs/DEVLOG.md`; entri lama tidak boleh ditimpa atau dihapus.
5. Tandai checkbox task pada file ini dari `[ ]` menjadi `[x]`.
6. Bila task diblokir atau gagal verifikasi, gunakan status `Blocked`/`Needs Fix` di backlog dan tulis penyebab serta next action di devlog; checkbox tetap `[ ]`.

Minimum isi entri DEVLOG: task ID, ringkasan hasil, role/agent, model, file yang berubah, keputusan penting, verifikasi, risiko/known issue, dan task berikutnya yang terbuka.

## 2. Role Agent

| Role agent | Tanggung jawab utama |
|---|---|
| Product & IKPA Analyst | Traceability requirement, keputusan scope, asumsi dan verifikasi regulasi |
| Solution Architect | Boundary modul, ADR, kontrak lintas-layer, dependency sequencing |
| UI/UX Designer | Token, pola interaksi, responsive states, prototype acceptance |
| Frontend Foundation Agent | Workspace web, design system, layout, shared components |
| Frontend Operator Agent | Seluruh area Operator Satker |
| Frontend Admin Agent | Seluruh area Admin KPPN |
| Domain Engine Agent | Engine IKPA deterministik dan golden tests |
| Database Agent | Drizzle schema, migration, seed, constraint, scoped query |
| Auth & Access Agent | Clerk, access resolver, route guard, tenant isolation |
| Backend Domain Agent | Server functions/query/mutation domain operasional |
| Policy & Reminder Agent | Rule set, compliance guard, deadline, scheduler, delivery |
| Import & Export Agent | CSV/XLSX, job import, PDF/XLSX export |
| QA Agent | Unit, integration, component, E2E, regression |
| Security Agent | Threat model, webhook signature, isolation, upload/export security |
| DevOps Agent | Environment, CI/CD, Vercel, Cloudflare, observability |
| Technical Writer | Panduan pengguna, runbook, dokumentasi keputusan dan handoff |

## 3. Hasil Review dan Decision Gate

Temuan berikut harus diakomodasi sebelum implementasi terkait dianggap final:

1. Repo saat ini masih satu aplikasi TanStack Start minimal, sedangkan TSD mengusulkan monorepo. Task list memilih migrasi terkontrol ke struktur TSD sebelum halaman UI bertambah banyak.
2. Daftar kode revisi, kurva deviasi, bucket kontrak, aturan BLU, KKP/UP-TUP, dan event mandatory 2026 belum tervalidasi formal.
3. Interpretasi BAST/BAPP sebagai hari ke-0 atau hari ke-1 serta makna H-0 belum dikunci.
4. `minLeadDays >= 1` bertentangan dengan contoh delivery H-0. Kontrak policy perlu memakai `allowedLeadDays` atau aturan override yang eksplisit.
5. Kalender kerja pada ERD hanya diikat ke tahun, sementara dokumen menghendaki histori/versioning. Desain final harus mencegah perubahan kalender mengubah interpretasi histori.
6. Strategi memilih rule set pada rentang tanggal efektif dan aturan hanya satu versi aktif perlu constraint/resolver yang eksplisit.
7. Storage file import belum final: R2 bersifat opsional, sedangkan runtime Vercel tidak cocok untuk penyimpanan file permanen.
8. Library decimal, parser XLSX, dan generator PDF belum dipilih.
9. Retensi audit, snapshot, import file, dan notification delivery harus diputuskan sebelum produksi.
10. Pengguna yang memiliki mapping Admin dan Operator diarahkan ke Admin berdasarkan TSD; kebutuhan switch context harus diputuskan secara eksplisit.

## 4. Fase 0 — Governance, Kontrak, dan Keputusan Arsitektur

- [x] **F0-01 — Buat matriks traceability requirement-ke-fitur.** [Role: Product & IKPA Analyst] [Model: Sol Medium]  
  **File:** `docs/traceability-matrix.md`  
  **DoD:** Seluruh PUB/OPS/ADM, acceptance criteria PRD/FSD, tabel ERD, state wireframe, dan test TSD memiliki ID implementasi serta status MVP.

- [x] **F0-02 — Dokumentasikan status verifikasi parameter IKPA 2026.** [Role: Product & IKPA Analyst] [Model: Sol Medium]  
  **File:** `docs/regulatory-verification-2026.md`  
  **DoD:** Setiap parameter memiliki nilai sementara, sumber, pemilik verifikasi, status `verified/needs_verification`, dan larangan go-live bila belum valid.

- [x] **F0-03 — Putuskan interpretasi kalender kerja dan H+17/H-0.** [Role: Product & IKPA Analyst] [Model: Luna Max]  
  **File:** `docs/adr/ADR-001-workday-boundaries.md`  
  **Depends:** F0-02  
  **DoD:** Inklusivitas tanggal awal/akhir, weekend, override hari kerja, timezone, dan contoh lintas bulan terdokumentasi tanpa ambiguitas.

- [x] **F0-04 — Putuskan versioning kalender kerja.** [Role: Solution Architect] [Model: Luna Max]
  **File:** `docs/adr/ADR-002-workday-versioning.md`  
  **Depends:** F0-03  
  **DoD:** Memilih kalender immutable per rule set atau calendar version terpisah, termasuk dampak ERD dan snapshot.

- [x] **F0-05 — Putuskan semantik lead time termasuk H-0.** [Role: Solution Architect] [Model: Luna Max]
  **File:** `docs/adr/ADR-003-reminder-lead-days.md`  
  **DoD:** Konflik `minLeadDays >= 1` versus H-0 diselesaikan dan schema final dijelaskan.

- [x] **F0-06 — Putuskan resolver versi rule set.** [Role: Solution Architect] [Model: Luna Max]
  **File:** `docs/adr/ADR-004-rule-set-resolution.md`  
  **DoD:** Aturan effective range, publish, retire, overlap, rollback, dan histori snapshot eksplisit.

- [x] **F0-07 — Tetapkan struktur monorepo dan package manager.** [Role: Solution Architect] [Model: Luna Max]
  **File:** `docs/adr/ADR-005-repository-structure.md`  
  **DoD:** Memilih npm workspaces atau alternatif, mapping starter saat ini ke `apps/web`, serta boundary `db`, `ikpa-engine`, `policy-reminder`, `access-control`, dan `ui`.

- [x] **F0-08 — Pilih dependency decimal, XLSX, PDF, dan storage import.** [Role: Solution Architect] [Model: Sol Medium]
  **File:** `docs/adr/ADR-006-runtime-dependencies.md`  
  **DoD:** Pilihan dibandingkan dari presisi, keamanan, serverless compatibility, ukuran bundle, lisensi, dan maintenance.

- [x] **F0-09 — Putuskan akses ganda Admin/Operator.** [Role: Product & IKPA Analyst] [Model: Luna Max]
  **File:** `docs/adr/ADR-007-access-precedence.md`  
  **DoD:** Redirect default, pilihan satker, pergantian konteks, dan session behavior ditetapkan.

- [x] **F0-10 — Tetapkan kebijakan retensi dan klasifikasi data.** [Role: Security Agent] [Model: Sol Medium]
  **File:** `docs/data-retention-and-classification.md`  
  **DoD:** Retensi audit/snapshot/import/delivery, data personal, redaction log, dan prosedur penghapusan disetujui.

- [x] **F0-11 — Definisikan kontrak frontend bersama.** [Role: Solution Architect] [Model: Sol Medium]
  **Files:** `packages/contracts/src/index.ts`, `packages/contracts/src/schemas.ts`  
  **Depends:** F0-03–F0-09  
  **DoD:** DTO akses, konteks global, indikator, snapshot, policy, delivery, pagination, filter, dan structured error tersedia tanpa dependensi UI/database.

- [x] **F0-12 — Buat katalog mock scenario.** [Role: UI/UX Designer] [Model: Luna Max]
  **File:** `docs/mock-scenarios.md`  
  **Depends:** F0-11  
  **DoD:** Scenario normal, empty, incomplete, risky, stale rule set, policy locked, delivery failed, unauthorized, dan server error memiliki expected UI.

## 5. Fase 1 — Workspace dan UI Foundation

- [x] **F1-01 — Migrasikan starter ke workspace target.** [Role: Solution Architect] [Model: Sol Medium]
  **Scope:** Struktur root, `apps/web`, dan `packages/*` sesuai ADR-005  
  **Depends:** F0-07  
  **DoD:** `npm install`, dev server, route generation, typecheck, lint, dan build starter lulus tanpa kehilangan riwayat source.

- [x] **F1-02 — Pasang dependency UI yang sudah disetujui.** [Role: Frontend Foundation Agent] [Model: Luna Max]
  **Files:** `package.json`, `package-lock.json`  
  **Depends:** F1-01  
  **DoD:** shadcn/Radix, lucide-react, Recharts, form/validation, dan test UI tersedia dengan versi terkunci.

- [x] **F1-03 — Konfigurasi token warna dan typography.** [Role: Frontend Foundation Agent] [Model: Luna Max]
  **Files:** `apps/web/src/styles.css`, `apps/web/src/lib/design-tokens.ts`  
  **DoD:** Token sesuai design system, Inter, tabular numbers, focus ring, semantic statuses, dan reduced motion tersedia.

- [x] **F1-04 — Buat primitive status dan badge.** [Role: Frontend Foundation Agent] [Model: Luna Max]
  **Files:** `packages/ui/src/components/status-badge.tsx`, `packages/ui/src/components/rule-set-badge.tsx`  
  **Depends:** F1-03  
  **DoD:** Status tidak bergantung warna saja dan memiliki label serta accessible name.

- [x] **F1-05 — Buat komponen context header.** [Role: Frontend Foundation Agent] [Model: Luna Max]
  **Files:** `packages/ui/src/components/context-header.tsx`, `packages/ui/src/components/context-selector.tsx`  
  **Depends:** F0-11, F1-03  
  **DoD:** Satker/KPPN, tahun, periode, mode akses, dan rule set tampil responsif.

- [x] **F1-06 — Buat state loading dan error.** [Role: Frontend Foundation Agent] [Model: Luna Max]
  **Files:** `packages/ui/src/components/loading-state.tsx`, `packages/ui/src/components/error-state.tsx`  
  **DoD:** Skeleton mempertahankan layout; error menampilkan retry dan request ID aman.

- [x] **F1-07 — Buat state empty dan incomplete.** [Role: Frontend Foundation Agent] [Model: Luna Max]
  **Files:** `packages/ui/src/components/empty-state.tsx`, `packages/ui/src/components/incomplete-state.tsx`  
  **DoD:** Kedua state memiliki penjelasan, domain terdampak, dan CTA kontekstual.

- [x] **F1-08 — Buat komponen disclaimer dan policy lock.** [Role: Frontend Foundation Agent] [Model: Luna Max]
  **Files:** `packages/ui/src/components/simulation-disclaimer.tsx`, `packages/ui/src/components/policy-lock-alert.tsx`  
  **DoD:** Disclaimer nilai tidak resmi dan alasan field terkunci dapat dipakai lintas halaman.

- [x] **F1-09 — Buat shell publik.** [Role: Frontend Foundation Agent] [Model: Luna Max]
  **Files:** `apps/web/src/components/layout/public-shell.tsx`, `apps/web/src/components/layout/public-header.tsx`  
  **DoD:** Header, content width, mobile layout, dan CTA login sesuai wireframe.

- [x] **F1-10 — Buat shell Operator.** [Role: Frontend Foundation Agent] [Model: Luna Max]
  **Files:** `apps/web/src/components/layout/operator-shell.tsx`, `apps/web/src/components/layout/operator-navigation.tsx`  
  **Depends:** F1-05  
  **DoD:** Sidebar desktop, sheet/bottom navigation mobile, dan active route lengkap.

- [x] **F1-11 — Buat shell Admin KPPN.** [Role: Frontend Foundation Agent] [Model: Luna Max]
  **Files:** `apps/web/src/components/layout/admin-shell.tsx`, `apps/web/src/components/layout/admin-navigation.tsx`  
  **Depends:** F1-05  
  **DoD:** Mode Admin terlihat jelas dan shortcut policy tersedia pada mobile.

- [x] **F1-12 — Buat format lokal Indonesia.** [Role: Frontend Foundation Agent] [Model: Luna Max]
  **Files:** `apps/web/src/lib/format.ts`, `apps/web/src/lib/format.test.ts`  
  **DoD:** Rupiah, persen, permil, nilai, tanggal, waktu WIB, dan selisih poin teruji.

- [x] **F1-13 — Buat antarmuka mock service.** [Role: Frontend Foundation Agent] [Model: Luna Max]
  **Files:** `apps/web/src/mocks/service.ts`, `apps/web/src/mocks/scenario.ts`  
  **Depends:** F0-11, F0-12  
  **DoD:** UI dapat memilih scenario dan menerima Promise/structured error seperti backend.

## 6. Fase 2 — UI Publik dan Akses dengan Dummy Data

- [ ] **F2-01 — Buat landing page content component.** [Role: Frontend Foundation Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/components/public/landing-content.tsx`, `apps/web/src/components/public/indicator-summary.tsx`  
  **Depends:** F1-09  
  **DoD:** Hero, manfaat, indikator, disclaimer, dan CTA sesuai WF-01.

- [ ] **F2-02 — Hubungkan route landing page.** [Role: Frontend Foundation Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/index.tsx`, `apps/web/src/routeTree.gen.ts`  
  **Depends:** F2-01  
  **DoD:** Route publik responsif dan metadata dasar benar.

- [ ] **F2-03 — Buat UI sign-in dummy.** [Role: Frontend Foundation Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/components/public/sign-in-panel.tsx`, `apps/web/src/routes/sign-in.tsx`  
  **DoD:** Loading, error, reset/MFA placeholder, dan redirect intent divisualisasikan tanpa auth nyata.

- [ ] **F2-04 — Buat halaman akses belum diberikan.** [Role: Frontend Foundation Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/components/access/access-pending.tsx`, `apps/web/src/routes/access-pending.tsx`  
  **DoD:** Email tersamarkan, instruksi Admin KPPN, logout dummy, dan state mobile tersedia.

- [ ] **F2-05 — Buat halaman pilih satker.** [Role: Frontend Foundation Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/components/access/org-picker.tsx`, `apps/web/src/routes/select-organization.tsx`  
  **Depends:** F0-09  
  **DoD:** Search, daftar satker, empty state, dan active selection sesuai WF-04.

## 7. Fase 3 — UI Operator dengan Dummy Data

- [ ] **F3-01 — Buat fixture konteks dan dashboard Operator.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/mocks/operator-context.ts`, `apps/web/src/mocks/operator-dashboard.ts`  
  **Depends:** F1-13  
  **DoD:** Scenario lengkap, incomplete, risky, dan no-deadline memenuhi kontrak bersama.

- [ ] **F3-02 — Buat kartu skor utama dan indikator.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/components/operator/score-card.tsx`, `apps/web/src/components/operator/indicator-card.tsx`  
  **DoD:** Target, gap, kontribusi, tren, kelengkapan, rule set, dan disclaimer tampil.

- [ ] **F3-03 — Buat panel deadline dan rekomendasi.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/components/operator/deadline-panel.tsx`, `apps/web/src/components/operator/recommendation-list.tsx`  
  **DoD:** Urgensi, indikator, deadline absolut/relatif, serta CTA input tersedia.

- [ ] **F3-04 — Buat halaman Dashboard Operator.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/dashboard.tsx`, `apps/web/src/routeTree.gen.ts`  
  **Depends:** F3-01–F3-03  
  **DoD:** Semua state WF-OPS-01 dapat dipilih melalui mock scenario.

- [ ] **F3-05 — Buat form konteks simulasi.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/components/operator/simulation-context-form.tsx`, `apps/web/src/components/operator/simulation-mode-tabs.tsx`  
  **DoD:** Actual/forecast/scenario, target, periode, BLU, dan unsaved state tampil jelas.

- [ ] **F3-06 — Buat panel hasil simulasi dummy.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/components/operator/simulation-result.tsx`, `apps/web/src/components/operator/formula-trace.tsx`  
  **DoD:** Breakdown, override highlight, delta poin, warning, missing data, dan trace formula tersedia.

- [ ] **F3-07 — Buat route Simulasi IKPA.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/simulation.tsx`, `apps/web/src/routeTree.gen.ts`  
  **Depends:** F3-05, F3-06  
  **DoD:** Panel hasil sticky desktop dan summary expandable mobile sesuai WF-OPS-02.

- [ ] **F3-08 — Buat pola tabel/form input reusable.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/components/data/domain-data-table.tsx`, `apps/web/src/components/data/domain-form-drawer.tsx`  
  **DoD:** Loading, empty, error, pagination, filter, CRUD dummy, dirty state, dan confirmation tersedia.

- [ ] **F3-09 — Buat UI Pagu & Revisi DIPA.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/data/budget-revisions.tsx`, `apps/web/src/mocks/budget-revisions.ts`  
  **Depends:** F3-08  
  **DoD:** Pagu 51/52/53/57, histori revisi, eligibility, semester, dan NKRA dummy tampil.

- [ ] **F3-10 — Buat UI RPD & Realisasi.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/data/rpd-realization.tsx`, `apps/web/src/mocks/rpd-realization.ts`  
  **Depends:** F3-08  
  **DoD:** Grid bulanan, edit massal dummy, deviasi, penyerapan, dan chart placeholder responsif.

- [ ] **F3-11 — Buat UI Kontrak & Tagihan.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/data/contracts-invoices.tsx`, `apps/web/src/mocks/contracts-invoices.ts`  
  **Depends:** F3-08  
  **DoD:** Tabs kontrak/tagihan/risiko, detail drawer, H+17, eligibility, dan status deadline tampil.

- [ ] **F3-12 — Buat UI UP/TUP & KKP.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/data/up-tup-kkp.tsx`, `apps/web/src/mocks/up-tup-kkp.ts`  
  **Depends:** F3-08  
  **DoD:** Transaksi, interval, ringkasan tunai, target KKP, dan deadline dummy tampil.

- [ ] **F3-13 — Buat UI Capaian Output.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/data/output-achievement.tsx`, `apps/web/src/mocks/output-achievement.ts`  
  **Depends:** F3-08  
  **DoD:** RO bulanan, konfirmasi, deadline, nilai eligibility, dan warning tampil.

- [ ] **F3-14 — Buat UI SPM Dispensasi.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/data/spm-dispensation.tsx`, `apps/web/src/mocks/spm-dispensation.ts`  
  **Depends:** F3-08  
  **DoD:** Total Q4, dispensasi, rasio permil, pengurang, dan proyeksi risiko tampil.

- [ ] **F3-15 — Buat wizard Import Data dummy.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/import.tsx`, `apps/web/src/mocks/import-job.ts`  
  **DoD:** Pilih file, validasi, preview, error row, confirm commit, progress async, dan result state tersedia.

- [ ] **F3-16 — Buat UI Skenario & Riwayat.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/history.tsx`, `apps/web/src/mocks/simulations.ts`  
  **DoD:** List, filter, soft-delete dialog, duplicate, compare dua skenario, dan stale rule set banner tersedia.

- [ ] **F3-17 — Buat UI Analisis & Rekomendasi.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/analysis.tsx`, `apps/web/src/mocks/analysis.ts`  
  **DoD:** Filter, prioritas, dampak, urgensi, deadline, dan deep-link ke input tampil.

- [ ] **F3-18 — Buat UI Reminder Center.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/reminders.tsx`, `apps/web/src/mocks/reminders.ts`  
  **DoD:** Mandatory lock, preview jadwal, recipient, lead time, escalation, digest, reset default, dan invalid policy state tersedia.

- [ ] **F3-19 — Buat UI Laporan & Ekspor.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/reports.tsx`, `apps/web/src/mocks/reports.ts`  
  **DoD:** Filter, preview isi laporan, pilihan XLSX/PDF, disclaimer, dan status generate dummy tersedia.

- [ ] **F3-20 — Buat UI Panduan IKPA.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/guides.tsx`, `apps/web/src/mocks/guides.ts`  
  **DoD:** Delapan topik, formula, contoh, istilah, tips, source, dan verification badge tersedia.

- [ ] **F3-21 — Buat UI Pengaturan Satker.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/settings.tsx`, `apps/web/src/mocks/settings.ts`  
  **DoD:** Profil, BLU, timezone, target, rule set, source regulation, dan daftar operator read-only tersedia.

## 8. Fase 4 — UI Admin KPPN dengan Dummy Data

- [ ] **F4-01 — Buat fixture dashboard dan scope Admin.** [Role: Frontend Admin Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/mocks/admin-context.ts`, `apps/web/src/mocks/admin-dashboard.ts`  
  **DoD:** Normal, no-data, risky, delivery-failed, dan policy-changed tersedia.

- [ ] **F4-02 — Buat UI Dashboard Monitoring Admin.** [Role: Frontend Admin Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/admin-kppn/dashboard.tsx`, `apps/web/src/components/admin/risk-overview.tsx`  
  **Depends:** F4-01  
  **DoD:** Agregat, distribusi status, tren, satker prioritas, deadline, delivery, dan rule set tampil.

- [ ] **F4-03 — Buat UI Daftar Satker.** [Role: Frontend Admin Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/admin-kppn/organizations/index.tsx`, `apps/web/src/mocks/admin-organizations.ts`  
  **DoD:** Search/filter/pagination, card mobile, skor, gap, risiko, deadline, dan update time tersedia.

- [ ] **F4-04 — Buat UI Detail Satker read-only.** [Role: Frontend Admin Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/admin-kppn/organizations/$orgId.tsx`, `apps/web/src/mocks/admin-organization-detail.ts`  
  **DoD:** Dashboard, indikator, snapshot, reminder, audit relevan, export, dan tanpa aksi edit operasional.

- [ ] **F4-05 — Buat UI Monitoring Risiko & Reminder.** [Role: Frontend Admin Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/admin-kppn/monitoring/reminders.tsx`, `apps/web/src/mocks/admin-reminders.ts`  
  **DoD:** Filter lintas satker, detail delivery drawer, error aman, dan retry confirmation dummy tersedia.

- [ ] **F4-06 — Buat UI Laporan Agregat.** [Role: Frontend Admin Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/admin-kppn/reports.tsx`, `apps/web/src/mocks/admin-reports.ts`  
  **DoD:** Rekap nilai, indikator, risiko, kelengkapan, delivery, filter scope, dan preview export tersedia.

- [ ] **F4-07 — Buat UI daftar Rule Set.** [Role: Frontend Admin Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/admin-kppn/policy/rule-sets/index.tsx`, `apps/web/src/mocks/rule-sets.ts`  
  **DoD:** Draft/published/retired, version, effective date, source, compare, clone, dan action availability tampil.

- [ ] **F4-08 — Buat UI editor dan publish Rule Set.** [Role: Frontend Admin Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/admin-kppn/policy/rule-sets/$ruleSetId.tsx`, `apps/web/src/components/admin/rule-set-publish-dialog.tsx`  
  **DoD:** Sectioned editor, validation summary, assumptions, diff, impact reminder, dan explicit confirmation tersedia.

- [ ] **F4-09 — Buat UI Reminder Policy.** [Role: Frontend Admin Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/admin-kppn/policy/reminders.tsx`, `apps/web/src/mocks/reminder-policies.ts`  
  **DoD:** Event, category, deadline DSL summary, allowed lead days, recipient, active state, dan validation preview tersedia.

- [ ] **F4-10 — Buat UI Kalender Hari Kerja.** [Role: Frontend Admin Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/admin-kppn/policy/workdays.tsx`, `apps/web/src/mocks/workdays.ts`  
  **Depends:** F0-04  
  **DoD:** Kalender desktop/mobile, import preview, holiday/workday override, version, dan deadline impact tersedia.

- [ ] **F4-11 — Buat UI Riwayat Versi Policy.** [Role: Frontend Admin Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/admin-kppn/policy/history.tsx`, `apps/web/src/mocks/policy-history.ts`  
  **DoD:** Diff versi, snapshot/delivery usage, publish actor, dan upcoming schedule impact tampil.

- [ ] **F4-12 — Buat UI Audit Log.** [Role: Frontend Admin Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/admin-kppn/audit-logs.tsx`, `apps/web/src/mocks/audit-logs.ts`  
  **DoD:** Filter, actor/action/entity/time, before-after drawer, rule set, policy, dan request ID tersedia tanpa JSON mentah default.

- [ ] **F4-13 — Buat UI Manajemen Akses.** [Role: Frontend Admin Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/admin-kppn/access.tsx`, `apps/web/src/mocks/access-management.ts`  
  **DoD:** Add/edit/disable/delete dummy, dynamic scope field, verified identity state, dan proteksi admin terakhir divisualisasikan.

## 9. Fase 5 — UI Review dan Prototype Acceptance

- [ ] **F5-01 — Audit konsistensi desktop/tablet/mobile seluruh P0.** [Role: UI/UX Designer] [Model: Sol Medium]  
  **Scope:** Seluruh route UI Fase 2–4  
  **DoD:** Temuan dikelompokkan blocker/major/minor dan setiap perbaikan dibuat sebagai task Luna 1–2 file.

- [ ] **F5-02 — Audit aksesibilitas UI.** [Role: QA Agent] [Model: Sol Medium]  
  **Scope:** Keyboard, focus, semantics, contrast, label, dialog, table/card mobile, reduced motion  
  **DoD:** Alur P0 dapat digunakan keyboard dan tidak menggunakan warna sebagai satu-satunya penanda.

- [ ] **F5-03 — Buat component test untuk system states.** [Role: QA Agent] [Model: Luna Max]  
  **Files:** `packages/ui/src/components/system-states.test.tsx`, `packages/ui/src/components/system-states.stories.tsx`  
  **DoD:** Loading, empty, incomplete, error, policy lock, dan stale rule set tervalidasi visual/fungsional.

- [ ] **F5-04 — Buat smoke test navigasi mock.** [Role: QA Agent] [Model: Sol Medium]  
  **Scope:** Login dummy → Operator/Admin → seluruh route P0  
  **DoD:** Tidak ada route putus, console error, overflow kritis, atau state tanpa CTA.

- [ ] **F5-05 — Laksanakan acceptance UI bersama stakeholder.** [Role: Product & IKPA Analyst] [Model: Sol Medium]  
  **File:** `docs/ui-acceptance-report.md`  
  **Depends:** F5-01–F5-04  
  **DoD:** Setiap wireframe P0 diterima atau memiliki change request bernomor sebelum backend dimulai.

## 10. Fase 6 — Domain Engine IKPA

- [ ] **F6-01 — Buat schema input/output engine.** [Role: Domain Engine Agent] [Model: Luna Max]  
  **Files:** `packages/ikpa-engine/src/schemas.ts`, `packages/ikpa-engine/src/types.ts`  
  **Depends:** F0-02, F0-11  
  **DoD:** Decimal-safe, incomplete state, formula trace, warning, recommendation, rule set ID/version tervalidasi.

- [ ] **F6-02 — Buat rule set parser dan invariant.** [Role: Domain Engine Agent] [Model: Luna Max]  
  **Files:** `packages/ikpa-engine/src/rule-set.ts`, `packages/ikpa-engine/src/rule-set.test.ts`  
  **DoD:** Bobot, bucket overlap, rounding, assumption status, dan parameter money diuji.

- [ ] **F6-03 — Implementasikan indikator Revisi DIPA.** [Role: Domain Engine Agent] [Model: Luna Max]  
  **Files:** `packages/ikpa-engine/src/indicators/dipa-revision.ts`, `packages/ikpa-engine/src/indicators/dipa-revision.test.ts`  
  **DoD:** Eligibility, semester, non-kumulatif, trace, incomplete, dan golden score 80 lulus.

- [ ] **F6-04 — Implementasikan Deviasi Halaman III DIPA.** [Role: Domain Engine Agent] [Model: Luna Max]  
  **Files:** `packages/ikpa-engine/src/indicators/rpd-deviation.ts`, `packages/ikpa-engine/src/indicators/rpd-deviation.test.ts`  
  **DoD:** Jan–Nov, proporsi pagu, kurva rule set, zero denominator, dan rounding teruji.

- [ ] **F6-05 — Implementasikan Penyerapan Anggaran.** [Role: Domain Engine Agent] [Model: Luna Max]  
  **Files:** `packages/ikpa-engine/src/indicators/absorption.ts`, `packages/ikpa-engine/src/indicators/absorption.test.ts`  
  **DoD:** Kumulatif triwulan, target akun, cap 100, weighted result, dan golden 92,67 lulus.

- [ ] **F6-06 — Implementasikan Belanja Kontraktual.** [Role: Domain Engine Agent] [Model: Luna Max]  
  **Files:** `packages/ikpa-engine/src/indicators/contractual.ts`, `packages/ikpa-engine/src/indicators/contractual.test.ts`  
  **DoD:** Tiga komponen, bucket, kontrak dini, eligibility akun 53, termin, dan assumption warning teruji.

- [ ] **F6-07 — Implementasikan Penyelesaian Tagihan.** [Role: Domain Engine Agent] [Model: Luna Max]  
  **Files:** `packages/ikpa-engine/src/indicators/invoice-timeliness.ts`, `packages/ikpa-engine/src/indicators/invoice-timeliness.test.ts`  
  **Depends:** F0-03  
  **DoD:** Non-pegawai, H+17, kalender, boundary, dan golden 13/15 = 86,67 lulus.

- [ ] **F6-08 — Implementasikan Pengelolaan UP/TUP.** [Role: Domain Engine Agent] [Model: Luna Max]  
  **Files:** `packages/ikpa-engine/src/indicators/up-tup.ts`, `packages/ikpa-engine/src/indicators/up-tup.test.ts`  
  **DoD:** Komponen 50/25/25, weight 90/10, interval, setoran, KKP, incomplete, dan asumsi teruji.

- [ ] **F6-09 — Implementasikan Capaian Output.** [Role: Domain Engine Agent] [Model: Luna Max]  
  **Files:** `packages/ikpa-engine/src/indicators/output-achievement.ts`, `packages/ikpa-engine/src/indicators/output-achievement.test.ts`  
  **DoD:** Timeliness 30%, achievement 70%, confirmation, PCRO/TPCRO, Desember, dan zero case teruji.

- [ ] **F6-10 — Implementasikan pengurang Dispensasi SPM.** [Role: Domain Engine Agent] [Model: Luna Max]  
  **Files:** `packages/ikpa-engine/src/indicators/spm-dispensation.ts`, `packages/ikpa-engine/src/indicators/spm-dispensation.test.ts`  
  **DoD:** Permil, bucket boundaries, zero denominator, dan golden 24/5200 → 0,75 lulus.

- [ ] **F6-11 — Implementasikan orchestrator engine.** [Role: Domain Engine Agent] [Model: Luna Max]  
  **Files:** `packages/ikpa-engine/src/calculate.ts`, `packages/ikpa-engine/src/calculate.test.ts`  
  **Depends:** F6-01–F6-10  
  **DoD:** Overlay scenario, seven scores, deduction, total, incomplete flag, rounding, dan determinisme teruji.

- [ ] **F6-12 — Implementasikan recommendation ranking.** [Role: Domain Engine Agent] [Model: Luna Max]  
  **Files:** `packages/ikpa-engine/src/recommendations.ts`, `packages/ikpa-engine/src/recommendations.test.ts`  
  **DoD:** Weight × gap × urgency, stable tie-break, missing data, dan deep-link key teruji.

## 11. Fase 7 — Database dan Backend Foundation

- [ ] **F7-01 — Pasang dependency backend yang disetujui.** [Role: Database Agent] [Model: Luna Max]  
  **Files:** `package.json`, `package-lock.json`  
  **Depends:** F0-08  
  **DoD:** Drizzle/Neon, Zod, decimal, auth, queue, email, import/export dependency terpasang tanpa duplicate runtime.

- [ ] **F7-02 — Konfigurasi environment tervalidasi.** [Role: DevOps Agent] [Model: Luna Max]  
  **Files:** `.env.example`, `apps/web/src/env.server.ts`  
  **DoD:** Public/server secret dipisah, startup gagal jelas bila env wajib tidak ada, dan tidak ada nilai rahasia di repo.

- [ ] **F7-03 — Konfigurasi Drizzle dan client Neon.** [Role: Database Agent] [Model: Luna Max]  
  **Files:** `packages/db/drizzle.config.ts`, `packages/db/src/client.ts`  
  **DoD:** Generate/migrate dapat dijalankan pada database kosong dan koneksi server-only.

- [ ] **F7-04 — Buat enum dan tabel identitas/scope.** [Role: Database Agent] [Model: Luna Max]  
  **Files:** `packages/db/src/schema/enums.ts`, `packages/db/src/schema/identity.ts`  
  **DoD:** `kppn_scopes`, `organizations`, `users`, `user_accesses` beserta check/unique/index sesuai ERD.

- [ ] **F7-05 — Buat tabel rule set, policy, dan kalender.** [Role: Database Agent] [Model: Luna Max]  
  **Files:** `packages/db/src/schema/policy.ts`, `packages/db/src/schema/workdays.ts`  
  **Depends:** F0-04–F0-06  
  **DoD:** Versioning final, effective resolver support, immutable published policy, dan JSONB columns terdefinisi.

- [ ] **F7-06 — Buat tabel fiscal year, budget, dan revisi.** [Role: Database Agent] [Model: Luna Max]  
  **Files:** `packages/db/src/schema/fiscal-years.ts`, `packages/db/src/schema/budget-revisions.ts`  
  **DoD:** FK, numeric, dates, soft delete, unique active rows, dan index tersedia.

- [ ] **F7-07 — Buat tabel RPD dan realisasi.** [Role: Database Agent] [Model: Luna Max]  
  **File:** `packages/db/src/schema/rpd-realizations.ts`  
  **DoD:** Month/account constraints, numeric precision, soft-delete uniqueness, dan index tersedia.

- [ ] **F7-08 — Buat tabel kontrak dan SPM-LS.** [Role: Database Agent] [Model: Luna Max]  
  **Files:** `packages/db/src/schema/contracts.ts`, `packages/db/src/schema/spm-ls.ts`  
  **DoD:** Referential fields, payment type, soft delete, uniqueness, dan deadline query index tersedia.

- [ ] **F7-09 — Buat tabel UP/TUP dan KKP.** [Role: Database Agent] [Model: Luna Max]  
  **Files:** `packages/db/src/schema/up-tup.ts`, `packages/db/src/schema/kkp.ts`  
  **DoD:** Transaction type, dates, numeric precision, monthly uniqueness, dan index tersedia.

- [ ] **F7-10 — Buat tabel output dan SPM Q4.** [Role: Database Agent] [Model: Luna Max]  
  **Files:** `packages/db/src/schema/output-reports.ts`, `packages/db/src/schema/spm-q4.ts`  
  **DoD:** Range checks, confirmation, Q4 validation boundary, uniqueness, dan index tersedia.

- [ ] **F7-11 — Buat tabel simulation dan snapshot.** [Role: Database Agent] [Model: Luna Max]  
  **Files:** `packages/db/src/schema/simulations.ts`, `packages/db/src/schema/score-snapshots.ts`  
  **DoD:** Override JSONB, immutable snapshot support, parent relation, input hash, rule set FK/version, dan index tersedia.

- [ ] **F7-12 — Buat tabel reminder config dan delivery.** [Role: Database Agent] [Model: Luna Max]  
  **Files:** `packages/db/src/schema/reminder-configs.ts`, `packages/db/src/schema/notification-deliveries.ts`  
  **DoD:** Unique config, idempotency key, scheduling index, attempts, status, payload, dan immutable version tersedia.

- [ ] **F7-13 — Buat tabel import dan audit.** [Role: Database Agent] [Model: Luna Max]  
  **Files:** `packages/db/src/schema/import-jobs.ts`, `packages/db/src/schema/audit-logs.ts`  
  **DoD:** Import lifecycle, error report, append-only audit fields, request ID, actor, before/after, dan index tersedia.

- [ ] **F7-14 — Buat relations dan schema barrel.** [Role: Database Agent] [Model: Luna Max]  
  **Files:** `packages/db/src/schema/relations.ts`, `packages/db/src/schema/index.ts`  
  **Depends:** F7-04–F7-13  
  **DoD:** Semua relasi ERD dapat di-query dan tidak menggantikan authorization guard.

- [ ] **F7-15 — Generate dan review migration awal.** [Role: Database Agent] [Model: Sol Medium]  
  **Scope:** Generated Drizzle migration + metadata  
  **Depends:** F7-14  
  **DoD:** Urutan FK valid, migration kosong lulus, constraint/index cocok ERD/ADR, dan rollback strategy terdokumentasi.

- [ ] **F7-16 — Buat seed minimum 2026.** [Role: Database Agent] [Model: Sol Medium]  
  **Scope:** Seed scope, dua admin, satker, operator, fiscal year, rule set, policy, dan kalender  
  **Depends:** F0-02, F7-15  
  **DoD:** Seed idempotent, parameter belum valid diberi `needs_verification`, dan tidak membuat mandatory tanpa keputusan formal.

## 12. Fase 8 — Authentication dan Access Control

- [ ] **F8-01 — Pasang Clerk provider dan middleware global.** [Role: Auth & Access Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/start.ts`, `apps/web/src/routes/__root.tsx`  
  **Depends:** F7-02  
  **DoD:** Clerk middleware aktif untuk request, provider tersedia, route tetap public sampai guard diterapkan.

- [ ] **F8-02 — Implementasikan sinkronisasi user Clerk.** [Role: Auth & Access Agent] [Model: Luna Max]  
  **Files:** `packages/access-control/src/sync-user.ts`, `packages/access-control/src/sync-user.test.ts`  
  **DoD:** Verified identity di-upsert aman dan perubahan email memiliki aturan konflik.

- [ ] **F8-03 — Implementasikan access resolver.** [Role: Auth & Access Agent] [Model: Luna Max]  
  **Files:** `packages/access-control/src/access-resolver.ts`, `packages/access-control/src/access-resolver.test.ts`  
  **Depends:** F0-09, F7-04  
  **DoD:** Unauthorized, satu/multi operator, admin precedence/switching, inactive mapping, dan structured context teruji.

- [ ] **F8-04 — Implementasikan scope guard.** [Role: Auth & Access Agent] [Model: Luna Max]  
  **Files:** `packages/access-control/src/scope-guard.ts`, `packages/access-control/src/scope-guard.test.ts`  
  **DoD:** Operator org isolation dan Admin KPPN scope isolation memiliki positive/negative tests.

- [ ] **F8-05 — Terapkan route guard Operator.** [Role: Auth & Access Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/route.tsx`, `apps/web/src/routeTree.gen.ts`  
  **Depends:** F8-03  
  **DoD:** `beforeLoad` memverifikasi auth server-side dan redirect tidak membocorkan data.

- [ ] **F8-06 — Terapkan route guard Admin.** [Role: Auth & Access Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/admin-kppn/route.tsx`, `apps/web/src/routeTree.gen.ts`  
  **Depends:** F8-03  
  **DoD:** Hanya admin aktif dengan scope valid dapat merender area Admin.

- [ ] **F8-07 — Implementasikan mutasi akses dan proteksi admin terakhir.** [Role: Auth & Access Agent] [Model: Sol Medium]  
  **Scope:** Transaction, lock/count, CRUD mapping, audit, structured error  
  **Depends:** F7-13, F8-04  
  **DoD:** Tidak mungkin menghasilkan scope tanpa admin aktif; seluruh perubahan atomik dan teraudit.

## 13. Fase 9 — Backend Domain Operasional

- [ ] **F9-01 — Buat helper audit mutation.** [Role: Backend Domain Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/server/audit/write-audit.ts`, `apps/web/src/server/audit/write-audit.test.ts`  
  **DoD:** Actor, scope, before/after redacted, entity, version, policy, request ID tersimpan dalam transaksi pemanggil.

- [ ] **F9-02 — Buat query/mutation fiscal year dan settings.** [Role: Backend Domain Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/server/domains/settings.queries.ts`, `apps/web/src/server/domains/settings.mutations.ts`  
  **Depends:** F8-04, F9-01  
  **DoD:** Scoped read/update, timezone/BLU/target validation, uniqueness, dan audit tersedia.

- [ ] **F9-03 — Buat query/mutation Pagu & Revisi.** [Role: Backend Domain Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/server/domains/budget-revisions.queries.ts`, `apps/web/src/server/domains/budget-revisions.mutations.ts`  
  **DoD:** CRUD scoped, rule-set eligibility preview, soft delete, validation, dan audit tersedia.

- [ ] **F9-04 — Buat query/mutation RPD & Realisasi.** [Role: Backend Domain Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/server/domains/rpd-realization.queries.ts`, `apps/web/src/server/domains/rpd-realization.mutations.ts`  
  **DoD:** Upsert bulanan, batch edit, scoped uniqueness, decimal-safe, soft delete, dan audit tersedia.

- [ ] **F9-05 — Buat query/mutation Kontrak & Tagihan.** [Role: Backend Domain Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/server/domains/contracts-invoices.queries.ts`, `apps/web/src/server/domains/contracts-invoices.mutations.ts`  
  **DoD:** Same-fiscal-year relation, H+17 projection, eligibility, CRUD scoped, soft delete, dan audit tersedia.

- [ ] **F9-06 — Buat query/mutation UP/TUP & KKP.** [Role: Backend Domain Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/server/domains/up-tup-kkp.queries.ts`, `apps/web/src/server/domains/up-tup-kkp.mutations.ts`  
  **DoD:** Type/date/reference validation, monthly KKP, scoped CRUD, soft delete, dan audit tersedia.

- [ ] **F9-07 — Buat query/mutation Capaian Output.** [Role: Backend Domain Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/server/domains/output-achievement.queries.ts`, `apps/web/src/server/domains/output-achievement.mutations.ts`  
  **DoD:** Range, confirmation, deadline, unique month/RO, scoped CRUD, soft delete, dan audit tersedia.

- [ ] **F9-08 — Buat query/mutation SPM Dispensasi.** [Role: Backend Domain Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/server/domains/spm-dispensation.queries.ts`, `apps/web/src/server/domains/spm-dispensation.mutations.ts`  
  **DoD:** Q4 validation, ratio preview, scoped CRUD, soft delete, dan audit tersedia.

- [ ] **F9-09 — Buat service kalkulasi dan snapshot.** [Role: Backend Domain Agent] [Model: Sol Medium]  
  **Scope:** Load scoped input, resolve rule set/calendar, call pure engine, hash input, persist immutable snapshot  
  **Depends:** F6-11, F7-11, F9-02–F9-08  
  **DoD:** Actual/forecast/scenario tidak saling menimpa; snapshot lama tidak dihitung ulang.

- [ ] **F9-10 — Buat query monitoring Admin KPPN.** [Role: Backend Domain Agent] [Model: Sol Medium]  
  **Scope:** Dashboard aggregate, organization list/detail read-only, risk, completeness, snapshot, reminder  
  **Depends:** F8-04, F9-09  
  **DoD:** Semua query terbatasi `kppn_scope_id`, paginated, terindeks, dan tidak menyediakan mutasi data operasional.

## 14. Fase 10 — Policy, Reminder, Scheduler, dan Email

- [ ] **F10-01 — Implementasikan workday calendar.** [Role: Policy & Reminder Agent] [Model: Luna Max]  
  **Files:** `packages/policy-reminder/src/workday-calendar.ts`, `packages/policy-reminder/src/workday-calendar.test.ts`  
  **Depends:** F0-03, F0-04  
  **DoD:** Add/subtract/count, weekend, holiday, explicit working day, boundary, dan timezone teruji.

- [ ] **F10-02 — Implementasikan rule set resolver.** [Role: Policy & Reminder Agent] [Model: Luna Max]  
  **Files:** `packages/policy-reminder/src/rule-set-resolver.ts`, `packages/policy-reminder/src/rule-set-resolver.test.ts`  
  **Depends:** F0-06  
  **DoD:** Year/effective date, overlap rejection, retired fallback, dan no-rule error teruji.

- [ ] **F10-03 — Implementasikan deadline calculator.** [Role: Policy & Reminder Agent] [Model: Sol Medium]  
  **Scope:** DSL parser/evaluator dan tests seluruh event 2026  
  **Depends:** F10-01  
  **DoD:** Workday/calendar/event/schedule formula deterministic, bounded, dan tidak mengeksekusi JavaScript bebas.

- [ ] **F10-04 — Implementasikan Compliance Guard.** [Role: Policy & Reminder Agent] [Model: Luna Max]  
  **Files:** `packages/policy-reminder/src/compliance-guard.ts`, `packages/policy-reminder/src/compliance-guard.test.ts`  
  **Depends:** F0-05  
  **DoD:** Mandatory, allowed lead, deadline, required recipients, overrides, channel, dan actionable errors teruji.

- [ ] **F10-05 — Implementasikan idempotency key dan scheduler.** [Role: Policy & Reminder Agent] [Model: Sol Medium]  
  **Scope:** Eligibility, timezone schedule, unique insert, due delivery selection, re-evaluation  
  **Depends:** F10-02–F10-04  
  **DoD:** Replay aman, tidak ada duplikat, rule set version tersimpan, dan pending schedule dapat dievaluasi ulang.

- [ ] **F10-06 — Buat template email reminder.** [Role: Policy & Reminder Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/emails/reminder-email.tsx`, `apps/web/src/emails/reminder-email.test.tsx`  
  **DoD:** Event, satker, deadline/type hari, action, secure link, source/version, dan sanitized custom message tersedia.

- [ ] **F10-07 — Buat template digest dan escalation.** [Role: Policy & Reminder Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/emails/digest-email.tsx`, `apps/web/src/emails/escalation-email.tsx`  
  **DoD:** Grouping, priority, deadline, required context, text fallback, dan no-sensitive-log rules tersedia.

- [ ] **F10-08 — Buat endpoint QStash daily/send.** [Role: Policy & Reminder Agent] [Model: Sol Medium]  
  **Scope:** Dua endpoint signed, batch limit, request ID, retry, status transition, Resend call  
  **Depends:** F10-05–F10-07  
  **DoD:** Signature invalid ditolak; replay idempotent; error aman dicatat; success/failed status konsisten.

- [ ] **F10-09 — Buat mutasi Rule Set dan publish workflow.** [Role: Policy & Reminder Agent] [Model: Sol Medium]  
  **Scope:** Draft/validate/diff/publish/retire, audit, transaction, schedule re-evaluation  
  **Depends:** F6-02, F10-02, F10-05  
  **DoD:** Published immutable, source/change notes wajib, verification warning, dan snapshot historis tidak berubah.

- [ ] **F10-10 — Buat mutasi konfigurasi reminder satker.** [Role: Policy & Reminder Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/server/reminders/config.queries.ts`, `apps/web/src/server/reminders/config.mutations.ts`  
  **Depends:** F10-04  
  **DoD:** Preview server-authoritative, reset default, required recipients, audit, dan invalid policy rejection tersedia.

- [ ] **F10-11 — Buat retry delivery Admin.** [Role: Policy & Reminder Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/server/reminders/delivery.queries.ts`, `apps/web/src/server/reminders/delivery.mutations.ts`  
  **DoD:** Hanya failed delivery dalam scope, attempt trace, derived idempotency, confirmation data, dan audit tersedia.

## 15. Fase 11 — Integrasi Frontend–Backend Bertahap

> Pada fase ini mock service diganti per domain. Mock tetap dipertahankan untuk component test dan demo scenario.

- [ ] **F11-01 — Integrasikan auth, routing, dan active context.** [Role: Auth & Access Agent] [Model: Sol Medium]  
  **Scope:** Sign-in, access pending, org picker, Operator/Admin guard, context header  
  **Depends:** F5-05, F8-01–F8-06  
  **DoD:** Seluruh jalur akses nyata menggantikan dummy tanpa mengubah layout yang sudah diterima.

- [ ] **F11-02 — Integrasikan Pengaturan Satker.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/settings.tsx`, `apps/web/src/services/settings-service.ts`  
  **Depends:** F9-02  
  **DoD:** Load/save/error/audit feedback nyata; UI tidak mengakses DB langsung.

- [ ] **F11-03 — Integrasikan Pagu & Revisi.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/data/budget-revisions.tsx`, `apps/web/src/services/budget-revisions-service.ts`  
  **Depends:** F9-03  
  **DoD:** CRUD, eligibility, optimistic policy, structured errors, dan invalidation bekerja.

- [ ] **F11-04 — Integrasikan RPD & Realisasi.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/data/rpd-realization.tsx`, `apps/web/src/services/rpd-realization-service.ts`  
  **Depends:** F9-04  
  **DoD:** Batch save, dirty state, server validation, decimal display, dan refresh impact bekerja.

- [ ] **F11-05 — Integrasikan Kontrak & Tagihan.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/data/contracts-invoices.tsx`, `apps/web/src/services/contracts-invoices-service.ts`  
  **Depends:** F9-05  
  **DoD:** CRUD, relation validation, deadline status, risk detail, dan deep-link bekerja.

- [ ] **F11-06 — Integrasikan UP/TUP & KKP.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/data/up-tup-kkp.tsx`, `apps/web/src/services/up-tup-kkp-service.ts`  
  **Depends:** F9-06  
  **DoD:** CRUD, interval validation, monthly KKP, status, dan refresh impact bekerja.

- [ ] **F11-07 — Integrasikan Capaian Output.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/data/output-achievement.tsx`, `apps/web/src/services/output-achievement-service.ts`  
  **Depends:** F9-07  
  **DoD:** CRUD, confirmation, deadline, eligibility, dan incomplete CTA bekerja.

- [ ] **F11-08 — Integrasikan SPM Dispensasi.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/data/spm-dispensation.tsx`, `apps/web/src/services/spm-dispensation-service.ts`  
  **Depends:** F9-08  
  **DoD:** CRUD, Q4 validation, ratio, deduction preview, dan risk state bekerja.

- [ ] **F11-09 — Integrasikan Simulasi dan Snapshot.** [Role: Frontend Operator Agent] [Model: Sol Medium]  
  **Scope:** Simulation, history, compare, formula trace, stale version, scenario overlay  
  **Depends:** F9-09  
  **DoD:** Actual tidak termutasi oleh scenario; save snapshot immutable; result sama dengan golden engine.

- [ ] **F11-10 — Integrasikan Dashboard dan Analisis Operator.** [Role: Frontend Operator Agent] [Model: Sol Medium]  
  **Scope:** Dashboard aggregates, trends, deadlines, incomplete data, recommendations  
  **Depends:** F11-03–F11-09  
  **DoD:** Semua CTA menuju sumber data benar dan state estimasi transparan.

- [ ] **F11-11 — Integrasikan Reminder Center.** [Role: Frontend Operator Agent] [Model: Sol Medium]  
  **Scope:** List/detail/config/preview/save/reset/audit  
  **Depends:** F10-10  
  **DoD:** Client tidak dapat melewati Compliance Guard dan jadwal preview sama dengan hasil server.

- [ ] **F11-12 — Integrasikan monitoring Admin.** [Role: Frontend Admin Agent] [Model: Sol Medium]  
  **Scope:** Dashboard, organization list/detail, risk/reminder, delivery retry  
  **Depends:** F9-10, F10-11  
  **DoD:** Scope isolation, read-only operational detail, pagination/filter, dan retry audit bekerja.

- [ ] **F11-13 — Integrasikan Admin Policy.** [Role: Frontend Admin Agent] [Model: Sol Medium]  
  **Scope:** Rule set list/editor/diff/publish, policy, workdays, history  
  **Depends:** F10-09  
  **DoD:** Published read-only, preview impact, source required, validation, confirmation, dan version history bekerja.

- [ ] **F11-14 — Integrasikan Audit Log dan Manajemen Akses.** [Role: Frontend Admin Agent] [Model: Sol Medium]  
  **Scope:** Audit filters/detail dan access CRUD/protection  
  **Depends:** F8-07, F9-01  
  **DoD:** Last-admin error jelas, before/after redacted, dan seluruh aksi terbatasi scope.

## 16. Fase 12 — Import, Export, dan Laporan

- [ ] **F12-01 — Buat schema template dan parser CSV/XLSX per domain.** [Role: Import & Export Agent] [Model: Sol Medium]  
  **Scope:** Enam domain, header/type/reference validation, formula injection defense, error cap  
  **Depends:** F0-08, F9-03–F9-08  
  **DoD:** Parser tidak menulis DB dan menghasilkan preview/error terstruktur yang sama dengan kontrak UI.

- [ ] **F12-02 — Implementasikan upload dan preview import.** [Role: Import & Export Agent] [Model: Sol Medium]  
  **Scope:** MIME/size validation, temporary storage, sync/async threshold, job creation, scoped preview  
  **Depends:** F12-01  
  **DoD:** 10 MB/10.000 row rules diterapkan atau disesuaikan ADR; file tidak menjadi URL publik permanen.

- [ ] **F12-03 — Implementasikan commit import.** [Role: Import & Export Agent] [Model: Sol Medium]  
  **Scope:** Batch transaction, valid-row-only policy, duplicate handling, audit, idempotency  
  **Depends:** F12-02  
  **DoD:** Tidak ada write sebelum konfirmasi; partial/batch semantics terdokumentasi dan teruji.

- [ ] **F12-04 — Buat endpoint QStash import.** [Role: Import & Export Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/api/jobs/import/process.ts`, `apps/web/src/server/import/process-job.ts`  
  **Depends:** F12-02  
  **DoD:** Signature, replay, status transition, stuck job handling, dan safe error tersedia.

- [ ] **F12-05 — Integrasikan UI Import.** [Role: Frontend Operator Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/routes/operator/import.tsx`, `apps/web/src/services/import-service.ts`  
  **Depends:** F12-03, F12-04  
  **DoD:** Upload, polling, preview, errors, confirm, cancel, completion, dan retry sesuai backend.

- [ ] **F12-06 — Implementasikan export XLSX Operator.** [Role: Import & Export Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/server/exports/operator-xlsx.ts`, `apps/web/src/server/exports/operator-xlsx.test.ts`  
  **DoD:** Scoped data, filter, score/indicator/risk/recommendation, metadata, disclaimer, version, dan injection defense teruji.

- [ ] **F12-07 — Implementasikan export PDF Operator.** [Role: Import & Export Agent] [Model: Luna Max]  
  **Files:** `apps/web/src/server/exports/operator-pdf.tsx`, `apps/web/src/server/exports/operator-pdf.test.tsx`  
  **DoD:** Executive summary, chart-safe fallback, period, print time, disclaimer, dan rule set version tersedia.

- [ ] **F12-08 — Implementasikan export agregat Admin.** [Role: Import & Export Agent] [Model: Sol Medium]  
  **Scope:** XLSX/PDF agregat dan detail read-only dengan KPPN scope  
  **DoD:** Filter tercantum, data lintas scope tidak mungkin masuk, dan large export strategy teruji.

- [ ] **F12-09 — Integrasikan UI laporan Operator/Admin.** [Role: Frontend Foundation Agent] [Model: Sol Medium]  
  **Scope:** Preview, request, authenticated download, progress, error, filename  
  **Depends:** F12-06–F12-08  
  **DoD:** Tidak ada permanent public URL dan hasil cocok dengan filter UI.

## 17. Fase 13 — Quality, Security, Deployment, dan UAT

- [ ] **F13-01 — Lengkapi unit test seluruh pure modules.** [Role: QA Agent] [Model: Sol Medium]  
  **Scope:** Engine, rule parser, workday, deadline, compliance, scheduler, access, import parser  
  **DoD:** Branch kritis dan boundary regulasi tercakup; golden tests wajib lulus.

- [ ] **F13-02 — Buat integration test tenant isolation.** [Role: QA Agent] [Model: Sol Medium]  
  **Scope:** Seluruh query/mutation Operator dan Admin dengan cross-tenant IDs  
  **DoD:** Read/write lintas satker/scope selalu ditolak tanpa data leakage pada error.

- [ ] **F13-03 — Buat integration test policy/reminder.** [Role: QA Agent] [Model: Sol Medium]  
  **Scope:** Publish/re-evaluate, mandatory lock, workday, idempotency, retry, stale snapshot  
  **DoD:** Acceptance criteria policy 13–20 lulus pada database test.

- [ ] **F13-04 — Buat E2E Operator.** [Role: QA Agent] [Model: Sol Medium]  
  **Scope:** Login → input core domains → calculate → snapshot → reminder → export  
  **DoD:** Alur desktop dan mobile kritis lulus dengan data terisolasi.

- [ ] **F13-05 — Buat E2E Admin KPPN.** [Role: QA Agent] [Model: Sol Medium]  
  **Scope:** Login → monitor → detail read-only → access → publish policy → failed delivery retry → export  
  **DoD:** Last-admin protection, scope, audit, dan snapshot immutability terverifikasi.

- [ ] **F13-06 — Lakukan security review aplikasi.** [Role: Security Agent] [Model: Sol Medium]  
  **Scope:** Auth/session, tenant isolation, upload, export, webhook, SSR data, XSS, CSV injection, secrets, rate limits  
  **DoD:** Tidak ada critical/high terbuka; medium memiliki owner dan due date.

- [ ] **F13-07 — Lakukan performance test.** [Role: QA Agent] [Model: Sol Medium]  
  **Scope:** Kalkulasi satu satker, dashboard agregat, 10k import, scheduler batch, export  
  **DoD:** Kalkulasi normal <500 ms atau bottleneck/mitigasi terdokumentasi; query plan index ditinjau.

- [ ] **F13-08 — Konfigurasi CI quality gate.** [Role: DevOps Agent] [Model: Luna Max]  
  **Files:** `.github/workflows/ci.yml`, `package.json`  
  **DoD:** Typecheck, lint, unit, golden, integration, build, secret scan, dan migration check berjalan.

- [ ] **F13-09 — Konfigurasi deployment Vercel.** [Role: DevOps Agent] [Model: Luna Max]  
  **Files:** `vercel.json`, `docs/deployment-vercel.md`  
  **DoD:** Preview/staging/production env, runtime limits, cron/job endpoints, domain, dan rollback terdokumentasi.

- [ ] **F13-10 — Konfigurasi Cloudflare security baseline.** [Role: DevOps Agent] [Model: Sol Medium]  
  **File:** `docs/cloudflare-security-baseline.md`  
  **DoD:** DNS/TLS/CDN/WAF/rate limit rules untuk login, upload, export, webhook/job, dan cache bypass data sensitif terdokumentasi serta diterapkan.

- [ ] **F13-11 — Tambahkan observability dan alert.** [Role: DevOps Agent] [Model: Sol Medium]  
  **Scope:** Structured logs, request ID, redaction, calculation latency, job/delivery/import failures, publish errors  
  **DoD:** Alert harian/job gagal, delivery threshold, stuck import, dan publish failure dapat diuji.

- [ ] **F13-12 — Buat runbook operasional.** [Role: Technical Writer] [Model: Luna Max]  
  **Files:** `docs/runbook-operations.md`, `docs/runbook-incidents.md`  
  **DoD:** Seed/admin recovery, failed migration/job/email/import, rule rollback, secret rotation, dan escalation owner tersedia.

- [ ] **F13-13 — Laksanakan UAT berbasis acceptance criteria.** [Role: Product & IKPA Analyst] [Model: Sol Medium]  
  **File:** `docs/uat-report.md`  
  **Depends:** F13-01–F13-12  
  **DoD:** Seluruh 24 acceptance criteria FSD memiliki bukti pass/fail, owner defect, severity, dan keputusan rilis.

- [ ] **F13-14 — Verifikasi go-live regulasi dan data.** [Role: Product & IKPA Analyst] [Model: Sol Medium]  
  **Files:** `docs/go-live-checklist.md`, `docs/regulatory-verification-2026.md`  
  **Depends:** F0-02, F13-13  
  **DoD:** Tidak ada parameter mandatory/score produksi berstatus belum diverifikasi; source dan approver tercatat.

## 18. Urutan Milestone yang Disarankan

| Milestone | Cakupan | Exit criteria |
|---|---|---|
| M0 — Decision Ready | Fase 0 | ADR, kontrak, dan status regulasi cukup untuk membangun tanpa asumsi tersembunyi |
| M1 — UI Prototype | Fase 1–4 | Seluruh area publik, Operator, dan Admin dapat didemokan dengan dummy data |
| M2 — UI Accepted | Fase 5 | Stakeholder menerima navigasi, responsivitas, state, dan alur utama |
| M3 — Domain Ready | Fase 6 | Engine deterministik dan golden tests lulus |
| M4 — Backend Ready | Fase 7–10 | DB, auth, domain services, policy, scheduler, dan email tersedia |
| M5 — Integrated MVP | Fase 11–12 | Mock diganti backend per domain; import/export lengkap |
| M6 — Release Candidate | Fase 13 | Security, performance, E2E, UAT, dan verifikasi regulasi lulus |

## 19. Referensi Dokumentasi Terkini melalui Context7

Task teknis harus memeriksa dokumentasi terkini lagi saat mulai dikerjakan karena package saat ini memakai beberapa dependency `latest`.

- [TanStack Start — routing](https://tanstack.com/start/latest/docs/framework/react/guide/routing): file-based routes berada di `src/routes` dan route tree dihasilkan oleh tooling.
- [TanStack Start — middleware](https://tanstack.com/start/latest/docs/framework/react/guide/middleware): global request middleware dikonfigurasi melalui `createStart` di `src/start.ts`.
- [TanStack Start — server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions): loader dan komponen dapat memanggil server functions; otorisasi tetap server-authoritative.
- [Clerk TanStack React Start quickstart](https://clerk.com/docs/tanstack-react-start/getting-started/quickstart): `clerkMiddleware()` dipasang pada request middleware; route tetap public sampai guard diterapkan; `auth()` digunakan server-side.
- [Drizzle ORM PostgreSQL schema](https://orm.drizzle.team/docs/schemas): schema, enum, table, FK, index, dan inferred types didefinisikan secara type-safe.
- [Drizzle Kit migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate): migration SQL yang belum diterapkan dijalankan dan dicatat pada migration log; migration generated harus direview dan diuji pada database kosong.

## 20. Definition of Done Global

Sebuah fitur baru dianggap selesai hanya bila:

- requirement dan acceptance criteria terkait dapat ditelusuri;
- UI memiliki loading, empty, incomplete, error, success, dan policy-locked state bila relevan;
- desktop dan mobile dapat digunakan dengan keyboard serta tidak mengandalkan warna saja;
- server memverifikasi auth, scope, Zod schema, dan audit untuk setiap mutasi;
- nominal dan skor tidak memakai floating point yang tidak terkontrol;
- rule set version serta disclaimer terlihat pada hasil/snapshot/laporan;
- unit/integration/E2E yang proporsional lulus;
- tidak ada secret atau data sensitif pada client bundle dan log;
- task tidak menyentuh file di luar scope yang disetujui tanpa dipecah atau dinaikkan ke Sol Medium.
- `BACKLOG.md` dan `DEVLOG.md` telah diperbarui, serta checkbox task telah ditandai sesuai status sebenarnya.
