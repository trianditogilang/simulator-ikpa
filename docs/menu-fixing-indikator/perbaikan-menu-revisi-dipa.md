# Perbaikan Menu Revisi DIPA

**Tujuan:** agar skor indikator sesuai materi IKPA (bobot 10%, semesteran, 14 kode pagu tetap) dan operator satker bisa memakai halaman ini tanpa harus “menerka” dampak ke NKRA.

**Sumber acuan:** materi Pusdiklat AP (14 jenis revisi pagu tetap), penjelasan NKRA, dan temuan inspeksi `02-revisi-dipa.md`.

**Halaman:** `/operator/data/budget-revisions`

---

## 1. Prinsip yang harus dipegang

Indikator ini mengukur **kualitas perencanaan**, bukan jumlah semua pengesahan DIPA.

Satu baris revisi **hanya dihitung** jika **dua syarat terpenuhi sekaligus**:

1. Minimal satu kode jenis revisi termasuk **14 kode pagu tetap**.
2. **Total pagu satker tidak berubah** (`paguBefore` = `paguAfter`).

**Catatan cepat (wajib di UI dan di engine):**

> Jika pagu berubah, revisi **otomatis tidak dihitung**. Tidak perlu melihat kodenya.

Penilaian **per semester, tidak kumulatif**. Nilai tahunan:

```
Nilai IKPA Revisi DIPA = (50% × NKRA S1) + (50% × NKRA S2)
```

| Jumlah revisi objek per semester | NKRA |
|---:|---:|
| 0–1 kali | 110 |
| 2 kali | 100 |
| ≥ 3 kali | 50 |

14 kode objek: `201, 211, 212, 213, 217, 220, 221, 222, 225, 226, 229, 231, 236, 239`.

---

## 2. Perbaikan engine (wajib sebelum go-live)

Tanpa ini, UI yang ramah tetap menampilkan skor salah.

### 2.1 Filter objek penilaian

| Langkah | Aturan |
|---|---|
| 1 | Abaikan baris soft-delete. |
| 2 | Abaikan pengesahan awal / `DIPA-AWAL` (bukan revisi). |
| 3 | Jika `paguAfter ≠ paguBefore` → **bukan objek** (alasan: pagu berubah). |
| 4 | Parse `revisionCode` (boleh multi-kode, pemisah koma/spasi). |
| 5 | Jika irisan dengan 14 kode **kosong** → **bukan objek** (alasan: kode di luar daftar). |
| 6 | Jika pagu tetap **dan** ada ≥1 kode objek → **objek**, +1 pada semester tanggal revisi. |

Contoh PDF Satker XYZ 2025 harus menghasilkan: S1 = 1 objek, S2 = 3 objek, nilai tahunan **80**.

### 2.2 Pakai field yang sudah ada

- `revisionCode`, `paguBefore`, `paguAfter`, `revisionDate` **harus** masuk mapping ke engine.
- Hidupkan `hasBudgetChange` per baris: `paguAfter !== paguBefore` (bukan `map(() => true)`).
- Konsumsi `revisionEligibilityCodes` dari rule set; hapus status “daftar sementara” setelah dikunci ke 14 kode PDF.
- Hidupkan `previewRevisionEligibility` dan pakai di UI (bukan dead code).

### 2.3 Semester dan validasi tanggal

- S1 = 1 Jan–30 Jun; S2 = 1 Jul–31 Des, zona **WIB**, bukan `getMonth()` mentah server UTC.
- Tolak tanggal di luar tahun anggaran aktif.
- Izinkan duplikat hanya dengan peringatan (dua pengesahan sama tanggal tetap dua hitungan jika keduanya objek).

### 2.4 Tes wajib (golden)

