# 05 — Belanja Kontraktual (bobot 10%)

**Anchor:** `00-system-overview.md`, `01-dashboard.md` | **Tanggal:** 2026-09-06 (Diperbarui pasca-implementasi kanonis)
**Dasar Regulasi/Materi:** PER-5/PB/2024 & `4belanja-kontraktual.pdf` (Contoh Emas Nilai BK 97,00)
**Status:** IMPLEMENTED (Kanonis 3 Subkomponen: DAK 20% + KD 40% + AK53 40%)

## 1. Module Purpose

Menilai akselerasi pendaftaran dan penyelesaian kontrak melalui tiga sub-komponen:
1. **DAK (Distribusi Akselerasi Kontrak - 20%)**: Rasio jumlah kontrak eligible $\ge$ Rp50jt yang ditandatangani s.d. 30 Juni (TW II) terhadap total kontrak eligible TA.
2. **KD (Kontrak Pra-DIPA / Kontrak Dini - 40%)**: Rata-rata poin kontrak eligible $\ge$ Rp50jt yang ditandatangani s.d. 31 Maret (Pra-DIPA = 120 poin, Jan–Mar = 110 poin). Kontrak setelah 31 Maret tidak masuk pembagi/penyebut KD.
3. **AK53 (Akselerasi Kontrak 53 - 40%)**: Rata-rata poin penyelesaian SP2D kontrak Akun 53 (Modal), nilai Rp50jt–Rp200jt (inklusif), tipe pembayaran *sekaligus* (termin dikecualikan). Poin SP2D: TW I = 100, TW II = 90, TW III = 80, TW IV = 70.

Halaman: `/operator/data/contracts-invoices?tab=contracts`.

## 2. Implementation Status

| Aspek | Status | Catatan |
|---|---|---|
| CRUD Kontrak scoped + soft-delete + audit | IMPLEMENTED | Mendukung akun 51, 52, 53, 57; validasi form inline & banner server |
| Engine 3 subkomponen (DAK 20% + KD 40% + AK53 40%) | IMPLEMENTED | `packages/ikpa-engine/src/indicators/contractual.ts` |
| DAK berdasarkan jumlah kontrak (count) | IMPLEMENTED | Bukan berbasis total rupiah, batas 30 Juni, tabel bucket 0/50/60/80/100 |
| KD berbasis poin per kontrak & filter tanggal | IMPLEMENTED | Pra-DIPA 120, Jan–Mar 110, >31 Mar dieksklusikan dari penyebut KD |
| AK53 terhubung data riil & filter ketat | IMPLEMENTED | Akun 53, Rp50M–Rp200M, tipe sekaligus, poin berbasis tanggal SP2D (100/90/80/70) |
| Penanganan Data Kosong / Tidak Eligible | IMPLEMENTED | Mengembalikan status `incomplete` & nilai `null` (tidak defaulting 100) |
| Integrasi Workspace & Drawer Preview | IMPLEMENTED | `kontraktual-workspace.ts` + drawer live simulation badge & breakdown |
| Dashboard 1 baris + kartu metrik + rekomendasi | IMPLEMENTED | Dashboard & Analysis mengonsumsi engine kanonis yang sama |
| Navigasi Sidebar terpisah | IMPLEMENTED | Kontrak $\to$ `?tab=contracts`, SPM $\to$ `?tab=spm` tanpa active highlight ganda |
| Panduan Regulasi g-04 | IMPLEMENTED | Diperbarui sesuai rumus 3 subkomponen PER-5/PB/2024 |

## 3. Source Code Map

| Lapisan | File |
|---|---|
| Engine Kalkulasi | `packages/ikpa-engine/src/indicators/contractual.ts` (`calculateContractual`) |
| Skema Engine | `packages/ikpa-engine/src/schemas.ts` (`contractInputSchema`, `contractualInputSchema`, `contractualResultSchema`) |
| Aturan & Konfigurasi | `packages/ikpa-engine/src/rule-set.ts` (`contractualWeights{dak:20, kd:40, ak53:40}`) |
| Unit Tests Engine | `packages/ikpa-engine/src/indicators/contractual.test.ts` (8 test cases including 10-contract PDF acceptance test) |
| Mapping DB $\to$ Engine | `apps/web/src/server/simulation/calculate.ts` (`calculateAndPersistSnapshot`) |
| Workspace Helper & Badges | `apps/web/src/lib/simulation/kontraktual-workspace.ts` (+ `.test.ts`) |
| UI Halaman | `apps/web/src/routes/operator/data/contracts-invoices.tsx` (5 score cards, trace accordion, dynamic recommendations, badge per subkomponen, drawer live preview) |
| Service & ServerFn | `apps/web/src/services/contracts-invoices-service.ts`, `apps/web/src/server/contracts-invoices.ts`, `apps/web/src/server/domains/contracts-invoices.*` |
| Navigasi Operator | `apps/web/src/components/layout/operator-navigation.tsx` (`isOperatorRouteActive` dengan query-parameter matching) |
| Panduan IKPA | `apps/web/src/mocks/guides.ts` (`g-04`) |

## 4. User Flow

