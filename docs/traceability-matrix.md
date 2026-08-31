# Traceability Matrix — Simulator Penilaian IKPA

**Sumber:** PRD v1.3, FSD v1.0, TSD v1.0, ERD v1.0, UI/UX Design System v1.0, dan UI/UX Wireframes v1.0  
**Backlog implementasi:** [TASK-LIST-Simulator-IKPA.md](TASK-LIST-Simulator-IKPA.md)  
**Status baseline:** 31 Agustus 2026

Dokumen ini memetakan requirement ke task implementasi. Detail perilaku tetap mengikuti dokumen sumber; matriks ini tidak menduplikasi spesifikasi.

## Status

| Status | Arti |
|---|---|
| `Gate` | Keputusan/verifikasi wajib selesai sebelum implementasi terkait |
| `Planned` | Termasuk MVP dan sudah memiliki task implementasi |
| `Deferred` | Sengaja di luar MVP |
| `Done` | Implementasi dan verifikasi sudah selesai |

Semua item di bawah berstatus `Planned`, kecuali yang secara eksplisit ditandai `Gate`. Status implementasi aktual dilacak di [BACKLOG.md](BACKLOG.md).

## 1. Kebutuhan Fungsional PRD

| ID | Requirement | Task implementasi | Status MVP |
|---|---|---|---|
| PRD-FR-01 | Akurasi perhitungan, breakdown, input, asumsi, dan versi rule set | F6-01–F6-12, F9-09, F11-09 | Planned |
| PRD-FR-02 | Rule set versioned, tidak hard-coded | F0-02, F0-04–F0-06, F6-02, F7-05, F10-02, F10-09 | Gate → Planned |
| PRD-FR-03 | Perhitungan real-time saat form/skenario berubah | F3-05–F3-07, F6-11, F11-09 | Planned |
| PRD-FR-04 | Target, actual, forecast, scenario, dan perbandingan | F3-05–F3-07, F3-16, F7-11, F9-09, F11-09 | Planned |
| PRD-FR-05 | Rekomendasi berdasarkan gap, bobot, dan urgensi | F3-03, F3-17, F6-12, F11-10 | Planned |
| PRD-FR-06 | Riwayat, soft delete, restore/duplicate, snapshot, dan audit | F3-16, F7-11, F7-13, F9-01, F9-09, F11-09, F11-14 | Planned |
| PRD-FR-07 | Visualisasi tren, kontribusi, gap, kelengkapan, dan risiko | F3-02–F3-04, F4-02, F11-10, F11-12 | Planned |
| PRD-FR-08 | Kategori reminder mandatory/recommended/optional | F0-05, F3-18, F4-09, F10-04, F11-11, F11-13 | Planned |
| PRD-FR-09 | Email reminder, escalation, dan digest | F10-05–F10-08, F11-11 | Planned |
| PRD-FR-10 | Panduan indikator, formula, istilah, contoh, dan dasar rule | F3-20 | Planned |

## 2. Halaman dan Fitur FSD

### 2.1 Publik dan akses

| FSD ID | Fitur/route | UI task | Backend/integrasi | Status MVP |
|---|---|---|---|---|
| PUB-01 | Landing Page | F2-01, F2-02 | — | Planned |
| PUB-02 | Login dan routing akses | F2-03 | F8-01–F8-06, F11-01 | Planned |
| PUB-03 | Akses Belum Diberikan | F2-04 | F8-03, F11-01 | Planned |
| ACCESS-ORG | Pilih Satker untuk multi-mapping | F2-05 | F0-09, F8-03, F11-01 | Planned |

### 2.2 Operator Satker

