# Go-live Checklist — Simulator IKPA

**Current decision:** `NO-GO` (local baseline only).

- [x] Contract v2 and 24 V2-AC indexed.
- [x] Typecheck, workspace unit/golden tests, lint, build, and local E2E smoke
      pass.
- [x] Production mock/fallback/export signature guards are fail-closed.
- [ ] Isolated preview database migrated and seeded with non-production data.
- [ ] Clerk/authenticated Operator and Admin E2E pass on desktop and mobile.
- [ ] Cross-tenant/cross-KPPN integration suite pass.
- [ ] Mandatory reminder policy and idempotent delivery replay pass.
- [ ] CI quality gate runs on a remote pull request without skipped steps.
- [ ] Vercel preview and Cloudflare rules are verified.
- [ ] Observability, alert, rollback, and secret-rotation drills pass.
- [ ] UAT report has no unresolved Blocked/Needs Fix criteria.
- [ ] 2026 regulatory parameters have source and approver recorded.

Do not change this decision to `GO` from a local smoke run alone.
