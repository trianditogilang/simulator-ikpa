# 05 — Belanja Kontraktual (bobot 10%)

**Anchor:** `00-system-overview.md`, `01-dashboard.md` | **Tanggal:** 2026-09-05
**Mode:** INSPECT → TRACE → DOCUMENT. Tanpa vonis regulasi, tanpa ubahan code/docs operasional.
**Catatan instruksi:** perintah menyebut "Deviasi" tetapi file diminta `05-belanja-kontraktual.md` — dokumen ini memeriksa **Belanja Kontraktual** sesuai nama file (Deviasi sudah di `03`).

## 1. Module Purpose

Menilai akselerasi/distribusi kontrak lewat tiga sub-komponen (Distribusi 20% + Kontrak Dini 40% + Akselerasi 53 40%). Berbagi halaman `/operator/data/contracts-invoices` dengan Penyelesaian Tagihan (dua tab: Kontrak | SPM-LS). Tanpa workspace what-if (ditunda sebagai "sheet kasar" di PRE-F13); skenario hanya via Dashboard.

## 2. Implementation Status

| Aspek | Status |
|---|---|
| CRUD Kontrak scoped + soft-delete + audit | IMPLEMENTED |
| Engine 3 komponen + bucket distribusi + bobot 20/40/40 | IMPLEMENTED (dengan input mati, §7–8) |
| Akselerasi 53 dari data nyata | NOT IMPLEMENTED (`accelerations53: []` selalu) |
| Flag kontrak dini Pra-DIPA | NOT IMPLEMENTED (`isEarlyProcurement: false` selalu) |
| Filter termin / akun-53 di engine | NOT IMPLEMENTED (hanya filter nilai ≥Rp50jt) |
| Dashboard 1 baris + rekomendasi | IMPLEMENTED |
| Riwayat perbandingan | IMPLEMENTED (via snapshot umum) |
| Export (sheet Kontrak + ringkasan) | IMPLEMENTED |
| Reminder khusus kontrak dini/modal-53 | NOT IMPLEMENTED (tanpa policy seed; tanpa strip) |
| Panduan g-04 | MOCK (rumus beda: "3 hari kerja", bukan 3 komponen) |

## 3. Source Code Map

| Lapisan | File |
|---|---|
| Engine | `packages/ikpa-engine/src/indicators/contractual.ts` (`calculateContractual`) |
| Skema engine | `packages/ikpa-engine/src/schemas.ts:41-58` (`contractInputSchema{id,amount,signedDate,submittedDate,isEarlyProcurement}`, `acceleration53InputSchema{id,amount,signedDate}`, `contractualInputSchema`) |
| Aturan | `packages/ikpa-engine/src/rule-set.ts:158-166,172-178,192-196` (bobot 10; bucket distribusi 0→0/0.01-25→50/25.01-50→60/50.01-75→80/75.01-100→100; `contractualWeights{early:40, acc53:40, distr:20}`; warning `KON-006`) |
| Mapping DB→Engine | `apps/web/src/server/simulation/calculate.ts:327-336` (seluruh kontrak → `contracts[]`, `isEarlyProcurement:false`, `accelerations53:[]`) |
| UI halaman | `apps/web/src/routes/operator/data/contracts-invoices.tsx` (815 baris; tab contracts\|spm; drawer kontrak/SPM; strip H+17 milik Tagihan) |
| Service/API | `apps/web/src/services/contracts-invoices-service.ts` (`fetch/add/edit/removeContract`, `add/removeSpmLs`); `apps/web/src/server/contracts-invoices.ts` (6 ServerFn + FY2026 + fallback); `server/domains/contracts-invoices.queries|mutations.ts` (Zod + scope + audit; komentar `engine handles` eligibility) |
| Schema DB | `packages/db/src/schema/contracts.ts` (`contracts{contractNumber,accountCode,value,signedAt,paymentType,sp2dAt,…}`), `spm-ls.ts` (dipakai Tagihan) |
| Dashboard | `apps/web/src/server/dashboard.ts:53-61,135-168` (`contractual → /operator/data/contracts-invoices`); `dashboard.tsx:25-34` (`BELANJA_KONTRAKTUAL` + `TAGIHAN` berbagi href) |
| Panduan/mock | `mocks/guides.ts:45-54` (g-04), `mocks/contracts-invoices.ts` (dead mock vendor/BAST), `mocks/operator-dashboard.ts:117-127` |

## 4. User Flow

