# Technical Specification & Refactoring PRD: Modul Capaian Output & Integrasi Dashboard Simulator IKPA

Dokumen ini disusun sebagai instruksi resmi bagi AI Agent / Engineering Team untuk melakukan perbaikan antarmuka (*UI/UX refactoring*), penataan navigasi, dan integrasi data antara Menu Capaian Output dan Menu Dashboard pada aplikasi Simulator IKPA.

---

## 1. Konteks Masalah & Sasaran Refactor

### 1.1 Kondisi Saat Ini (Current State)
- **Menu Capaian Output**: Memiliki deretan tab horizontal: `Ringkasan & Anomali`, `Target Kinerja 12 Bulan`, `Realisasi Kinerja Bulanan`, dan `Fairness Treatment`.
- **Keterbatasan Teknis**: Engine simulasi detail per-Rincian Output (RO), deviasi PCRO vs TPCRO, serta fairness treatment masih dalam tahap pengembangan (*preview/belum siap pakai*).
- **Fokus Fungsi Saat Ini**: Kepatuhan batas waktu pelaporan (*Open Period*, reguler HK-7, jadwal dispensasi KPPN), pengingat email berkala (user & admin), dan edukasi regulasi (PER-5).
- **Isu UX**:
  1. Tab-tab simulasi tampak aktif sehingga menimbulkan ekspektasi keliru bahwa kalkulator per-RO sudah dapat digunakan.
  2. Tab pertama dinamai `Ringkasan & Anomali`, padahal isinya adalah kalender kepatuhan dan status pengingat.
  3. Barisan kartu penilaian (`RO Objek Penilaian`, `Ketepatan Waktu`, `Capaian RO`, `Nilai IKPA-CO`) bernilai kosong (`— / 100`), sehingga membingungkan saat nilai total IKPA perlu dikalkulasikan di Menu Dashboard.

### 1.2 Sasaran Perbaikan (Target State)
1. **Restrukturisasi Tab**: Tab disederhanakan menjadi 2 tab aktif + 1 tab dropdown untuk mengelompokkan fitur preview secara elegan dan tidak mencolok.
2. **Penyelarasan Nama Tab**: Mengganti `Ringkasan & Anomali` menjadi `Jadwal & Kepatuhan`.
3. **Data Handling pada Card Penilaian**: Menyediakan modal input data riil dari MyIntress/OM-SPAN sekaligus opsi *Quick Simulator / Override* agar Dashboard selalu memiliki angka valid untuk dikompositkan dengan indikator lain.

---

## 2. Rencana Restrukturisasi Navigasi Tab

### 2.1 Struktur Tab Baru
Ubah deretan tab navigasi horizontal menjadi:

```text
[ 📅 Jadwal & Kepatuhan ]   [ 📖 Panduan PER-5 ]   [ 🧪 Fitur Simulasi ▾ ]
```

### 2.2 Spesifikasi Tiap Tab
| Komponen Tab | Status Rilis | Konten / Perilaku Interaksi |
| :--- | :--- | :--- |
| **Tab 1: Jadwal & Kepatuhan** | **Active (Default)** | Menggantikan tab *Ringkasan & Anomali*. Berisi kalender *Open Period* bulanan, indikator HK-7, status perpanjangan/dispensasi KPPN, pemutakhiran target TW, dan konfigurasi reminder email. |
| **Tab 2: Panduan PER-5** | **Active** | Sarana edukasi regulasi, glosarium formula penilaian (`NK-ROKW 30%` & `NK-CRO 70%`), serta panduan teknis pelaporan agar terhindar dari anomali data. |
| **Tab 3: Dropdown "Fitur Simulasi ▾"** | **Preview Group** | Tombol dropdown untuk merapikan fitur yang sedang dikembangkan tanpa membuat tab horizontal padat. |

### 2.3 Isi Menu Dropdown "Fitur Simulasi ▾"
Dropdown menampung 3 item:
1. `Simulasi Target 12 Bulan` *(Badge: Segera Hadir / Preview)*
2. `Simulasi Realisasi Bulanan` *(Badge: Segera Hadir / Preview)*
3. `Simulasi Fairness Treatment` *(Badge: Segera Hadir / Preview)*

**Perilaku Interaksi (Action Behavior):**
- Ketika salah satu opsi dropdown diklik, **jangan tampilkan halaman kosong yang rusak**.
- Tampilkan **Modal Preview / Feature Teaser** dengan format:
  - Header: Nama fitur + Tag `Dalam Pengembangan`
  - Body: Ilustrasi/mockup kalkulator rancangan mendatang dan penjelasan fungsional singkat.
  - Call to Action (CTA): Tombol `[ Beri Masukan Konsep ]` atau `[ Pelajari Dasar Aturan di Panduan PER-5 ]`.

---

## 3. Logika & Mekanisme Pengisian Kartu Penilaian

Empat kartu metrik di bagian atas menu Capaian Output tetap dipertahankan:
1. `RO Objek Penilaian` (Contoh format: `X / Y RO`)
2. `Ketepatan Waktu (NK-ROKW 30%)`
3. `Capaian RO (NK-CRO 70%)`
4. `Nilai IKPA-CO & Kontribusi`

### 3.1 Dual-Source Input Mechanism
Untuk mengisi nilai pada kartu ini tanpa membebani operator dengan input mikro per-RO, sediakan 2 mode pengisian:

```
                  ┌──────────────────────────────────────────────┐
                  │       PILIHAN MODE CAPAIAN OUTPUT            │
                  └──────────────────────┬───────────────────────┘
                                         │
             ┌───────────────────────────┴───────────────────────────┐
             ▼                                                       ▼
   [ Mode A: Data Riil MyIntress ]                         [ Mode B: Quick Simulator ]
   - Operator input 2 nilai makro                          - Toggle 'Gunakan Skenario What-If'
   - NK-ROKW (0 - 100)                                     - Slider/Input angka estimasi manual
   - NK-CRO (0 - 100)                                      - Simulasi dampak jika telat (NK-ROKW = 0)
             │                                                       │
             └───────────────────────────┬───────────────────────────┘
                                         ▼
                 Perhitungan Otomatis Formula Resmi PER-5:
                 Nilai IKPA-CO = (NK-ROKW * 30%) + (NK-CRO * 70%)
                 Kontribusi IKPA = Nilai IKPA-CO * 25%
                                         │
                                         ▼
                       Kirim Nilai ke State Global / Dashboard
```

### 3.2 Spesifikasi Modal Input (Mode A - Rekomendasi Utama)
Sediakan tombol aksi di pojok barisan kartu: `[ ✏️ Input Capaian Terakhir ]`.
- **Field 1**: `Nilai Ketepatan Waktu (NK-ROKW)` -> Number input (0.00 - 100.00).
- **Field 2**: `Nilai Capaian RO (NK-CRO)` -> Number input (0.00 - 100.00).
- **Field 3 (Opsional)**: `Jumlah RO Eligible` -> Integer input.
- **Sistem Menghitung**:
  $$\text{Nilai IKPA-CO} = (\text{NK-ROKW} \times 0.30) + (\text{NK-CRO} \times 0.70)$$
  $$\text{Poin Kontribusi} = \text{Nilai IKPA-CO} \times 0.25$$
- Data disimpan di local storage / database state satker dan diberi penanda `source: "myintress_actual"`.

### 3.3 Spesifikasi Mode Quick Simulator (Mode B)
Sediakan switch/checkbox di samping kartu: `[ ] Aktifkan Skenario Nilai Cepat (What-If)`.
- Jika aktif, operator dapat langsung mengubah angka `NK-ROKW` dan `NK-CRO` secara bebas untuk melihat simulasi skor tanpa menunggu engine per-RO selesai.
- Status data pada kartu berubah menjadi `source: "simulation_override"`.

---

## 4. Integrasi ke Menu Dashboard Utama

Menu Dashboard mengagregasi seluruh komponen IKPA (Revisi DIPA, Deviasi Hal III DIPA, Penyerapan, Capaian Output, dll.) untuk menghitung skor total (skala 100) dengan formula:
$$\text{Total IKPA} = \sum (\text{Nilai Indikator}_i \times \text{Bobot}_i)$$

### 4.1 Perlakuan Komponen Capaian Output di Dashboard
1. **Nilai Masukan**: Dashboard membaca `Nilai IKPA-CO` dari state yang dihasilkan oleh Menu Capaian Output (baik dari Mode A maupun Mode B).
2. **Handling Jika Data Kosong**:
   - Jika operator belum pernah menginput data riil maupun simulasi cepat, sistem dashboard tidak boleh eror (`NaN`).
   - Tampilkan nilai default `0.00` atau berikan badge peringatan di baris Capaian Output pada tabel Dashboard: `[ ⚠️ Data Belum Diisi ]` disertai tombol link cepat: `[ Lengkapi di Menu Capaian Output ]`.
3. **Indikator Visual Transparan di Dashboard**:
   - Bila data berasal dari **Mode A**, beri tanda badge netral: `Data Aktual Terakhir`.
   - Bila data berasal dari **Mode B**, beri tanda badge biru/oranye: `Angka Simulasi What-If`.

---

## 5. Checklist Instruksi Pengerjaan untuk AI Agent / Engineer

- [ ] **Modifikasi Tab Header (`CapaianOutputView`)**:
  - [ ] Ubah label tab `Ringkasan & Anomali` menjadi `Jadwal & Kepatuhan`.
  - [ ] Pertahankan tab `Panduan PER-5`.
  - [ ] Hapus deretan tab langsung `Target Kinerja 12 Bulan`, `Realisasi Kinerja Bulanan`, dan `Fairness Treatment`.
  - [ ] Buat komponen dropdown menu `Fitur Simulasi ▾` yang menampung ketiga fitur di atas dengan penanda visual `Preview`.
- [ ] **Implementasi Modal Preview**:
  - [ ] Buat generic dialog modal teaser untuk menangani klik pada item dropdown fitur simulasi.
- [ ] **State Management & Input Action**:
  - [ ] Tambahkan tombol `[ ✏️ Input Capaian Terakhir ]` di sebelah barisan kartu metrik.
  - [ ] Pasang validasi batas input (0 - 100).
  - [ ] Implementasikan formula otomatis: `(NK-ROKW * 0.3) + (NK-CRO * 0.7)`.
  - [ ] Hitung kontribusi satker terhadap bobot 25%.
- [ ] **Integrasi State Dashboard (`DashboardView`)**:
  - [ ] Pastikan store/state total IKPA Dashboard melacak perubahan nilai `IKPA-CO`.
  - [ ] Tampilkan keterangan sumber nilai (*Aktual* vs *Simulasi Manual*) pada baris Capaian Output di tabel agregat Dashboard.
