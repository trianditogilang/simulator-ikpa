### 1. Masukan Mengenai Snapshot Aktual: Mengapa &amp; Bagaimana Sistem Bekerja?

  Kebutuhan Anda sangat logis: User hanya membutuhkan data aktual yang akurat, sinkron,

  konsisten, dan dapat dipilih secara kumulatif per bulan (Januari s.d. Desember) tanpa

  adanya penumpukan (spam/duplikasi) baris snapshot di database.

#### Perbaikan yang Baru Saja Kami Terapkan:

  Sebelumnya, sistem berpotensi membuat baris baru jika hash data berbeda. Kami telah

  memperbarui pipeline calculate.ts:

1. Pembaruan di Tempat (In-Place Update):

  • Untuk setiap bulan dalam Tahun Anggaran (misal Bulan 9 / September 2026),

   database hanya memiliki tepat 1 baris resmi.

   • Jika Anda mengubah data transaksi/anggaran lalu membuka Dashboard, sistem meng-

   update baris bulan tersebut di tempat tanpa menambah baris baru (zero row

   clutter).
2. Nol Penulisan Database saat Data Tetap:

  • Jika data tidak berubah, sistem langsung mengembalikan data dari cache memori

   tanpa melakukan penulisan ke database (eksekusi 0ms).
3. Akumulasi Bulan yang Bersih:

  • Di tab Snapshot Aktual, Anda akan melihat daftar bulan yang rapi (Bulan 1 s.d.

   Bulan 9) yang selalu mencerminkan nilai kumulatif YTD (Year-to-Date) terkini

   secara presisi.

  ──────

### 2. Rincian Fitur: Apa Saja yang Bisa Diskenariokan (What-If) dan Masuk ke

  "Skenario Tersimpan"?

  Fitur Skenario Tersimpan (Tab 🧪 di history.tsx) dirancang untuk menampung uji coba

  strategi pelaksanaan anggaran tanpa mengubah data riil pembukuan.

  Berikut daftar lengkap fungsi/parameter yang dapat Anda simulasikan di masing-masing

  dari 8 Indikator IKPA:

  │ Diagram exceeds terminal width (189 &gt; 89 cols)

  │ Displayed as code block. Widen terminal to view inline.

```
graph LR

    subgraph "Simulasi What-If per Indikator"

        A["1. Revisi DIPA"] --&gt; A1["Uji batas &lt;= 1x per Semester vs Dampak Revisi
```

  Pagu Tetap"]

```
        B["2. Deviasi Hal III"] --&gt; B1["Uji penyesuaian RPD Triwulanan &amp; batas
```

  deviasi 5%"]

```
        C["3. Penyerapan Anggaran"] --&gt; C1["Uji percepatan target belanja 51, 52,
```

  53, 57 per Triwulan"]

```
        D["4. Belanja Kontraktual"] --&gt; D1["Uji Pengadaan Dini, Akselerasi 53
```

  &lt;=200jt, Distribusi TW"]

```
        E["5. Penyelesaian Tagihan"] --&gt; E1["Uji percepatan SPM-LS &lt;=17 HK untuk
```

  capai zero-terlambat"]

```
        F["6. UP/TUP &amp; KKP"] --&gt; F1["Uji Nominal %GUP Revolving &amp; Interval Hari
```

  Kalender"]

```
        G["7. Capaian Output"] --&gt; G1["Uji Proyeksi Target Fisik 12 Bulan &amp;
```

  Konfirmasi PPK"]

```
        H["8. Dispensasi SPM"] --&gt; H1["Uji Rasio Dispensasi TW IV agar bebas
```

  penalti pengurang"]

```
    end

    A1 &amp; B1 &amp; C1 &amp; D1 &amp; E1 &amp; F1 &amp; G1 &amp; H1 --&gt; SIM["Dialog 'Simpan Skenario'"]

    SIM --&gt; HIST["Masuk ke /operator/history (Tab Skenario Tersimpan)"]
```

  ──────

#### Rincian Parameter yang Dapat Disimulasikan:

