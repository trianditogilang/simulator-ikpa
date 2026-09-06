# Perbaikan Menu Deviasi Halaman III DIPA

**Indikator:** Deviasi Halaman III DIPA  
**Bobot:** 15% dari IKPA  
**Rute data:** `/operator/data/rpd-realization`  
**Rute skor:** `/operator/deviasi`  
**Sumber aturan:** PDF Deviasi Hal III + ketentuan 2026 (deviasi tertimbang per jenis belanja)  
**Prioritas:** kerjakan **DH-01 s.d. DH-05** dulu. Tanpa pembagi *n* yang benar, kartu skor menyesatkan.

---

## 1. Yang harus dipahami operator (copy UI)

Tulis di header halaman data **dan** workspace, bahasa non-teknis:

> Indikator ini mengukur apakah realisasi bulanan sesuai RPD Halaman III DIPA. Dihitung **per jenis belanja** (51, 52, 53, 57), lalu **ditimbang** dengan proporsi pagu. Periode **Januari–November**. Desember **tidak** masuk skor. Rata-rata deviasi **0–5%** = nilai **100**. Di atas 5% = **100 − rata-rata** (contoh 6% → 94). Deviasi tiap akun dibatasi **100%**.

Tiga langkah operator:

1. Isi **pagu** per jenis belanja (sumber bobot).
2. Isi **RPD** dan **realisasi** per bulan per akun.
3. Lihat **berapa objek bulan** yang sudah dihitung (*n*), rata-rata tertimbang, dan nilai IKPA — tanpa pindah halaman.

---

## 2. Aturan hitung yang wajib (engine)

### 2.1 Deviasi per jenis belanja (bulanan)

\[
\text{DevDIPA}_{akun} = \min\left(100,\ \left|\frac{\text{Realisasi}-\text{RPD}}{\text{RPD}}\right|\times 100\right)
\]

Kasus khusus (ikuti PDF + narasi 2026):

| RPD | Realisasi | Deviasi |
|---|---|---|
| 0 | 0 | **0%** (tidak ada rencana, tidak ada belanja) |
| 0 | > 0 | **100%** (belanja tanpa rencana — cap) |
| > 0 | apa pun | rumus di atas, cap 100% |

Tolak nilai negatif di form. Jangan diam-diam jadi 0.

### 2.2 Deviasi tertimbang

\[
\text{DevTertimbang}_{akun} = \text{DevDIPA}_{akun} \times \frac{\text{Pagu akun}}{\text{Total pagu 51+52+53+57}}
\]

\[
\text{Deviasi bulan} = \sum_{akun} \text{DevTertimbang}_{akun}
\]

Akun pagu 0 → bobot 0 (tidak menggeser skor).

### 2.3 Rata-rata dan nilai IKPA

Pembagi **n = bulan penilaian berjalan**, minimum 1, maksimum 11 (Jan–Nov). **Jangan** membagi 11 jika baru Januari.

\[
\text{Rata-rata} = \frac{\sum_{i=1}^{n} \text{Deviasi bulan}_i}{n}
\]

\[
\text{Nilai} =
\begin{cases}
100 & \text{jika rata-rata } \le 5 \\
\max(0,\ 100 - \text{rata-rata}) & \text{jika rata-rata } > 5
\end{cases}
\]

Kontribusi IKPA = Nilai × 15%.

### 2.4 Golden test (wajib lulus)

**Januari (contoh PDF / narasi):** pagu 50% / 40% / 10%; Dev 0, 10, 0 → bulan = 4%. *n*=1 → rata-rata 4 ≤ 5 → **nilai 100**.

**Februari (narasi):** bulan = 13%. Σ = 4+13=17. *n*=2 → 8,5 → **nilai 91,5**.

**Maret (narasi):** bulan = 18%. Σ=35. *n*=3 → 11,67 → **nilai 88,33**.

**Mei (PDF Satker XYZ):** Σ lima bulan / 5 = 8,21 → **nilai 91,79**. Proporsi pagu Mei **boleh berbeda** dari Januari (45,45 / 45,45 / 9,09).

**Bukan golden:** memasukkan 8 bulan kosong lalu bagi 11. Itu **salah**.

---

## 3. Perbaikan engine (P0)

| ID | Perubahan | Mengapa |
|---|---|---|
| **DH-01** | `avg = Σ monthDev / n` dengan *n* = bulan 1…periode (maks 11), **bukan** selalu 11 | PDF: Jan bagi 1, Mei bagi 5 |
| **DH-02** | Jangan isi 11 bulan nol di `calculate.ts` untuk “melengkapi” input | Bulan kosong menekan rata-rata secara palsu |
| **DH-03** | Samakan `deviationOf` di workspace, tabel data, dan engine (termasuk RPD=0) | Tabel sekarang menampilkan 0 padahal engine 100 |
| **DH-04** | Bobot pagu **per periode kunci**, bukan satu pagu tahunan kaku | PDF Mei mengubah proporsi setelah revisi |
| **DH-05** | Tes emas Jan 100, Feb 91,5, Mar 88,33, Mei 91,79 | Cegah regresi |

