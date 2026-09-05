# PRE-F13 — Koreksi IA Operator (sebelum Fase 13)

**Produk:** Simulator Penilaian IKPA Satker  
**Status:** Keputusan produk dikunci; F13 belum boleh dimulai  
**Tanggal:** 5 September 2026  
**Pemilik:** Goal Galing  

Dokumen ini adalah instruksi kerja untuk AI coding agent. Bukan pengganti PRD/FSD/TSD/ERD. Baseline lama tetap di repo; penyimpangan dicatat sebagai `Intentional Change`.

**IA** = information architecture (struktur menu dan alur layar).  
**CORR** = correction (task koreksi fitur sebelum Fase 13).  
**PRE-F13** = nama fase, bukan nama satu file.

---

## 1. Di mana PRE-F13 ditulis

| File | Fungsi | Isi |
|---|---|---|
| `docs/TASK-LIST-Simulator-IKPA.md` | Urutan resmi | Seksi baru **antara Fase 12 dan Fase 13**: `CORR-00` s.d. `CORR-06`, plus `CORR-A-*` unchecked. F13-01 s.d. F13-14 tetap di bawah, **jangan dicentang**, beri `Depends: PRE-F13 CORR-01..05`. |
| `docs/BACKLOG.md` | Tracker status | Baris `CORR-00` … `CORR-06` (status, owner, file, bukti). |
| `docs/DEVLOG.md` | Jejak sesi | Entri append setiap task selesai. Jangan timpa entri lama. |
| `docs/future_plan.md` | Arsip, bukan task | IA Operator lama (domain-centric) + cara restore. Jangan timpa bagian Import. |

Tanpa seksi PRE-F13 di **task list**, agent mudah loncat ke F13 yang masih kosong.

Prefix di chat **bukan** pengganti tulisan di keempat file itu. Prefix hilang saat sesi baru. Yang diingat agent lintas sesi hanya file repo yang ia baca.

---

## 2. Posisi sekarang

- Fase 0–12 selesai di task list. Itu fondasi teknis, bukan bukti UX sudah benar.
- PRE-F13-01 s.d. PRE-F13-08 (panel GUP/SPM, isolasi simpan, dashboard 8 baris, Import UI dimatikan) sudah dikerjakan sebagai koreksi kecil.
- Devlog Session 96 menyebut “siap F13”. **Abaikan.** Fase 13 ditunda sampai CORR-01..05 Operator selesai.
- Excel **tidak** masuk aplikasi. Direplikasi cara kerjanya: sel kuning, skor instan, satu indikator dulu.

Implementasi IA lama dianggap masih awal pengembangan. **Jangan dihapus.** Arsipkan di `future_plan.md` (pola Import).

---

## 3. IA yang dikunci

### Sidebar Operator

```text
Dashboard IKPA          ← total, gap, 5 rekomendasi, deadline terdekat
Revisi DIPA
Deviasi Halaman III
Penyerapan Anggaran
Belanja Kontraktual
Penyelesaian Tagihan    ← strip reminder wajib + rekomendasi kontekstual
UP/TUP & KKP            ← GUP/PTUP wajib; KKP custom
Capaian Output          ← lapor 5 hari kerja wajib + rekomendasi kontekstual
Dispensasi SPM
Reminder Center         ← daftar tenggat lintas indikator

Lainnya
  Riwayat & perbandingan
  Laporan & ekspor
  Panduan IKPA
  Pengaturan
```

Nama 8 menu indikator wajib persis seperti di atas.

### Aturan penempatan fitur

| Fitur | Di mana | Bukan |
|---|---|---|
| Skenario | Mode kerja di **tiap** indikator: actual terkunci, sisa tahun diubah, skor indikator muncul | Menu sidebar |
| Gabungan nilai IKPA | **Dashboard**: merakit 8 skor; menandai actual / asumsi / kosong; tombol `Simpan skenario IKPA` | Menu “Skenario gabungan” |
| Riwayat | Arsip di Lainnya: buka, bandingkan, duplikasi | Tempat menghitung; sejajar 8 indikator |
| Analisis & rekomendasi | 5 tindakan prioritas di Dashboard; kontekstual di Tagihan/Output | Menu setara Penyerapan |
| OPS-11 `/operator/analysis` | `Lihat semua` dari Dashboard jika daftar panjang | Jangan dihapus; jangan di sidebar inti |
| Panduan harian | `?` / drawer di tiap indikator | Menu inti |
| Panduan lengkap | Lainnya → Panduan IKPA | Tugas harian |
| Import | Tetap stub; sudah di `future_plan` | Restore di fase ini |
| Tools / unggah Excel | Tidak ada | — |