1. Revisi DIPA (Bobot 10%) — budget-revisions.tsx

  • Yang Disimulasikan: Menambah rencana pengajuan revisi anggaran (misal jenis

   revisi pagu tetap kode 211, 212, 221).

   • Tujuan Skenario: Menguji apakah pengajuan revisi tambahan di Semester I /

   Semester II masih aman (≤1 kali → skor 100) atau menyebabkan penurunan skor ke 50.
2. Deviasi Halaman III DIPA (Bobot 15%) — deviasi.tsx

  • Yang Disimulasikan: Menyesuaikan angka rencana penarikan dana (RPD) pada

   Triwulan berjalan per jenis belanja (51, 52, 53, 57).

   • Tujuan Skenario: Menguji apakah perubahan RPD berhasil menekan deviasi

   kumulatif ke bawah batas toleransi 5% agar nilai indikator tetap 100.
3. Penyerapan Anggaran (Bobot 20%) — penyerapan.tsx

  • Yang Disimulasikan: Menguji tambahan proyeksi realisasi anggaran sebelum akhir

   triwulan (TW I: target 20/15/10/25%, TW II: 50%, TW III: 75/70/70/75%, TW IV:

   95/90/90/95%).

   • Tujuan Skenario: Mengetahui berapa sisa rupiah yang harus dieksekusi agar

   mendapatkan skor maksimal 20.00 poin terbobot.
4. Belanja Kontraktual (Bobot 10%) — contracts-invoices.tsx

  • Yang Disimulasikan:
  ```
   • Kontrak Dini: Menguji jika paket kontrak ditandatangani pra-DIPA (bobot
  
   40%).
  
   • Akselerasi Kontrak 53: Menguji percepatan penandatanganan BAST/Kontrak
  
   modal ≤Rp200 juta pada TW I (bobot 40%).
  
   • Distribusi Kontraktual: Menguji persebaran kontrak sepanjang TW I s.d. TW
  
   IV (bobot 20%).
  ```

   • Tujuan Skenario: Mengukur lonjakan nilai IKPA jika komitmen kontraktual

   diselesaikan lebih awal.
5. Penyelesaian Tagihan SPM-LS (Bobot 10%) — contracts-invoices.tsx

  • Yang Disimulasikan: Menguji kepatuhan penerbitan SPM-LS dalam batas 17 hari

   kerja sejak BAST/BAPP.

   • Tujuan Skenario: Menguji skenario zero-terlambat (semua SPM diterbitkan ≤17

   hari kerja) untuk mengamankan nilai 10.00 poin penuh.
6. Pengelolaan UP/TUP &amp; KKP (Bobot 10%) — up-tup.tsx

  • Yang Disimulasikan:
  ```
   • Simulasi %GUP Disebulankan: Menguji nominal pengajuan GUP (misal 50% vs 80%
  
   UP) dan interval tanggal (misal per 20 hari vs 35 hari) untuk mencapai
  
   revolving ≥100%.
  
   • Simulasi Setoran TUP: Menguji dampak nominal sisa TUP yang disetorkan
  
   kembali ke Kas Negara.
  
   • Simulasi Kepemilikan KKP: Menguji aktivasi KKP satker untuk membuka batas
  
   skor dari maksimal 90% menjadi 100%.
  ```

   • Tujuan Skenario: Menentukan ritme revolving UP terbaik yang tidak melanggar

   batas waktu 30 hari.
7. Capaian Output (Bobot 25%) — output-achievement.tsx

  • Yang Disimulasikan:
  ```
   • Distribusi Proyeksi Target Fisik 12 Bulan: Menyesuaikan target bulanan
  
   (PCRO) agar linier dengan penyerapan anggaran (PPA) tanpa memicu anomali
  
   deviasi fisik.                                                               
  
   • Konfirmasi Realisasi 7 HK: Menguji skenario jika seluruh Rincian Output    
  
   terisi dan terkonfirmasi PPK tepat waktu.                                    
  
   • Fairness Treatment: Menguji simulasi pengecualian penilaian pada RO yang   
  
   terdampak blokir/force majeure.                                              
  ```

   • Tujuan Skenario: Mengamankan indikator dengan bobot terbesar dalam IKPA (25.00 

   poin).
