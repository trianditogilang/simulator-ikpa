# Documentation Index

This index is the starting point for project context. The application behavior
already accepted in the repository remains the default; documentation changes
must not silently change product behavior.

## Active product contract

The revision-v2 documents are the active product contract for the current
8-indicator Operator information architecture and Admin KPPN monitoring:

- [PRD Revisi v2](revisi-v2/PRD-Simulator-IKPA.md)
- [FSD Revisi v2](revisi-v2/FSD-Simulator-IKPA.md)
- [TSD Revisi v2](revisi-v2/TSD-Simulator-IKPA.md)
- [ERD Revisi v2](revisi-v2/ERD-Simulator-IKPA.md)
- [Acceptance Criteria Revisi v2](revisi-v2/ACCEPTANCE-CRITERIA.md)
- [Traceability Matrix](traceability-matrix.md)
- [Architecture decisions](adr/)

The baseline documents at the root of `docs/` are historical references when
they conflict with the active revision-v2 contract. Conflicts must be reported
before a behavior-changing implementation decision is made.

## Planning and execution

- [Task List](TASK-LIST-Simulator-IKPA.md) — phase order, scope, dependencies, and DoD
- [BACKLOG](BACKLOG.md) — current task status, blockers, and next actions
- [DEVLOG](DEVLOG.md) — concise execution evidence and decisions
- [Operator stabilization policy](operator-freeze.md)
- [Future plan](future_plan.md)
- [UAT report](uat-report.md) — per-ID evidence and current release decision
- [Go-live checklist](go-live-checklist.md) — explicit local/staging gates
- [Operations runbook](runbook-operations.md)
- [Incident runbook](runbook-incidents.md)
- [Observability baseline](observability-baseline.md)
- [Vercel preview checklist](deployment-vercel.md)
- [Cloudflare security baseline](cloudflare-security-baseline.md)

## Supporting references

- [Implementation review](implementation-review/)
- [UI/UX design system](UI-UX-Design-System.md)
- [UI/UX wireframes](UI-UX-Wireframes.md)
- [Regulatory verification](regulatory-verification-2026.md)
- [Smoke navigation](smoke-test-navigation.md)

## Agent reading guide

At session start:

1. Read `AGENTS.md` and this index.
2. Inspect `git status` and preserve existing changes.
3. Read the active task, its dependencies, and the relevant acceptance criteria.
4. Read the active/open backlog section and recent DEVLOG entries.
5. Search older records by task ID, feature, ADR, or affected path.

Do not load the complete `BACKLOG.md` or `DEVLOG.md` unless resolving a
dependency, regression, historical decision, or documentation conflict.

## Documentation maintenance

Keep active documents focused on current work. Archive completed records only
in a dedicated documentation task under `docs/archive/`; preserve task IDs and
repair inbound links before moving any document. BACKLOG and DEVLOG are both
updated when a task is completed, but BACKLOG stays concise and DEVLOG carries
the verification evidence. PRE-F13 archival is intentionally held as a
separate task until the blocked authenticated UAT/release gates have an owner;
the current append-only history remains the source of record.
