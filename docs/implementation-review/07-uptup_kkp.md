# 07 — Pengelolaan UP/TUP & KKP (bobot 10%)

**Anchor:** `00-system-overview.md`, `01-dashboard.md` | **Tanggal:** 2026-09-05
**Mode:** INSPECT → TRACE → DOCUMENT. Tanpa vonis regulasi, tanpa ubahan code/docs operasional.
**Catatan instruksi:** perintah menyebut "Deviasi" tetapi file diminta `07-uptup_kkp.md` — dokumen ini memeriksa **UP/TUP & KKP** sesuai nama file.

## 1. Module Purpose

Menilai revolving tunai (GUP/PTUP/setoran) + proporsi KKP. Tiga permukaan: (a) tab data `/operator/data/up-tup-kkp` (CRUD transaksi UP/TUP + KKP bulanan), (b) workspace `/operator/up-tup` (CORR-04: skor gabungan/aktual/delta/Tunai·KKP + strip reminder GUP/PTUP wajib + panel what-if GUP/KKP reuse), (c) panel asumsi dipakai Simulasi legacy + (via server) forecast/scenario. Satu-satunya indikator dengan what-if panel penuh + tabel acuan Excel.

## 2. Implementation Status

| Aspek | Status |
|---|---|
| CRUD UP/TUP (6 tipe) + KKP bulanan scoped + audit | IMPLEMENTED |
| Engine tunai 50/25/25 + KKP 90/10 + bobot 10 | IMPLEMENTED (count-based, §8) |
| Workspace + strip GUP/PTUP + panel GUP/KKP | IMPLEMENTED |
| Panel asumsi → forecast/scenario server | IMPLEMENTED (lossy, §8) |
| Dashboard 1 baris + rekomendasi | IMPLEMENTED |
| Riwayat perbandingan | IMPLEMENTED (via snapshot umum) |
| Export (sheet UP/TUP + KKP + ringkasan) | IMPLEMENTED |
| Reminder GUP/PTUP terjadwal | PARTIAL (strip baca aktual; policy seed ada; scheduler skeleton) |
| KKP custom terpisah | IMPLEMENTED (panel `kkpNominal/kkpTanggal`; tab data bulanan) |

## 3. Source Code Map

| Lapisan | File |
|---|---|
| Engine | `packages/ikpa-engine/src/indicators/up-tup.ts` (`calculateUpTup`, `countDays` kalender, `getMonth/Quarter`) |
| Skema engine | `packages/ikpa-engine/src/schemas.ts:76-94` (`upTupTransactionSchema{UP\|TUP}`, `kkpTransactionSchema`, `upTupInputSchema`) |
| Aturan | `packages/ikpa-engine/src/rule-set.ts:157-166,197-202` (bobot 10; `kkpTargets 1:1/2:5/3:9/4:12.5`; warning `UPT-006` + dinamis `UPT-007`) |
| Mapping DB→Engine | `apps/web/src/server/simulation/calculate.ts:244-298` (collapse non-TUP→UP; KKP fallback `YYYY-MM-15`; asumsi forecast/scenario) |
| Workspace lib | `apps/web/src/lib/simulation/up-tup-workspace.ts` (`collapseDbType`, `mapActualToEngine`, `calcUpTupScore`, `mergeWithAssumptions`, `buildGupReminders`) + test 9; `up-tup-assumptions.ts` (panel logic: `calcGupPreview`, `calcTanggalMaksimal`, `maxHariSP2DAgar100`, `buildUpTupEngineInput`, defaults UP 18jt/GUP 11jt) + test 19 |
| Workspace UI | `apps/web/src/routes/operator/up-tup.tsx` (454 baris; 4 kartu + strip + aktual-terkunci + panel reuse + `?`/dialog) |
| Panel UI | `apps/web/src/components/operator/up-tup-assumption-panel.tsx` (readout Kualitas GUP % merah/hijau + saran + tabel acuan statis + Catatan Excel) |
| Data UI | `apps/web/src/routes/operator/data/up-tup-kkp.tsx` (699 baris; 2 tab + drawer UP/TUP + drawer KKP) |
| Service/API | `apps/web/src/services/up-tup-kkp-service.ts` (`fetch/add/removeUpTup`, `save/removeKkp`); `apps/web/src/server/up-tup-kkp.ts` (5 ServerFn + FY2026); `server/domains/up-tup-kkp.{queries,mutations}.ts` (Zod + GUP/PTUP-wajib-referensi + audit) |
| Schema DB | `packages/db/src/schema/up-tup.ts` (`up_tup_transactions{type 6 enum,amount,sp2dAt,referenceSp2dAt,settlementDate,isSettled,…}`), `kkp.ts` (`kkp_usages{month,amount,usageDate,…}`) |
| Reminder seed | `packages/db/src/seed.ts:221-239` (`up_tup_revolving_monthly`, mandatory, `monthly_revolving:30`, lead 3–7, default `[7,3,1]`) |
| Dashboard | `server/dashboard.ts`, `dashboard.tsx:25-34` (`UP_TUP → /operator/up-tup`) |

