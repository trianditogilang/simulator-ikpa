# Operator Freeze — Simulator IKPA

Status: **FROZEN**. Jangan ubah kode operator sama sekali.

Aturan: hanya 1 file docs baru + `BACKLOG`/`DEVLOG`. Tidak ada UI (Ponytail: nihil).

## Glob freeze

```text
apps/web/src/routes/operator/**/*
apps/web/src/components/operator/**/*
apps/web/src/lib/simulation/**/*
apps/web/src/services/*operator*
apps/web/src/routes/operator/data/budget-revisions.tsx
apps/web/src/routes/operator/deviasi.tsx
apps/web/src/routes/operator/penyerapan.tsx
apps/web/src/routes/operator/data/contracts-invoices.tsx
apps/web/src/routes/operator/data/output-achievement.tsx
apps/web/src/routes/operator/data/spm-dispensation.tsx
apps/web/src/routes/operator/reminders.tsx
apps/web/src/routes/operator/dashboard.tsx
apps/web/src/routes/operator/history.tsx
apps/web/src/routes/operator/simulation.tsx
apps/web/src/routes/operator/up-tup.tsx
apps/web/src/services/simulation-service.ts
apps/web/src/services/reminders-service.ts
apps/web/src/services/output-achievement-service.ts
apps/web/src/services/*budget*
apps/web/src/services/*revision*
apps/web/src/services/*rpd*
apps/web/src/services/*contract*
apps/web/src/services/*output*
apps/web/src/services/*spm*
apps/web/src/services/*reminder*
apps/web/src/services/*dashboard*
apps/web/src/server/dashboard.ts
apps/web/src/server/simulation/**/*
apps/web/src/components/layout/operator-*
```

## Verifikasi wajib

1. `npm run typecheck --workspace @simulator-ikpa/web` → 0 error.
2. `git diff --name-only` hanya file docs (`docs/operator-freeze.md`, `docs/BACKLOG.md`, `docs/DEVLOG.md`).