### Alur pemakaian

1. Pilih satker dan tahun. Periode = bulan berjalan.
2. Isi **actual** hanya bulan yang sudah lewat, per indikator yang dikerjakan. Tidak wajib 8 sekaligus.
3. Dashboard menampilkan skor actual (boleh bertanda estimasi).
4. Buka satu indikator. Atas = actual terkunci. Bawah = rencana sisa tahun. Skor indikator berubah instan.
5. Ulangi indikator lain jika perlu.
6. Dashboard merakit total. Simpan skenario IKPA dari Dashboard.
7. Setelah transaksi nyata, update actual. Reminder Tagihan, Output, GUP/PTUP mengikuti tanggal actual.

Tanpa actual YTD, simulasi bukan “tengah jalan”.

---

## 4. Excel → menu (UX saja, rumus tetap engine)

Jangan salin buta angka sheet (contoh: target 51 Q1 di `PENY.` 10%; default 2026 tetap 20%).

| Sheet | Menu aplikasi | Direplikasi |
|---|---|---|
| Simulasi Setiap GUP | UP/TUP & KKP | What-if GUP: nominal, tanggal, disebulankan, tepat waktu |
| Penyerapan Anggaran / FORMULA BARU | Penyerapan Anggaran | Pagu, realisasi sisa/kumulatif, target TW, cap 100 |
| DEV | Deviasi Halaman III | RPD vs realisasi Jan–Nov; proporsi pagu dari sumber yang sama |
| PENY. | Penyerapan Anggaran | Sama + pagu netto (blokir kemudian) |
| UP KKP | UP/TUP & KKP | Target 1% / 5% / 9% / 12,5%; nilai 100 vs 110 |
| Kontrak | Belanja Kontraktual | Tiga komponen; sheet kasar — tunda what-if penuh |

Tidak dari Excel ini: Revisi DIPA, Tagihan, Capaian Output (RO), Dispensasi SPM. Menu tetap ada.

---

## 5. Template seksi task list (sisipkan sebelum Fase 13)

```markdown
## Fase PRE-F13 — Koreksi IA Operator

Jangan mulai F13 sebelum CORR-01 s.d. CORR-05 selesai.
Route lama jangan dihapus. IA domain-centric diarsip di docs/future_plan.md.

- [ ] CORR-00 Arsipkan IA lama ke future_plan dan kunci keputusan di BACKLOG.
  Role: Technical Writer / Product
  Files: docs/future_plan.md, docs/BACKLOG.md, docs/TASK-LIST-Simulator-IKPA.md
  DoD: Bagian Import tidak tertimpa. Baris CORR-00..06 ada di backlog. Navigation belum diubah.

- [ ] CORR-01 Ubah navigasi Operator sesuai sidebar 8 indikator + Reminder + Lainnya.
  Role: Frontend Operator Agent
  File: apps/web/src/components/layout/operator-navigation.tsx
  Depends: CORR-00
  DoD: Nama menu persis dokumen PRE-F13. Import tidak tampil. Route lama tetap. Admin nav tidak disentuh.

- [ ] CORR-02 Workspace Penyerapan (actual YTD terkunci, sisa tahun editable, skor via engine).
  Role: Frontend Operator Agent
  Depends: CORR-01
  DoD: Actual tidak tertimpa. Target dari rule set. ?/drawer rumus singkat ada.

- [ ] CORR-03 Workspace Deviasi Halaman III (Jan–Nov; pagu dari sumber yang sama dengan Penyerapan).
  Role: Frontend Operator Agent
  Depends: CORR-02
  DoD: Skor via engine. Desember tidak dihitung. ?/drawer ada.

- [ ] CORR-04 Workspace UP/TUP & KKP (reuse panel GUP/KKP; reminder GUP/PTUP wajib).
  Role: Frontend Operator Agent
  Depends: CORR-03
  DoD: Lib assumptions tidak dihapus. Tab data actual tetap. ?/drawer ada.

- [ ] CORR-05 Dashboard merakit 8 baris, 5 rekomendasi, Simpan skenario IKPA.
  Role: Frontend Operator Agent
  Depends: CORR-04
  DoD: Estimasi jika ada indikator kosong. CTA Lihat semua boleh ke /operator/analysis. Bukan menu Skenario gabungan.

- [ ] CORR-06 Strip reminder + rekomendasi kontekstual di Tagihan dan Output.
  Role: Frontend Operator Agent
  Depends: CORR-05
  DoD: H+17 dan 5 hari kerja wajib tampil. Bukan kalkulator opsional.

- [ ] CORR-A-00 s.d. CORR-A-05 Admin monitor 8 indikator (parkir).
  Depends: CORR-01..05 Operator
  DoD: Read-only. Tidak ada sel kuning. Tidak ada mutasi data operasional.
```