1. Operator membuka menu **Belanja Kontraktual** dari sidebar navigasi $\to$ diarahkan ke `/operator/data/contracts-invoices?tab=contracts`.
2. Header menampilkan status penilaian IKPA 5-kartu horizontal:
   - Kartu 1: **NK-DAK (20%)** — Distribusi Kontrak s.d. TW II
   - Kartu 2: **NK-KD (40%)** — Kontrak Dini / Pra-DIPA
   - Kartu 3: **NK-AK53 (40%)** — Akselerasi Belanja Modal 53
   - Kartu 4: **Nilai IKPA Belanja Kontraktual** (Skor terbobot 100%)
   - Kartu 5: **Kontribusi IKPA (10%)** (Maksimal 10.00 poin)
3. Accordion **Lihat Rincian Perhitungan**: Membedah formula, rasio count DAK, detail rata-rata KD, detail rata-rata SP2D AK53, dan alasan pengecualian jika ada kontrak yang tidak eligible.
4. Box **Rekomendasi Strategis**: Menghasilkan rekomendasi taktis real-time berdasarkan data kontrak yang tercatat.
5. Tabel Kontrak: Menampilkan Nomor Kontrak, Jenis Belanja (51/52/53/57), Nilai Kontrak, Tgl Tanda Tangan, Tipe Pembayaran (Sekaligus/Termin), Tgl SP2D, Status Evaluasi Subkomponen (Badge DAK, KD, AK53), dan Aksi Edit / Hapus.
6. Drawer Tambah / Ubah Kontrak: Operator mengisi/mengedit data kontrak dengan Live Preview real-time dampak indikator terhadap DAK, KD, dan AK53 sebelum menyimpan ke database.

## 5. Input Inventory & Mapping

| Field DB / Form | Type | Scope Evaluasi | Aturan Engine |
|---|---|---|---|
| `contractNumber` | text | Identitas | Wajib diisi (1–64 karakter), tampil di trace & tabel |
| `accountCode` | enum (51, 52, 53, 57) | DAK, KD, AK53 | Semua akun eligible untuk DAK & KD; Hanya akun `53` yang masuk AK53 |
| `value` / `amount` | numeric (18,2) | DAK, KD, AK53 | Minimal Rp50.000.000 untuk DAK & KD; Rentang Rp50.000.000 s.d. Rp200.000.000 untuk AK53 |
| `signedAt` / `signedDate`| date (YYYY-MM-DD) | DAK, KD | Dasar DAK ($\le$ 30 Juni) & KD (Pra-DIPA vs Jan–Mar vs >31 Mar) |
| `paymentType` | enum (sekaligus, termin)| AK53 | Hanya `sekaligus` yang masuk AK53; `termin` dikecualikan |
| `sp2dAt` / `sp2dDate` | date (YYYY-MM-DD) | AK53 | Tanggal penentu triwulan penyelesaian SP2D (TW I=100, TW II=90, TW III=80, TW IV=70) |

## 6. Formula & Acceptance Test Verifikasi

### 6.1 Data Uji Standar (Contoh Emas PDF 10 Kontrak)
1. Kontrak 1 (52, 1,458M, 29 Des TH Lalu, Sekaligus, SP2D 28 Agu) $\to$ KD: 120, AK53: Excluded (Akun 52), DAK: $\le$ TW II
2. Kontrak 2 (52, 344M, 12 Jan, Sekaligus, SP2D 15 Feb) $\to$ KD: 110, AK53: Excluded (Akun 52), DAK: $\le$ TW II
3. Kontrak 3 (53, 440M, 28 Feb, Sekaligus, SP2D 19 Apr) $\to$ KD: 110, AK53: Excluded (>200M), DAK: $\le$ TW II
4. Kontrak 4 (53, 187,5M, 1 Mar, Sekaligus, SP2D 28 Mar) $\to$ KD: 110, AK53: 100 (TW I), DAK: $\le$ TW II
5. Kontrak 5 (52, 400M, 4 Apr, Sekaligus, SP2D 6 Mei) $\to$ KD: Excluded (>31 Mar), AK53: Excluded (Akun 52), DAK: $\le$ TW II
6. Kontrak 6 (53, 125M, 30 Mei, Sekaligus, SP2D 5 Jul) $\to$ KD: Excluded (>31 Mar), AK53: 80 (TW III), DAK: $\le$ TW II
7. Kontrak 7 (52, 90,36M, 27 Jun, Sekaligus, SP2D 11 Jul) $\to$ KD: Excluded (>31 Mar), AK53: Excluded (Akun 52), DAK: $\le$ TW II
8. Kontrak 8 (52, 732M, 23 Agu, Sekaligus, SP2D 19 Des) $\to$ KD: Excluded, AK53: Excluded, DAK: > TW II
9. Kontrak 9 (52, 288,5M, 16 Sep, Sekaligus, SP2D 18 Okt) $\to$ KD: Excluded, AK53: Excluded, DAK: > TW II
10. Kontrak 10 (52, 175,6M, 11 Nov, Sekaligus, SP2D 29 Nov) $\to$ KD: Excluded, AK53: Excluded, DAK: > TW II

### 6.2 Hasil Perhitungan Engine
- **NK-DAK**: $7 / 10 = 70\% \to$ Bucket $(50\% < R \le 75\%) \to \mathbf{80,00}$
- **NK-KD**: $(120 + 110 + 110 + 110) / 4 = \mathbf{112,50}$
- **NK-AK53**: $(100 + 80) / 2 = \mathbf{90,00}$
- **Nilai Belanja Kontraktual**: $(80 \times 20\%) + (112,50 \times 40\%) + (90 \times 40\%) = 16,00 + 45,00 + 36,00 = \mathbf{97,00}$
- **Kontribusi IKPA**: $97,00 \times 10\% = \mathbf{9,70}$