Detail DH-01:

- Jika konteks bulan = 3, *n*=3 (Jan–Mar), Desember tidak pernah masuk.
- Bulan tanpa RPD **dan** tanpa realisasi: tetap masuk *n* dengan deviasi 0 **hanya jika** bulan itu sudah lewat (periode penilaian). Jangan menghitung bulan masa depan sebagai 0 “sempurna”.
- Workspace: skor **aktual** memakai *n* = bulan berjalan; skor **rencana** boleh memakai *n* sampai bulan rencana (maks 11).

Detail DH-04 (penguncian):

- Simpan **tanggal posting DIPA revisi** (atau tanggal kunci manual jika data SPAN belum ada).
- Proporsi pagu yang dipakai bulan *m* = pagu terkunci pada posting terakhir **sebelum/pada** akhir bulan *m*.
- RPD Hal III terkunci dengan aturan yang sama. Edit RPD setelah kunci = versi baru, tidak mengubah bulan yang sudah terkunci kecuali admin buka kunci.

---

## 4. Perbaikan menu agar mudah dipakai

### 4.1 Satu layar, dua zona (halaman data)

Pisahkan yang sering tertukar:

**Zona A — Input bulan ini**  
Pills **Jan–Nov** untuk skor; pill Desember berlabel `Des · tidak dihitung skor (untuk Penyerapan)`.  
Tabel 4 akun: RPD | Realisasi | Deviasi % | Bobot pagu | Deviasi tertimbang | status.

Status pakai ambang indikator, bukan 5/10 sembarang:

- Deviasi tertimbang bulan / rata-rata ≤ 5% → hijau “aman (nilai 100 bila rata-rata tetap ≤5)”
- > 5% → kuning/merah “menggerus nilai”

**Zona B — Kartu skor (selalu terlihat, sticky)**

| Kartu | Isi |
|---|---|
| Nilai indikator | 0–100, rumus 100−avg atau 100 |
| Rata-rata deviasi | angka + *n* bulan |
| Deviasi bulan ini | jumlah tertimbang 51+52+53+57 |
| Sisa ruang ke 5% | “Rata-rata masih 3,2%. Boleh naik 1,8 poin sebelum nilai turun.” |
| Kontribusi IKPA | nilai × 15% |

Tanpa kartu ini, operator harus ke `/operator/deviasi` hanya untuk tahu lulus atau tidak.

### 4.2 Pratinjau sebelum simpan

Di drawer RPD / Realisasi, **sebelum** simpan tampilkan:

- Deviasi akun ini (baru)
- Deviasi tertimbang akun
- Deviasi bulan (baru)
- Rata-rata *n* bulan (baru)
- Nilai IKPA lama → baru

Contoh: `Nilai 100 → 91,5 (rata-rata 4% → 8,5%, n=2)`. Tombol Simpan nonaktif jika angka tidak valid.

### 4.3 Tabel jejak seperti materi pelatihan

Tambah accordion **“Cara angka ini dihitung”** untuk bulan terpilih, kolom persis ilustrasi:

Bulan | RPD 51/52/53/57 | Real 51/52/53/57 | Proporsi pagu | Deviasi | Deviasi tertimbang | Jumlah bulan | Rata-rata kumulatif | Nilai IKPA

Isi otomatis. Ini mengganti dialog `?` yang hanya teks rumus.

### 4.4 Workspace simulasi (`/operator/deviasi`)

Pertahankan aktual terkunci + sel kuning sisa tahun, plus:

- Label *n* aktual vs *n* rencana.
- Strip: “Rencana kuning **tidak** tersimpan ke Dashboard sampai Anda tekan **Simpan rencana**.”
- Tombol **Simpan rencana** (baru) → snapshot terpisah, atau salin ke RPD bulan depan dengan konfirmasi.
- Samakan periode dengan Dashboard (jangan hardcode bulan 8).
- Satu rumus di `?`: sebutkan pembagi *n*, bukan “÷11 bulan”.

### 4.5 Reminder pemutakhiran RPD

Seed policy + strip di halaman:

| Triwulan | Update RPD paling lambat | Strip |
|---|---|---|
| I | Hari kerja ke-10 **Februari** | “Perbarui RPD TW1 sebelum H+10 Februari.” |
| II | Hari kerja ke-10 **April** | sama |
| III | Hari kerja ke-10 **Juli** | sama |
| IV | Hari kerja ke-10 **Oktober** | sama |

Tampil H-10, H-3, dan H-1…20 sesuai PRD. Deep-link ke pills bulan terkait.

### 4.6 Copy yang harus diganti