Pada header Fase 13 tambahkan: `Depends: PRE-F13 CORR-01..05`. Checkbox F13 tetap kosong.

---

## 6. Dokumen acuan per sesi

| Dilampirkan | Cukup path |
|---|---|
| `docs/BACKLOG.md` | PRD, FSD, TSD, ERD, Design System, Wireframes |
| `docs/DEVLOG.md` | Task list (setelah seksi PRE-F13 ada) |
| Dokumen PRE-F13 ini (sesi 1, atau jika agent nyasar) | — |
| Sesi CORR-00: `docs/future_plan.md` | — |
| Sesi Penyerapan/Deviasi/GUP: Excel terkait | — |

Jangan tempel PRD/FSD utuh setiap sesi.

---

## 7. Prefix vs CORR-00 vs prompt harian

| Hal | Fungsi |
|---|---|
| Prefix panjang | Hanya sesi pertama, atau jika agent nyasar. Bukan ritual harian. |
| **CORR-00** | Task yang **menulis** keputusan ke task list, backlog, dan `future_plan`. Tanpa ini aturan hanya di chat. |
| Prompt pendek | Sesi 2 dst.: selesai X, baca backlog/devlog/task list PRE-F13, lanjut Y. |

Agent coding **tidak** ingat chat kemarin. Yang ia “ingat” adalah file yang dibaca di awal sesi.

---

## 8. Prompt

### Prefix (opsional setelah CORR-00; wajib jika agent nyasar)

```text
Review docs/BACKLOG.md, docs/DEVLOG.md, dan seksi PRE-F13 di task list dulu.
Jangan mulai F13, CI, Vercel, UAT, atau Admin.
Jangan restore Import. Jangan menu Tools. Jangan upload Excel.
Jangan rewrite engine, schema DB, atau PRD/FSD/TSD/ERD.
Kerjakan HANYA task yang saya sebut. Ponytail: scope kecil.
Context7 hanya untuk stack yang disentuh.
Selesai: verifikasi, update BACKLOG, append DEVLOG, centang task list jika DoD lulus.
IA lama jangan dihapus: rujuk docs/future_plan.md.

Sidebar dikunci: Dashboard; 8 indikator (Revisi, Deviasi, Penyerapan, Kontraktual,
Tagihan, UP/TUP & KKP, Output, Dispensasi); Reminder Center;
Lainnya = Riwayat, Laporan, Panduan, Pengaturan.
Skenario = mode di tiap indikator. Gabungan = Dashboard + Simpan skenario IKPA.
Analisis di Dashboard; Lihat semua boleh ke /operator/analysis.
Panduan harian = ?/drawer. Fokus Operator. Jangan CORR-A-* sekarang.
```

### Sesi 1 — CORR-00 (wajib dulu)

```text
Saya anggap ini masih awal pengembangan. Jangan masuk F13.

Task CORR-00:
1) Review BACKLOG dan DEVLOG teratas (Session 96 = PRE-F13-08 Import disabled).
2) Sisipkan seksi "Fase PRE-F13 — Koreksi IA Operator" di task list
   antara Fase 12 dan Fase 13, sesuai template dokumen PRE-F13.
   Pada Fase 13 tulis Depends: PRE-F13 CORR-01..05. Jangan centang F13.
3) APPEND docs/future_plan.md, jangan timpa bagian Import.
   Judul: "IA Operator domain-centric (pra-koreksi 8 indikator)".
   Catat sidebar Input Data lama, /operator/simulation mega-page,
   analysis/guides sebagai menu inti, route yang dipertahankan, cara restore.
4) Tambah baris CORR-00 s.d. CORR-06 di BACKLOG.

Jangan ubah navigation. Hanya task list + future_plan + backlog + devlog.
```

