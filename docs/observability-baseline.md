# Observability Baseline — Simulator IKPA

**Status:** Partial / Needs Fix (F13-11).

> **Catatan ADR-008 (2026-11-15):** Vercel Logs dan layanan observability di luar Indonesia tidak dipakai. Target F13-11 adalah log terstruktur ke stdout dengan rotasi di host VPS dan alert lewat SMTP. Rujukan QStash di bawah dibaca sebagai endpoint job cron setelah MIG-04.

## Already available

- QStash route mengembalikan `x-request-id`.
- Audit log menyimpan actor, entity, action, scope, dan request ID pada mutasi
  administratif/operasional yang sudah terhubung.
- Error response production dipotong dan diberi code terstruktur untuk DB,
  provider, signature, dan export.

## Still required before go-live

- Correlation/request ID konsisten pada seluruh ServerFn dan route.
- Redaction test untuk payload email, cookie, token, dan upload.
- Metric kalkulasi/export latency, failure rate, delivery retry, dan publish
  failure.
- Alert yang dapat diuji untuk job stuck, provider outage, dan mandatory
  reminder failure.

Tidak ada vendor observability atau credential yang diasumsikan aktif oleh
repository. F13-11 belum boleh ditandai Completed tanpa sinkronisasi dengan
platform deployment.
