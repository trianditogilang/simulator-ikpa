<!--chatbot
integrasi myintress
tidak hanya wib
migrasi ke vps/ dc kemenkeu
fitur: setting profile pop up, tooltip, darkmode-->


<!--notes:
Review docs/BACKLOG.md, docs/DEVLOG.md, dan docs/PRE-F13-Koreksi-IA-Operator.md dulu.
Jangan F13, jangan ubah navigation, jangan hapus kode.

Task CORR-00:
1. Sisipkan seksi Fase PRE-F13 di task list, antara Fase 12 dan Fase 13, sesuai dokumen itu.
   F13 tetap unchecked, tulis Depends: PRE-F13 CORR-01..05.
2. APPEND docs/future_plan.md (jangan timpa bagian Import): arsip IA menu Input Data lama + cara restore.
3. Tambah baris CORR-00 s.d. CORR-06 di BACKLOG.
4. Append DEVLOG.

Ponytail. Update backlog, devlog, checkbox CORR-00 setelah selesai.



Saya sudah menyelesaikan CORR-00. Review backlog, devlog, dan seksi PRE-F13 di task list dulu.
Lanjut CORR-01 sesuai docs/PRE-F13-Koreksi-IA-Operator.md.
Jangan F13, jangan Admin, jangan hapus route lama.
Ponytail + context7. Update backlog, devlog, dan checkbox task list setelah DoD lulus.



Saya sudah menyelesaikan CORR-01. Review docs/BACKLOG.md, docs/DEVLOG.md, dan docs/PRE-F13-Koreksi-IA-Operator.md dulu.
Lanjut CORR-02 saja. Jangan F13, jangan Admin, jangan hapus route lama.

Workspace Penyerapan Anggaran — bukan klon Excel:
- Identitas halaman = indikator (skor, gap, target triwulan), bukan grid rumus
- Actual YTD terkunci; sisa tahun editable (pola sel kuning Sheet1)
- Skor instan via engine/rule set 2026 (51 20/50/75/95; 52 15/50/70/90; 53 10/40/70/90; 57 25/50/75/95; cap 100)
- Sheet2 = contoh rumus bersih. Sheet1 nilai TW1 hardcoded 100: abaikan
- Pagu netto (setelah blokir) boleh dipakai; bukan menu terpisah
- Akun 57 tetap didukung meski tidak ada di Excel
- ?/drawer rumus singkat. Actual tidak tertimpa

Ponytail + context7. Update backlog, devlog, dan checkbox task list setelah DoD lulus.

3	CORR-02 Penyerapan	Excel penyerapan
4	CORR-03 Deviasi	Excel DEV
5	CORR-04 UP/TUP	Excel GUP + KKP
-->


<!--Kalau *default branch* di GitHub kamu sudah `main`, tetapi setiap kali kamu *push* dari komputer lokal malah masuk ke `master`, berarti **nama cabang aktif di komputer lokal kamu yang masih `master**`.

Hal ini sangat umum terjadi ketika kamu membuat repositori pertama kali di komputer lewat perintah `git init` sebelum menghubungkannya ke GitHub.

Berikut cara cepat menyatukan dan menyinkronkannya agar kode kamu di `master` pindah ke `main`:

---

### Langkah 1: Ubah Cabang Lokal ke `main` & Push

Jalankan perintah ini di terminal komputer kamu secara berurutan:

1. **Ubah nama cabang lokal dari `master` jadi `main`:**
```bash
git branch -m master main

```


2. **Kirim (*push*) kode dari `main` lokal ke `main` di GitHub:**
```bash
git push -u origin main

```



---

### Langkah 2: Hapus Cabang `master` yang Terlanjur Terbuat di GitHub

Karena sebelumnya kamu sempat *push* ke `master`, di GitHub sekarang ada dua cabang (`main` dan `master`). Untuk menghapus `master` yang redundan di GitHub:

```bash
git push origin --delete master

```

---

### Langkah 3: Amankan untuk Proyek-Proyek Berikutnya

Agar setiap kali kamu mengetik `git init` di komputer langsung otomatis bernama `main` (bukan `master` lagi), jalankan perintah konfigurasi ini sekali saja:

```bash
git config --global init.defaultBranch main

```

Sekarang cabang di lokal dan GitHub kamu sudah sama-sama menggunakan `main`.-->

---

# Future Plan — Import Data Transaksional (DINONAKTIFKAN SEMENTARA, 2026-09-04)

