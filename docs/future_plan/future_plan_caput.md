# Panduan Teknis Reaktivasi Fitur Simulasi Capaian Output (IKPA 25%)

Dokumen ini adalah **panduan referensi operasional dan teknis** untuk mengaktifkan kembali (*reactivate*) seluruh fitur simulasi Capaian Output (Simulasi Target Kinerja 12 Bulan, Simulasi Realisasi Kinerja Bulanan, dan Simulasi Fairness Treatment) dari status **Fitur Preview (Sandbox Read-Only)** menjadi **Fitur Produksi Aktif (Full Persistent Read-Write)**.

---

## 1. Arsitektur & Fondasi Sistem Capaian Output

Modul Capaian Output dibangun di atas fondasi arsitektur monorepo yang sudah lengkap dan siap pakai:

### 1.1 Skema Database PostgreSQL (Drizzle ORM)
Lokasi file skema: `packages/db/src/schema/output-reports.ts` & `packages/db/src/schema/assessment-exclusion.ts`

1. **`output_target_plans`**:
   - Menyimpan target fisik 12 bulan per Rincian Output (RO).
   - Kolom utama: `organizationId`, `fiscalYearId`, `roCode`, `roName`, `volumeDipa`, `unit`, `isIntegerUnit`, `isPriorityNational`, `quarter`, `version`, `status` (`draft` | `submitted` | `active` | `superseded`), `monthlyTargets` (`jsonb`).
2. **`output_reports`**:
   - Menyimpan laporan realisasi fisik bulanan per RO.
   - Kolom utama: `organizationId`, `fiscalYearId`, `month`, `roCode`, `roName`, `volumeDipa`, `rvro`, `pcro`, `tpcro`, `rvroIncremental`, `pcroIncremental`, `reportedAt`, `confirmed`, `status` (`draft` | `submitted` | `confirmed`), `evidenceDocumentUrl`, `achievementReference`, `operatorNote`, `ppkValidationNote`, `validationResults`.
3. **`ro_budget_realizations`**:
   - Realisasi anggaran belanja per RO per bulan (PPA % dan nominal belanja) untuk validasi Rule 01 s.d. Rule 08 dan deteksi anomali gap PCRO vs PPA.
4. **`target_update_windows`**:
   - Jadwal pembukaan jendela pemutakhiran target triwulanan (10 HK awal triwulan: TW1 & TW2 s.d. 30 Apr, TW3 s.d. 14 Jul, TW4 s.d. 14 Okt).
5. **`assessment_exclusion_proposals`** & **`assessment_exclusion_policies`**:
   - Manajemen pengecualian perlakuan fairness (RO Khusus seperti FAN.ZZ1, keadaan kahar, penugasan pusat).

---

## 2. Server Mutations & Service Layer yang Tersedia

Semua mutasi backend TanStack Start `createServerFn` dan service client telah diimplementasikan secara penuh:

| Fungsi Backend Server | Service Client (`apps/web/src/services/output-achievement-service.ts`) | Kegunaan |
| :--- | :--- | :--- |
| `saveOutputTargetPlanFn` | `saveTargetPlan(plan)` | Menyimpan / memperbarui target fisik 12 bulan per RO. |
| `submitOutputTargetPlanFn` | `submitTargetPlanRecord(planId)` | Mengaktifkan target plan (`status = "active"`). |
| `saveOutputReportFn` | `saveOutputReport(report)` | Menyimpan draft / laporan realisasi bulanan RO. |
| `submitOutputReportFn` | `submitOutputReportRecord(reportId)` | Mengirimkan laporan ke PPK (`status = "submitted"`). |
| `verifyOutputReportFn` | `verifyOutputReport(reportId)` | Mengesahkan dan mengonfirmasi laporan oleh PPK (`status = "confirmed"`). |
| `deleteOutputReportFn` | `removeOutputReport(reportId)` | Menghapus catatan realisasi output. |
| `createFairnessProposalFn` | `submitFairnessProposal(data)` | Mendaftarkan pengecualian fairness RO ke database. |
| `deleteFairnessProposalFn` | `removeFairnessProposal(data)` | Menghapus / menonaktifkan pengecualian fairness RO. |

---

## 3. Langkah-Langkah Teknis Reaktivasi Fitur Simulasi

Saat Anda siap mengaktifkan kembali fitur simulasi ke mode produksi penuh, ikuti checklist langkah berikut pada file `apps/web/src/routes/operator/data/output-achievement.tsx`:

### Langkah 1: Hapus Flag Sandbox / Preview Guard pada Tombol Simpan
Pada form Drawer Target (`DomainFormDrawer` Target) dan Form Drawer Realisasi (`DomainFormDrawer` Realisasi):
1. Ubah properti `isSubmitDisabled`:
   ```tsx
   // Ganti dari mode preview:
   isSubmitDisabled={!targetFormValidation.isValid} // Tanpa disable sandbox
   ```
2. Pastikan pemanggilan fungsi `onSubmit` mengarah ke mutasi database:
   - Target Drawer: `onSubmit={handleSaveTarget}`
   - Realisasi Drawer: `onSubmit={() => handleSaveRealisasi("draft")}`
   - Tombol Kirim / Konfirmasi: `onClick={() => handleSaveRealisasi("confirmed")}`
   - Modal Fairness: `onClick={handleSubmitProposal}`

### Langkah 2: Mengembalikan Tab Navigasi Penuh & Palet Warna Primer
1. Di bagian tab navigasi horizontal:
   - Anda dapat mengembalikan 4/5 tab horizontal penuh (misal: `Jadwal & Kepatuhan`, `Target Kinerja 12 Bulan`, `Realisasi Kinerja Bulanan`, `Fairness Treatment`, `Panduan PER-5`) atau tetap mempertahankan susunan dropdown dengan menghapus badge `Preview`.
2. Ubah class CSS penataan tema:
   - Ganti class tema abu-abu/slate (`bg-slate-100`, `border-slate-300`, `text-slate-800`) kembali ke class dinamis warna primer (`bg-primary`, `bg-purple-600`, `bg-success`, `bg-warning`).
3. Hapus banner teaser / info `[ 🧪 Fitur Simulasi (Preview) · Sandbox Interaktif ]`.

### Langkah 3: Verifikasi Sinkronisasi Data ke Engine & Dashboard
1. Pastikan `apps/web/src/server/simulation/calculate.ts` mengambil data dari database tabel `output_reports` saat menghitung skor total IKPA satker.
2. Jalankan pengujian otomatis untuk memvalidasi:
   ```bash
   npm run typecheck
   npm test
   ```

---

## 4. Status Snapshot Saat Ini (Masa Preview)
- **Fokus Utama Halaman**: Menu Capaian Output saat ini berfokus pada **Jadwal & Kepatuhan** (Open Period reguler HK-7, dispensasi KPPN s.d. akhir bulan M+1, edukasi aturan PER-5, dan pengingat reminder).
- **Fitur Simulasi**: Tetap dapat dibuka dan diotak-atik (interaktif penuh: input angka, ganti filter, kalkulasi real-time di layar) dengan tema abu-abu ber-kontras tinggi, namun tidak menulis / mengubah database produksi (sandbox preview).
- **Dual-Source Input Nilai**: Kartu ringkasan penilaian mendukung input data riil makro MyIntress (`NK-ROKW` & `NK-CRO`) atau opsi *Quick What-If* agar skor IKPA pada Dashboard selalu terisi dan akurat.