## 4. User Flow

**Tab data:** tab UP/TUP (tabel tipe/nominal/SP2D/referensi/pertanggungjawaban/status + search) + tab KKP (bulanan + target) → drawer UP/TUP (select 6 tipe, nominal, SP2D, referensi, tanggal PJ, checkbox settled; GUP/PTUP tanpa referensi → ditolak) → `addUpTup` → invalidate; drawer KKP (bulan + nominal + tanggal opsional) → `saveKkpUsage` (upsert bulanan); hapus via `confirm()`.
**Workspace:** loader `fetchUpTupAndKkp` → 4 kartu (skor gabungan, aktual, delta, Tunai·KKP) → strip reminder wajib per GUP/PTUP aktual (jatuh tempo = hari-sama-bulan-depan; Tepat/Terlambat/Menunggu + H−n + saran) → section aktual DB terkunci → panel what-if (nominal UP, nominal & tanggal GUP, counter TUP-tepat/terlambat/PTUP/GUP-nihil/setoran, KKP nominal/tanggal; live preview + trace + tabel acuan + saran "UBAH…LEBIH CEPAT atau TAMBAHKAN…") + `?` rumus → catatan kuning-tak-timpa. Tanpa simpan (delta hanya halaman; simpan via Dashboard).

## 5. Input Inventory

| Input | Type | Required | Default | Validation | Source | Digunakan Calculation? |
|---|---|---|---|---|---|---|
| `type` | select 6 | Ya | — | enum UP/TUP/GUP/GUP_NIHIL/PTUP/SETORAN_TUP | drawer | YA (collapse → UP/TUP) |
| `amount` | numeric | Ya | — | decimal 18,2 (negatif lolos) | drawer | YA (KKP-% nominal; count untuk tunai tak pakai nominal!) |
| `sp2dAt` | date | Ya | — | ISO | drawer | YA (start hitung hari; bulan KKP-tunai) |
| `referenceSp2dAt` | date\|null | Wajib utk GUP/PTUP | null | ISO\|null; ditolak bila kosong utk GUP/PTUP | drawer | TIDAK (disimpan, tak dibaca engine) → GAP |
| `settlementDate` | date\|null | Tidak | null | ISO\|null | drawer | YA (selisih hari; same-month) |
| `isSettled` | checkbox | Tidak | false | boolean | drawer | YA (false/tanpa tanggal = terlambat implisit) |
| KKP `month`+`amount`+`usageDate?` | int/numeric/date? | Ya/Ya/Tidak | — | month 1–12; decimal; ISO\|null | drawer KKP | YA (bulan→TW; fallback tgl-15) |
| Asumsi panel | 11 field | — | DEFAULT (UP 18jt, GUP 11jt, 05-05→05-25, counter 0, KKP 0) | `calcGupPreview` validasi (UP>0, GUP≥0, ISO, rencana>sebelumnya) | panel | YA (workspace lokal + server forecast/scenario) |

## 6. Validation Rules

- BE (`up-tup-kkp.mutations.ts:13-32,60-63`): decimal 18,2; enum 6 tipe; ISO; KKP month 1–12. Satu-satunya validasi referensial modul: **GUP/PTUP wajib `referenceSp2dAt`** (throw). Unik KKP bulanan (upsert month). Scope FY + audit. Tanpa cek: nominal ≥0, tanggal ≤ hari-ini, settlement ≥ SP2D, duplikat, GUP-nihil-nol vs GUP-nilai.
- FE/panel: `FormattedNumberInput` + `calcGupPreview` (pesan ID eksplisit); counter asumsi clamp 0–20 (server) ; workspace buang tanggal malformed diam-diam (`isoDate null → skip` transaksi!).

## 7. Business Rules

