# 06 — Penyelesaian Tagihan (bobot 10%)

**Anchor:** `00-system-overview.md`, `01-dashboard.md` | **Tanggal:** 2026-09-05
**Mode:** INSPECT → TRACE → DOCUMENT. Tanpa vonis regulasi, tanpa ubahan code/docs operasional.
**Catatan instruksi:** perintah menyebut "Deviasi" tetapi file diminta `06-penyelesaian-tagihan.md` — dokumen ini memeriksa **Penyelesaian Tagihan** sesuai nama file.

## 1. Module Purpose

Menilai ketepatan SPM-LS (non-pegawai) yang diterima KPPN maksimal H+17 hari kerja sejak BAST/BAPP. Berbagi halaman `/operator/data/contracts-invoices` dengan Belanja Kontraktual (tab Kontrak | SPM-LS) + strip reminder H+17 wajib (CORR-06) + saran kontekstual. Tanpa workspace what-if; skenario hanya via Dashboard.

## 2. Implementation Status

| Aspek | Status |
|---|---|
| CRUD SPM-LS scoped + guard FY sama + soft-delete + audit | IMPLEMENTED |
| Engine H+17 + skor + bobot 10 | IMPLEMENTED (dengan deviasi kalender/pegawai, §7–8) |
| Strip H+17 + saran + link Reminder Center | IMPLEMENTED (estimasi Mon–Fri, bukan kalender KPPN) |
| Pengecualian pegawai | NOT IMPLEMENTED (dihitung semua; hanya label) |
| Kalender kerja penuh (libur + akhir pekan + override) | PARTIAL (libur DB dipakai; akhir pekan dihitung; override diabaikan) |
| Dashboard 1 baris + rekomendasi | IMPLEMENTED |
| Riwayat perbandingan | IMPLEMENTED (via snapshot umum) |
| Export (sheet SPM-LS + ringkasan) | IMPLEMENTED |
| Reminder H-5/H-2/H-0 terjadwal | PARTIAL (policy seed ada; strip hanya estimasi baca, bukan scheduler) |

## 3. Source Code Map

| Lapisan | File |
|---|---|
| Engine | `packages/ikpa-engine/src/indicators/invoice-timeliness.ts` (`calculateInvoiceTimeliness`, `countWorkdays`) |
| Skema engine | `packages/ikpa-engine/src/schemas.ts:60-74` (`invoiceInputSchema{id,bastDate,spmDate}` — tanpa `isPegawai`; `workdayCalendarSchema{holidays,workdays}`) |
| Aturan | `packages/ikpa-engine/src/rule-set.ts:158-166` (bobot 10); warning `TAG-003` via `assumptionWarnings` |
| Mapping DB→Engine | `apps/web/src/server/simulation/calculate.ts:91-102,337-344` (semua `spmLsRows` tanpa filter pegawai; `holidays` = workdays.isHoliday, `workdayOverrides` diteruskan tetapi tak dibaca engine) |
| Strip/saran | `apps/web/src/lib/simulation/tagihan-output-reminder.ts:17-99` (`countWorkdaysMonFri`, `addWorkdaysMonFri`, `buildSpmReminders`, `tagihanAdvice`) + test 8 |
| UI halaman | `apps/web/src/routes/operator/data/contracts-invoices.tsx` (815 baris; tab, 3 kartu metriks, strip §457-512, tabel kontrak/SPM, drawer kontrak/SPM) |
| Service/API | `apps/web/src/services/contracts-invoices-service.ts` (`fetch/add/removeSpmLs`, kontrak); `apps/web/src/server/contracts-invoices.ts` (6 ServerFn + FY2026); `server/domains/contracts-invoices.queries.ts` (`listSpmLs`, `projectDeadlineH17`), `.mutations.ts:23-30,153-197` (Zod + guard FY sama + audit) |
| Schema DB | `packages/db/src/schema/spm-ls.ts` (`spm_ls{contractId,referenceNumber,bastBappDate,receivedAtKppn NOT NULL,isPegawai,…}`), `contracts.ts` (induk) |
| Reminder seed | `packages/db/src/seed.ts:202-220` (`spm_ls_contract_17d`, mandatory, `workdays_after_bast:17`, lead 3–10, default `[10,5,2]`) |
| Dashboard | `apps/web/src/server/dashboard.ts`, `dashboard.tsx:25-34` (`TAGIHAN → /operator/data/contracts-invoices`) |
| Panduan/mock | `mocks/guides.ts:55-64` (g-05, rumus benar), `mocks/contracts-invoices.ts` (dead mock vendor), `mocks/operator-dashboard.ts` (13/15) |