> Status saat arsip: menu Import Data dinonaktifkan dari UI untuk menghemat
> penyimpanan Neon di awal implementasi (input manual per form tetap jalan).
> Backend + parser TIDAK dihapus, hanya entry UI yang dicabut sehingga
> pengaktifan ulang tinggal restore 1 nav item + 8 tombol + 1 route stub.
> Referensi task asal: F12-01 s/d F12-05 (lihat BACKLOG + DEVLOG Session 93).

## 1. Alasan penonaktifan (konteks 2026-09-04)

- Setiap upload membuat 1 baris `import_jobs` + `errorReportJson` berisi
  `validRows` (slice maks 100) + `preview` (5) + `errors` (maks 100).
  Pemakaian massal = pertumbuhan JSONB tiap upload, belum ada TTL/retensi.
- Upload masih base64 direct via ServerFn (ceiling body Vercel ~4.5 MB;
  guard parser 10 MB / 10.000 baris). R2 presigned belum aktif, jadi file
  besar membebani request body + JSONB.
- Prioritas awal: input manual 6 domain via drawer sudah cukup; import
  massal belum urgent. Aktifkan lagi saat satker minta migrasi OMSPAN massal.

## 2. Alur pengguna (wizard 3 langkah, file `routes/operator/import.tsx`)

1. **Step 1 — Unggah:** pilih Domain (6 opsi) → pilih file `.csv`/`.xlsx`
   (guard client: >10 MB ditolak, ekstensi selain csv/xlsx ditolak) →
   `uploadImportFile({ domain, file })` → file dibaca `arrayBuffer` →
   base64 → `uploadImportFn`.
2. **Step 2 — Validasi & Preview:** server return
   `{ jobId, domain, filename, totalRows, validRows, invalidRows, errors, preview, status }`.
   UI tampilkan badge valid/error, rincian error (maks 100), preview 5 baris
   valid pertama (JSON). Tombol "Lanjut ke Komitmen" disabled bila 0 valid.
3. **Step 3 — Konfirmasi Commit:** teks penegas valid-row-only + upsert +
   teraudit → `commitImportJob(jobId)` → alert jumlah committed →
   redirect `/operator/dashboard`. "Unggah Ulang" memanggil
   `cancelImportJob` (kecuali job mock `mock-*`) lalu reset ke Step 1.

## 3. Entry point UI (yang dicabut saat penonaktifan)

| Entry | File:baris (saat arsip) | Cara restore |
|---|---|---|
| Nav sidebar "Import Data" → `/operator/import` | `apps/web/src/components/layout/operator-navigation.tsx:59` (`inputItems`) + ikon `Upload` | Kembalikan 1 baris `{ label: "Import Data", href: "/operator/import", icon: Upload }` |
| Tombol "Import" di tabel Pagu & Revisi | `apps/web/src/routes/operator/data/budget-revisions.tsx:372-374` (`onImportClick` → `window.location.href = "/operator/import"`) | Kembalikan prop `onImportClick` |
| Tombol "Import" di tabel RPD & Realisasi | `apps/web/src/routes/operator/data/rpd-realization.tsx:450-452` | Sama |
| Tombol "Import" Kontrak (tab contracts) | `apps/web/src/routes/operator/data/contracts-invoices.tsx:478-480` | Sama |
| Tombol "Import" SPM-LS (tab spm) | `apps/web/src/routes/operator/data/contracts-invoices.tsx:498-500` | Sama |
| Tombol "Import" UP/TUP | `apps/web/src/routes/operator/data/up-tup-kkp.tsx:479-481` | Sama |
| Tombol "Import" KKP | `apps/web/src/routes/operator/data/up-tup-kkp.tsx:492-494` | Sama |
| Tombol "Import" Capaian Output | `apps/web/src/routes/operator/data/output-achievement.tsx:379-381` | Sama |
| Tombol "Import" SPM Dispensasi | `apps/web/src/routes/operator/data/spm-dispensation.tsx:323-325` | Sama |
| Route langsung `/operator/import` | `apps/web/src/routes/operator/import.tsx` (di-stub jadi halaman "dinonaktifkan sementara", bukan dihapus agar `routeTree.gen.ts` tidak perlu regenerate) | Kembalikan isi wizard dari git history |
| Komponen tabel generik (TIDAK diubah) | `apps/web/src/components/data/domain-data-table.tsx:21,35,62-70` (prop `onImportClick?` tetap ada) | Jangan dihapus — dipakai lagi saat restore |

