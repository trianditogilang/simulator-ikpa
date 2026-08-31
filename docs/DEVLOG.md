# DEVLOG — Simulator Penilaian IKPA

Catatan pengembangan kronologis. Tambahkan entri terbaru tepat di bawah bagian ini. Entri lama bersifat append-only dan tidak boleh ditimpa atau dihapus kecuali untuk koreksi faktual yang diberi catatan.

## Template Entri

```markdown
## YYYY-MM-DD HH:mm WIB — TASK-ID — Judul task

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