8. Dispensasi SPM (Faktor Pengurang) — spm-dispensation.tsx

  • Yang Disimulasikan: Menguji jumlah pengajuan SPM Dispensasi pada akhir tahun   

   (TW IV) terhadap total SPM yang diterbitkan.                                     

   • Tujuan Skenario: Menghindari penalti pengurangan skor (-0.25 s.d. -1.00 poin   

   total IKPA).

  ──────

### 3. Alur Kerja Skenario Tersimpan

1. Operator membuka menu indikator (misal /operator/up-tup atau /operator/deviasi).
2. Operator mencoba mengubah slider/input pada Panel Simulasi What-If.
3. Di bagian bawah panel simulasi, muncul tombol "Simpan Skenario Ini".
4. Operator memberi nama (misal "Skenario Percepatan GUP TW3").
5. Skenario tersebut tersimpan dan langsung muncul di Tab Skenario Tersimpan pada

  history.tsx.
6. Di halaman Riwayat, operator dapat mencentang skenario tersebut bersama data

  aktual dan menekan tab Bandingkan untuk melihat perbandingan proyeksi vs kondisi riil

  saat ini.

===================================================v2=================

  Menu history.tsx dan sistem simulasi telah dioptimalkan agar ringan, tidak

  menimbulkan spam snapshot di database, menyajikan matriks 12 bulan aktual, dan

  menyediakan 3 Slot Skenario Tetap (A, B, C) untuk simulasi What-If.

  Berikut penjelasan lengkap mengenai arsitektur baru menu Riwayat serta rincian fungsi

  yang dapat disimulasikan pada 8 indikator IKPA:

  ──────

### 1. Bagaimana Menu /operator/history Bekerja Sekarang

  │ Diagram exceeds terminal width (154 &gt; 89 cols)

  │ Displayed as code block. Widen terminal to view inline.

```
flowchart TD

    A["Dashboard / Perhitungan Bulanan"] --&gt;|Idempotent In-Place Update| B[("Tabel
```

  score_snapshots (Maks. 1 Row / Bulan)")]

```
    B --&gt; C["/operator/history"]

    C --&gt; D["Tab 1: Matriks Evaluasi Aktual 12 Bulan (Jan - Des)"]

    C --&gt; E["Tab 2: Skenario Tersimpan (Slot A, B, C)"]

    C --&gt; F["Fitur Komparasi Multilateral (Maks 3 Pilihan)"]
```

#### A. Tab 1: Snapshot Aktual (Matriks 12 Bulan Kumulatif)

1. Matriks Evaluasi Jan s.d. Des: Menampilkan 12 kartu/baris evaluasi dari Januari

  sampai Desember. Operator langsung melihat bulan mana saja yang sudah memiliki data

  aktual dan bulan mana yang belum terdata.

2. Bebas Spam Database &amp; Memori Ringan:

   • Diberlakukan in-place update pada calculate.ts. Jika data bulan tersebut tidak

   berubah (inputHash sama), sistem tidak melakukan penulisan ke database. Jika ada

   perubahan data, sistem hanya melakukan update pada baris bulan tersebut, bukan

   membuat baris baru.

   • Payload kueri riwayat disanitasi (simulation.ts) sehingga pohon formula

   matematika yang besar tidak ikut dimuat saat membuka daftar riwayat (menghemat

   memori browser &gt;80%).
3. Fitur Tab 1:

   • Status terdata / belum terdata.

   • Nilai IKPA Aktual Kumulatif &amp; Predikat Capaian (Sangat Baik / Baik / Cukup /

   Kurang).

   • Selisih (Gap) terhadap target 95,00.

   • Tombol Lihat Detail (👁️) untuk membuka modal breakdown 8 indikator.

   • Checklist Bandingkan untuk memasukkan data bulan tersebut ke panel komparasi.

  ──────

#### B. Tab 2: Skenario Tersimpan (Sistem 3 Slot: A, B, C)