**Rule ID:** UPT-BR-001 — Collapse tipe DB (lossy, mirror server↔workspace)
`UP→UP, TUP→TUP, selainnya→UP` (`calculate.ts:244-248`; `collapseDbType`, `up-tup-workspace.ts:34-39`). Akibat: PTUP/SETORAN/GUP_NIHIL tak dibedakan engine; nuansa jenis hilang by design (terdokumentasi di asumsi).

**Rule ID:** UPT-BR-002 — Tunai count-based 50/25/25 (nominal diabaikan)
Ketepatan = #{settled ≤30 hari kalender}/#{semua tx}; Disebulankan = #{UP same-month}/#{UP}; Setoran = #{TUP ≤30}/#{TUP}; grup kosong → 100; unsettled → penyebut saja (terlambat). `tunai = 0.5/0.25/0.25` (`up-tup.ts:62-107`). Hari = selisih kalender (`countDays`, bukan hari kerja).

**Rule ID:** UPT-BR-003 — KKP kumulatif nominal per TW + bonus 110
Per TW q≤maxQuarter(periode): `pct = ΣKKP/Σ(KKP+tunai nominal)` kumulatif; `≥target → 110 else 100`; `kkp = rata-rata TW` (`up-tup.ts:121-167`). Target Q 1/5/9/12.5. Periode: month→ceil(m/3), quarter/semester/year sesuai (`:127-132`); Dashboard default bulan 8 → Q3 (3 TW dievaluasi).

**Rule ID:** UPT-BR-004 — Final 90/10 + kontribusi (tanpa cap)
`final = tunai×0.9 + kkp×0.1`, round mode-config; `weighted = final×10/100` (`up-tup.ts:179-196`). Bisa >100 (test 101.00).

**Rule ID:** UPT-BR-005 — Kosong = incomplete
`transactions + kkp` kosong → null/incomplete + 2 warning (`up-tup.ts:49-60`); workspace short-circuit sama sebelum panggil engine (`up-tup-workspace.ts:87-89`). Praktik: ada 1 baris apa pun → complete.

**Rule ID:** UPT-BR-006 — GUP workbook (panel, bukan skor resmi)
`maksimal = hari-sama-bulan-depan` (`calcTanggalMaksimal`); `status = rencana≤maksimal`; `nilai = (GUP/UP)×(disebulankan/SP2D)×100 cap 100` + saran OKE/UBAH + tabel acuan `maxHari = floor(%×{28,30,31})` (`up-tup-assumptions.ts:119-296`). Panel tampilkan workbook + engine berdampingan (dua kebenaran eksplisit).

**Rule ID:** UPT-BR-007 — Asumsi → engine (lossy, counts + Rp1jt)
GUP→1 UP (nominal rencana); tiap counter → N×Rp1.000.000 (tepat +20h / lambat +35h / nihil UP-0 +10h); KKP>0 → 1 tx (`buildUpTupEngineInput`, `:332-436`; server duplikat `:265-298` dengan cap 20). Server pakai hanya forecast/scenario; actual selalu DB.

**Rule ID:** UPT-BR-008 — Reminder GUP/PTUP per aktual
`due = hari-sama-bulan-depan(sp2d)`; settled → banding tanggal; belum → H−n vs today (`buildGupReminders`, `:152-201`; `calcTanggalMaksimal` tanpa kalender libur — teks panel "waspada libur" saja).

## 8. Calculation Logic

Input (`schemas.ts:76-94`): `transactions[{UP|TUP,amount,date,settlementDate?,isSettled}]`, `kkpTransactions[{amount,date}]` + `period` terpisah. Server bangun dari DB + asumsi (forecast/scenario); workspace dari `mapActualToEngine` (skip tanggal-malformed; KKP fallback tgl-15) + `mergeWithAssumptions`. Jejak 4 langkah: Tunai / KKP / Akhir `(Tunai×0.9)+(KKP×0.1)` / Tertimbang. Warning `UPT-*` + `UPT-007` proporsi-nominal selalu ditempel.

## 9. Formula & Variables

Persis code: `tepat = #{settled∧(settle−sp2d ≤30)}/#{tx}`; `sebulan = #{UP: month(settle)==month(sp2d)}/#{UP}` (tahun diabaikan — Des-2025 vs Jan-2026 dianggap sebulan!); `setor = #{TUP ≤30}/#{TUP}`; `tunai = 0.5 tepat+0.25 sebulan+0.25 setor`; `kkp_q = pct_q≥target?110:100`, `kkp = mean(q≤maxQ)`; `final = 0.9 tunai+0.1 kkp`; `weighted = final×0.1`. Workbook panel: `C11=GUP/UP; maks=same-day-next-month; nilai=C11×(E14/E17)×100 cap 100`.

