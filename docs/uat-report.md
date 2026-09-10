# UAT Report — Revisi v2

**Status:** `Blocked / Not a release approval`  
**Environment:** Local verification dengan branch Neon test dan Clerk test key; authenticated staging/E2E belum tersedia.
**Contract:** [Acceptance Criteria Revisi v2](revisi-v2/ACCEPTANCE-CRITERIA.md)

`Done` di bawah berarti bukti unit/pure atau smoke lokal tersedia; bukan berarti
UAT authenticated sudah lulus. Setiap criteria yang belum memiliki bukti
staging tetap menahan go-live.

| ID | Status | Bukti / blocker |
|---|---|---|
| V2-AC-01 | Needs Fix | Landing smoke desktop/mobile 2/2; login persistence belum diuji |
| V2-AC-02 | Blocked | Memerlukan Clerk/DB fixture terisolasi |
| V2-AC-03 | Blocked | Access-pending/403 authenticated E2E belum tersedia |
| V2-AC-04 | Blocked | Navigasi 8 indikator authenticated belum diuji |
| V2-AC-05 | Needs Fix | Branch Neon test + authenticated HTTP/DB isolation 10 test lulus; seluruh ServerFn dan E2E belum terwakili |
| V2-AC-06 | Blocked | Admin scope/read-only E2E membutuhkan database test |
| V2-AC-07 | Blocked | Admin mapping/last-admin E2E membutuhkan database test |
| V2-AC-08 | Needs Fix | Unit validation dan Import deferred; import job/QStash serta sebagian scoped integration lulus |
| V2-AC-09 | Done | Engine breakdown 8 baris dan version test tersedia |
| V2-AC-10 | Done | Golden/boundary test workspace lulus |
| V2-AC-11 | Needs Fix | Pure actual/what-if test ada; persistence E2E belum ada |
| V2-AC-12 | Blocked | Slot A/B/C persistence membutuhkan DB/auth fixture |
| V2-AC-13 | Blocked | Slot name full-flow E2E belum ada |
| V2-AC-14 | Blocked | Dashboard authenticated/recommendation E2E belum ada |
| V2-AC-15 | Blocked | Dashboard–Riwayat parity authenticated belum ada |
| V2-AC-16 | Blocked | Compare monthly/scenario E2E belum ada |
| V2-AC-17 | Blocked | Policy publish/retire DB test belum ada |
| V2-AC-18 | Blocked | Mandatory lock DB/provider test belum ada |
| V2-AC-19 | Needs Fix | Pure deadline test lulus; policy active integration belum ada |
| V2-AC-20 | Blocked | Re-evaluation/snapshot version DB test belum ada |
| V2-AC-21 | Blocked | Delivery replay/idempotency provider test belum ada |
| V2-AC-22 | Blocked | Admin aggregate scoped E2E belum ada |
| V2-AC-23 | Blocked | Admin monitoring/audit/read-only E2E belum ada |
| V2-AC-24 | Needs Fix | Operator XLSX ZIP signature guard lulus; PDF/Admin export retired; scoped export E2E belum ada |

## Release decision

`NO-GO` sampai F13-02..F13-05, F13-08, F13-13, dan F13-14 memiliki bukti
environment yang sesuai serta seluruh status non-`Done` ditutup oleh owner.