1. 3 Slot Terdedikasi: Skenario What-If dibatasi ke dalam 3 slot tetap:

   • 🔵 Skenario A (misal: Skenario Konservatif / Baseline Plus)

   • 🟣 Skenario B (misal: Skenario Moderat / Optimal RPD)

   • 🟠 Skenario C (misal: Skenario Akselerasi Penuh)
2. Alur Simpan What-If:

   • Saat operator menekan tombol "Simpan Skenario" pada dialog

   save-scenario-dialog.tsx, operator cukup memilih salah satu tombol slot (A, B,

   atau C).

   • Menyimpan ke slot yang sudah terisi akan otomatis memperbarui (overwrite)

   skenario pada slot tersebut.
3. Fitur Tab 2:

   • Menampilkan perbandingan Skor Baseline vs Skor Proyeksi.

   • Menampilkan tag indikator yang diubah.

   • Tombol Buka Detail Parameter, Hapus Slot, dan Pilih Bandingkan.

  ──────

### 2. Rincian Fungsi &amp; Parameter Simulasi (What-If) pada 8 Indikator IKPA

  Berikut adalah daftar lengkap parameter yang dapat diskenariokan pada masing-masing

  indikator IKPA:

   … │ Indikator … │ Bo… │ Parameter yang Dapat Disimula… │ Dampak &amp; Rumus Perhitungan

  ───┼─────────────┼─────┼────────────────────────────────┼────────────────────────────

   1 │ Revisi DIPA │ 10% │ • Jumlah frekuensi pengajuan   │ Maksimal 1 kali revisi per

```
 │             │     │ revisi DIPA per triwulan (Q1,  │ triwulan per satker untuk

 │             │     │ Q2, Q3, Q4).                   │ mendapatkan skor 100.

 │             │     │                                │ Setiap kelebihan revisi

 │             │     │                                │ memotong skor.
```

   2 │ Deviasi     │ 15% │ • Penyesuaian angka Rencana    │ Menghitung rata-rata

```
 │ Halaman III │     │ Penarikan Dana (RPD) bulanan   │ deviasi bulanan antara

 │ DIPA        │     │ per jenis belanja (51 Pegawai, │ realisasi dan RPD. Deviasi

 │             │     │ 52 Barang, 53 Modal, 57        │ ≤5% menghasilkan nilai

 │             │     │ Bansos).• Estimasi realisasi   │ maksimal 100.

 │             │     │ bulanan vs rencana tarikan.    │
```

   3 │ Penyerapan  │ 10% │ • Proyeksi target realisasi    │ Menghitung rasio realisasi

```
 │ Anggaran    │     │ per jenis belanja (51, 52, 53, │ kumulatif terhadap target

 │             │     │ 57) pada akhir triwulan.•      │ nasional per triwulan (Q1:

 │             │     │ Penyesuaian pagu DIPA aktif.   │ 20%, Q2: 50%, Q3: 70%, Q4:

 │             │     │                                │ 90%).
```

   4 │ Belanja     │ 10% │ • Tanggal pendaftaran kontrak  │ Skor dihitung dari rasio

```
 │ Kontraktual │     │ ke KPPN (apakah ≤3 hari kerja  │ kontrak yang didaftarkan

 │             │     │ dari tanda tangan kontrak).•   │ tepat waktu ≤3 hari kerja

 │             │     │ Akselerasi pendaftaran kontrak │ ke KPPN.

 │             │     │ dini (Modal/Barang) sebelum    │

 │             │     │ akhir Q1.                      │
```

   5 │ Penyelesaia │ 10% │ • Rentang hari antara tanggal  │ Menghitung rasio SPM-LS

```
 │ n Tagihan   │     │ BAST/SPK dengan tanggal        │ non-kontraktual yang

 │ (SPM-LS)    │     │ penerbitan SPM-LS ke KPPN      │ terbit tepat waktu ≤17

 │             │     │ (batas toleransi 17 hari       │ hari kerja dari BAST.

 │             │     │ kerja).                        │
```

   6 │ Pengelolaan │ 10% │ • Frekuensi/siklus revolving   │ Skor gabungan: Ketepatan

