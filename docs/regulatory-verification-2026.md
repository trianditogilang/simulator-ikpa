# Status Verifikasi Parameter IKPA 2026

**Produk:** Simulator Penilaian IKPA Satker  
**Tanggal pemeriksaan:** 31 Agustus 2026  
**Pemilik dokumen:** Product & IKPA Analyst  
**Approver produksi:** Admin KPPN/pejabat pengampu regulasi yang ditunjuk  
**Status dokumen:** Baseline verifikasi untuk desain; belum merupakan persetujuan go-live

> Dokumen ini mencatat bukti, asumsi, dan gap. Simulator bukan sumber nilai resmi OMSPAN/KPPN. Nilai sementara tidak boleh dipromosikan menjadi aturan produksi hanya karena tercantum pada PRD/FSD/TSD.

## 1. Aturan Status

| Status | Arti | Boleh dipakai |
|---|---|---|
| `verified` | Nilai didukung sumber resmi yang ditemukan dan konsisten dengan baseline produk | Fixture, test, dan kandidat rule set; tetap perlu approval publish |
| `needs_verification` | Sumber 2026 belum cukup, terdapat ambiguitas, atau nilai merupakan kebijakan internal aplikasi | UI dummy dan draft rule set dengan warning; **tidak untuk rule set produksi** |

Status `verified` bukan pengganti approval. Semua rule set produksi tetap memerlukan sumber regulasi, catatan perubahan, pembuat, approver, dan waktu publish.

## 2. Sumber Resmi