Tab `Kontrak`: banner total nilai + tabel (Nomor/Akun, Nilai, Tgl TTD, tipe `sekaligus|termin`, SP2D, aksi) + search nomor → drawer Tambah (nomor, akun 51/52/53, nilai, tgl TTD default hari-ini, tipe default `sekaligus`, SP2D opsional) → `addContract` → invalidate; Edit via `editContract`; hapus via `confirm()` → `removeContract`. Tab `SPM` milik Tagihan (dokumen 06). Tanpa kartu skor/strip/plan/`?` untuk kontraktual di halaman ini; dampak terlihat di Dashboard. Nav `Belanja Kontraktual` + `Penyelesaian Tagihan` berbagi href (highlight ganda sementara, CORR-01).

## 5. Input Inventory

| Input | Type | Required | Default | Validation | Source | Digunakan Calculation? |
|---|---|---|---|---|---|---|
| `contractNumber` | text | Ya | `""` | trim, 1–64 | drawer kontrak | TIDAK (id saja) |
| `accountCode` | select 51/52/53 | Ya | `"53"` | enum (tanpa 57) | drawer | TIDAK (tak difilter engine) → GAP |
| `value` | numeric string | Ya | `""`→0 | `parseFloat\|\|0`+`toFixed(2)`; BE decimal 18,2 (negatif lolos) | drawer | YA (syarat ≥50jt; penimbang) |
| `signedAt` | date | Ya | hari-ini | `z.iso.date()` | drawer | YA (bulan TTD → TW II / TW I) |
| `paymentType` | select sekaligus/termin | Ya | `sekaligus` | enum | drawer | TIDAK (disimpan, tak dibaca engine) → GAP |
| `sp2dAt` | date\|null | Tidak | `""`→null | ISO\|null | drawer | YA sebagian (`submittedDate = sp2dAt ?? signedAt` — diteruskan tetapi tak dibaca engine!) → GAP |
| `search` | text | Tidak | — | client nomor | toolbar | TIDAK |
| Flag Pra-DIPA | — | — | — | — | TIDAK ADA di UI/DB | TAK TERISI (selalu false) |
| Daftar akselerasi-53 | — | — | — | — | TAK ADA (selalu `[]`) | TAK TERISI |

## 6. Validation Rules

- FE: `required` + trim nomor; `parseFloat||0`; tanggal default hari-ini.
- BE (`contracts-invoices.mutations.ts:9-30`): decimal 18,2 (negatif diizinkan), nomor 1–64, akun `51|52|53` (57 ditolak — beda dari pagu/RPD/deviasi/penyerapan yang dukung 57), `paymentType` enum, tanggal ISO. FY milik org + audit (`create/update/delete_contract`). Tanpa cek: nilai ≥0, tanggal ≤ hari-ini/dalam-TA, duplikat nomor, akun 53 + rentang 50–200jt + non-termin (sengaja "store as is").

## 7. Business Rules

**Rule ID:** KON-BR-001 — Eligible kontraktual = nilai ≥ Rp50jt (saja)
Trigger: engine. Condition: `parseDecimal(amount)>=50000000` (`contractual.ts:24-26`). Tanpa filter akun/termin/tanggal. Output: `eligibleContracts`. Ref.

**Rule ID:** KON-BR-002 — Distribusi s.d. TW II + bucket
Processing: `amountQ2` = Σ eligible dengan `getMonth(signedDate)≤5` (Jan–Jun, komentar "TW II"); `ratio=amountQ2/total×100`; first-match bucket (`contractual.ts:34-74`); `ratio>100→100` safety. Output: `distributionScore` (trace `Nilai Distribusi Kontrak`). Bucket: 0→0, 0.01–25→50, 25.01–50→60, 50.01–75→80, 75.01–100→100.

**Rule ID:** KON-BR-003 — Kontrak dini (Pra-DIPA 120 / Jan–Mar 110 / lain 0)
Processing: per kontrak `cScore = isEarly?120 : signedMonth≤2?110 : 0`; `earlyAvg = Σ(cScore×amount)/Σamount` (`contractual.ts:50-86`). Output: `earlyProcurementScore` (4 desimal, tanpa cap — bisa >100). Jalur 120 mati via server.

**Rule ID:** KON-BR-004 — Akselerasi 53 (50–200jt, selesai TW I)
Condition: `50jt≤amt≤200jt`; selesai = `signedMonth≤2` (`contractual.ts:101-123`). Output: `(completed/total)×100`. Via server: input selalu `[]` → cabang kosong → `100` + warning.

**Rule ID:** KON-BR-005 — Kosong = 100 + warning
Condition: `eligibleContracts` kosong → distribusi 100 + dini 100 + warning ID; `eligible53` kosong → 100 + warning (`contractual.ts:28-31,106-108`). Praktik: DB kosong → skor kontraktual 100 (bukan incomplete).