```
 │ UP &amp; TUP    │     │ GUP per bulan (target ≥1       │ waktu revolving UP (50%),

 │             │     │ ×/bulan).• Kecepatan           │ pertanggungjawaban TUP

 │             │     │ pertanggungjawaban/setoran     │ (30%), dan porsi KKP

 │             │     │ sisa TUP.• Persentase          │ (20%).

 │             │     │ transaksi menggunakan KKP (≥2% │

 │             │     │ dari proporsi UP).             │
```

   7 │ Capaian     │ 25% │ • Persentase Capaian Rincian   │ Indikator berbobot

```
 │ Output      │     │ Output (PCRO) pada setiap      │ terbesar (25%). Menghitung

 │             │     │ Rincian Output (RO).•          │ rasio ketercapaian PCRO

 │             │     │ Realisasi Volume Rincian       │ dan RVRO terhadap target

 │             │     │ Output (RVRO) terlaporkan.     │ triwulanan satker.
```

   8 │ Dispensasi  │ 10% │ • Jumlah pengajuan SPM yang    │ 0 dispensasi = skor 100.

```
 │ SPM         │     │ memerlukan surat dispensasi    │ Setiap dispensasi yang

 │             │     │ Kepala KPPN pada akhir tahun   │ diterbitkan memotong skor

 │             │     │ anggaran (Desember).           │ indikator secara

 │             │     │                                │ bertingkat.
```

  ──────



&nbsp;