## 10. Threshold / Weight / Period / Rounding

- Bobot 10; sub 50/25/25 tunai, 90/10 akhir; KKP 1/5/9/12.5 + bonus 110 (tanpa 100-pas).
- Threshold: 30 hari kalender (bukan kerja); same-month (tanpa tahun); H−n kalender. Cap: workbook 100; engine tanpa cap (101 mungkin).
- Periode: KKP dievaluasi s.d. TW periode (Dashboard Q3 default); tunai seluruh-FY tanpa jendela (transaksi lama ikut selamanya).
- Rounding: `roundDec(mode,2)` final/kontribusi; komponen `toFixed(2)`; `getMonth/Quarter` via split string (tanpa validasi tahun).
- Nol: UP-0 (`GUP Nihil`) tetap 1 transaksi (pengaruhi count); KKP-0 → pct 0 → 100 (bukan 0); total-nol + KKP-nol → pct 0 → 100.

## 11. Calculation Examples (engine aktual)

### Normal Case — sempurna → 101
UP 1000 (1→15 Jan) + TUP 1000 (1→20 Feb) + KKP 1000 (1 Mar), periode Q1: tepat 2/2=100, sebulan 1/1=100, setor 1/1=100 → tunai 100; KKP pct=1000/3000=33.33≥1 → 110 → `final = 90+11 = "101.00"`, weighted 10.10 (test `:25-74`).

### Boundary Case
Settle tepat 30 hari → tepat; 31 → terlambat. KKP pct tepat target (mis. 1.00%) → 110 (inklusif `≥`). Same-month lintas tahun (SP2D Des-2025, settle Jan-2026, month 12 vs 1) → tidak sebulan (benar kebetulan); SP2D Jan-2025 settle Jan-2026 → sebulan (salah tahun, terhitung tepat).

### Edge/Invalid Case
(a) Kosong → null/incomplete + 2 warning (Dashboard Estimasi). (b) 1 UP unsettled → tepat 0/1=0, sebulan 0/1=0, setor (TUP kosong)=100 → tunai 25 → final ≈ 22.5+KKP. (c) GUP_NIHIL Rp0 settled → 1 tx tepat + sebulan (bila same-month). (d) Default panel (UP 18jt, GUP 11jt, 05-05→05-25): workbook `61.11%×(31/20)=94.72 Tepat` (Devlog S94) — skor workbook ≠ skor engine (agregat). (e) `settlementDate<sp2dAt` → diff negatif ≤30 → tepat (artifisial). (f) Tanggal malformed → workspace skip transaksi (skor naik diam-diam); server `new Date(NaN)` → `NaN` di KKP? `addDays` fallback iso mentah (inkonsisten).

## 12. Data Model & Persistence

`up_tup_transactions{id, fiscalYearId, type 6-enum, amount numeric, sp2dAt date NOT NULL, referenceSp2dAt date?, settlementDate date?, isSettled bool default false, …}` + indeks; `kkp_usages{id, fiscalYearId, month smallint, amount numeric, usageDate date?, …}`. Tulis insert/soft-delete + audit (KKP upsert bulanan); baca non-deleted; asumsi panel tak persist (state) kecuali server forecast/scenario (`simulation_overrides entityType=assumptions`).

## 13. API / Service

`up-tup-kkp-service{fetchUpTupAndKkp,addUpTup,removeUpTup,saveKkpUsage,removeKkpUsage}` → `server/up-tup-kkp.ts` (5 ServerFn + FY2026 + fallback) → domain queries/mutations + audit. Validator passthrough; Zod domain; tanpa-DB UNCERTAIN (pola modul lain).

## 14. End-to-End Data Flow

`drawer (UP/TUP/KKP) → service → ServerFn → scope+FY → Zod(+referensi) → insert+audit → invalidate → loader → (a) tab data, (b) workspace aktual + panel-asumsi-lokal → mapActual + merge → calculateUpTup(default2026) → kartu+strip. Terpisah: Dashboard → calculate.ts (collapse + asumsi bila scenario) → engine (rule published, periode bulan-8) → kartu UP_TUP + rekomendasi + history/export.` Referensi SP2D & workbook-nilai tak mengalir ke skor resmi.

## 15. Dashboard Integration — IMPLEMENTED (sumber sama, periode default)