| FSD ID | Fitur | UI task | Backend/integrasi | Status MVP |
|---|---|---|---|---|
| OPS-01 | Dashboard IKPA | F3-01–F3-04 | F9-09, F11-10 | Planned |
| OPS-02 | Simulasi IKPA | F3-05–F3-07 | F6-01–F6-12, F9-09, F11-09 | Planned |
| OPS-03 | Pagu & Revisi DIPA | F3-09 | F7-06, F9-03, F11-03 | Planned |
| OPS-04 | RPD & Realisasi | F3-10 | F7-07, F9-04, F11-04 | Planned |
| OPS-05 | Kontrak & Tagihan | F3-11 | F7-08, F9-05, F11-05 | Planned |
| OPS-06 | UP/TUP & KKP | F3-12 | F7-09, F9-06, F11-06 | Planned |
| OPS-07 | Capaian Output | F3-13 | F7-10, F9-07, F11-07 | Planned |
| OPS-08 | SPM Dispensasi | F3-14 | F7-10, F9-08, F11-08 | Planned |
| OPS-09 | Import Data | F3-15 | F7-13, F12-01–F12-05 | Planned |
| OPS-10 | Skenario & Riwayat | F3-16 | F7-11, F9-09, F11-09 | Planned |
| OPS-11 | Analisis & Rekomendasi | F3-17 | F6-12, F11-10 | Planned |
| OPS-12 | Laporan & Ekspor | F3-19 | F12-06, F12-07, F12-09 | Planned |
| OPS-13 | Reminder Center | F3-18 | F10-04, F10-10, F11-11 | Planned |
| OPS-14 | Panduan IKPA | F3-20 | — | Planned |
| OPS-15 | Pengaturan Satker | F3-21 | F9-02, F11-02 | Planned |

### 2.3 Admin KPPN

| FSD ID | Fitur | UI task | Backend/integrasi | Status MVP |
|---|---|---|---|---|
| ADM-01 | Dashboard Monitoring KPPN | F4-01, F4-02 | F9-10, F11-12 | Planned |
| ADM-02 | Daftar Satker | F4-03 | F9-10, F11-12 | Planned |
| ADM-03 | Detail Satker read-only | F4-04 | F9-10, F11-12 | Planned |
| ADM-04 | Monitoring Risiko & Reminder | F4-05 | F10-11, F11-12 | Planned |
| ADM-05 | Laporan Agregat | F4-06 | F12-08, F12-09 | Planned |
| ADM-06 | Daftar Rule Set IKPA | F4-07 | F10-09, F11-13 | Planned |
| ADM-07 | Editor dan publish Rule Set | F4-08 | F10-09, F11-13 | Planned |
| ADM-08 | Reminder Policy | F4-09 | F10-03, F10-04, F10-09, F11-13 | Planned |
| ADM-09 | Kalender Hari Kerja | F4-10 | F0-03, F0-04, F10-01, F11-13 | Gate → Planned |
| ADM-10 | Riwayat Versi Policy | F4-11 | F10-02, F10-09, F11-13 | Planned |
| ADM-11 | Audit Log | F4-12 | F7-13, F9-01, F11-14 | Planned |
| ADM-12 | Manajemen Akses | F4-13 | F8-07, F11-14 | Planned |

## 3. Acceptance Criteria PRD

