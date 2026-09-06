# Perbaikan Menu Penyerapan Anggaran

**Untuk:** AI agent developer (perbaiki engine, mapping data, tes, UI)  
**Menu:** `/operator/penyerapan` + data `/operator/data/rpd-realization`  
**Sumber aturan:** materi IKPA penyerapan (bobot 20%), PDF contoh TW1 92,67 dan TW2 85,15  
**Bahasa UI:** Indonesia ringkas. Jangan tampilkan istilah YTD / Year to Date. Pakai **akumulatif** atau **sampai dengan triwulan**.

---

## 1. Tujuan perbaikan

Skor di kartu harus sama dengan rumus IKPA resmi:

1. Hitung per **jenis belanja** (51, 52, 53, 57).
2. Realisasi yang dibanding target adalah **jumlah dari Januari sampai akhir triwulan yang dinilai** (akumulatif), bukan hanya 3 bulan triwulan itu.
3. Nilai IKPA penyerapan = **rata-rata nilai kinerja triwulan 1 sampai triwulan berjalan**, bukan selalu dibagi 4.

Tanpa tiga hal ini, angka di aplikasi **bukan** IKPA penyerapan.

---

## 2. Istilah yang dipakai di layar (wajib)

| Jangan tulis | Tulis di UI |
|---|---|
| YTD | Akumulatif / sampai dengan triwulan |
| NKPAT | Nilai kinerja tertimbang |
| PA | Penyerapan vs target |
| Cap | Nilai maksimum 100 |
| Q1–Q4 | Triwulan 1–4 |
| Weighted | Bobot 20% |

Teks bantuan singkat di header/`?`:

> Skor dihitung **per triwulan**, dari realisasi **Januari sampai akhir triwulan**. Target sudah ditentukan per jenis belanja dan tidak bisa diubah. Nilai triwulan = rata-rata tertimbang pagu. Nilai indikator = rata-rata triwulan yang sudah lewat.

---

## 3. Rumus yang harus di-code (sumber kebenaran)

### 3.1 Target default (tidak bisa digeser)

Akumulatif (% dari pagu jenis belanja):

| Jenis belanja | Kode | TW1 | TW2 | TW3 | TW4 |
|---|---|---|---|---|---|
| Pegawai | 51 | 20 | 50 | 75 | 95 |
| Barang | 52 | 15 | 50 | 70 | 90 |
| Modal | 53 | 10 | 40 | 70 | 90 |
| Bansos | 57 | 25 | 50 | 75 | 95 |

Target rupiah TW n, jenis belanja x:

`target_rp = pagu_x_tw × (target_persen_x_tw / 100)`

### 3.2 Realisasi akumulatif

`realisasi_tw_n = jumlah realisasi bulan 1 sampai bulan akhir triwulan n`

- TW1: Jan–Mar  
- TW2: Jan–Jun  
- TW3: Jan–Sep  
- TW4: Jan–Des  

**Salah (hapus):** jumlah hanya 3 bulan triwulan itu (contoh TW2 = Apr+Mei+Jun saja).

### 3.3 Pagu per triwulan (cut-off DIPA)

Pagu yang dipakai **boleh berbeda per triwulan**:

| Triwulan | Pagu acuan |
|---|---|
| 1 | Pagu DIPA hari kerja ke-10 **Februari** |
| 2 | Pagu DIPA hari kerja ke-10 **April** |
| 3 | Pagu DIPA hari kerja ke-10 **Juli** |
| 4 | Pagu DIPA **akhir tahun** (penguncian = tanggal posting DIPA hasil revisi) |

Jangan pakai satu pagu tahunan yang sama untuk semua triwulan jika ada revisi.

Jika data cut-off belum ada di DB: simpan **pagu per triwulan per akun**. Operator/admin mengisi atau sistem mengambil snapshot pada tanggal cut-off. Dokumentasikan di UI: “Pagu triwulan ini mengikuti DIPA cut-off, bukan pagu hari ini.”

### 3.4 Penyerapan vs target (per jenis belanja)

```
pa_x = (realisasi_akumulatif_x / target_rp_x) × 100
jika pa_x > 100 → pa_x = 100
jika target_rp_x <= 0 atau pagu_x <= 0 → jenis belanja ini dilewati (tidak masuk tertimbang)
```

Kelebihan di atas target **hangus** (tidak menambah skor).

### 3.5 Proporsi pagu dan nilai tertimbang

```
proporsi_x = pagu_x / total_pagu_jenis_yang_dinilai
nilai_tertimbang_x = pa_x × proporsi_x
nilai_kinerja_tw = jumlah nilai_tertimbang_x   // 51+52+53+57 yang ada
```

Setara: `Σ (pa_x × pagu_x) / Σ pagu_x`

### 3.6 Nilai IKPA penyerapan (indikator)

`n` = triwulan penilaian (triwulan yang sudah jatuh tempo / dipilih pengguna).

```
ikpa_pa = (nilai_kinerja_tw1 + … + nilai_kinerja_tw_n) / n
```