## 4. Peta file backend (TIDAK dihapus — tetap di-build, hanya tak dipanggil)

| Lapisan | File | Peran |
|---|---|---|
| Client service | `apps/web/src/services/import-service.ts` | `uploadImportFile` (File → base64), `fetchImportJobs/Job`, `commit/cancelImportJob`, helper `downloadBase64File`. Thin wrapper di atas ServerFn |
| ServerFn upload/preview/list/get/commit/cancel | `apps/web/src/server/import.ts` (`uploadImportFn`, `listImportJobsFn`, `getImportJobFn`, `commitImportFn`, `cancelImportFn`) | Guard `assertOperatorOrgScope`, `normalizeDomain` (label UI → `ImportDomain`), validasi ekstensi/MIME/size base64, `parseImportFile`, insert `import_jobs` status `validated` + `errorReportJson { errors, preview, validRows[0..100] }`; commit loop validRows → mutasi domain, tandai `committing` → `completed`/`failed` |
| Parser + template header | `apps/web/src/server/import/parser.ts` (`parseImportFile`, `parseCsv`, `parseXlsx`, `DOMAIN_HEADERS`, `sanitizeForExport`) | Batas `MAX_ROWS 10.000`, `MAX_BYTES 10 MB`, `ERROR_CAP 100`; tolak formula injection `^[=+\-@\t\r]`; CSV naive split (ceiling: quoted-comma multiline); XLSX via dynamic `exceljs` (`Function("m","return import(m)")` agar build lolos tanpa dep) |
| QStash recovery | `apps/web/src/server/import/process-job.ts` (`handleQStashImport`) + `apps/web/src/routes/api/jobs/import/process.ts` (`POST /api/jobs/import/process`) | Verify signature current/next, recover `committing` stuck >5 m → `failed`, tandai `uploaded` yatim → `failed`. Upload sinkron saat ini, QStash hanya safety net |
| Mock lama | `apps/web/src/mocks/import-job.ts` (`mockImportJobs`) | Fixture F3-15, sudah tak dipakai route riil; biarkan untuk Storybook/dev |
| Skema DB | `packages/db/src/schema/import-jobs.ts` (tabel `import_jobs`: `orgId`, `fiscalYearId`, `domain`, `filename`, `storageKey` null, `status`, `total/valid/invalidRows`, `errorReportJson` JSONB, `createdBy`) | TIDAK ada migrasi drop — tabel dibiarkan agar re-enable tanpa migrasi |

## 5. Aturan parser per domain (template header `DOMAIN_HEADERS`)

- `budget_revisions`: `account_code,amount,effective_at` (51/52/53/57; decimal 18,2; `YYYY-MM-DD`) ATAU revisi (`revision_code,revision_date,pagu_before,pagu_after` — terdeteksi via header `revision_code`).
- `rpd_realization`: `month,account_code,amount[,target]` (month 1–12; target `rpd|realization`, default `rpd`).
- `contracts_invoices`: kontrak `contract_number,account_code,value,signed_at,payment_type` (51/52/53; `sekaligus|termin`) ATAU SPM-LS `contract_number,reference_number,bast_date,received_at` (lookup kontrak by number; gagal → skip baris + `lastError`).
- `up_tup_kkp`: UP/TUP `type,amount,sp2d_at[,reference_sp2d_at]` (`UP/TUP/GUP/GUP_NIHIL/PTUP/SETORAN_TUP`; GUP/PTUP wajib `reference_sp2d_at`) ATAU KKP `month,amount,usage_date`.
- `output_achievement`: `ro_code,month,rvro,volume_dipa,pcro,tpcro` (decimal 8,4; `0 ≤ rvro ≤ volume_dipa`; `pcro/tpcro` 0–100).
- `spm_dispensation`: `reference_number,issued_at,is_dispensasi` (`issued_at` wajib Okt–Des; boolean `true/1/ya/y | false/0/tidak/n`).
- Global: header case/space-insensitive; jumlah kolom harus pas; baris kosong dilewati; error di-cap 100; `totalRows` = baris non-kosong.

## 6. Semantik commit (penting saat restore — jangan diubah diam-diam)