| Kasus | Hasil |
|---|---|
| S1=1 objek, S2=3 objek | NKRA 110 & 50 → **80** (kontribusi 8,0) |
| Kode 212, pagu tetap | Objek |
| Kode 315/325, pagu tetap | Bukan objek |
| Ada 221 tetapi pagu naik | Bukan objek |
| 0 objek di kedua semester | NKRA 110 & 110 → 110 (jelaskan di UI: “belum ada revisi objek”) |
| DIPA-AWAL saja | 0 objek, bukan S1=1 |

---

## 3. Perbaikan tampilan halaman (agar mudah dipakai)

Halaman saat ini hanya CRUD. Operator harus ke Dashboard untuk tahu skor. Itu yang paling menghambat.

### 3.1 Susunan layar yang disarankan

1. **Judul + bantuan singkat**  
   “Revisi DIPA · bobot 10% · dinilai per semester, hanya revisi pagu tetap.”  
   Tombol `?` membuka rumus + 14 kode (bukan teks mock yang salah).

2. **Kartu skor langsung di halaman ini** (jangan wajib buka Dashboard)
   - NKRA Semester 1
   - NKRA Semester 2
   - Nilai tahunan
   - Kontribusi ke IKPA (`nilai × 10%`)
   - Status: Aman (0–1 objek) / Hati-hati (2) / Risiko (≥3)

3. **Filter semester** pada tabel: Semua / S1 / S2, plus chip “Hanya objek penilaian”.

4. **Tabel histori** dengan kolom yang operator butuhkan:

   | Tanggal | Kode | Pagu sebelum | Pagu sesudah | Δ pagu | Semester | Objek? | Alasan | Aksi |
   |---|---|---|---|---|---|---|---|---|

   Badge:
   - Hijau: **Dihitung**
   - Abu: **Tidak dihitung — pagu berubah**
   - Abu: **Tidak dihitung — kode di luar 14 jenis**
   - Putih: **Pengesahan awal (dikecualikan)**

5. **Ringkasan bawah tabel**  
   `Objek S1: 1 · Objek S2: 3 · Sisa kuota aman S2: 0 (ambang ke-2 sudah terlewati)`

### 3.2 Form tambah/ubah revisi yang “bicara”

Saat operator mengisi drawer:

- Kode: **select multi** 14 kode + opsi “kode lain…” (bukan text bebas tanpa bantuan).
- Setelah pagu sebelum/sesudah terisi, tampilkan **pratinjau langsung**:

  > “Revisi ini **tidak dihitung** karena pagu satker berubah (+Rp 2,34 M).”  
  > atau  
  > “Revisi ini **dihitung** sebagai objek Semester 2. Jika disimpan, NKRA S2: 110 → 100.”

- Tampilkan delta pagu otomatis; jangan prefill pagu sesudah = pagu sebelum tanpa penjelasan (itu justru tersembunyi sebagai “pagu tetap”).
- Izinkan **edit** revisi (sekarang hanya tambah/hapus) agar koreksi kode tidak memaksa hapus-buat ulang.
- Validasi: kode wajib, tanggal dalam TA, pagu tidak negatif.

### 3.3 Pagu akun 51/52/53/57 vs indikator ini

Pisahkan secara visual dua zona:

| Zona | Fungsi | Pengaruh ke skor Revisi DIPA |
|---|---|---|
| Alokasi pagu per jenis belanja | Dipakai Deviasi & Penyerapan | **Tidak** |
| Histori pengesahan revisi | Dipakai indikator Revisi DIPA | **Ya**, setelah filter objek |

Teks bantuan: “Mengubah kartu pagu **tidak** menambah hitungan revisi. Yang dihitung hanya baris pengesahan di tabel.”

### 3.4 Peringatan ambang (strategi satker)

Tampilkan strip di atas tabel, bukan hanya reminder generik:

- Objek ke-1 di semester: “Masih aman (NKRA 110). Konsolidasikan usulan berikutnya.”
- Objek ke-2: “NKRA semester ini akan 100. Usulan berikutnya menurunkan ke 50.”
- Objek ke-3+: “NKRA semester ini 50. Nilai tahunan tertekan. Tinjau DIPA, gabungkan usulan, lengkapi dokumen blokir.”