## 4. User Flow

Tab `SPM-LS`: 3 kartu (Jumlah Kontrak, Total Nilai, Jumlah SPM-LS + "Target 17 HK") → strip `Reminder H+17 wajib` (judul + count terlambat + link Reminder Center; kosong → saran; ada → top-5 Terlambat + saran + catatan estimasi) → tabs Kontrak/SPM → tabel SPM (Nomor + kategori Pegawai/Non, Kontrak Terkait via lookup client, BAST, Diterima KPPN, aksi hapus) + search nomor → drawer SPM (select kontrak default baris pertama, nomor, BAST default hari-ini, diterima default hari-ini, checkbox pegawai default false) → `addSpmLs` (guard: kontrak wajib dipilih; tanggal bebas) → invalidate. Hapus via `confirm()`. Tanpa kartu skor/plan/`?` tagihan; dampak via Dashboard.

## 5. Input Inventory

| Input | Type | Required | Default | Validation | Source | Digunakan Calculation? |
|---|---|---|---|---|---|---|
| `contractId` | select kontrak | Ya | kontrak pertama | UUID + ada + FY sama + tak deleted | drawer SPM | TIDAK (relasi saja) |
| `referenceNumber` | text | Ya | `""` | trim di FE; BE 1–64 | drawer SPM | TIDAK (label strip) |
| `bastBappDate` | date | Ya | hari-ini | `z.iso.date()` | drawer SPM | YA (start, exclusive) |
| `receivedAtKppn` | date | Ya | hari-ini | `z.iso.date()` (NOT NULL di DB) | drawer SPM | YA (end, inclusive) |
| `isPegawai` | checkbox | Tidak | false | boolean | drawer SPM | TIDAK (disimpan + label strip; engine abaikan) → GAP |
| `search` | text | Tidak | — | client nomor | toolbar | TIDAK |

## 6. Validation Rules

- FE: kontrak harus dipilih (`!selectedContractId` → error); nomor trim (kosong → BE tolak); tanggal default hari-ini (bisa kapan pun).
- BE (`createSpmSchema`): UUID, nomor 1–64, dua tanggal ISO (tanpa urutan — `received<bast` diizinkan), `isPegawai` opsional. Guard: kontrak ada + FY sama + tak deleted. Komentar eksplisit `H+17 not validated here` (`mutations.ts:172`). Tanpa cek: SPM kontraktual vs non-kontraktual, pegawai, 17 hari, duplikat nomor, masa depan.
- Scope FY + audit (`create/delete_spm_ls`). Soft-delete (bukan hard).

## 7. Business Rules

**Rule ID:** TAG-BR-001 — H+17 start-exclusive end-inclusive, libur-di-skip (tetapi akhir pekan DIHITUNG)
Trigger: engine per invoice. Processing (`invoice-timeliness.ts:6-31`): `cur=bast+1 hari`; tiap hari `≤spmDate`: bila `YYYY-MM-DD ∉ holidays` → +1. Akhir pekan **tidak** dikecualikan (tak ada cek `getDay`), hari kerja eksplisit (`workdays[]`) **tidak** dibaca (hanya `holidays[]`). Output: `workdays` int. Ref.

**Rule ID:** TAG-BR-002 — Tepat bila ≤17
Condition: `workdays≤17 → onTime++` (`:62-64`). BAST==SPM → 0 → tepat. `spm<bast` → loop kosong → 0 → tepat (artifisial).

**Rule ID:** TAG-BR-003 — Skor rasio + rounding mode
Processing: `raw=onTime/total×100`; round sesuai `rounding.mode` (half_up/down/down/up) + `toFixed(fractionDigits)`; kontribusi dibulatkan ulang (`:67-122`). Output: `score`, `weightedContribution`, trace 2 langkah.

**Rule ID:** TAG-BR-004 — Kosong = incomplete
Condition: `invoices.length==0` → `{score:null, incomplete}` + warning ID "…non-pegawai (denominator nol)" (`:40-51`). Praktik: DB tanpa SPM → Dashboard Estimasi.

**Rule ID:** TAG-BR-005 — Semua baris dihitung (pegawai ikut)
Mapping tanpa filter (`calculate.ts:337-344`); skema tanpa field pegawai. Teks warning "non-pegawai" menyesatkan. Strip bedakan label (`· Pegawai`) tetapi `tagihanAdvice` keluarkan pegawai dari penyebut saran (strip ≠ engine).