| ID | Sumber | Relevansi |
|---|---|---|
| S1 | [JDIH Kemenkeu — PER-5/PB/2024](https://jdih.kemenkeu.go.id/dok/per-5-pb-2024) | Metadata hukum resmi; ditetapkan dan berlaku sejak 2 Mei 2024 sampai dicabut; riwayat perubahan belum tercatat |
| S2 | [DJPb KPPN Bandung I — IKPA 2025 Sudah, Mari Menyiapkan IKPA 2026](https://djpb.kemenkeu.go.id/kppn/bandung1/id/data-publikasi/artikel/2914-ikpa-2025-sudah) | Publikasi 6 Januari 2026 yang menyatakan IKPA 2025/penyiapan 2026 mengacu PER-5/PB/2024 |
| S3 | [DJPb — Paparan Petunjuk Teknis Penilaian IKPA](https://djpb.kemenkeu.go.id/kppn/pati/images/SAMBAL/Paparan_Petunjuk_Teknis_Penilaian_Kinerja_Pelaksanaan_Anggaran_Tahun_2024.pdf) | Formula, bobot, target, bucket, dan contoh resmi PER-5/PB/2024 |
| S4 | [DJPb KPPN Padang — Ringkasan PER-5/PB/2024](https://djpb.kemenkeu.go.id/kppn/padang/id/layanan/layanan-non-spm/ikpa-2024.html) | Ringkasan reformulasi, delapan indikator, KKP, dan dispensasi |
| S5 | [DJPb KPPN Bandar Lampung — Optimalisasi IKPA](https://djpb.kemenkeu.go.id/kppn/bandarlampung/id/data-publikasi/pengumuman/3095-langkah-langkah-optimalisasi-penilaian-ikpa-ta-2024-s-1189.html) | Daftar 14 kode revisi yang diperhitungkan pada baseline PER-5/PB/2024 |
| S6 | [DJPb KPPN Surakarta — Penyesuaian IKPA Prioritas Direktif Presiden TA 2026](https://djpb.kemenkeu.go.id/kppn/surakarta/images/2026/Surat_KPPN/Penyesuaian_IKPA_dalam_Rangka_Pelaksanaan_Prioritas_Direktif_Presiden.pdf) | Penyesuaian 2026: RO Khusus dikecualikan dari Penyerapan Anggaran dan Capaian Output |
| S7 | [DJPb — Materi Capaian Output 2026](https://djpb.kemenkeu.go.id/kppn/jember/images/2026/CAPUT2026/Materi_Capaian_Output_2026.pdf) | Konfirmasi penggunaan PER-5/PB/2024 dan perubahan proses validasi capaian output pada 2026 |

### Hierarki penggunaan sumber

1. Produk hukum pada JDIH dan naskah resmi yang ditandatangani.
2. Surat/kebijakan pusat DJPb yang berlaku untuk tahun berjalan.
3. Materi resmi Direktorat Pelaksanaan Anggaran/DJPb.
4. Publikasi KPPN/Kanwil sebagai bukti pendukung, bukan pengganti naskah pusat bila terjadi konflik.
5. PRD/FSD/TSD hanya menjadi spesifikasi produk, bukan sumber regulasi.

## 3. Register Parameter Penilaian

### 3.1 Dasar dan komposisi nilai

| ID | Parameter | Nilai sementara 2026 | Sumber | Status | Owner verifikasi | Tindak lanjut |
|---|---|---|---|---|---|---|
| REG-001 | Dasar penilaian | PER-5/PB/2024 masih berlaku dan dirujuk pada 2026 | S1, S2, S7 | verified | Product & IKPA Analyst | Pantau pencabutan/perubahan dan surat pusat setelah 31 Agustus 2026 |
| REG-002 | Indikator berbobot | Revisi 10%; Deviasi 15%; Penyerapan 20%; Kontraktual 10%; Tagihan 10%; UP/TUP 10%; Capaian Output 25% | S3, S4 | verified | Product & IKPA Analyst | Simpan sebagai config, bukan konstanta engine |
| REG-003 | Dispensasi SPM | Pengurang di luar jumlah tujuh indikator | S3, S4 | verified | Product & IKPA Analyst | Simpan tabel pengurang berversi |
| REG-004 | Pembulatan internal | Scale dan mode pembulatan belum dinyatakan eksplisit pada sumber yang diperiksa | PRD/TSD | needs_verification | Admin KPPN Regulatory Approver | Tetapkan titik dan mode pembulatan sebelum golden test produksi |

### 3.2 Revisi DIPA

| ID | Parameter | Nilai sementara 2026 | Sumber | Status | Owner verifikasi | Tindak lanjut |
|---|---|---|---|---|---|---|
| REV-001 | Periode | Semester, non-kumulatif | S3 | verified | Product & IKPA Analyst | — |
| REV-002 | Skor jumlah revisi | 0–1 = 110; 2 = 100; ≥3 = 50 | S3 | verified | Product & IKPA Analyst | — |
| REV-003 | Agregasi tahunan | 50% Semester I + 50% Semester II | S3 | verified | Product & IKPA Analyst | — |
| REV-004 | Kondisi pagu | Revisi dengan kondisi pagu berubah tidak diperhitungkan | S3 | verified | Product & IKPA Analyst | Definisikan field pembanding pagu pada input |
| REV-005 | Kode revisi objek | `201, 211, 212, 213, 217, 220, 221, 222, 225, 226, 229, 231, 236, 239` | S5 | needs_verification | Admin KPPN Regulatory Approver | Dapatkan lampiran/naskah pusat yang menegaskan daftar tetap berlaku untuk TA 2026 |

### 3.3 Deviasi Halaman III DIPA

| ID | Parameter | Nilai sementara 2026 | Sumber | Status | Owner verifikasi | Tindak lanjut |
|---|---|---|---|---|---|---|
| DEV-001 | Bobot dan periode | Bobot 15%; Januari–November | S3 | verified | Product & IKPA Analyst | — |
| DEV-002 | Metode agregasi | Rata-rata deviasi bulanan tertimbang proporsi pagu jenis belanja | S3 | verified | Product & IKPA Analyst | — |
| DEV-003 | Ambang nilai maksimal | Rata-rata deviasi ≤5% memperoleh nilai maksimal 100; deviasi bulanan dibatasi 100% | S3 | verified | Product & IKPA Analyst | — |
| DEV-004 | Kurva di atas 5% | Draft produk memakai kurva/bucket rule set; bentuk final belum dibuktikan dari sumber 2026 yang diperiksa | PRD/FSD/TSD | needs_verification | Admin KPPN Regulatory Approver | Salin formula/lampiran resmi secara presisi dan buat boundary examples |
| DEV-005 | Batas pemutakhiran RPD | Paling lambat hari kerja ke-10 awal triwulan | S3 | verified | Product & IKPA Analyst | Interpretasi kalender diselesaikan F0-03/F0-04 |

### 3.4 Penyerapan Anggaran

| ID | Parameter | Nilai sementara 2026 | Sumber | Status | Owner verifikasi | Tindak lanjut |
|---|---|---|---|---|---|---|
| ABS-001 | Akun 51 | Target kumulatif TW I–IV: 20% / 50% / 75% / 95% | S3 | verified | Product & IKPA Analyst | — |
| ABS-002 | Akun 52 | Target kumulatif TW I–IV: 15% / 50% / 70% / 90% | S3, S6 | verified | Product & IKPA Analyst | Terapkan hanya pada pagu objek penilaian |
| ABS-003 | Akun 53 | Target kumulatif TW I–IV: 10% / 40% / 70% / 90% | S3, S6 | verified | Product & IKPA Analyst | Terapkan hanya pada pagu objek penilaian |
| ABS-004 | Akun 57 | Target kumulatif TW I–IV: 25% / 50% / 75% / 95% | S3 | verified | Product & IKPA Analyst | — |
| ABS-005 | Metode agregasi | Nilai triwulanan per jenis belanja, tertimbang proporsi pagu | S3 | verified | Product & IKPA Analyst | — |
| ABS-006 | Batas nilai per jenis belanja | Draft produk membatasi nilai maksimal 100 | PRD/FSD/TSD | needs_verification | Admin KPPN Regulatory Approver | Cocokkan formula dan cap terhadap lampiran/naskah PER-5 |
| ABS-007 | Basis pagu | Hari kerja ke-10 Februari/April/Juli; TW IV memakai pagu akhir periode | S3 | verified | Product & IKPA Analyst | Definisi tanggal posting dan timezone masuk F0-03 |
| ABS-008 | Satker BLU | Tidak menjadi objek penilaian Penyerapan Anggaran pada baseline PER-5/PB/2024 | S3 | verified | Admin KPPN Regulatory Approver | Konfirmasi tidak ada treatment 2026 tambahan sebelum publish |
| ABS-009 | Penyesuaian RO Khusus 2026 | Alokasi RO Khusus tertentu tidak menjadi objek Penyerapan Anggaran | S6 | verified | Admin KPPN Regulatory Approver | Simpan daftar/kriteria RO Khusus dari directive pusat, bukan hanya contoh `FAN.ZZ1` |

### 3.5 Belanja Kontraktual

| ID | Parameter | Nilai sementara 2026 | Sumber | Status | Owner verifikasi | Tindak lanjut |
|---|---|---|---|---|---|---|
| KON-001 | Komponen internal | Distribusi akselerasi 20%; kontrak dini 40%; akselerasi kontrak 53 40% | S3 | verified | Product & IKPA Analyst | — |
| KON-002 | Nilai minimum objek | Rp50 juta ke atas untuk seluruh jenis belanja pada distribusi/kontrak dini | S3 | verified | Product & IKPA Analyst | Gunakan decimal/integer Rupiah |
| KON-003 | Bucket distribusi kontrak s.d. TW II | >75%=100; 50,01–75%=80; 25,01–50%=60; 0,01–25%=50; 0%=0 | S3 | verified | Product & IKPA Analyst | Boundary test wajib |
| KON-004 | Kontrak dini | Pra-DIPA sebelum 1 Januari = 120; non-Pra-DIPA 1 Januari–31 Maret = 110 | S3 | verified | Product & IKPA Analyst | Metode agregasi lintas kontrak tetap diverifikasi pada KON-006 |
| KON-005 | Akselerasi akun 53 | Nilai Rp50–200 juta; selesai sampai 31 Maret; tanggal SP2D; kontrak sekaligus, bukan termin | S3 | verified | Product & IKPA Analyst | — |
| KON-006 | Agregasi final kontrak dini | Draft menggunakan rata-rata nilai kontrak eligible; detail denominator/pengecualian belum dibuktikan lengkap | PRD/FSD/TSD | needs_verification | Admin KPPN Regulatory Approver | Salin formula resmi dan uji kontrak tanpa objek/pengecualian |

### 3.6 Penyelesaian Tagihan

| ID | Parameter | Nilai sementara 2026 | Sumber | Status | Owner verifikasi | Tindak lanjut |
|---|---|---|---|---|---|---|
| TAG-001 | Objek | SPM-LS kontraktual terhadap seluruh SPM-LS kontraktual yang diajukan | S3 | verified | Product & IKPA Analyst | Konfirmasi filter non-pegawai pada TAG-003 |
| TAG-002 | Batas waktu | Paling lambat 17 hari kerja dari tanggal BAST/BAPP | S3 | verified | Product & IKPA Analyst | Inklusivitas hari awal/akhir diselesaikan F0-03 |
| TAG-003 | Pengecualian pegawai | Draft produk mengecualikan belanja pegawai | PRD/FSD/TSD | needs_verification | Admin KPPN Regulatory Approver | Dapatkan definisi objek lengkap dari lampiran resmi |
| TAG-004 | Formula | SPM-LS tepat waktu / seluruh SPM-LS objek × 100 | S3 | verified | Product & IKPA Analyst | Definisikan hasil saat denominator nol |

### 3.7 Pengelolaan UP/TUP dan KKP

| ID | Parameter | Nilai sementara 2026 | Sumber | Status | Owner verifikasi | Tindak lanjut |
|---|---|---|---|---|---|---|
| UPT-001 | Bobot komponen | UP/TUP tunai 90%; UP KKP 10% | S3, S4 | verified | Product & IKPA Analyst | — |
| UPT-002 | Komponen tunai | Ketepatan waktu 50%; GUP disebulankan 25%; setoran TUP 25% | S3 | verified | Product & IKPA Analyst | — |
| UPT-003 | Ketepatan GUP/PTUP | Penyampaian dalam satu bulan | S3 | verified | Product & IKPA Analyst | Boundary satu bulan/hari kerja diselesaikan F0-03 |
| UPT-004 | Target KKP | TW I 1%; TW II 5%; TW III 9%; TW IV 12,5% dari UP KKP bulanan yang disetahunkan | S3, S4 | verified | Product & IKPA Analyst | — |
| UPT-005 | Skor KKP | Mencapai target 110; belum mencapai 100; nilai tahun rata-rata triwulan | S3 | verified | Product & IKPA Analyst | Perilaku tanpa UP KKP/transaksi mengikuti case resmi dan perlu test |
| UPT-006 | Formula setoran TUP/koreksi | Formula dasar tersedia, tetapi treatment koreksi, denominator nol, dan pengecualian 2026 belum ditetapkan produk | S3, PRD/FSD | needs_verification | Admin KPPN Regulatory Approver | Susun contoh edge case yang disetujui sebelum engine final |

### 3.8 Capaian Output

| ID | Parameter | Nilai sementara 2026 | Sumber | Status | Owner verifikasi | Tindak lanjut |
|---|---|---|---|---|---|---|
| OUT-001 | Bobot komponen | Ketepatan waktu 30%; capaian RO 70%; bobot indikator 25% | S3 | verified | Product & IKPA Analyst | — |
| OUT-002 | Batas pelaporan | 5 hari kerja pada bulan berikutnya; tepat waktu 100, terlambat 0 | S3 | verified | Product & IKPA Analyst | Definisi open period dan kalender diselesaikan F0-03/F0-04 |
| OUT-003 | Formula Januari–November | Capaian/realisasi RO terhadap target; menggunakan PCRO/TPCRO sesuai proses bisnis | S3 | verified | Product & IKPA Analyst | Implementasi mengikuti formula terstruktur, bukan teks bebas |
| OUT-004 | Formula Desember | Draft menetapkan perlakuan PCRO 100%; detail final perlu contoh resmi lengkap | S3, PRD/FSD | needs_verification | Admin KPPN Regulatory Approver | Verifikasi formula Desember dan denominator nol |
| OUT-005 | Status konfirmasi | Produk mensyaratkan laporan terkonfirmasi agar eligible | S3, S7 | verified | Product & IKPA Analyst | Sinkronkan istilah status SAKTI/OMSPAN 2026 |
| OUT-006 | Penyesuaian RO Khusus 2026 | RO Khusus tertentu tidak menjadi objek Capaian Output | S6 | verified | Admin KPPN Regulatory Approver | Simpan kriteria/list resmi; contoh `FAN.ZZ1` tidak boleh di-hardcode sebagai satu-satunya kode |
| OUT-007 | Validasi PPK 2026 | Proses 2026 menambahkan validasi PPK untuk meningkatkan validitas rekaman | S7 | verified | Product & IKPA Analyst | Tentukan apakah memengaruhi input simulator atau hanya panduan operasional |

### 3.9 Dispensasi SPM

| ID | Parameter | Nilai sementara 2026 | Sumber | Status | Owner verifikasi | Tindak lanjut |
|---|---|---|---|---|---|---|
| DSP-001 | Rasio | Jumlah SPM dispensasi / jumlah SPM TW IV × 1.000 | S3 | verified | Product & IKPA Analyst | Definisikan denominator nol |
| DSP-002 | Bucket 1 | 0,00‰ → pengurang 0 | S3 | verified | Product & IKPA Analyst | — |
| DSP-003 | Bucket 2 | 0,01–0,099‰ → 0,25 | S3 | verified | Product & IKPA Analyst | Boundary decimal test wajib |
| DSP-004 | Bucket 3 | 0,1–0,99‰ → 0,50 | S3 | verified | Product & IKPA Analyst | Boundary decimal test wajib |
| DSP-005 | Bucket 4 | 1–4,99‰ → 0,75 | S3 | verified | Product & IKPA Analyst | Boundary decimal test wajib |
| DSP-006 | Bucket 5 | ≥5,00‰ → 1,00 | S3 | verified | Product & IKPA Analyst | Boundary decimal test wajib |

## 4. Register Parameter Reminder

Seluruh jadwal berikut adalah baseline desain produk. PER-5/PB/2024 mengatur proses/indikator, tetapi tidak otomatis menjadikan event aplikasi sebagai reminder `mandatory` atau menetapkan penerima email wajib.

| ID | Event | Nilai sementara | Sumber | Status | Owner verifikasi | Syarat publish |
|---|---|---|---|---|---|---|
| REM-001 | `rpd_update_due` | Recommended; H-10/H-3; workday | PRD/FSD baseline; deadline didukung S3 | needs_verification | Admin KPPN Regulatory Approver | Cocokkan dengan deadline RPD resmi dan tetapkan lead range |
| REM-002 | `absorption_gap_due` | Recommended; H-14/H-7 akhir triwulan | PRD/FSD baseline | needs_verification | Admin KPPN Regulatory Approver | Kebijakan internal tertulis |
| REM-003 | `early_contract_due` | Optional/Recommended; H-30/H-14 sebelum 31 Maret | PRD/FSD baseline | needs_verification | Admin KPPN Regulatory Approver | Pilih satu kategori dan source |
| REM-004 | `capital_53_contract_due` | Recommended; H-14 akhir triwulan | PRD/FSD baseline | needs_verification | Admin KPPN Regulatory Approver | Kebijakan internal tertulis |
| REM-005 | `invoice_timeliness_due` | H-5/H-2/H-0 dari H+17; mandatory hanya bila ditetapkan | PRD/FSD baseline; deadline didukung S3 | needs_verification | Admin KPPN Regulatory Approver | Keputusan mandatory, recipient, H-0, dan kalender eksplisit |
| REM-006 | `gup_ptup_due` | Recommended; H-5/H-2 | PRD/FSD baseline; interval didukung S3 | needs_verification | Admin KPPN Regulatory Approver | Definisi satu bulan dan lead range |
| REM-007 | `tup_deposit_due` | Recommended; H-10/H-3 | PRD/FSD baseline | needs_verification | Admin KPPN Regulatory Approver | Formula deadline dan jenis hari |
| REM-008 | `kkp_target_due` | Optional; H-14 akhir triwulan | PRD/FSD baseline; target didukung S3 | needs_verification | Admin KPPN Regulatory Approver | Kebijakan internal tertulis |
| REM-009 | `output_report_due` | H-3/H-1/H-0; mandatory hanya bila ditetapkan | PRD/FSD baseline; deadline didukung S3 | needs_verification | Admin KPPN Regulatory Approver | Keputusan mandatory, recipient, H-0, dan kalender eksplisit |
| REM-010 | `spm_dispensation_risk` | Recommended; H-30/H-14/H-7 akhir tahun | PRD/FSD baseline | needs_verification | Admin KPPN Regulatory Approver | Sinkron dengan langkah akhir tahun berjalan |
| REM-011 | `dipa_revision_threshold` | Optional; event revisi ke-1/ke-2 | PRD/FSD baseline; threshold score didukung S3 | needs_verification | Admin KPPN Regulatory Approver | Definisi eligibility revisi final |
| REM-012 | `ikpa_weekly_digest` | Optional; Senin 07.00 WIB | PRD/FSD baseline | needs_verification | Admin KPPN Regulatory Approver | Kebijakan internal, timezone, recipient |
| REM-013 | Kalender hari kerja 2026 | Belum ada dataset kalender yang disetujui di repo | PRD/FSD/TSD requirement | needs_verification | Admin KPPN Regulatory Approver | Import/approval kalender resmi dan versioning F0-04 |
| REM-014 | Required recipients | Belum ditetapkan per event | PRD/FSD policy model | needs_verification | Admin KPPN Regulatory Approver | Daftar role/email-group yang sah dan dasar penetapan |

## 5. Edge Case yang Harus Diputuskan

| ID | Keputusan terbuka | Task lanjutan | Dampak bila belum selesai |
|---|---|---|---|
| EDGE-001 | BAST/BAPP dihitung hari ke-0 atau hari ke-1 | F0-03 | Tagihan H+17 dapat berbeda satu hari |
| EDGE-002 | H-0 dikirim pada jam berapa dan apakah tetap valid pada hari non-kerja | F0-03, F0-05 | Reminder mandatory dapat terlambat/salah jadwal |
| EDGE-003 | Versioning kalender dan perubahan hari kerja retrospektif | F0-04 | Snapshot/deadline historis dapat berubah |
| EDGE-004 | `minLeadDays >= 1` versus jadwal H-0 | F0-05 | Schema menolak default policy sendiri |
| EDGE-005 | Overlap/effective range rule set | F0-06 | Dua rule set dapat dianggap aktif |
| EDGE-006 | Denominator nol pada indikator dan subkomponen | F6-02–F6-10 | Engine menghasilkan angka semu atau division error |
| EDGE-007 | Titik pembulatan formula dan display | F0-02 follow-up approval, F6-02 | Golden result dapat berbeda |
| EDGE-008 | Daftar RO Khusus 2026 dan masa berlakunya | Admin KPPN Regulatory Approver | Penyerapan/output dapat memasukkan objek yang seharusnya dikecualikan |

## 6. Aturan Go-Live

Rule set produksi 2026 **dilarang dipublish/go-live** apabila salah satu kondisi berikut terjadi:

1. Ada parameter scoring, eligibility, bucket, formula, kalender, atau pembulatan yang dipakai engine tetapi masih `needs_verification`.
2. Daftar kode revisi dan kriteria RO Khusus belum memiliki bukti/approval yang berlaku untuk scope implementasi.
3. Event diberi kategori `mandatory` tanpa keputusan eksplisit Admin KPPN, required recipients, dasar kebijakan, dan audit publish.
4. Kalender hari kerja 2026 belum diimpor, divalidasi, disetujui, dan diberi versi.
5. Golden test belum menggunakan parameter yang sama persis dengan rule set yang akan dipublish.
6. Sumber regulasi tidak tersimpan pada rule set atau dokumen sumber tidak dapat ditelusuri.

Fitur UI dummy, prototype, dan development lokal boleh berjalan dengan parameter `needs_verification` hanya jika:

- setiap hasil menampilkan warning asumsi;
- data tidak diberi label nilai resmi;
- rule set berstatus `draft`;
- notification delivery eksternal dinonaktifkan.

## 7. Checklist Approval Produksi

- [ ] Admin KPPN/approver mengonfirmasi sumber pusat yang berlaku untuk TA 2026.
- [ ] Seluruh baris scoring dan eligibility berstatus `verified`.
- [ ] Edge case F0-03 sampai F0-06 sudah menjadi ADR yang disetujui.
- [ ] Kalender kerja 2026 memiliki versi dan checksum/import record.
- [ ] Daftar RO Khusus dan kode revisi tersimpan sebagai konfigurasi, bukan hard-code.
- [ ] Reminder mandatory dan required recipients ditetapkan eksplisit.
- [ ] Golden tests lulus terhadap candidate rule set produksi.
- [ ] Rule set menyimpan source, status verifikasi, change notes, creator, approver, dan publish time.

## 8. Ringkasan

| Kelompok | Verified | Needs verification |
|---|---:|---:|
| Dasar dan komposisi | 3 | 1 |
| Revisi DIPA | 4 | 1 |
| Deviasi Halaman III DIPA | 4 | 1 |
| Penyerapan Anggaran | 8 | 1 |
| Belanja Kontraktual | 5 | 1 |
| Penyelesaian Tagihan | 3 | 1 |
| UP/TUP dan KKP | 5 | 1 |
| Capaian Output | 6 | 1 |
| Dispensasi SPM | 6 | 0 |
| Reminder dan kalender | 0 | 14 |
| **Total** | **44** | **22** |

Angka ringkasan hanya menghitung baris register parameter; edge case dan checklist approval tidak dihitung sebagai parameter terpisah.
