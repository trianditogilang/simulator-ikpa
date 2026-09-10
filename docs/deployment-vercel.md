# Deployment Vercel — Simulator IKPA

**Status:** Preview/staging checklist only. Adapter Nitro untuk TanStack Start
sudah tersedia, tetapi belum diterapkan ke project Vercel karena kredensial
project, environment Preview, dan domain produksi belum tersedia di repository.

## Build adapter

- `apps/web/vite.config.ts` memakai `nitro()` setelah `tanstackStart()`.
- `nitro` tercatat sebagai dev dependency workspace web; Vercel dapat memakai
  preset TanStack Start dan mendeteksi output server tanpa Start Command manual.

## Required preview gate

1. Buat Vercel Preview terisolasi dari production.
2. Set `NODE_ENV=production`, `DATABASE_URL`/`DIRECT_URL`, Clerk server and
   publishable keys, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`,
   dan `RESEND_API_KEY` melalui secret manager; jangan commit nilainya.
3. Jalankan migration pada database branch preview, bukan database produksi.
4. Jalankan typecheck, workspace test, lint, build, Playwright smoke, dan
   signature test export terhadap preview.
5. Verifikasi route job hanya menerima signature yang valid dan production
   tidak memakai fixture/fallback.

## Release and rollback

- Promote hanya commit yang memiliki `docs/uat-report.md` pass untuk seluruh
  criteria dan approval regulasi.
- Simpan deployment ID, migration revision, dan environment version pada
  release record.
- Rollback aplikasi ke deployment sebelumnya; rollback database hanya melalui
  migration forward yang sudah direview, bukan menghapus data secara manual.

## Current blocker

Tidak ada `vercel.json`, project ID, Preview URL, atau deployment credential di
repository. F13-09 tetap `Blocked` sampai owner deployment menyediakan semua
input tersebut dan menjalankan authenticated staging verification.
