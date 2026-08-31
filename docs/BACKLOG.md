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
| DOC-001 | Completed | Tetapkan protokol wajib pembaruan backlog dan devlog | Primary Agent / Technical Writer | Sol Medium | 2026-08-31 | 2026-08-31 | `docs/TASK-LIST-Simulator-IKPA.md`; `docs/BACKLOG.md`; `docs/DEVLOG.md` | Protokol, template, status, dan pengecualian metadata telah ditambahkan. |

## Catatan Sinkronisasi

- Jika status di tracker berbeda dengan checkbox task list, gunakan status yang paling konservatif dan perbaiki keduanya sebelum pekerjaan berikutnya dimulai.
- `DEVLOG.md` adalah catatan kronologis append-only; BACKLOG adalah status terkini.