CTA praktis (copy dari materi):

- Review DIPA minimal bulanan / triwulanan
- Gabungkan usulan revisi + tetapkan cutoff internal
- Lengkapi dokumen untuk buka catatan blokir

Reminder `dipa_revision_quarterly` tetap ada, tetapi **deep-link ke halaman ini** dan sebut jumlah objek berjalan.

---

## 4. Copy & panduan yang harus diganti

Hapus teks mock `1→100, >1→80`. Ganti dengan tabel NKRA di atas.

Teks bantuan singkat (boleh di drawer `?`):

1. Cek pagu satker. Berubah → tidak dihitung.
2. Pagu tetap → cek apakah kodenya salah satu dari 14.
3. Hitung berapa kali objek per semester.
4. Rata-rata S1 dan S2 = nilai indikator tahun ini.

Sertakan contoh ABC/XYZ: S1 satu objek (110), S2 tiga objek (50) → **80**.

---

## 5. Alur kerja operator (setelah perbaikan)

1. Buka **Revisi DIPA** → lihat kartu NKRA S1/S2/tahun (tanpa ke Dashboard dulu).
2. Input pengesahan baru (tanggal, kode dari daftar, pagu sebelum/sesudah).
3. Baca pratinjau “dihitung / tidak” **sebelum simpan**.
4. Jika dihitung dan mendekati ambang 2, tunda/gabungkan usulan.
5. Filter “Hanya objek” untuk rapat KPA.
6. Dashboard tetap menampilkan kontribusi 10%, sinkron dengan halaman ini.

---

## 6. Backlog implementasi (urut kerjakan)

| ID | Item | Prioritas | Selesai jika |
|---|---|---|---|
| RD-01 | Filter objek: 14 kode + pagu tetap; exclude DIPA-AWAL | P0 | Contoh XYZ = 80 |
| RD-02 | Mapping `code` + `paguBefore/After` ke engine; `hasBudgetChange` benar | P0 | Field tidak mati |
| RD-03 | Kartu NKRA + kontribusi di halaman menu | P0 | Skor terlihat tanpa Dashboard |
| RD-04 | Badge objek/alasan di setiap baris tabel | P0 | Operator paham kenapa dihitung |
| RD-05 | Pratinjau eligibility di drawer simpan | P0 | Tidak “kaget” setelah simpan |
| RD-06 | Select 14 kode + multi-kode | P1 | Input tidak bebas-salah |
| RD-07 | Strip ambang 1 / 2 / ≥3 + CTA strategi | P1 | Frekuensi revisi terkendali |
| RD-08 | Edit revisi; validasi TA & pagu ≥ 0; tanggal WIB | P1 | Data bisa dikoreksi |
| RD-09 | Perbaiki `guides.ts`; drawer rumus | P1 | Panduan = engine |
| RD-10 | Filter S1/S2/objek; ringkasan kuota semester | P2 | Rapat KPA lebih cepat |
| RD-11 | Reminder triwulanan deep-link + hitungan objek | P2 | Review berkala jalan |
| RD-12 | Hapus fallback DIPA-AWAL sebagai hitungan; mutasi tanpa-DB jangan sukses palsu | P2 | Tidak menyesatkan uji |

---

## 7. Kriteria penerimaan (UAT satker)

Operator non-teknis dapat:

- Menjelaskan dalam satu kalimat revisi mana yang memengaruhi IKPA.
- Menyimpan revisi pagu naik dan melihat badge **tidak dihitung**.
- Menyimpan revisi kode 212 pagu tetap dan melihat NKRA berubah.
- Melihat nilai tahun = rata-rata S1 dan S2 tanpa kalkulator.
- Menghentikan usulan ke-3 di semester yang sama setelah baca strip kuning/merah.

Jika kelima hal itu gagal, menu belum layak dipakai pengambilan keputusan satker.
