# Runbook Insiden — Simulator IKPA

## Database unavailable (`NO_DB` / `DATABASE_UNAVAILABLE`)

1. Hentikan promote dan cek status provider database.
2. Pastikan env preview/production menunjuk branch yang benar; jangan mengaktifkan
   fixture demo pada production.
3. Jika migration tertunda, jalankan migration forward pada preview lalu ulangi
   smoke dan export signature.

## Delivery provider unavailable

1. Pertahankan delivery `failed`/`scheduled`; jangan mengubahnya menjadi `sent`.
2. Periksa `RESEND_API_KEY` dan QStash current/next signing key melalui secret
   manager.
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