======== V3 ===========

  ### 1. Alur Rewrite Skenario dari Menu Indikator

  • Pilihan Slot Skenario (A, B, atau C): Ketika operator melakukan simulasi What-If di

  menu indikator mana pun lalu menekan tombol "Simpan sebagai Skenario IKPA", dialog

  save-scenario-dialog.tsx akan menampilkan pilihan 3 slot tujuan:

      • 🔵 Slot A (Timpa Slot)

      • 🟣 Slot B (Timpa Slot)

      • 🟠 Slot C (Timpa Slot)

  • Mekanisme Rewrite: Memilih slot A, B, atau C langsung menimpa (in-place

  rewrite/overwrite) data skenario lama pada slot tersebut dengan hasil simulasi

  indikator yang sedang aktif tanpa membuat baris ganda di database.

  ──────

  ### 2. Editor Nilai / Skor 8 Indikator Interaktif pada Kartu Skenario

  Pada tab Skenario Simulasi di history.tsx:

  • Tombol Ubah (Pencil): Membuka dialog edit yang kini memungkinkan operator mengubah

  langsung:

      1. Nama Skenario &amp; Target Nilai IKPA.

      2. Skor Nilai Asli (0 s.d. 100) untuk seluruh 8 Indikator IKPA:

          • Revisi DIPA (10%)

          • Deviasi Halaman III DIPA (15%)

          • Penyerapan Anggaran (10%)

          • Belanja Kontraktual (10%)

  Berikut adalah penjelasan mengenai pembaruan alur pemilihan slot saat simpan skenario

  dari menu indikator, cakupan simulasi What-If 8 indikator, dan fitur edit

  nominal/skor indikator langsung:

          • Penyelesaian Tagihan (10%)

          • Pengelolaan UP dan TUP (10%)

          • Capaian Output (25%)

          • Dispensasi SPM (10%)

      3. Kalkulasi Live Terbobot: Skor total IKPA langsung terhitung otomatis secara

      real-time saat operator mengubah angka pada masing-masing indikator dan langsung

      disimpan ke database.

  ──────

  ### 3. Cakupan Menu Simulasi What-If pada 8 Indikator IKPA

  Sistem Simulator IKPA mendukung simulasi pada seluruh 8 indikator IKPA, dengan 4

  indikator memiliki dedicated visual workspace mandiri dan 4 indikator lainnya

  memiliki panel simulasi berbasis domain/tabel:

  per akun belanja (51, 52, 53, 57).

  1. 📊 Deviasi Halaman III DIPA (deviasi.tsx) — Simulasi penyesuaian angka RPD bulanan

  2. 💰 Penyerapan Anggaran (penyerapan.tsx) — Simulasi akselerasi realisasi per

  triwulan vs pagu DIPA.

  3. 💳 Pengelolaan UP, TUP &amp; KKP (up-tup.tsx) — Simulasi siklus revolving GUP, setoran

  sisa TUP, dan kenaikan proporsi belanja KKP.

  4. 🎯 Capaian Output (output-achievement.tsx) — Simulasi kenaikan target PCRO dan

  volume output (RVRO) per Rincian Output.

  5. 📄 Revisi DIPA (budget-revisions.tsx) — Simulasi frekuensi revisi pagu tetap vs

  revisi administratif per semester.

  6. 📝 Belanja Kontraktual (contracts-invoices.tsx) — Simulasi pendaftaran kontrak

  tepat waktu (≤3 hari kerja) dan kontrak dini 53 Modal.

  7. 🧾 Penyelesaian Tagihan (SPM-LS) (contracts-invoices.tsx) — Simulasi penerbitan

  SPM-LS tepat waktu (≤17 hari kerja dari BAST).

  8. 🏛️ Dispensasi SPM (spm-dispensation.tsx) — Simulasi mitigasi dispensasi SPM akhir

  tahun (Desember).

  ──────

  ### 4. Status Verifikasi

  • TypeScript Typecheck: 0 error di seluruh 7 package monorepo (npm run typecheck).

 ┃ /btw kenapa tidak semua indikator punya panel simulasi sendiri?

 ┃

 ┃   • Bobot &amp; Volatilitas Tinggi: Keempat indikator ini mencakup 60% total bobot IKPA

 ┃   (Capaian Output 25%, Deviasi 15%, Penyerapan 10%, UP/TUP 10%) dan paling dinamis

 ┃   berubah setiap bulan.

 ┃   ──────

 ┃   ### 2. Indikator Transaksional Diskrit (Cukup Berbasis Tabel, Form &amp; Reminder)

 ┃

 ┃   Indikator seperti Revisi DIPA, Belanja Kontraktual, Penyelesaian Tagihan (SPM-

 ┃   LS), dan Dispensasi SPM memiliki formula yang bersifat diskrit dan aturan

 ┃   kepatuhan (compliance-based):

 ┃

 ┃   • Variabel Tunggal / Hitungan Hari Kerja:

 ┃       • Revisi DIPA: Hanya menghitung frekuensi pengajuan per semester/triwulan

 ┃       (maksimal 1x per periode).

 ┃       • Kontraktual: Rasio pendaftaran kontrak yang ≤3 hari kerja dari tanggal

 ┃       kontrak.

 ┃       • Penyelesaian Tagihan: Rasio penerbitan SPM-LS yang ≤17 hari kerja dari BAST.

 ┃       • Dispensasi SPM: Jumlah penerbitan SPM dispensasi di bulan Desember (0

 ┃       dispensasi = 100).

 ┃   • Kebutuhan Sebenarnya adalah Mitigasi Waktu: Untuk 4 indikator ini, operator

 ┃   tidak membutuhkan grafik proyeksi kurva yang rumit, melainkan peringatan jatuh

 ┃   tempo (deadline reminder) dan daftar transaksi mana yang mendekati batas

 ┃   toleransi keterlambatan.

 ┃   ──────

 ┃   ### 3. Efisiensi Antarmuka &amp; Beban Kognitif Operator

 ┃

 ┃   • Ringan &amp; Fokus: Jika semua indikator dipaksakan memiliki panel simulasi

 ┃   kurva/grafik tersendiri yang berat, sistem akan menjadi lambat dan membingungkan

 ┃   pengguna dengan terlalu banyak layar simulasi yang sebenarnya hanya mengubah 1

 ┃   atau 2 variabel input.

 ┃   • Tetap Dapat Disimulasikan: Melalui menu Riwayat &amp; Skenario, operator tetap

 ┃   dapat langsung mengedit skor/nominal untuk seluruh 8 indikator sekaligus dan

 ┃   melihat akumulasi skor terbobotnya secara instan. 