- TW1: langsung = nilai kinerja TW1  
- TW2: (TW1 + TW2) / 2  
- TW3: (TW1 + TW2 + TW3) / 3  
- TW4: keempatnya / 4  

**Salah (hapus):** selalu dibagi 4, dengan triwulan depan bernilai 0. Itu menekan skor di tengah tahun.

Kontribusi ke IKPA total: `ikpa_pa × 20 / 100`.

Pembulatan: nilai per akun cukup 2–4 desimal konsisten; **nilai indikator 2 desimal**, half-up.

### 3.7 Satker BLU

Tidak dinilai untuk indikator ini. Tampilkan banner:

> Satker BLU tidak termasuk penilaian penyerapan anggaran.

Jangan menampilkan seolah skor kinerja 100 tanpa keterangan. Di laporan tulis **Dikecualikan**. Jika engine tetap butuh angka agar total 8 indikator jalan, boleh internal 100 + status `dikecualikan`, label UI **bukan** “skor 100”.

---

## 4. Tes emas (wajib lulus)

Angka dari materi. Realisasi = akumulatif sampai akhir triwulan.

### Tes A — Triwulan 1 = 92,67

Pagu: 51=250, 52=200, 53=50 (total 500). Tidak ada 57.  
Target %: 20 / 15 / 10 → target Rp 50 / 30 / 5.  
Realisasi akumulatif: 60 / 24,5 / 7.

| Langkah | 51 | 52 | 53 |
|---|---|---|---|
| PA | 60/50=120 → **100** | 24,5/30=**81,67** | 7/5=140 → **100** |
| Proporsi | 50% | 40% | 10% |
| Tertimbang | 50 | 32,67 | 10 |

Nilai kinerja TW1 = **92,67**. Nilai IKPA-PA TW1 = **92,67**.

### Tes B — Triwulan 2 = 85,15

Pagu TW2: 51=250, 52=250, 53=50 (total 550).  
Target %: 50 / 50 / 40 → target Rp 125 / 125 / 20.  
Realisasi akumulatif Jan–Jun: 164 / 63,5 / 22.

| Langkah | 51 | 52 | 53 |
|---|---|---|---|
| PA | 164/125=131,2 → **100** | 63,5/125=**50,8** | 22/20=110 → **100** |
| Proporsi | 45,45% | 45,45% | 9,09% |
| Tertimbang | 45,45 | 23,09 | 9,09 |

Nilai kinerja TW2 = **77,63**.  
IKPA-PA TW2 = (92,67 + 77,63) / 2 = **85,15**.

Bukan 77,63 sebagai skor indikator. Bukan (92,67+77,63+0+0)/4.

### Tes C — lain

- BLU: tidak dinilai + banner.  
- Pagu 0 pada satu akun: akun itu tidak tertimbang.  
- Realisasi 0, ada pagu: PA = 0.  
- Baru TW1 selesai: rata-rata **hanya TW1**, jangan masukkan TW2–4 = 0.

---

## 5. Perbaikan engine & data (developer)

File yang harus disentuh (sesuai peta kode saat ini):

- `packages/ikpa-engine/src/indicators/absorption.ts`
- `packages/ikpa-engine/src/schemas.ts` (pagu **per triwulan**, bukan satu pagu untuk semua TW)
- `packages/ikpa-engine/src/rule-set.ts` (target tetap; jangan rata-rata 4 TW kaku)
- `apps/web/src/server/simulation/calculate.ts` — agregasi realisasi **bulan 1 … akhir TW**, bukan Σ 3 bulan TW
- `apps/web/src/lib/simulation/penyerapan-workspace.ts` — sama
- Tes: `absorption.test.ts` + workspace test; tambah Tes A dan Tes B

Perilaku baru engine:

1. Input per TW: `{ quarter, realizedAkumulatif{51,52,53,57}, budget{51,52,53,57} }`.
2. `nValid` = jumlah triwulan **sampai periode penilaian**, bukan TW yang kebetulan punya pagu di masa depan.
3. Dashboard periode default harus memakai **triwulan dari bulan berjalan** (contoh September = TW3 → rata-rata 3 TW), bukan memaksa 4 TW dan bukan mengunci bulan 8 jika konteks satker sudah pindah bulan.
4. Realisasi negatif: **tolak** di form (minimal 0).
5. Unik DB `(tahun_anggaran, bulan, kode_akun)` agar server dan workspace tidak beda jumlah.

Pagu cut-off: jika belum ada tabel snapshot DIPA, minimal:

- field `pagu_tw1 … pagu_tw4` per akun, atau  
- `budgets` bertanggal + fungsi “ambil pagu pada cut-off TW”.

Jangan diam-diam pakai pagu terbaru untuk TW yang sudah lewat.

---

## 6. Perbaikan menu agar mudah dipakai

### 6.1 Satu alur yang jelas

