# Runbook Insiden — Simulator IKPA

> **Catatan ADR-008 (2026-11-18):** database kini PostgreSQL di VPS (bukan branch Neon) dan email dikirim lewat SMTP (MIG-05). QStash diganti service `scheduler` yang memanggil `/api/jobs/*` dengan `JOB_SECRET` (MIG-04); cek log `docker compose logs scheduler`. Prosedur VPS lengkap menyusul pada F13-09.

## Database unavailable (`NO_DB` / `DATABASE_UNAVAILABLE`)

1. Hentikan promote dan cek status provider database.
2. Pastikan env preview/production menunjuk branch yang benar; jangan mengaktifkan
   fixture demo pada production.
3. Jika migration tertunda, jalankan migration forward pada preview lalu ulangi
   smoke dan export signature.

## Delivery provider unavailable

1. Pertahankan delivery `failed`/`scheduled`; jangan mengubahnya menjadi `sent`.
2. Periksa variabel `SMTP_*`, `NOTIFICATION_SENDER_EMAIL`, dan `JOB_SECRET`
   melalui secret manager (`RESEND_API_KEY` dan `QSTASH_*` tidak dipakai lagi
   sejak MIG-05 dan MIG-04).
3. Setelah provider tervalidasi, retry hanya delivery failed dalam scope Admin
   yang sesuai dan cek audit log/idempotency.

## Tenant or scope incident

1. Cabut deployment yang dicurigai dan simpan request ID/audit ID.
2. Periksa mapping `user_accesses`, organisasi, dan KPPN scope; jangan menghapus
   histori audit.
3. Rotasi session/secret bila token terekspos, lalu jalankan cross-scope test
   pada database branch terisolasi.

## Export or import incident

- File dengan signature/MIME salah dianggap gagal; jangan kirim ke pengguna.
- Import tetap nonaktif sampai parser, storage, cleanup, dan job idempotency
  disetujui pada task terpisah.

## Escalation

Owner release mencatat severity, waktu mulai/selesai, request ID, deployment,
migration, dampak tenant, keputusan rollback, dan follow-up task di BACKLOG.