Satu engine actual; threshold 90/75; rute `UP_TUP → /operator/up-tup`; rekomendasi `Optimalkan UP/TUP` (deep-link `up-tup-kkp` vs rute workspace `/operator/up-tup` — beda seperti modul lain). Periode Dashboard (Q3) vs workspace (bulan global) bisa beda jumlah TW KKP dievaluasi.

## 16. Reminder Integration — PARTIAL

Strip workspace per-GUP/PTUP aktual + saran + (panel) margin-libur-teks; seed `up_tup_revolving_monthly` mandatory → Reminder Center generik + scheduler skeleton. Tanpa jadwal H-7/H-3/H-0 terkirim dari halaman; `nearestDeadline` hardcode Output. Due kalender-biasa (bukan hari-kerja-KPPN).

## 17. History Integration — IMPLEMENTED

`breakdownJson.indicators[up_tup]` (+`subComponents[tunai,kkp]` + trace + versi) per snapshot; compare History. Asumsi panel tersimpan hanya bila via Simulasi/scenario (`assumptions` override-row).

## 18. Report/Export Integration — IMPLEMENTED

Sheet UP/TUP + KKP mentah (6 tipe + flag settled) + Ringkasan 8 + PDF + agregat Admin; sanitasi; base64. Copy "7 indikator" sama.

## 19. Error Handling

Loader tanpa try/catch; mutasi → banner; GUP/PTUP-tanpa-referensi → throw eksplisit (satu-satunya di modul domain); panel → pesan validasi ID + `isValid=false`; tanggal malformed → skip/placeholder; tanpa-DB UNCERTAIN.

## 20. Edge Cases

- Unsettled selamanya = penyebut abadi (skor tak pulih sampai settled/dihapus).
- Same-month tanpa tahun; 30-hari kalender (libur/akhir-pekan ikut).
- KKP TW dievaluasi s.d. periode — Dashboard Q3 vs workspace bulan-12 beda skor KKP walau data sama.
- Nominal tunai diabaikan (Rp1 vs Rp1M sama); nominal KKP menentukan pct (Rp kecil + tunai kecil bisa 110).
- Counter asumsi nominal fiktif Rp1jt + cap 20; KKP asumsi tanpa bulan-TW eksplisit (dari tanggal).
- `referenceSp2dAt` wajib-tak-dipakai; `settlementDate<sp2d` tepat-artifisial.

## 21. Mock/Hardcoded/Placeholder Findings (10)

1. HARDCODED: bobot 10 + 50/25/25 + 90/10 + 30 hari + KKP 1/5/9/12.5 + bonus 110 + round mode.
2. HARDCODED: FY2026; default panel (UP 18jt/GUP 11jt/05-05→05-25); Rp1jt fiktif + 20/35/10 hari + cap 20; fallback KKP tgl-15.
3. Dead-ish: `referenceSp2dAt` (wajib-tak-baca), `maxHariSP2DAgar100` (lib+test, panel tak pakai lagi — Devlog S107), `hasUpTupChanges` (diimpor lalu dibuang — S108).
4. Dua kebenaran: workbook (nominal×waktu, cap 100) vs engine (count, 90/10) — disengaja + terdokumentasi di komentar.
5. Due kalender-biasa + teks "waspada libur" (bukan kalender kerja).
6. Dead mock tab-data lama (`mocks/up-tup-kkp.ts` bila ada — halaman pakai loader; verifikasi sisa bila perlu).
7. Tanpa-DB fallback UNCERTAIN; tanpa simpan-rencana; tanpa breakdown nominal di kartu Dashboard.
8. Saran panel redaksi dikunci ("…LEBIH CEPAT atau TAMBAHKAN…", S109).
9. Tabel acuan statis persis gambar (angka gambar di-code, bukan rumus).
10. TODO implisit: bedakan PTUP/Setoran/Nihil di engine, tolak negatif/duplikat/mundur-tanggal, sinkron periode, kalender kerja GUP.

## 22. Source Code Evidence

