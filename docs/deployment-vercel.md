# Deployment Vercel — Simulator IKPA

**Status:** Preview/staging aktif; Production/domain publik belum diaktifkan.
Adapter Nitro untuk TanStack Start sudah dipakai oleh project Vercel. Nilai
credential tetap hanya berada pada Vercel Environment Variables/secret manager.

## Build adapter

- `apps/web/vite.config.ts` memakai `nitro()` setelah `tanstackStart()`.
- `nitro` tercatat sebagai dev dependency workspace web; Vercel dapat memakai
  preset TanStack Start dan mendeteksi output server tanpa Start Command manual.
- Build production memaksa `NODE_ENV=production` dan mengosongkan
  `VITE_USER_NODE_ENV` hanya pada command `build`, sehingga bundle Nitro tidak
  memuat React `jsxDEV`.

## Project settings

- Repository: `trianditogilang/simulator-ikpa`, branch Preview: `staging`.
- Preview URL saat ini:
  `https://simulator-ikpa-web-git-staging-trianditogilang.vercel.app`.
- Install command: `npm ci`.
- Build command: `npm run build` (workspace root script; Nitro menghasilkan
  Vercel function output).
- Runtime: Nitro server function pada batas durasi/ukuran plan Vercel Hobby;
  tidak ada `maxDuration` custom yang boleh diasumsikan lebih tinggi dari plan.
- Preview dan Production harus memakai Neon branch, Clerk instance, serta
  environment variable yang terpisah.

## Required preview gate

1. Buat Vercel Preview terisolasi dari production.
2. Set `NODE_ENV=production`, `DATABASE_URL`/`DIRECT_URL`,
   `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `APP_URL`,
   `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`,
   `QSTASH_NEXT_SIGNING_KEY`, `RESEND_API_KEY`, dan
   `NOTIFICATION_SENDER_EMAIL` melalui Vercel Environment Variables; jangan
   commit nilainya.
3. Jalankan migration pada database branch preview, bukan database produksi.
4. Jalankan typecheck, workspace test, lint, build, Playwright smoke, dan
   signature test export terhadap preview.
5. Verifikasi route job hanya menerima signature yang valid dan production
   tidak memakai fixture/fallback. Endpoint yang disiapkan adalah:
   - `POST /api/qstash/daily` untuk scan delivery terjadwal;
   - `POST /api/qstash/send` untuk pengiriman batch;
   - `POST /api/jobs/import/process` untuk pemrosesan import.
   Semua endpoint wajib dipanggil oleh QStash dengan signature valid. Saat ini
   delivery masih fail-closed sampai adapter Resend/QStash F13-03 tersedia.

## Release and rollback

- Promote hanya commit yang memiliki `docs/uat-report.md` pass untuk seluruh
  criteria dan approval regulasi.
- Simpan deployment ID, migration revision, dan environment version pada
  release record.
- Cron QStash berjalan di luar Vercel dan memanggil URL Production; jangan
  menjadwalkan endpoint delivery sebelum provider sandbox/production lulus
  replay/idempotency test.
- Rollback aplikasi ke deployment sebelumnya; rollback database hanya melalui
  migration forward yang sudah direview, bukan menghapus data secara manual.

## Current blocker

Project dan Preview URL tersedia, dan smoke read-only authenticated pada 11
route Operator sudah lulus. F13-09 tetap `Needs Fix` karena Production/domain
belum disiapkan, endpoint delivery masih menunggu provider F13-03, dan browser/
UAT serta mutation/cross-tenant evidence belum lengkap. Jika Deployment
Protection diaktifkan kembali, gunakan bypass automation hanya dari secret
manager lokal/CI dan jangan memasukkan secret ke URL atau repository.
