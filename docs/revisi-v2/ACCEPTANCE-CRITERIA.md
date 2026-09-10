# Acceptance Criteria — Revisi v2

Dokumen ini adalah daftar acceptance criteria aktif untuk UAT dan Fase 13.
Baseline acceptance criteria v1 di dokumen root `docs/` dipertahankan untuk
histori, tetapi tidak boleh digunakan ketika bertentangan dengan daftar ini.

| ID | Kriteria aktif | Bukti utama |
|---|---|---|
| V2-AC-01 | Landing dan satu alur login tersedia. | F13-04 |
| V2-AC-02 | Mapping email mengarahkan Operator/Admin ke area yang benar. | F13-04, F13-05 |
| V2-AC-03 | Email tanpa mapping hanya melihat access-pending/403. | F13-02, F13-04 |
| V2-AC-04 | Operator dapat membuka Dashboard dan delapan workspace indikator yang aktif. | F13-04 |
| V2-AC-05 | Operator hanya membaca dan menulis data satker yang diotorisasi. | F13-02 |
| V2-AC-06 | Admin dapat memonitor scope KPPN; detail transaksi satker read-only. | F13-02, F13-05 |
| V2-AC-07 | Multiple admin setara dan admin aktif terakhir tidak dapat dicabut. | F13-02, F13-05 |
| V2-AC-08 | Input manual seluruh domain aktif tervalidasi dan scoped; Import Data tetap Disabled/Deferred. | F13-01, F13-02 |
| V2-AC-09 | Engine menghasilkan delapan baris tampilan (tujuh indikator plus pengurang Dispensasi SPM), breakdown, bobot, dan rule-set version. | F13-01 |
| V2-AC-10 | Golden result dan boundary regulasi lulus tanpa perubahan formula yang tidak disetujui. | F13-01 |
| V2-AC-11 | Actual tersimpan tidak berubah ketika proyeksi atau what-if dijalankan. | F13-01, F13-04 |
| V2-AC-12 | Skenario per indikator dapat disimpan ke Slot A/B/C tanpa menulis actual. | F13-04 |
| V2-AC-13 | Nama Slot A/B/C tersinkron antara dialog indikator dan Riwayat. | F13-04 |
| V2-AC-14 | Dashboard menampilkan delapan indikator, lima rekomendasi, gap, incomplete state, dan estimasi secara transparan. | F13-04 |
| V2-AC-15 | Riwayat menggunakan Evaluasi untuk item aktual dan memiliki parity dengan Dashboard. | F13-04 |
| V2-AC-16 | Compare mendukung Evaluasi bulanan dengan proyeksi/skenario dan maksimal tiga slot skenario. | F13-04 |
| V2-AC-17 | Admin dapat membuat, memvalidasi, publish, dan retire policy/rule set tanpa deploy aplikasi. | F13-03, F13-05 |
| V2-AC-18 | Operator tidak dapat melepas event mandatory, penerima wajib, formula deadline, atau batas policy. | F13-03 |
| V2-AC-19 | Deadline Tagihan H+17, Output lima hari kerja, dan GUP/PTUP memakai kalender/policy aktif. | F13-03, F13-04 |
| V2-AC-20 | Publish policy mengevaluasi jadwal mendatang dan snapshot lama mempertahankan rule/policy version asal. | F13-03 |
| V2-AC-21 | Delivery menyimpan policy, rule version, idempotency, retry audit, dan tidak menggandakan replay. | F13-03, F13-05 |
| V2-AC-22 | Admin melihat agregat delapan indikator, skor, gap, dan sumber aktual/proyeksi/kosong dalam scope. | F13-05 |
| V2-AC-23 | Admin melihat monitoring mandatory reminder, risiko, failed delivery, audit, dan detail read-only tanpa kontrol operasional. | F13-05 |
| V2-AC-24 | Export Operator XLSX scoped menghasilkan workbook valid dengan MIME/signature ZIP/XLSX, filter tercantum, tanpa URL publik permanen, dan disclaimer/rule version tersedia. PDF Operator dan ekspor Admin tidak termasuk kontrak aktif sejak 2026-09-10. | F13-02, F13-04 |

## Invariants protected by Fase 13

- Tidak ada redesign IA, perubahan formula, atau perubahan perilaku actual/what-if tanpa requirement baru.
- Runtime mock hanya boleh digunakan untuk demo/non-production; production harus fail closed.
- Perubahan pada operator yang diterima harus memiliki regression evidence desktop dan mobile.