| Lokasi | Jangan | Ganti |
|---|---|---|
| Tabel data | RPD=0 → tampil 0% | Sama dengan engine (100% jika ada realisasi) |
| Dialog workspace | “÷11 bulan” | “dibagi jumlah bulan Jan–bulan berjalan (maks Nov)” |
| `guides.ts` g-02 | kurva samar | tabel 0–5% = 100; >5% = 100−avg |
| Link “Lihat skor Penyerapan” | dari halaman RPD | “Lihat skor Deviasi Hal III” ke `/operator/deviasi` |
| Warning pagu 0 | bahasa Inggris | “Pagu jenis belanja belum diisi. Bobot belum bisa dihitung.” |
| Dashboard | Estimasi 0 saat incomplete | “Belum bisa dihitung — isi pagu + RPD/realisasi s.d. bulan *n*” |

---

## 5. Strategi satker di dalam menu (bukan hanya materi)

Tampilkan **panel “Cara jaga nilai 100”** di bawah kartu:

1. Halaman III DIPA = alat kendali KPA, bukan formalitas. Cocokkan kegiatan unit dengan RPD.
2. Manfaatkan **pemutakhiran tiap triwulan** (Feb/Apr/Jul/Okt) sebelum kunci.
3. Jaga deviasi tertimbang bulanan agar **rata-rata kumulatif ≤ 5%**.
4. Jika satu bulan jelek (contoh Maret 18%), bulan berikutnya harus kecil agar rata-rata turun — tunjukkan **target deviasi bulan depan** agar rata-rata kembali ≤5%.

Contoh bantuan: “Rata-rata sekarang 11,67 (*n*=3). Agar nilai 100 di Juni (*n*=6), jumlah 3 bulan ke depan maksimal 18,33% atau rata-rata **6,11% per bulan** — masih di atas 5%, jadi nilai 100 di Juni **tidak mungkin**; target realistis tampilkan nilai proyeksi.”

---

## 6. Backlog

| ID | Item | Prioritas | Penerima manfaat |
|---|---|---|---|
| DH-01 | Pembagi *n* bulan berjalan | P0 | Angka benar |
| DH-02 | Jangan pad 11 bulan nol | P0 | Angka benar |
| DH-03 | Samakan rumus UI = engine | P0 | Operator tidak tertipu badge |
| DH-04 | Kunci pagu/RPD per posting DIPA | P0 | Sesuai PDF 2026 |
| DH-05 | Golden test Jan/Feb/Mar/Mei | P0 | QA |
| DH-06 | Kartu skor + *n* + sisa ruang 5% di halaman data | P0 | Mudah dipakai |
| DH-07 | Pratinjau sebelum simpan | P0 | Keputusan sadar |
| DH-08 | Tabel jejak per akun seperti slide | P1 | Transparansi |
| DH-09 | Pill Des berlabel; tolak negatif | P1 | Cegah salah isi |
| DH-10 | Reminder H+10 Feb/Apr/Jul/Okt | P1 | Strategi triwulan |
| DH-11 | Target bulan depan agar rata-rata turun | P1 | Kejar nilai |
| DH-12 | Simpan rencana workspace + selaraskan periode Dashboard | P1 | Simulasi tidak hilang |
| DH-13 | Warning pagu 0 bahasa Indonesia; kosong ≠ 100 tanpa konfirmasi | P1 | Kejujuran data |
| DH-14 | Pagu Netto vs blokir (catatan di kartu bobot) | P2 | Audit |

---

## 7. Kriteria UAT (lulus bila operator bisa)

1. Isi hanya Januari sesuai contoh → nilai **100**, *n*=1, rata-rata **4** — bukan ~0,36.
2. Tambah Februari 13% → nilai **91,5**.
3. Tambah Maret 18% → nilai **88,33**.
4. Ubah pagu (simulasi revisi Mei) → bobot bulan Mei berubah, bulan Jan tetap memakai bobot lama jika kunci aktif.
5. RPD 53 = 0, Real 53 = 2 → baris tabel **100%**, bukan 0%.
6. Isi Desember → banner “tidak masuk skor Deviasi”; skor tidak berubah.
7. Rata-rata 6% → nilai **94** (bukan 0, bukan 80).
8. Drawer menampilkan nilai lama → baru sebelum simpan.
9. Strip reminder muncul di pekan update RPD triwulan.
10. Dashboard dan workspace menampilkan **nilai yang sama** untuk bulan konteks yang sama.

---

## 8. Urutan kerjakan

1. Engine DH-01, DH-02, DH-03, DH-05 (angka benar).
2. Kartu + pratinjau + copy DH-06, DH-07, DH-09 (menu bisa dipakai).
3. Kunci pagu DH-04.
4. Reminder + target kejar + simpan rencana DH-10 s.d. DH-12.

Selesai langkah 1–2, satker sudah bisa memakai menu sebagai alat kendali, bukan hanya CRUD RPD.