| ID | Ringkasan acceptance criterion | Task pembuktian utama | Status MVP |
|---|---|---|---|
| PRD-AC-01 | Landing page dan satu login | F2-01–F2-03, F11-01, F13-04 | Planned |
| PRD-AC-02 | Redirect berdasarkan mapping email | F8-03, F8-05, F8-06, F11-01, F13-04, F13-05 | Planned |
| PRD-AC-03 | Email tanpa mapping melihat access pending | F2-04, F8-03, F11-01 | Planned |
| PRD-AC-04 | Operator mengakses semua menu tanpa role operasional | F1-10, F8-05, F13-04 | Planned |
| PRD-AC-05 | Operator hanya mengakses satker sendiri | F8-04, F13-02, F13-06 | Planned |
| PRD-AC-06 | Admin memonitor scope, detail read-only, export agregat | F9-10, F11-12, F12-08, F13-05 | Planned |
| PRD-AC-07 | Beberapa Admin KPPN setara | F8-03, F8-07, F13-05 | Planned |
| PRD-AC-08 | CRUD mapping akses diaudit | F8-07, F9-01, F11-14, F13-05 | Planned |
| PRD-AC-09 | Tujuh indikator dan pengurang beserta trace/version | F6-01–F6-11, F9-09, F11-09 | Planned |
| PRD-AC-10 | Empat golden result utama lulus | F6-03, F6-05, F6-07, F6-10, F13-01 | Planned |
| PRD-AC-11 | Target, simulasi, riwayat, dan compare | F3-05–F3-07, F3-16, F9-09, F11-09 | Planned |
| PRD-AC-12 | Dashboard lengkap dan actionable | F3-01–F3-04, F11-10, F13-04 | Planned |
| PRD-AC-13 | Publish rule set tanpa deploy | F10-09, F11-13, F13-03, F13-05 | Planned |
| PRD-AC-14 | Konfigurasi delivery dalam batas policy | F10-04, F10-10, F11-11, F13-03 | Planned |
| PRD-AC-15 | Mandatory/required recipient tidak dapat dilepas | F10-04, F11-11, F13-03, F13-05 | Planned |
| PRD-AC-16 | H-n memakai kalender kerja aktif | F0-03, F0-04, F10-01, F10-03, F13-03 | Gate → Planned |
| PRD-AC-17 | Jadwal mendatang berubah, snapshot lama tetap | F10-05, F10-09, F11-09, F13-03 | Planned |
| PRD-AC-18 | Delivery menyimpan idempotency, policy, dan version | F7-12, F10-05, F13-03 | Planned |
| PRD-AC-19 | Reminder Center menjelaskan mandatory dan batas | F3-18, F11-11 | Planned |
| PRD-AC-20 | Replay QStash tidak menduplikasi notifikasi | F10-05, F10-08, F13-03, F13-05 | Planned |

## 4. Acceptance Criteria FSD

| ID | Ringkasan acceptance criterion | Task pembuktian utama | Status MVP |
|---|---|---|---|
| FSD-AC-01 | Landing dan login | F2-01–F2-03, F13-04 | Planned |
| FSD-AC-02 | Operator diarahkan ke dashboard Operator | F8-03, F8-05, F11-01 | Planned |
| FSD-AC-03 | Admin diarahkan ke dashboard Admin | F8-03, F8-06, F11-01 | Planned |
| FSD-AC-04 | Tanpa mapping tidak dapat membuka aplikasi | F2-04, F8-03, F13-02 | Planned |
| FSD-AC-05 | Operator mengakses seluruh menu input | F1-10, F3-09–F3-15, F13-04 | Planned |
| FSD-AC-06 | Multi-admin memiliki hak sama | F8-03, F8-07, F13-05 | Planned |
| FSD-AC-07 | Admin terakhir tidak dapat dihapus/dinonaktifkan | F4-13, F8-07, F13-05 | Planned |
| FSD-AC-08 | CRUD/import seluruh domain hanya pada satker sendiri | F9-02–F9-08, F12-01–F12-05, F13-02 | Planned |
| FSD-AC-09 | Engine menghitung indikator, pengurang, breakdown, version | F6-01–F6-11, F9-09 | Planned |
| FSD-AC-10 | Golden results lulus | F6-03, F6-05, F6-07, F6-10, F13-01 | Planned |
| FSD-AC-11 | Actual/forecast/snapshot/scenario tidak mengubah actual | F7-11, F9-09, F11-09 | Planned |
| FSD-AC-12 | Dashboard menampilkan score, gap, incomplete, deadline, trend, recommendation | F3-01–F3-04, F11-10 | Planned |
| FSD-AC-13 | Admin draft/edit/publish rule set tanpa deploy | F10-09, F11-13 | Planned |
| FSD-AC-14 | Admin mengelola reminder policy dan workdays | F4-09, F4-10, F10-01, F10-09, F11-13 | Planned |
| FSD-AC-15 | Operator mengatur delivery dalam batas | F10-04, F10-10, F11-11 | Planned |
| FSD-AC-16 | Operator tidak melewati mandatory/deadline policy | F10-03, F10-04, F13-03 | Planned |
| FSD-AC-17 | Workday event memakai kalender aktif | F0-03, F0-04, F10-01, F10-03 | Gate → Planned |
| FSD-AC-18 | Publish mengevaluasi jadwal; snapshot mempertahankan version | F10-05, F10-09, F13-03 | Planned |
| FSD-AC-19 | Delivery log menyimpan policy/version/idempotency | F7-12, F10-05 | Planned |
| FSD-AC-20 | Tidak ada delivery duplikat | F10-05, F10-08, F13-03 | Planned |
| FSD-AC-21 | Admin melihat satker dalam scope secara read-only | F9-10, F11-12, F13-02 | Planned |
| FSD-AC-22 | Admin melihat risiko/reminder/failure/laporan agregat | F11-12, F12-08, F13-05 | Planned |
| FSD-AC-23 | Admin memetakan Operator dan Admin | F8-07, F11-14 | Planned |
| FSD-AC-24 | Mutasi sensitif dan retry dicatat pada audit | F9-01, F10-09–F10-11, F13-03 | Planned |