**Rule ID:** TAG-BR-006 — Strip estimasi Mon–Fri (bukan vonis)
`countWorkdaysMonFri` (`tagihan-output-reminder.ts:17-29`): Sen–Jum saja, tanpa libur; `end<start→null→Menunggu`; `received null→Menunggu` (tak tercapai via DB NOT NULL). Status `≤17 Tepat else Terlambat`. Saran: 0 scored → imbauan; semua tepat → apresiasi; ada terlambat → `N dari M … prioritaskan {3 nomor}`.

**Rule ID:** TAG-BR-007 — Helper proyeksi H+17 tak terpakai di halaman
`projectDeadlineH17` (`queries.ts:55-70`, Mon–Fri + skip libur argumen) — nol pemanggil di route (dead helper untuk kebutuhan stimasi tanggal, bukan penilaian).

## 8. Calculation Logic

Input (`schemas.ts:60-74`): `invoices[{bastDate,spmDate}]`, `workdayCalendar{holidays[],workdays[] (diabaikan)}`. Server: seluruh SPM FY + `holidays` dari `workdays.isHoliday` + overrides tak-berfungsi. Jejak: `Rasio (onTime/total)×100` + `Tertimbang (score×weight)/100`. Warning `TAG-*` disalin (`TAG-003: Pengecualian pegawai belum final` — pengakuan eksplisit).

## 9. Formula & Variables

Persis code: `wd = count_{d=bast+1..spm}(d ∉ holidays)`; `onTime = #{wd≤17}`; `score = round_mode(onTime/total×100, 2)`; `weighted = round_mode(score×10/100, 2)`. BAST hari ke-0 (ADR-001 konsisten: eksklusif start). H-0 = tanggal deadline (batas ≤17).

## 10. Threshold / Weight / Period / Rounding

- Bobot 10. Threshold 17 inklusif. Tanpa bucket/kurva. Periode: seluruh SPM FY aktif (tanpa jendela bulan/TW — SPM lama ikut selamanya sampai dihapus).
- Rounding 4-mode + 2 desimal (skor & kontribusi terpisah). Golden: 13/15 → `86.67` + `8.67` (test `:26-68`; PRD:628 "tagihan 86,67").
- Nol: tanpa SPM → null/incomplete (bukan 0/100). Satu SPM 19-hari-tanpa-libur → `0.00`.
- `workdays[]` override + akhir pekan: diabaikan/dihitung (lihat §7) — verifikasi kalender di §25.

## 11. Calculation Examples (engine aktual)

### Normal Case — golden 86.67
13× (1→10 Jan, 9 hari kalender, 0 libur → tepat) + 2× (1→25 Jan, 24 hari → terlambat) → 13/15×100 = 86.666… → half_up 2 → `"86.67"`, kontribusi 8.67, complete.

### Boundary Case
17 hari kerja (tanpa libur: BAST 1 Jan → SPM 18 Jan = 17) → tepat; 18 → terlambat. 10 hari-libur di tengah (test `:70-101`): BAST 1 Jan → SPM 28 Jan = 27 kalender − 10 libur = 17 → tepat → `"100.00"`.

### Edge/Invalid Case
(a) Kosong → null/incomplete + warning (Dashboard Estimasi 0). (b) `spm<bast` → 0 hari → tepat (artifisial; validasi tak tolak). (c) Pegawai 10/10 tepat + non 0/5 → engine 15/15 = 100 (pegawai mendongkrak; seharusnya dikecualikan). (d) Strip vs engine: Sabtu–Minggu dihitung engine tetapi tidak di strip → berkas lintas-akhir-pekan bisa Tepat-di-strip tetapi Terlambat-di-engine (atau sebaliknya saat libur nasional: strip hitung, engine skip). (e) `receivedAtKppn` wajib NOT NULL → tak ada status Menunggu nyata.

## 12. Data Model & Persistence

`spm_ls{id, fiscalYearId, contractId→contracts(cascade), referenceNumber, bastBappDate date, receivedAtKppn date NOT NULL, isPegawai bool default false, createdBy, deletedAt…}` + indeks FY/kontrak/tanggal/pegawai. Alir: drawer → guard FY → insert + audit → baca non-deleted → engine/strip/tabel/export. Hapus kontrak = cascade ke SPM (peringatan `confirm` "mungkin terpengaruh" — sebenarnya pasti cascade di DB).

## 13. API / Service

`contracts-invoices-service{fetchContractsAndInvoices,addSpmLs,removeSpmLs}` → `server/contracts-invoices.ts{listContractsAndSpmFn,createSpmLsFn,deleteSpmLsFn}` → domain queries/mutations. Validator ServerFn passthrough; Zod domain; FY2026 auto-init; fallback tanpa-DB UNCERTAIN (pola modul lain: sukses-palsu — belum dibaca di trace ini).