### Sesi 2 s.d. 7 — prompt pendek

Setelah CORR-00, gaya harian cukup:

```text
Saya sudah menyelesaikan CORR-0X. Review backlog, devlog, dan seksi PRE-F13 di task list dulu.
Lanjutkan CORR-0Y. Update backlog, devlog, dan checkbox task list setelah DoD lulus.
Ponytail + context7 untuk stack yang disentuh.
Jangan F13, jangan Admin, jangan hapus route lama.
```

Isi task **CORR-0Y** (jangan digabung dengan CORR-00):

- **CORR-01** — `operator-navigation.tsx`: daftar nama IA persis. Import tidak tampil. Admin nav tidak disentuh.
- **CORR-02** — Workspace Penyerapan. Excel = UX saja. Actual YTD terkunci, sisa tahun via engine, akun 51/52/53/57, ?/drawer.
- **CORR-03** — Workspace Deviasi. Jan–Nov, pagu sama dengan Penyerapan, skor via engine, ?/drawer.
- **CORR-04** — Workspace UP/TUP. Reuse GUP/KKP. Reminder GUP/PTUP wajib. Jangan hapus lib assumptions.
- **CORR-05** — Dashboard 8 baris, 5 rekomendasi, Simpan skenario IKPA, CTA Lihat semua → `/operator/analysis`.
- **CORR-06** — Tagihan & Output: reminder wajib + rekomendasi kontekstual (H+17, 5 hari kerja).

---

## 9. Admin (parkir)

Admin memakai model 8 indikator yang sama, **tanpa** sel kuning. Read-only, scope KPPN.

| ID | Isi | Syarat |
|---|---|---|
| CORR-A-00 | Bekukan: monitor 8 indikator + reminder wajib | CORR-01 |
| CORR-A-01 | Dashboard Admin agregat 8 baris + deadline wajib | CORR-02..04 |
| CORR-A-02 | Daftar satker: 8 skor, gap, actual vs proyeksi | Loader bukan mock |
| CORR-A-03 | Detail satker read-only | `/admin-kppn/organizations/:orgId` |
| CORR-A-04 | Monitoring reminder mandatory | Policy backend ada |
| CORR-A-05 | Policy, kalender, akses, audit tetap | Setelah A-01..03 |

Prompt Admin nanti: *bukan F13, bukan edit data satker, `assertAdminKppnScope`, tidak ada mutasi operasional.*

---

## 10. Template append `docs/future_plan.md`

```markdown
## IA Operator domain-centric (pra-koreksi 8 indikator)

Diarsipkan sebelum koreksi sidebar 8 indikator. Backend/route tetap.
Restore = pasang ulang entry nav + CTA, tanpa drop tabel.

Yang diarsipkan:
- Sidebar Input Data: Pagu & Revisi, RPD & Realisasi, Kontrak & Tagihan,
  UP/TUP & KKP, Capaian Output, SPM Dispensasi
- /operator/simulation sebagai satu halaman 8 accordion
- /operator/analysis dan /operator/guides sebagai menu inti sidebar
- Import sudah diarsip terpisah di bagian atas dokumen ini

File route yang dipertahankan:
- apps/web/src/routes/operator/data/*
- apps/web/src/routes/operator/simulation.tsx
- apps/web/src/routes/operator/analysis.tsx
- apps/web/src/routes/operator/guides.tsx
- apps/web/src/routes/operator/history.tsx

Cara restore: [diisi agent saat CORR-00]
```

---

## 11. Definition of Done fase PRE-F13 (sebelum F13)

- Seksi PRE-F13 ada di task list; F13 belum tercentang.
- Sidebar sesuai daftar nama terkunci; Import tidak tampil.
- Operator: actual YTD → simulasi sisa tahun di Penyerapan, Deviasi, UP/TUP → total di Dashboard.
- Actual tidak tertimpa asumsi.
- `future_plan.md` memuat arsip IA lama (dan Import).
- Admin belum diubah, kecuali kontrak field skor 8 indikator sudah dipikirkan.