## 5. Tabel ERD

| Tabel | Schema task | Service/consumer utama | Status MVP |
|---|---|---|---|
| `kppn_scopes` | F7-04 | F8-04, F9-10 | Planned |
| `organizations` | F7-04 | F9-02, F9-10 | Planned |
| `users` | F7-04 | F8-02, F8-03 | Planned |
| `user_accesses` | F7-04 | F8-03, F8-07 | Planned |
| `rule_sets` | F7-05 | F6-02, F10-02, F10-09 | Planned |
| `reminder_policies` | F7-05 | F10-03–F10-05, F10-09 | Planned |
| `workdays` / calendar version final | F7-05 | F10-01, F10-03 | Gate → Planned |
| `fiscal_years` | F7-06 | F9-02–F9-09 | Planned |
| `budgets` | F7-06 | F9-03, F6-04–F6-06 | Planned |
| `dipa_revisions` | F7-06 | F9-03, F6-03 | Planned |
| `rpd_lines` | F7-07 | F9-04, F6-04 | Planned |
| `realizations` | F7-07 | F9-04, F6-04, F6-05 | Planned |
| `contracts` | F7-08 | F9-05, F6-06 | Planned |
| `spm_ls` | F7-08 | F9-05, F6-07, F10-03 | Planned |
| `up_tup_transactions` | F7-09 | F9-06, F6-08 | Planned |
| `kkp_usages` | F7-09 | F9-06, F6-08 | Planned |
| `output_reports` | F7-10 | F9-07, F6-09, F10-03 | Planned |
| `spm_q4` | F7-10 | F9-08, F6-10 | Planned |
| `simulations` | F7-11 | F9-09, F11-09 | Planned |
| `simulation_overrides` | F7-11 | F6-11, F9-09 | Planned |
| `score_snapshots` | F7-11 | F9-09, F11-09 | Planned |
| `org_reminder_configs` | F7-12 | F10-04, F10-10 | Planned |
| `notification_deliveries` | F7-12 | F10-05, F10-08, F10-11 | Planned |
| `import_jobs` | F7-13 | F12-02–F12-05 | Planned |
| `audit_logs` | F7-13 | F9-01, F11-14 | Planned |

## 6. Wireframe

### 6.1 Halaman