## 14. End-to-End Data Flow

`drawer SPM → service → ServerFn → scope+FY → Zod+guard → insert+audit → invalidate → loader → (a) tabel/3 kartu, (b) strip estimasi Mon–Fri, (c) Dashboard load → calculate.ts (semua baris + kalender libur) → engine H+17 → skor → kartu TAGIHAN + rekomendasi + history/export.` Saran strip tak masuk snapshot; warning TAG engine masuk snapshot.

## 15. Dashboard Integration — IMPLEMENTED (sumber sama)

Satu engine actual; threshold kartu 90/75; rute `TAGIHAN → /operator/data/contracts-invoices` (berbagi dengan kontraktual). Rekomendasi `Ketepatan Waktu Tagihan` deep-link konsisten. Catatan: kartu Dashboard tak tampilkan per-berkas (hanya agregat); strip per-berkas hanya di halaman.

## 16. Reminder Integration — PARTIAL

Seed `spm_ls_contract_17d` mandatory (`workdays_after_bast 17`, lead 3–10, default `[10,5,2]`, penerima `ppk,bendahara`) → muncul generik di Reminder Center + scheduler/QStash (skeleton, dokumen 00). Strip halaman = alat baca estimasi + link, bukan jadwal H-5/H-2/H-0 terkirim. `nearestDeadline` Dashboard hardcode Output (bukan tagihan berikut). Deadline DSL vs hitungan strip berbeda (kalender vs Mon–Fri).

## 17. History Integration — IMPLEMENTED

`breakdownJson.indicators[invoice_timeliness]` + trace + versi rule per snapshot; compare History. Per-berkas tak berversi (hanya agregat).

## 18. Report/Export Integration — IMPLEMENTED

Sheet `SPM-LS` mentah (termasuk flag pegawai) + Ringkasan 8 + PDF + agregat Admin dari tabel/snapshot scoped; sanitasi; base64. Copy "7 indikator" sama.

## 19. Error Handling

Loader tanpa try/catch; mutasi → banner; `confirm()` hapus; tanpa-DB UNCERTAIN. `parseISO` strip kembalikan `Menunggu` untuk tanggal malformed (tak mungkin dari DB valid). `formatRupiah(parseFloat)` hanya untuk kontrak.

## 20. Edge Cases

- SPM lintas tahun FY: scoped FY aktif saja (SPM FY lama tak ikut walau BAST dekat).
- Kontrak dihapus → SPM ikut cascade (audit hanya baris kontrak; SPM hilang tanpa audit sendiri — UNCERTAIN, cek cascade-audit).
- `receivedAtKppn` NOT NULL: tak ada konsep "tagihan berjalan/belum sampai" di skor (semua dinilai final).
- SPM kontraktual vs non-kontraktual tak dibedakan (kolom tak ada) — padahal label indikator "kontraktual non-pegawai".
- Duplikat nomor, tanggal masa depan, `spm<bast` diizinkan.

## 21. Mock/Hardcoded/Placeholder Findings (9)

1. HARDCODED: bobot 10, H+17, `≤17`, mode round, seed lead/default/penerima.
2. HARDCODED: FY2026; teks strip/saran; link Reminder Center; judul tombol DeadlinePanel `Buka Data Tagihan`.
3. DIVERGENSI kalender: engine (kalender−libur, akhir pekan dihitung, override mati) vs strip (Mon–Fri, tanpa libur) vs helper `projectDeadlineH17` (Mon–Fri + libur argumen, mati).
4. Warning menyesatkan: "non-pegawai (denominator nol)" + `TAG-003` (teks akui, code tetap hitung pegawai).
5. Skema `receivedAtKppn NOT NULL` vs tipe strip `received null` + status Menunggu (tak terjangkau).
6. Dead mock `mocks/contracts-invoices.ts` (vendor/BAST) + contoh dashboard 13/15 (konsisten angka tetapi statis).
7. Panduan g-05 benar rumus (langka — cocok engine) tetapi tanpa sebut pengecualian pegawai/kalender.
8. Tanpa-DB fallback UNCERTAIN; tanpa kartu skor tagihan di halaman.
9. TODO implisit: filter pegawai, akhir-pekan/override, kolom kontraktual, status berjalan, tolak `spm<bast`/duplikat/masa-depan, audit cascade.

## 22. Source Code Evidence

