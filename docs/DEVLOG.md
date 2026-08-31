# DEVLOG — Simulator Penilaian IKPA

Catatan pengembangan kronologis. Tambahkan entri terbaru tepat di bawah bagian ini. Entri lama bersifat append-only dan tidak boleh ditimpa atau dihapus kecuali untuk koreksi faktual yang diberi catatan.

## Template Entri

```markdown
### Session [NUMBER] - [DATE] 
**Time:** Start: [TIME] | End: [TIME] | Duration: [DURATION]
- Status: Completed | Blocked | Needs Fix
- Agent/Role: ...
- Model: Luna Max | Sol Medium
**Tasks Completed:**
- [TASK-ID] Task description
- [TASK-ID] Task description
**Code Changes:**
- Files created/modified: [list files]
- Lines of code: [approximate]
- Key implementations: [brief description]
- Verifikasi: `command` — hasil
**Issues Encountered:**
- Issue: [description]
- Solution: [how it was resolved]
**Next Session Plan:**
- Tasks to continue: [TASK-IDs]
- New tasks: [if any]
**Notes:**
[Any additional notes, observations, or reminders]
```

### Session 2 - 2026-08-31
**Time:** Start: 19:26 WIB | End: 19:28 WIB | Duration: 2 minutes
- Status: Completed
- Agent/Role: Primary Agent / Product & IKPA Analyst
- Model: Luna Max
**Tasks Completed:**
- [F0-03] Putuskan interpretasi kalender kerja dan H+17/H-0
**Code Changes:**
- Files created/modified: `docs/adr/ADR-001-workday-boundaries.md`, `docs/TASK-LIST-Simulator-IKPA.md`, `docs/BACKLOG.md`, `docs/DEVLOG.md`
- Lines of code: 170 baris ADR ditambah metadata tracking
- Key implementations: LocalDate dan timezone eksplisit, resolusi override kalender, H+17 start-exclusive/end-inclusive, H-n workday/calendar-day, H-0 terpisah dari waktu kirim, serta contoh lintas bulan dan override
- Verifikasi: `PowerShell required-concept and placeholder audit` — seluruh 10 konsep wajib ditemukan, contoh tanggal boundary tersedia, dan 0 placeholder
**Issues Encountered:**
- Issue: Sumber resmi menetapkan 17 hari kerja tetapi tidak menjelaskan konvensi teknis aplikasi untuk inklusivitas tanggal awal, H-0, dan cutoff waktu
- Solution: Menetapkan konvensi aplikasi yang deterministik dan mudah diaudit; status produksi tetap memerlukan approval, sedangkan perubahan di masa depan wajib melalui calculator option berversi
**Next Session Plan:**
- Tasks to continue: [F0-04] Putuskan versioning kalender kerja
- New tasks: Tidak ada
**Notes:**
BAST/BAPP diperlakukan sebagai hari ke-0; deadline adalah hari kerja eligible ke-17. H-0 adalah tanggal deadline, bukan otomatis pukul 00.00.

### Session 1 - 2026-08-31
**Time:** Start: 19:16 WIB | End: 19:24 WIB | Duration: 8 minutes
- Status: Completed
- Agent/Role: Primary Agent / Product & IKPA Analyst
- Model: Sol Medium
**Tasks Completed:**
- [F0-02] Dokumentasikan status verifikasi parameter IKPA 2026
**Code Changes:**
- Files created/modified: `docs/regulatory-verification-2026.md`, `docs/TASK-LIST-Simulator-IKPA.md`, `docs/BACKLOG.md`, `docs/DEVLOG.md`
- Lines of code: sekitar 216 baris dokumentasi regulasi ditambah metadata tracking
- Key implementations: register 66 parameter, hierarki tujuh sumber resmi, status per parameter, owner verifikasi, edge case, larangan go-live, dan checklist approval produksi
- Verifikasi: `PowerShell audit register ID/status/source/placeholder` — 66 ID unik, 44 `verified`, 22 `needs_verification`, 7 tautan sumber resmi, 0 baris tanpa status, dan 0 placeholder
**Issues Encountered:**
- Issue: Tidak ditemukan peraturan pusat baru khusus 2026 yang menggantikan PER-5/PB/2024; terdapat penyesuaian 2026 untuk RO Khusus dan beberapa detail produk belum dibuktikan oleh sumber resmi yang diperiksa
- Solution: PER-5/PB/2024 dipakai sebagai baseline yang masih berlaku, penyesuaian 2026 dicatat terpisah, dan seluruh detail tanpa bukti memadai tetap `needs_verification`
**Next Session Plan:**
- Tasks to continue: [F0-03] Putuskan interpretasi kalender kerja dan H+17/H-0
- New tasks: Tidak ada
**Notes:**
Parameter `needs_verification` hanya boleh dipakai pada UI dummy/draft rule set dengan warning; dilarang masuk rule set produksi atau mengaktifkan delivery eksternal.