| Wireframe ID | Task UI | Integration task | Status MVP |
|---|---|---|---|
| WF-01 | F2-01, F2-02 | — | Planned |
| WF-02 | F2-03 | F11-01 | Planned |
| WF-03 | F2-04 | F11-01 | Planned |
| WF-04 | F2-05 | F11-01 | Planned |
| WF-OPS-01 | F3-01–F3-04 | F11-10 | Planned |
| WF-OPS-02 | F3-05–F3-07 | F11-09 | Planned |
| WF-OPS-03 | F3-08 | F11-03–F11-08 | Planned |
| WF-OPS-04 | F3-10 | F11-04 | Planned |
| WF-OPS-05 | F3-11 | F11-05 | Planned |
| WF-OPS-06 | F3-12 | F11-06 | Planned |
| WF-OPS-07 | F3-13 | F11-07 | Planned |
| WF-OPS-08 | F3-14 | F11-08 | Planned |
| WF-OPS-09 | F3-15 | F12-05 | Planned |
| WF-OPS-10 | F3-16 | F11-09 | Planned |
| WF-OPS-11 | F3-17 | F11-10 | Planned |
| WF-OPS-12 | F3-18 | F11-11 | Planned |
| WF-OPS-13 | F3-19 | F12-09 | Planned |
| WF-OPS-14 | F3-20 | — | Planned |
| WF-OPS-15 | F3-21 | F11-02 | Planned |
| WF-ADM-01 | F4-01, F4-02 | F11-12 | Planned |
| WF-ADM-02 | F4-03 | F11-12 | Planned |
| WF-ADM-03 | F4-04 | F11-12 | Planned |
| WF-ADM-04 | F4-05 | F11-12 | Planned |
| WF-ADM-05 | F4-06 | F12-09 | Planned |
| WF-ADM-06 | F4-07 | F11-13 | Planned |
| WF-ADM-07 | F4-08 | F11-13 | Planned |
| WF-ADM-08 | F4-09 | F11-13 | Planned |
| WF-ADM-09 | F4-10 | F11-13 | Planned |
| WF-ADM-10 | F4-11 | F11-13 | Planned |
| WF-ADM-11 | F4-12 | F11-14 | Planned |
| WF-ADM-12 | F4-13 | F11-14 | Planned |

### 6.2 State sistem

| Wireframe ID | State | Shared component/task | Page verification | Status MVP |
|---|---|---|---|---|
| WF-STATE-01 | Loading | F1-06 | F5-03, F5-04 | Planned |
| WF-STATE-02 | Empty data | F1-07 | F5-03, F5-04 | Planned |
| WF-STATE-03 | Data incomplete | F1-07 | F3-04, F5-03 | Planned |
| WF-STATE-04 | Rule set tidak tersedia | F1-06, F1-08 | F3-07, F5-03 | Planned |
| WF-STATE-05 | Snapshot memakai rule set lama | F1-08 | F3-16, F11-09 | Planned |
| WF-STATE-06 | Policy locked | F1-08 | F3-18, F11-11 | Planned |
| WF-STATE-07 | Error server | F1-06 | F5-03, F5-04 | Planned |

## 7. Test TSD

### 7.1 Unit dan golden test

| Test ID | Cakupan TSD | Task test | Status MVP |
|---|---|---|---|
| TSD-UT-01 | Seluruh indikator IKPA | F6-03–F6-10, F13-01 | Planned |
| TSD-UT-02 | Kalender hari kerja dan deadline | F10-01, F10-03, F13-01 | Planned |
| TSD-UT-03 | Rule set resolver | F10-02, F13-01 | Planned |
| TSD-UT-04 | Compliance Guard | F10-04, F13-01 | Planned |
| TSD-UT-05 | Scheduler dan idempotency key | F10-05, F13-01 | Planned |
| TSD-UT-06 | Access resolver dan scope guard | F8-03, F8-04, F13-01 | Planned |
| TSD-UT-07 | Parser import per domain | F12-01, F13-01 | Planned |
| TSD-GT-01 | Revisi DIPA = 80 | F6-03, F13-01 | Planned |
| TSD-GT-02 | Penyerapan Q1 = 92,67 | F6-05, F13-01 | Planned |
| TSD-GT-03 | Tagihan 13/15 = 86,67 | F6-07, F13-01 | Planned |
| TSD-GT-04 | Dispensasi 24/5.200 = 0,75 | F6-10, F13-01 | Planned |
| TSD-GT-05 | Output belum konfirmasi = 0 | F6-09, F13-01 | Planned |
| TSD-GT-06 | Kontrak 53 termin tidak eligible | F6-06, F13-01 | Planned |
| TSD-GT-07 | Libur/weekend tidak menambah H+17 | F10-01, F6-07, F13-01 | Planned |

### 7.2 Integration test