| Bagian | File → function/component → purpose |
|---|---|
| Kalkulasi | `packages/ikpa-engine/src/indicators/invoice-timeliness.ts` → `calculateInvoiceTimeliness/countWorkdays` |
| Skema/aturan | `packages/ikpa-engine/src/schemas.ts:60-74`; `packages/ikpa-engine/src/rule-set.ts` (bobot + `TAG-003`) |
| Mapping | `apps/web/src/server/simulation/calculate.ts:91-102,337-344` (+ `workdayRows` → holidays/overrides) |
| Strip | `apps/web/src/lib/simulation/tagihan-output-reminder.ts:17-99` → Mon–Fri + saran |
| UI | `apps/web/src/routes/operator/data/contracts-invoices.tsx:56-108,142-173,300-363,415-512` → tab/strip/tabel/drawer |
| Service/API/validasi | `apps/web/src/services/contracts-invoices-service.ts`; `apps/web/src/server/contracts-invoices.ts`; `apps/web/src/server/domains/contracts-invoices.{queries.ts:41-70,mutations.ts:23-30,153-197}` |
| DB | `packages/db/src/schema/spm-ls.ts` → `spm_ls` |
| Reminder seed | `packages/db/src/seed.ts:202-220` |
| Dashboard/History/Export | `server/dashboard.ts`, `dashboard.tsx`, `history.tsx`, `exports/operator-xlsx.ts` |
| Test | `invoice-timeliness.test.ts` (4: kosong, golden 86.67, libur, >17), `tagihan-output-reminder.test.ts` (8) |

## 23. Documentation Discrepancies

1. PRD:253/FSD/TSD "non-pegawai" vs code hitung semua (diakui `TAG-003` needs_verification + PRD:642) — BACKLOG F6-07/F9-05/F11-05 klaim selesai/tervalidasi.
2. PRD:265 `BAST/BAPP menuju batas` mandatory H-5/H-2/H-0 + penerima terkunci vs strip estimasi + scheduler skeleton — BACKLOG F10 klaim selesai.
3. ADR-001 (H+17 start-exclusive, H-0 = deadline) cocok engine, tetapi engine hitung akhir pekan sebagai kerja — kontradiksi "hari kerja" yang perlu putusan.
4. Banner halaman sebut "kontrak (3 hari kerja)" — ranah kontraktual, bukan tagihan (campur pesan seperti g-04).
5. `fitur.md` tetap tidak ada.

## 24. Implementation Gaps (7)

1. Pegawai ikut skor (pengecualian belum final) — peringatan teks tanpa efek.
2. Akhir pekan dihitung kerja; `workdays[]` override diabaikan (kalender setengah pakai).
3. Strip estimasi Mon–Fri tanpa libur vs engine kalender-minus-libur — dua kebenaran berbeda di satu halaman vs Dashboard.
4. Tanpa status berjalan (NOT NULL) + tanpa kolom kontraktual — seluruh SPM final & campur jenis.
5. Tanpa jadwal H-5/H-2/H-0 terkirim dari halaman (hanya baca + link).
6. `spm<bast`/duplikat/masa-depan lolos; cascade hapus tanpa audit SPM.
7. Nav ganda + tanpa skor tagihan di halaman (buta dampak hingga Dashboard).

## 25. Questions for AI Reviewer

1. Apakah `wd = hari ∉ holidays (termasuk Sabtu–Minggu), BAST eksklusif`, `tepat ≤17`, `skor = onTime/total×100`, bobot 10, semua-SPM-FY (pegawai ikut) sudah sesuai regulasi — khususnya akhir pekan, `workdays[]` override, dan pengecualian pegawai/kontraktual?
2. Apakah `spm<bast → 0 → tepat`, NOT NULL (tanpa berjalan), cascade-tanpa-audit, dan duplikat/masa-depan dapat diterima?
3. Mana kalender kanonis: engine (kalender−libur) vs strip (Mon–Fri) vs helper (Mon–Fri+libur) — dan bolehkah strip berlabel estimasi tampil berdampingan dengan skor resmi?
4. Apakah reminder mandatory H-5/H-2/H-0 + penerima wajib (`ppk,bendahara`) sudah terpenuhi oleh policy-seed + strip-baca, atau pengiriman terjadwal wajib ada sebelum go-live?
5. Apakah warning "non-pegawai (denominator nol)" + `TAG-003` cukup sebagai pengungkapan, atau filter pegawai wajib di engine + mapping sekarang?
6. Apakah agregat seluruh-FY (tanpa jendela) + `nearestDeadline` hardcode-Output memenuhi kebutuhan tenggat tagihan berikut?
7. Apakah panduan g-05 perlu dilengkapi pengecualian + definisi hari kerja + contoh batas agar konsisten dengan ADR-001?

---
*Berhenti di sini. Jangan lanjut ke indikator berikutnya tanpa perintah.*