**Rule ID:** KON-BR-006 — Final 20/40/40 + kontribusi IKPA
Processing: `final = distr×0.2 + dini×0.4 + acc53×0.4` (`round 2`); `weighted = final×10/100` (`contractual.ts:135-159,204-212`). Status selalu `complete` (kecuali tak ada cabang incomplete). `subComponents[3]` + warning `KON-006` selalu ditempel.

## 8. Calculation Logic

Input (`schemas.ts:55-58`): `contracts[{amount,signedDate,submittedDate,isEarlyProcurement}]`, `accelerations53[{amount,signedDate}]`. Server isi: seluruh `contractRows` (semua akun/tipe) dengan `submittedDate=sp2dAt??signedAt`, `isEarly=false`; `accelerations53=[]`. Artinya 2 dari 3 sub-input efektif mati; `submittedDate` diteruskan tetapi nol pembacaan di engine (dead field kedua setelah `hasBudgetChange` revisi).

## 9. Formula & Variables

Persis code: `elig = amount≥50jt`; `ratio = Σ elig Jan–Jun / Σ elig ×100 → bucket`; `early = Σ(score×amount)/Σamount`, `score ∈ {120 Pra-DIPA (mati), 110 Jan–Mar, 0}`; `acc53 = Σ53 Jan–Mar / Σ53 eligible(50–200jt) ×100` (=100 via server); `final = 0.2 distr + 0.4 early + 0.4 acc53`; `weighted = final×0.1`. Util `parseDecimal/round/mul/div` (`utils.ts`).

## 10. Threshold / Weight / Period / Rounding

- Bobot indikator 10; sub-bobot 20/40/40 (invarian Σ=100 di `rule-set.ts:87-99`).
- Threshold: 50jt (elig), 50–200jt (53), bulan TW II `≤5` (Jun inklusif), TW I `≤2` (Mar inklusif), bucket 0/25/50/75/100. Skor komponen 110/120 melebihi 100 tanpa cap (dini & final bisa >100).
- Periode: tahun berjalan implisit (tanpa filter tahun di engine — semua baris FY aktif; FY lain tak terbaca karena scoped FY).
- Rounding: dini/acc53 `round(4)`, final `round(2)`, weighted `round(2)`. Bulan via `new Date(signedDate).getMonth()` lokal server (timezone-naif, tanggal ISO `YYYY-MM-DD` → tengah-malam UTC bisa geser bulan di WIB — UNCERTAIN).

## 11. Calculation Examples (engine aktual, bobot 10)

### Normal Case — campuran (test emas `contractual.test.ts:19-74`)
c1 100jt Feb + c2 100jt Jul; a1 100jt Feb + a2 100jt Apr → distr ratio 50% → bucket 60 (×0.2=12); dini (110+0)/2=55 (×0.4=22); acc53 50% (×0.4=20) → `final "54.00"`, weighted 5.40, `subComponents 60 / 55.0000 / 50.0000`.

### Boundary Case
Rasio 25% → 50 vs 25.01% → 60 (selisih 10 poin komponen = 2 poin final). Kontrak 49.999.999 → tak eligible (diabaikan total); tepat 50.000.000 → eligible. TTD 31 Mar (getMonth 2) → dini 110 + acc53 selesai; 1 Apr (getMonth 3) → 0 + belum.

### Edge/Invalid Case
(a) DB kosong via server → `contracts[] + acc53[]` → 100/100/100 → final `"100.00"` complete + 2 warning ID (kosong = sempurna). (b) Semua kontrak <50jt → sama dengan (a) (diabaikan total). (c) Semua Jan–Mar ≥50jt: dini 110 → final = 0.2×bucket(100→100)=20 + 44 + 40 = 104 → melebihi 100, weighted 10.4 (tanpa cap — perlu putusan reviewer). (d) `isEarlyProcurement` tak pernah true via server (jalur 120 mati). (e) Termin 53 Rp100jt selesai Mar → via server masuk `contracts` (bukan `accelerations53`) → hanya pengaruhi distr/dini, acc53 tetap 100. (f) Akun 57 ditolak di drawer (enum) — kontrak 57 tak bisa dicatat walau pagu 57 ada.

## 12. Data Model & Persistence

`contracts{id, fiscalYearId, contractNumber text, accountCode text(51/52/53), value numeric(18,2), signedAt date, paymentType enum(sekaligus|termin), sp2dAt date?, createdBy, deletedAt…}` + indeks FY/nomor/akun/tanggal. Tulis insert/update/soft-delete + audit; baca scoped FY non-deleted (tanpa order). SPM-LS terpisah (`spm_ls`, dokumen 06). Tanpa tabel akselerasi-53 / flag dini (kolom tak ada — alasan struktural mengapa mapping mati).