| Test ID | Cakupan TSD | Task test | Status MVP |
|---|---|---|---|
| TSD-IT-01 | Operator hanya menulis org yang dipetakan | F13-02 | Planned |
| TSD-IT-02 | Admin hanya membaca scope KPPN | F13-02 | Planned |
| TSD-IT-03 | Publish menghasilkan rule set efektif | F13-03 | Planned |
| TSD-IT-04 | Publish mengevaluasi reminder pending | F13-03 | Planned |
| TSD-IT-05 | Mandatory tidak dapat dinonaktifkan | F13-03 | Planned |
| TSD-IT-06 | Idempotency mencegah delivery ganda | F13-03 | Planned |
| TSD-IT-07 | Commit import dan audit atomik | F12-03, F13-01 | Planned |

### 7.3 E2E dan quality gate

| Test ID | Cakupan TSD | Task test | Status MVP |
|---|---|---|---|
| TSD-E2E-01 | Alur lengkap Operator sampai export | F13-04 | Planned |
| TSD-E2E-02 | Alur monitoring/export Admin | F13-05 | Planned |
| TSD-E2E-03 | Admin menambah Operator dan login berhasil | F13-05 | Planned |
| TSD-E2E-04 | Admin menambah Admin setara | F13-05 | Planned |
| TSD-E2E-05 | Admin terakhir tidak dapat dinonaktifkan | F13-05 | Planned |
| TSD-E2E-06 | Operator tidak dapat melepas mandatory/recipient | F13-04, F13-05 | Planned |
| TSD-E2E-07 | Publish mengevaluasi jadwal, snapshot tetap | F13-05 | Planned |
| TSD-E2E-08 | Replay QStash tidak duplikat | F13-03, F13-05 | Planned |
| TSD-QG-01 | Typecheck, lint, unit, golden, build | F13-08 | Planned |
| TSD-QG-02 | Migration database kosong/staging | F7-15, F13-08 | Planned |
| TSD-QG-03 | E2E kritis | F13-04, F13-05, F13-08 | Planned |
| TSD-QG-04 | Secret scan | F13-06, F13-08 | Planned |
| TSD-QG-05 | Auth, scope, Zod, audit pada mutasi | F13-02, F13-06 | Planned |

## 8. Gate Regulasi dan Non-Functional

| Gate/NFR | Task | Status MVP |
|---|---|---|
| Parameter IKPA 2026 tervalidasi dan bersumber | F0-02, F13-14 | Gate |
| Definisi H+17/H-0 | F0-03 | Gate |
| Versioning kalender kerja | F0-04 | Gate |
| Lead time mandatory termasuk H-0 | F0-05 | Gate |
| Effective rule set resolver | F0-06 | Gate |
| Struktur repository | F0-07, F1-01 | Gate → Planned |
| Decimal/XLSX/PDF/storage | F0-08, F7-01, F12-01–F12-09 | Gate → Planned |
| Akses ganda Admin/Operator | F0-09, F8-03 | Gate |
| Retensi dan klasifikasi data | F0-10, F13-06 | Gate |
| Kinerja kalkulasi <500 ms | F13-07 | Planned |
| WCAG AA dan keyboard dasar | F5-02 | Planned |
| Tenant isolation | F8-04, F13-02, F13-06 | Planned |
| Observability dan alert | F13-11 | Planned |

## 9. Coverage Summary

| Area | Item terpetakan | Gap tanpa task |
|---|---:|---:|
| Requirement fungsional PRD | 10 | 0 |
| Fitur/halaman FSD | 31 | 0 |
| Acceptance criteria PRD | 20 | 0 |
| Acceptance criteria FSD | 24 | 0 |
| Tabel ERD | 25 | 0 |
| Wireframe halaman | 31 | 0 |
| Wireframe state sistem | 7 | 0 |
| Unit/golden test TSD | 14 | 0 |
| Integration test TSD | 7 | 0 |
| E2E/quality gate TSD | 13 | 0 |

`F0-02` sampai `F0-10` tetap menjadi gate; status `Planned` pada fitur terkait tidak berarti parameter regulasi sudah disetujui untuk produksi.