| Bagian | File → function/component → purpose |
|---|---|
| Kalkulasi | `packages/ikpa-engine/src/indicators/up-tup.ts` → `calculateUpTup/countDays/getMonth/getQuarter/roundDec` |
| Skema/aturan | `packages/ikpa-engine/src/schemas.ts:76-94`; `packages/ikpa-engine/src/rule-set.ts:157-166,197-202` |
| Mapping | `apps/web/src/server/simulation/calculate.ts:244-298` |
| Workspace | `apps/web/src/lib/simulation/up-tup-workspace.ts` → 6 fn; `up-tup-assumptions.ts` → preview + `buildUpTupEngineInput` |
| UI | `apps/web/src/routes/operator/up-tup.tsx` → `UpTupPage`; `components/operator/up-tup-assumption-panel.tsx`; `routes/operator/data/up-tup-kkp.tsx` → `UpTupKkpPage` |
| Service/API/validasi | `services/up-tup-kkp-service.ts`; `server/up-tup-kkp.ts`; `server/domains/up-tup-kkp.{queries,mutations}.ts` |
| DB | `packages/db/src/schema/up-tup.ts`, `kkp.ts` |
| Reminder seed | `packages/db/src/seed.ts:221-239` |
| Dashboard/History/Export | `server/dashboard.ts`, `dashboard.tsx`, `history.tsx`, `exports/operator-xlsx.ts` |
| Test | `up-tup.test.ts` (3+), `up-tup-workspace.test.ts` (9), `up-tup-assumptions.test.ts` (19) |

## 23. Documentation Discrepancies

1. PRD:254 (90% tunai + 10% KKP) cocok, tetapi komposisi tunai 50/25/25 + count-based + collapse-lossy hanya terdokumentasi di komentar/devlog, bukan PRD/FSD — BACKLOG F6-08 klaim "sesuai" tanpa sebut lossy.
2. PRD:266-268 event GUP/PTUP/setoran/KKP vs seed 1 policy generik + strip kalender-biasa — BACKLOG F10 klaim selesai.
3. `referensi/Referensi UP GUP KKP.xlsx` (target KKP 1/5/9/12.5, nilai 110) cocok rule set, tetapi workbook ≠ engine (dua rumus) — panel sudah jujur tampilkan keduanya; dokumen lama bisa salah sangka satu rumus.
4. BACKLOG F11-06 "interval validation" — code hanya GUP/PTUP-referensi; interval 30-hari tak divalidasi saat input (hanya dinilai).
5. `fitur.md` tetap tidak ada.

## 24. Implementation Gaps (7)

1. PTUP/Setoran/Nihil collapse → UP (skor tak bedakan jenis; setoran-TUP tak terukur khusus).
2. Tunai count-based (nominal diabaikan) + KKP nominal-based — dua filsafat dalam satu skor.
3. Same-month tanpa tahun; 30-hari kalender (bukan kerja); due kalender-biasa.
4. Rencana panel tak persist ke Dashboard/History (menguap); periode Q Dashboard vs bulan workspace.
5. Tanpa jadwal GUP/PTUP terkirim + tanpa kalender kerja (teks waspada saja).
6. `referenceSp2dAt` wajib-tak-dipakai; tanggal-malformed skip-diam; `settle<sp2d` tepat-artifisial; negatif/duplikat lolos.
7. Skor >100 mungkin (KKP 110) tanpa cap akhir/pengungkapan di kartu.

## 25. Questions for AI Reviewer

1. Apakah `tunai count 50/25/25 (≤30 hari kalender; same-month tanpa tahun)`, `KKP kumulatif-nominal per TW vs 1/5/9/12.5 → 110/100`, `final 90/10`, bobot 10, collapse-lossy, unsettled = terlambat sudah sesuai regulasi — khususnya nominal-vs-count, tahun-diabaikan, dan 30-kalender vs 1-bulan-revolving?
2. Apakah bonus KKP 110 + final >100 (101) harus di-cap, dan apakah KKP-0 → 100 dapat diterima?
3. Apakah `referenceSp2dAt` wajib-tak-dipakai, tanggal-malformed skip, `settle<sp2d` tepat, negatif/duplikat menandakan validasi belum cukup untuk go-live?
4. Mana rumus kanonis GUP: workbook-panel vs engine-agregat — dan bolehkah keduanya tampil berdampingan permanen?
5. Apakah strip due kalender-biasa + teks waspada-libur memenuhi reminder GUP/PTUP wajib, atau jadwal kalender-kerja H-7/H-3/H-0 wajib ada?
6. Apakah periode KKP kanonis Q-Dashboard vs bulan-workspace, dan haruskah rencana panel persist sebagai forecast/scenario?
7. Apakah 6 tipe DB vs 2 tipe engine (plus `UPT-006/007` needs_verification) berarti skema atau engine yang harus berubah sebelum audit nilai?

---
*Berhenti di sini. Jangan lanjut ke indikator berikutnya tanpa perintah.*