## 13. API / Service

`contracts-invoices-service.ts` → `server/contracts-invoices.ts`: `listContractsAndSpmFn(GET)`, `createContractFn/updateContractFn/deleteContractFn`, (+ SPM milik Tagihan). Validator ServerFn passthrough; Zod di domain; FY2026 auto-init; fallback tanpa-DB (pola: periksa saat deep-inspection Tagihan — UNCERTAIN untuk kontrak, kemungkinan sukses-palsu seperti modul lain).

## 14. End-to-End Data Flow

`drawer kontrak → service → ServerFn → scope+FY2026 → Zod → insert+audit → invalidate → loader (kontrak+SPM) → tabel/tab. Terpisah: Dashboard load → calculate.ts petakan SEMUA kontrak (tanpa filter akun/termin; dini=false; acc53=[]) → calculateContractual(default? no — rule published) → skor → kartu BELANJA_KONTRAKTUAL + rekomendasi + history/export.` Drawer `paymentType/sp2dAt/akun` tersimpan tetapi tak mengubah skor (kecuali nilai & tanggal).

## 15. Dashboard Integration — IMPLEMENTED (sumber sama, rute ganda)

Satu engine actual; petakan threshold 90/75; `deltaPoints:0`; rute server `contractual → /operator/data/contracts-invoices`; nav `BELANJA_KONTRAKTUAL` + `TAGIHAN` → href sama (highlight ganda). Rekomendasi `Selesaikan Proses Kontraktual` (deep-link `contracts-invoices` — konsisten di kedua peta untuk modul ini).

## 16. Reminder Integration — NOT IMPLEMENTED

PRD:262-263 `Kontrak dini (H-30/H-14 sblm 31 Mar)` + `Kontrak modal 53 (H-14)` — seed 5 policy tanpa keduanya; halaman tanpa strip/peringatan kontraktual (strip CORR-06 hanya H+17 Tagihan); `nearestDeadline` hardcode Output. Satu-satunya sinyal = rekomendasi generik engine.

## 17. History Integration — IMPLEMENTED

`breakdownJson.indicators[contractual]` (+`subComponents[3]` + trace + versi rule) tersimpan tiap load; compare History tampilkan kontribusi. Lineage scenario via Dashboard (tanpa asumsi kontraktual).

## 18. Report/Export Integration — IMPLEMENTED

Sheet `Kontrak` mentah + Ringkasan 8 + PDF + agregat Admin dari tabel/snapshot scoped; sanitasi; base64. Copy "7 indikator" sama (discrepancy copy).

## 19. Error Handling

Loader tanpa try/catch; mutasi → banner; hapus via `confirm()`; `formatRupiah(parseFloat)` bisa throw bila korup. Tanpa-DB kemungkinan sukses-palsu (UNCERTAIN — verifikasi saat Tagihan bila perlu).

## 20. Edge Cases

- <50jt diabaikan total (bukan 0 parsial) — satu rupiah menentukan eligibilitas.
- Batas bulan via `getMonth` (Jun/Mar inklusif); tanggal ISO tengah-malam UTC vs WIB bisa geser bulan-batas.
- Skor >100 mungkin (dini 110/120) tanpa cap akhir.
- Akun 57 tak bisa diinput (enum 51–53) tetapi pagu 57 ada — asimetri input.
- Termin tak berpengaruh (kolom mati) walau PRD/FSD/TSD mensyaratkan pengecualian termin untuk 53.
- Duplikat nomor diizinkan (tiap baris bobot penuh).

## 21. Mock/Hardcoded/Placeholder Findings (10)

1. HARDCODED: bobot 10 + 20/40/40 + bucket + 50jt/200jt + bulan 5/2 + skor 120/110 (config via rule set, nilai awal hardcode).
2. MATI via server: `isEarlyProcurement:false` (jalur 120), `accelerations53:[]` (komponen 53 selalu 100), `submittedDate` diteruskan-tak-dibaca.
3. Komentar `engine handles` (`mutations.ts:57`) — engine justru tak filter akun/termin.
4. Panduan g-04 rumus "3 hari kerja" ≠ 3 komponen engine (salah domain — mirip definisi pendaftaran kontrak, bukan akselerasi).
5. Dead mock `mocks/contracts-invoices.ts` (vendor/BAST) tak diimpor halaman.
6. Nav ganda Kontraktual+Tagihan satu href.
7. Tanpa strip/`?`/skor di halaman untuk kontraktual (hanya strip Tagihan).
8. Tanpa kolom/flag Pra-DIPA & tabel-53 di DB (alasan struktural).
9. Tanpa-DB fallback UNCERTAIN (belum dibaca di trace ini).
10. TODO implisit: filter termin/akun-53, cap final, enum 57, tolak negatif/duplikat/masa-depan.