- **valid-row-only:** hanya `validRows` tersimpan; baris error diabaikan.
- **Slice 100 (ceiling ponytail):** `errorReportJson.validRows` hanya menyimpan 100 pertama → commit massal >100 baris HANYA menyimpan 100 pertama. Upgrade path: simpan full payload (R2/bytea) atau re-parse dari `storageKey` sebelum commit massal dipakai produksi.
- **Upsert/duplikat:** via mutasi domain existing (`upsertBudget`, `upsertRpdLine/Realization`, `createContract/SpmLs`, `createUpTup/upsertKkp`, `upsertOutput`, `createSpmQ4`); tiap baris gagal → catat `lastError` (200 char) lalu lanjut.
- **Status lifecycle:** `validated → committing → completed/failed`; `cancel` hanya bila belum terminal (`completed/failed` ditolak); guard scope `assertOperatorOrgScope` di semua ServerFn; audit via mutasi domain masing-masing.
- **Mock tanpa DB:** bila `DATABASE_URL/DIRECT_URL` kosong, upload return `jobId: mock-<ts>` tanpa tulis DB; commit return `{ success, committed: 0 }`.

## 7. Biaya penyimpanan (kenapa dicabut + opsi hemat saat restore)

- Saat ini file mentah TIDAK disimpan (`storageKey: null`); yang disimpan = `errorReportJson` JSONB per job (~100 baris valid + 100 error + preview). 1 upload ≈ puluhan–ratusan KB JSONB. Tanpa retensi, 100 upload ≈ puluhan MB.
- Opsi hemat saat restore (pilih satu, urut termurah): (a) cron/TTL hapus `errorReportJson.validRows` job `completed/failed >30 hari` (simpan ringkasan count saja); (b) pindah payload ke R2 (`storageKey`) + presigned PUT/GET 5 menit (catatan DEVLOG Session 93 punya sketsa `POST /api/import/presign`); (c) baru terakhir pertimbangkan partisi/drop — JANGAN drop tabel untuk hemat kecil karena memutus re-enable.

## 8. Checklist re-enable (copy-paste saat dibutuhkan)

1. `git log --oneline -- apps/web/src/routes/operator/import.tsx` → restore wizard 3-step (atau tulis ulang tipis di atas `import-service.ts` yang masih ada).
2. Kembalikan 1 baris nav di `operator-navigation.tsx` + 8 `onImportClick` di 6 file data (tabel §3).
3. `npm install exceljs --workspace @simulator-ikpa/web` bila ingin parse XLSX beneran (tanpa ini XLSX throw panduan; CSV tetap jalan).
4. Verifikasi: `npx tsc --noEmit -p apps/web/tsconfig.json --pretty false` (0 error) → `npm run build --workspace @simulator-ikpa/web` (client + SSR lulus) → smoke upload CSV 3 baris 1 domain → cek `import_jobs` 1 baris `validated` → commit → cek data domain + status `completed`.
5. Bila file >4.5 MB dibutuhkan: aktifkan R2 presigned (env `R2_*` + `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`), ubah `uploadImportFile` ke `fetch(putUrl)` lalu notify; JANGAN jadikan object R2 URL publik permanen (hapus after terminal).
6. Update BACKLOG (baris restore) + DEVLOG (sesi re-enable) seperti biasa.

## 9. Tech-stack best practice yang dipakai saat pencabutan (context7 + ponytail)

- **TanStack Router file-based (context7 docs 2026):** file di `src/routes` = route; prefix `-` mengecualikan file dari `routeTree.gen.ts`. Kami SENGAJA tidak rename/delete `import.tsx` agar `routeTree.gen.ts` tidak berubah (tanpa `tsr generate` ulang, tanpa 404, tanpa type-break). Penonaktifan cukup di lapisan komponen (stub) + hapus link navigasi — pola standar "keep route, disable entry".
- **TanStack Start ServerFn:** backend import tetap di-bundle server-only; tanpa pemanggil, tidak ada biaya runtime/storage. Tidak perlu feature-flag env baru (ponytail: 1 stub > 1 flag + 1 config + N branch).
- **Neon Postgres + Drizzle:** hemat storage via "stop nulis" (cabut UI), bukan via migrasi drop tabel. Drop = migrasi + review + risiko re-enable; stop-nulis = 0 migrasi, reversibel 1 commit.
- **Ponytail ladder yang dipakai:** YAGNI (R2/queue/TTL ditunda) → reuse (`OperatorShell`, `DomainDataTable` prop existing, mutasi domain existing) → stdlib/native (tanpa dep baru) → 1-line-ish diff (1 nav + 1 stub + 8 prop) → `skipped: R2 presigned, TTL cleanup, exceljs dep, penghapusan tabel; add when: upload massal >100 baris / file >4.5 MB / JSONB bengkak`.
