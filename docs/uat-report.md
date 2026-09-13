# UAT Report — Revisi v2

**Status:** `Blocked / Not a release approval`  
**Environment:** Authenticated Preview verification pada `https://simulator-ikpa-web-git-staging-trianditogilang.vercel.app` dengan branch Neon test dan sesi Clerk Operator/Admin sementara; fixture data dibuat dan dibersihkan pada database test, release UAT lintas fase tetap belum selesai.
**Contract:** [Acceptance Criteria Revisi v2](revisi-v2/ACCEPTANCE-CRITERIA.md)

`Done` di bawah berarti bukti unit/pure atau smoke lokal tersedia; bukan berarti
UAT authenticated sudah lulus. Setiap criteria yang belum memiliki bukti
staging tetap menahan go-live.

| ID | Status | Bukti / blocker |
|---|---|---|
| V2-AC-01 | Needs Fix | Landing smoke desktop/mobile 2/2; login persistence belum diuji |
| V2-AC-02 | Blocked | Memerlukan Clerk/DB fixture terisolasi |
| V2-AC-03 | Blocked | Access-pending/403 authenticated E2E belum tersedia |
| V2-AC-04 | Done | Authenticated Playwright 12/12 memuat dashboard dan navigasi seluruh 8 workspace pada Chromium desktop + Mobile Chrome |
| V2-AC-05 | Needs Fix | Branch Neon test + authenticated HTTP/DB isolation 10 test lulus; seluruh ServerFn dan E2E belum terwakili |
| V2-AC-06 | Done | Authenticated Admin E2E 12/12 memverifikasi scope KPPN, agregat 8 indikator, detail read-only, dan peer rejection tanpa leakage |
| V2-AC-07 | Needs Fix | Last-admin/self protection terverifikasi; multi-admin equivalence dan add/remove lifecycle belum diuji |
| V2-AC-08 | Needs Fix | Unit validation dan Import deferred; import job/QStash serta sebagian scoped integration lulus |
| V2-AC-09 | Done | Engine breakdown 8 baris dan version test tersedia |
| V2-AC-10 | Done | Golden/boundary test workspace lulus |
| V2-AC-11 | Done | Authenticated what-if E2E menjaga nilai Aktual tetap sama dan menyimpan hasil sebagai scenario terpisah |
| V2-AC-12 | Needs Fix | Slot B persistence terverifikasi; Slot A/C belum diuji independen |
| V2-AC-13 | Done | Nama scenario Slot B tersimpan dan muncul kembali di Riwayat |
| V2-AC-14 | Done | Dashboard authenticated menampilkan 8 indikator |
| V2-AC-15 | Done | Dua snapshot aktual fixture tampil konsisten pada Dashboard/Riwayat compare flow |
| V2-AC-16 | Done | Compare dua evaluasi bulanan dengan Slot B scenario menampilkan tabel indikator IKPA |
| V2-AC-17 | Blocked | Policy publish/retire DB test belum ada |
| V2-AC-18 | Blocked | Mandatory lock DB/provider test belum ada |
| V2-AC-19 | Needs Fix | Pure deadline test lulus; policy active integration belum ada |
| V2-AC-20 | Blocked | Re-evaluation/snapshot version DB test belum ada |
| V2-AC-21 | Blocked | Delivery replay/idempotency provider test belum ada |
| V2-AC-22 | Done | Admin E2E 12/12 memverifikasi agregat 8 indikator dengan score/gap/source Aktual, Proyeksi, dan Kosong |
| V2-AC-23 | Done | Admin E2E memverifikasi mandatory reminder/risk, failed delivery retry + audit, scope rejection, read-only tanpa kontrol operasional, dan policy fail-safe |
| V2-AC-24 | Done | Authenticated Operator XLSX download lulus; ZIP signature guard; PDF/Admin export retired |

## Release decision

`NO-GO` sampai F13-02..F13-05, F13-08, F13-13, dan F13-14 memiliki bukti
environment yang sesuai serta seluruh status non-`Done` ditutup oleh owner.