## 22. Source Code Evidence

| Bagian | File → function/component → purpose |
|---|---|
| Kalkulasi | `packages/ikpa-engine/src/indicators/contractual.ts` → `calculateContractual` |
| Skema/aturan | `packages/ikpa-engine/src/schemas.ts:41-58`; `packages/ikpa-engine/src/rule-set.ts:158-166,172-178,192-196` |
| Mapping | `apps/web/src/server/simulation/calculate.ts:327-336` |
| UI | `apps/web/src/routes/operator/data/contracts-invoices.tsx` → `ContractsInvoicesPage/handleCreateContract/...` (tab + drawer + strip Tagihan) |
| Service/API/validasi | `apps/web/src/services/contracts-invoices-service.ts`; `apps/web/src/server/contracts-invoices.ts`; `apps/web/src/server/domains/contracts-invoices.*` |
| DB | `packages/db/src/schema/contracts.ts` → `contracts` |
| Dashboard/History/Export | `server/dashboard.ts`, `dashboard.tsx`, `history.tsx`, `exports/operator-xlsx.ts` |
| Test | `packages/ikpa-engine/src/indicators/contractual.test.ts` (2: kosong-100, campuran-54) |

## 23. Documentation Discrepancies

1. PRD:252/FSD:874/ERD: kontrak 53 eligible (akun 53, 50–200jt, bukan termin) vs code (tanpa filter akun/termin; acc53 selalu 100) — BACKLOG F6-06/F9-05/F11-05 klaim selesai/tervalidasi.
2. PRD:262-263 event kontrak-dini + modal-53 vs seed tanpa policy — BACKLOG F7-16/F10 klaim selesai.
3. Panduan g-04 ("3 hari kerja") vs engine 3 komponen vs PRD — tiga sumber tiga rumus.
4. TSD:1322/877 contoh vs perilaku kosong=100 (apakah contoh mencakup kasus kosong? UNCERTAIN).
5. `fitur.md` tetap tidak ada.

## 24. Implementation Gaps (7)

1. Komponen Akselerasi-53 tidak terhubung data (selalu 100 → +40% final gratis).
2. Flag Pra-DIPA tidak ada (jalur 120 mati; skor dini maks 110 via Jan–Mar saja).
3. Termin/akun tak difilter (kontrak pegawai?/termin kecil ikut selama ≥50jt; kontrak 57 tak bisa masuk).
4. Skor final tanpa cap (bisa >100) + dini tanpa cap.
5. Tanpa reminder/strip kontraktual + tanpa what-if (sheet kasar ditunda).
6. Nav ganda + tanpa skor di halaman (user buta dampak hingga buka Dashboard).
7. Negatif/duplikat/masa-depan/timezone-bulan tanpa penjagaan.

## 25. Questions for AI Reviewer

1. Apakah `elig≥50jt (semua akun, termin ikut)`, `distr Jan–Jun→bucket`, `dini {120 Pra-DIPA, 110 Jan–Mar, 0} rata-rata tertimbang nilai`, `acc53 (50–200jt, selesai Mar)`, `final 20/40/40`, bobot 10, tanpa cap sudah sesuai regulasi — khususnya nasib termin, akun-57, dan Pra-DIPA yang mati?
2. Apakah `accelerations53:[]` + `isEarly:false` berarti go-live diblokir sampai kolom/sumber 53 & flag dini ada, atau 100-otomatis dapat diterima sementara (dengan pengungkapan)?
3. Apakah skor >100 (dini 110/120, final 104) harus di-cap, dan bucket distribusi di bawah 50% (PRD:642) sudah final?
4. Apakah batas Jun/Mar inklusif via `getMonth` + tanpa filter tahun sudah tepat, termasuk kontrak masa depan/duplikat/negatif?
5. Mana rumus kanonis: engine 3-komponen vs panduan "3 hari kerja" vs PRD — dan apakah panduan g-04 harus ditulis ulang?
6. Apakah ketiadaan reminder kontrak-dini/modal-53 memblokir go-live?
7. Haruskah drawer menolak akun-57-ditolak vs pagu-57-ada diselaraskan (tambah 57 atau dokumentasikan pengecualian)?

---
*Berhenti di sini. Jangan lanjut ke indikator berikutnya tanpa perintah.*
