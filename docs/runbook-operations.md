# Runbook Operasional — Simulator IKPA

Dokumen ini berlaku untuk preview/staging lebih dulu. Jangan menjalankan
perintah mutasi database produksi tanpa approval release dan backup tervalidasi.

## Pemeriksaan harian

1. `npm run typecheck`
2. `npm run test`
3. `npm run lint`
4. `npm run check:migrations`
5. `npm run check:secrets`
6. `npm run build`
7. `npm run test:e2e`

Catat commit, hasil command, migration revision, dan deployment ID di DEVLOG.

## Database and seed

- `npm run seed --workspace @simulator-ikpa/db` hanya pada branch/dev database.
- Periksa `DATABASE_URL`/`DIRECT_URL` sebelum migrate; production tanpa DB harus
  fail closed, bukan masuk mode demo.
- Review migration SQL, jalankan pada database kosong/preview, lalu cek data
  tenant dan scope sebelum promote.

## Jejak audit

Halaman Audit Log Admin (ADM-11) dipensiunkan sejak 2026-09-13; pemilik
memutuskan 2026-11-24 audit cukup dibaca langsung dari tabel `audit_logs`.
Hanya `select` — jangan ubah atau hapus baris audit lewat SQL.

- Drizzle Studio: `cd packages/db; npx drizzle-kit studio` (memakai
  `DIRECT_URL`/`DATABASE_URL` dari `.env` root), lalu buka
  https://local.drizzle.studio dan pilih tabel `audit_logs`.
- psql (lokal, atau VPS lewat SSH). Compose butuh file env yang sama dengan saat
  `up`; di lokal `.env.compose.local` dan `.env.smtp.local`:

  ```
  docker compose --env-file .env.compose.local --env-file .env.smtp.local exec db psql -U ikpa -d simulator_ikpa -c "select a.created_at, a.action, a.entity_type, u.name, u.email from audit_logs a left join users u on u.id = a.actor_id order by a.created_at desc limit 50;"
  ```

- Akun yang emailnya dilepas (`released-<id>@released.invalid`) tidak menyimpan
  email lamanya; cari lewat `users.name` atau `actor_id`.

## Reminder and delivery

- Periksa policy mandatory Tagihan, Output, dan GUP/PTUP.
- Audit `notification_deliveries` berdasarkan policy/rule version/idempotency.
- Delivery failed hanya di-retry dari Admin scoped; jangan mengubah status
  langsung lewat SQL.
- Provider email yang belum terhubung harus menghasilkan `503`, bukan status
  sent.

## Export and import

- Operator XLSX wajib memiliki signature ZIP (`PK\x03\x04`) dan MIME XLSX.
- Ekspor Admin dan PDF Operator retired dari kontrak aktif; route lama harus tetap
  read-only/fail-safe tanpa preview atau file palsu.
- Import tetap `Disabled/Deferred`; job backend yang dipanggil tanpa database
  production harus menghasilkan `DATABASE_UNAVAILABLE`.