1. Isi/ubah **realisasi per bulan** (data).  
2. Buka **Penyerapan** untuk lihat skor.  
3. (Opsional) Isi **rencana sisa tahun** hanya sebagai simulasi, dengan tombol **Simpan skenario** agar Dashboard ikut.

Tautan di tabel data: `Lihat skor penyerapan` (jangan campur kolom RPD sebagai “penyerapan %”).

### 6.2 Kartu atas (4 kartu, bahasa biasa)

| Kartu | Isi |
|---|---|
| Skor penyerapan | IKPA-PA sampai triwulan berjalan, 2 desimal, + “bobot 20%” |
| Skor aktual | Tanpa rencana sisa tahun |
| Dampak rencana | Selisih jika rencana sisa tahun dijalankan (simulasi) |
| Jarak ke 100 | `100 − skor` |

Di bawah skor: `Triwulan 2 dari 4 · rata-rata 2 triwulan`.

### 6.3 Tabel aktual (terkunci)

Kolom per jenis belanja:

- Pagu triwulan ini  
- Realisasi sampai dengan [akhir TW / bulan berjalan]  
- Target (Rp dan %)  
- Penyerapan vs target (PA, maks. 100)  
- Proporsi pagu  
- Nilai tertimbang  

Catatan di bawah tabel:

> Realisasi dihitung dari Januari sampai bulan ini. Target bersifat akumulatif. Nilai di atas 100 dihitung 100.

Tombol `Ubah realisasi` ke halaman data. Jangan edit pagu di sini.

### 6.4 Pilih triwulan vs kontrol bulanan

- **Skor resmi:** fokus triwulan (pilih TW1–TW berjalan).  
- **Kontrol:** boleh lihat per bulan agar Maret/Juni tidak kejut, dengan label: `Pemantauan bulanan (tidak mengubah rumus triwulan)`.

Hapus atau relabel kolom yang membagi realisasi dengan RPD. RPD **tidak** masuk skor penyerapan.

### 6.5 Rencana sisa tahun (sel kuning)

- Hanya bulan **setelah** bulan berjalan.  
- Label: `Rencana pencairan sisa tahun (simulasi)`.  
- `Reset rencana`.  
- **Simpan skenario** (wajib ditambah) supaya tidak hilang saat pindah Dashboard.  
- Desember: tidak ada rencana; skor = aktual.

### 6.6 Banner & kosong

- BLU: dikecualikan (teks di 3.7).  
- Belum ada pagu: `Isi pagu DIPA dulu agar skor bisa dihitung.` + tautan Pagu.  
- Belum ada realisasi: skor 0 dengan status **data belum lengkap**, bukan seolah penilaian selesai.

### 6.7 Bantuan strategi (satu panel ringkas)

Bukan teori panjang. Tiga poin:

1. Jangan tumpuk pencairan di akhir tahun; **triwulan 2 paling berat** untuk pegawai dan barang.  
2. Percepat belanja **barang dan modal** serta pengadaan dari awal tahun.  
3. Cairkan **sebanding per bulan** sesuai rencana kegiatan dan rencana penarikan dana.

Tampilkan sisa kebutuhan vs target triwulan berjalan, contoh:

> Belanja barang: realisasi 63,5 dari target 125. Kurang **61,5** sampai akhir triwulan 2.

### 6.8 Target di dialog `?`

Tampilkan tabel target 51/52/53/57. Teks: `Target ini sudah ditentukan, tidak bisa diubah.`

---

## 7. Yang tidak perlu diubah

- Bobot 20%.  
- Empat kode akun 51/52/53/57.  
- Cap 100 per jenis belanja.  
- Rata-rata antar triwulan **tanpa** bobot berbeda (TW1 sama pentingnya dengan TW2 saat dirata-rata).  
- CRUD realisasi berbagi halaman dengan RPD (RPD tetap untuk indikator lain).

---

## 8. Kriteria selesai

- [ ] Tes A 92,67 dan Tes B 85,15 lulus di engine dan workspace  
- [ ] Realisasi triwulan n = jumlah Januari–akhir TW n  
- [ ] IKPA-PA = rata-rata TW 1…n, n = triwulan penilaian  
- [ ] Pagu bisa berbeda per TW (cut-off)  
- [ ] UI tanpa istilah YTD; pakai akumulatif / sampai dengan  
- [ ] Kolom RPD tidak disamarkan sebagai penyerapan  
- [ ] BLU berlabel dikecualikan  
- [ ] Rencana simulasi bisa disimpan  
- [ ] Dashboard memakai triwulan yang sama dengan workspace  

---

## 9. Urutan kerjakan

1. Perbaiki agregasi realisasi akumulatif + rata-rata 1…n + tes emas.  
2. Pagu per triwulan / cut-off.  
3. Copy UI, tabel, banner, hilangkan kolom menyesatkan.  
4. Simpan skenario + sinkron periode Dashboard.  
5. Panel sisa ke target + tiga strategi.

Kerjakan (1) dulu. Jangan rilis skor ke pengguna sebelum tes A dan B hijau.