## 2026-08-31 — F0-01 — Matriks traceability requirement-ke-fitur selesai

- Status: Completed
- Agent/Role: Primary Agent / Product & IKPA Analyst
- Model: Sol Medium
- Ringkasan: Memetakan requirement fungsional PRD, seluruh fitur PUB/OPS/ADM, acceptance criteria PRD/FSD, 25 tabel ERD, seluruh wireframe halaman/state, test TSD, serta gate regulasi/NFR ke task implementasi.
- File berubah: `docs/traceability-matrix.md`, `docs/TASK-LIST-Simulator-IKPA.md`, `docs/BACKLOG.md`, `docs/DEVLOG.md`.
- Keputusan penting: Matriks hanya menjadi indeks pelacakan; detail normatif tetap berada pada PRD/FSD/TSD/ERD dan dokumen UI/UX untuk mencegah duplikasi spesifikasi.
- Verifikasi: Audit referensi menghasilkan 131 task ID unik, 0 referensi invalid, 0 placeholder, dan 199 baris pemetaan.
- Risiko/known issue: Parameter regulasi 2026 tetap berstatus gate dan belum boleh dipakai sebagai aturan produksi sebelum F0-02/F13-14 selesai.
- Next action/dependensi terbuka: `F0-02` — dokumentasikan status verifikasi parameter IKPA 2026.

## 2026-08-31 — F0-01 — Matriks traceability requirement-ke-fitur dimulai

- Status: In Progress
- Agent/Role: Primary Agent / Product & IKPA Analyst
- Model: Sol Medium
- Ringkasan: Memulai pemetaan seluruh requirement produk, spesifikasi fungsional, tabel ERD, state UI, dan test TSD ke task implementasi.
- File berubah: `docs/BACKLOG.md`, `docs/DEVLOG.md`.
- Keputusan penting: Matriks dibuat sebagai satu dokumen Markdown tanpa generator atau dependency tambahan.
- Verifikasi: Status dan ownership telah dicatat di backlog.
- Risiko/known issue: Parameter regulasi 2026 yang belum tervalidasi tetap dipisahkan ke gate F0-02.
- Next action/dependensi terbuka: Selesaikan `docs/traceability-matrix.md`, audit coverage, lalu tutup F0-01.

## 2026-08-31 — DOC-001 — Protokol pembaruan BACKLOG dan DEVLOG

- Status: Completed
- Agent/Role: Primary Agent / Technical Writer
- Model: Sol Medium
- Ringkasan: Menetapkan kewajiban semua agent untuk memperbarui backlog, devlog, dan checkbox task sebelum pekerjaan dinyatakan selesai.
- File berubah: `docs/TASK-LIST-Simulator-IKPA.md`, `docs/BACKLOG.md`, `docs/DEVLOG.md`.
- Keputusan penting: Ketiga file tracking dikategorikan sebagai metadata operasional dan tidak dihitung dalam batas 1–2 file implementasi task Luna Max.
- Verifikasi: Pemeriksaan manual terhadap aturan penyelesaian, status backlog, template devlog, dan konsistensi nama file.
- Risiko/known issue: Belum ada task implementasi yang dimulai; tracker akan bertambah saat task diambil.
- Next action/dependensi terbuka: Mulai Fase 0 dari `F0-01` dan isi owner/status saat task diambil.
