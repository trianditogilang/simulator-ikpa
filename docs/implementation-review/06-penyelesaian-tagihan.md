# 06 — Penyelesaian Tagihan (Bobot 10%)

**Anchor:** `00-system-overview.md`, `01-dashboard.md` | **Tanggal Pembaruan:** 2026-09-06
**Status:** IMPLEMENTED & VERIFIED

---

## 1. Definisi & Tujuan Modul

Menilai ketepatan waktu penyelesaian tagihan **SPM-LS kontraktual non-belanja pegawai** yang diterima KPPN saat proses konversi paling lambat **17 hari kerja (H+17)** sejak tanggal BAST atau BAPP (PER-5/PB/2024 Pasal 8).

- **Bobot Indikator:** 10% terhadap total IKPA.
- **Skala Nilai:** 0–100.
- **Kontribusi Tertimbang:** \(\min((\text{Nilai PT} \times 10\%), 10.00)\) poin.
- **Workspace:** `/operator/data/contracts-invoices?tab=invoices` (atau `?tab=spm`).

---

## 2. Status Implementasi

| Aspek | Status | Keterangan |
|---|---|---|
| Formula Kanonis PER-5/PB/2024 | IMPLEMENTED | \((SPM\ Tepat\ Waktu \div Total\ SPM\ Eligible) \times 100\) |
| Pengecualian Belanja Pegawai (`isPegawai`) | IMPLEMENTED | Belanja pegawai dikeluarkan penuh dari pembilang & penyebut |
| Kalender Kerja Kanonis (Weekend + Libur + Overrides) | IMPLEMENTED | Utilitas `workday-calendar.ts` digunakan bersama di engine, UI, reminder |
| Validasi Tanggal Konversi (`receivedAtKppn >= bastBappDate`) | IMPLEMENTED | Validasi form & server menolak konversi sebelum BAST |
| Status SPM Berjalan / Menunggu Konversi | IMPLEMENTED | Mendukung `receivedAtKppn = null` dengan status estimasi berjalan & risiko deadline |
| 5-Card Score Summary & Accordion Trace | IMPLEMENTED | Skor, kontribusi, on-time, terlambat, pending, serta detail trace 3 langkah |
| UI & Navigasi Terpisah | IMPLEMENTED | Sidebar `Penyelesaian Tagihan` membuka `?tab=invoices` dengan active state presisi |
| Test Coverage & Golden Ratio (13/15 = 86.67) | VERIFIED | Unit test engine, integration test helper, dan verifikasi monorepo lulus 100% |

---

## 3. Peta Kode (Source Code Map)

| Komponen | Lokasi File | Peran & Deskripsi |
|---|---|---|
| **Kanonis Engine** | `packages/ikpa-engine/src/indicators/invoice-timeliness.ts` | Filter `isPegawai: false` & `isContractual: true`, evaluasi H+17 hari kerja kanonis, capping kontribusi 10.00 pts, trace lengkap |
| **Kalender Kerja** | `packages/ikpa-engine/src/utils/workday-calendar.ts` | `isWorkday`, `addWorkdays`, `countWorkdays` (start-exclusive end-inclusive, Senin–Jumat, libur nasional, override kerja/libur) |
| **Schema Engine** | `packages/ikpa-engine/src/schemas.ts` | `invoiceInputSchema` (`referenceNumber`, `contractId`, `bastDate`, `spmDate` optional/nullable, `isPegawai`, `isContractual`) |
| **DB Model** | `packages/db/src/schema/spm-ls.ts` | `receivedAtKppn` nullable untuk mendukung berkas berjalan |
| **Server Mutations** | `apps/web/src/server/domains/contracts-invoices.mutations.ts` | `createSpmLs`, `updateSpmLs`, `softDeleteSpmLs` dengan validasi `receivedAtKppn >= bastBappDate` & audit log |
| **Server Functions** | `apps/web/src/server/contracts-invoices.ts` | `listContractsAndSpmFn`, `createSpmLsFn`, `updateSpmLsFn`, `deleteSpmLsFn` |
| **Client Services** | `apps/web/src/services/contracts-invoices-service.ts` | `fetchContractsAndInvoices`, `addSpmLs`, `editSpmLs`, `removeSpmLs` |
| **Workspace Helper** | `apps/web/src/lib/simulation/tagihan-workspace.ts` | `evaluateSingleSpm`, `calcTagihanSummary`, 5 kartu metriks, live preview, dynamic recommendations |
| **Route UI** | `apps/web/src/routes/operator/data/contracts-invoices.tsx` | Tab SPM-LS / Invoices dengan 5 metric cards, accordion trace, tabel evaluasi H+17, drawer create/edit, modal panduan |
| **Navigasi Sidebar** | `apps/web/src/components/layout/operator-navigation.tsx` | Link `Penyelesaian Tagihan` ke `?tab=invoices` dengan pengecekan tab aktif yang terisolasi dari Belanja Kontraktual |

---

## 4. Contoh Perhitungan & Golden Test

### Contoh PDF `penyelesaian-tagihan.pdf`:
Sepanjang tahun anggaran, Satker memiliki 15 berkas SPM-LS non-pegawai (13 tepat waktu ≤ 17 HK dan 2 terlambat > 17 HK):
- **Nilai Indikator:** \((13 \div 15) \times 100 = 86.666... = 86.67\)
- **Kontribusi Tertimbang:** \(86.67 \times 10\% = 8.67\) poin
- **Status Penilaian:** `Lengkap (Nilai Final)`

### Boundary Test H+17:
- BAST 2026-03-02 → Konversi 2026-03-25 (Hari Kerja ke-17) → **Tepat Waktu (17 HK)**.
- BAST 2026-03-02 → Konversi 2026-03-26 (Hari Kerja ke-18) → **Terlambat (18 HK)**.
- BAST & Konversi di hari yang sama → **Tepat Waktu (0 HK berlalu)**.
- Konversi sebelum BAST → Ditolak validasi form & server.

---

## 5. Ringkasan Kebijakan & Gap yang Telah Ditutup

1. **Pengecualian Belanja Pegawai:** SPM dengan `isPegawai = true` (gaji, tunjangan, lembur, uang makan) secara tegas dikecualikan dari pembilang dan penyebut.
2. **Penetapan Tanggal Titik Akhir:** Tanggal titik akhir adalah tanggal konversi/diterima KPPN, bukan tanggal cetak atau approval satker.
3. **SPM Belum Konversi:** SPM dalam proses pengajuan tanpa tanggal konversi memiliki status `Menunggu Konversi` atau `Berisiko` (bila mendekati/melewati H+17) dan tidak dianggap tepat waktu secara artifisial. Nilai indikator berstatus `Estimasi` selama terdapat berkas berjalan.
4. **Denominator Nol:** Bila tidak ada SPM eligible, status indikator adalah `incomplete (Belum dapat dinilai)` dengan skor `null`, bukan 100 atau 0.
