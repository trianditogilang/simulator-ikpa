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
