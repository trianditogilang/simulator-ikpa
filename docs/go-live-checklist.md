# Go-live Checklist — Simulator IKPA

**Current decision:** `NO-GO` (local baseline only).

- [x] Contract v2 and 24 V2-AC indexed.
- [x] Typecheck, workspace unit/golden tests, lint, build, and local E2E smoke
      pass.
- [x] Production mock/fallback/export signature guards are fail-closed.
- [ ] Isolated preview database migrated and seeded with non-production data.
- [ ] No service outside Indonesia stores or processes application data
      (ADR-008 inventory verified after MIG-01..MIG-07).
- [ ] Authenticated Operator and Admin E2E pass on desktop and mobile on the
      ADR-008 stack (Better Auth + self-hosted PostgreSQL).
- [ ] Cross-tenant/cross-KPPN integration suite pass.
- [ ] Mandatory reminder policy and idempotent delivery replay pass.
- [ ] CI quality gate runs on a remote pull request without skipped steps.
- [ ] VPS staging deployment, reverse-proxy/firewall rules, and backup restore
      are verified (F13-09, F13-10).
- [ ] Observability, alert, rollback, and secret-rotation drills pass.
- [ ] UAT report has no unresolved Blocked/Needs Fix criteria.
- [ ] 2026 regulatory parameters have source and approver recorded.

Do not change this decision to `GO` from a local smoke run alone.
