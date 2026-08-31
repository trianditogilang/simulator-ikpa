# UI/UX Design System & Product Design Rules

**Produk:** Simulator Penilaian IKPA Satker  
**Basis:** PRD Final v1.3, FSD MVP v1.0, TSD MVP v1.0, dan ERD MVP v1.0  
**Versi:** 1.0  
**Tanggal:** 31 Agustus 2026  
**Status:** Referensi wajib untuk UI/UX Designer Agent dan Frontend Agent

> Dokumen ini menjadi sumber desain lintas dokumen untuk semua keputusan visual, interaksi, responsivitas, dan penggunaan komponen pada Simulator IKPA. Dokumen ini tidak menggantikan kebutuhan fungsional pada PRD/FSD/TSD; dokumen ini menerjemahkan kebutuhan tersebut menjadi aturan desain yang konsisten.

---

## 1. Posisi Dokumen

### 1.1 Rekomendasi utama

Saran desain sebaiknya **tidak ditempel seluruhnya ke PRD, FSD, TSD, atau ERD** karena aturan tersebut berlaku lintas halaman dan akan menjadi terlalu sulit dirawat bila tersebar.

Gunakan dokumen terpisah ini sebagai **UI/UX Design System & Product Design Rules**. Saat pengembangan dengan AI agent, jadikan dokumen ini referensi wajib bersama PRD, FSD, TSD, dan ERD.

Urutan referensi yang direkomendasikan:

1. **PRD Final v1.3** — tujuan produk, batas scope, akses, dan kebutuhan tingkat produk.
2. **FSD MVP v1.0** — halaman, menu, perilaku pengguna, dan acceptance criteria fungsional.
3. **TSD MVP v1.0** — arsitektur, route, komponen teknis, keamanan, dan implementasi frontend/backend.
4. **ERD MVP v1.0** — model data, relasi, constraint, dan sumber data antarmuka.
5. **UI/UX Design System & Product Design Rules ini** — arah visual, komponen, responsivitas, pola UX, dan design token.

### 1.2 Penempatan ringkas pada dokumen lain

Tambahkan hanya rujukan singkat berikut pada dokumen yang sudah ada:

- **PRD bagian 7 Tech Stack:** tambahkan `Design System: Inter + Tailwind CSS + shadcn/ui + lucide-react; referensi UI/UX Design System & Product Design Rules v1.0.`
- **FSD bagian halaman/UI:** tambahkan `Semua halaman mengikuti UI/UX Design System & Product Design Rules v1.0.`
- **TSD bagian UI/State:** tambahkan `Implementasi token, komponen, aksesibilitas, dan pola responsif mengacu pada UI/UX Design System & Product Design Rules v1.0.`
- **ERD:** tidak perlu ditambahkan karena ERD tidak memuat aturan visual.

---

## 2. Prinsip Desain

### 2.1 Arah desain

UI terinspirasi dari karakter **MyIntress**: tampilan dashboard profesional yang bersih, mudah dipindai, terasa ringan, menggunakan whitespace cukup, kartu informatif, hierarki kuat, serta tindakan penting yang jelas tanpa visual berlebihan.

Inspirasi tersebut adalah arah estetika dan pengalaman, bukan instruksi menyalin layout, logo, aset, konten, atau identitas visual produk lain.

### 2.2 Prinsip utama

- **Clean:** Hindari kepadatan visual, elemen dekoratif yang tidak membantu tugas, dan tabel/form yang terlalu padat.
- **Modern:** Gunakan komponen konsisten, state interaktif jelas, spacing lega, bentuk sederhana, serta umpan balik instan.
- **Minimalis:** Satu tujuan utama per halaman, CTA dominan terbatas, dan informasi sekunder ditempatkan progresif.
- **Responsive:** Semua fungsi utama tersedia dari layar kecil sampai desktop.
- **Mobile first:** Desain dimulai dari lebar layar mobile; desktop menambah ruang dan densitas secara bertahap.
- **Clarity over decoration:** Prioritaskan keterbacaan nilai IKPA, risiko, deadline, dan aksi yang perlu dilakukan.
- **Trust and auditability:** Selalu tampilkan periode, satker, waktu data diperbarui, status kelengkapan, dan versi rule set pada konteks yang relevan.
- **Actionable by default:** Risiko harus diikuti tindakan, pemilik tindakan, deadline, atau tautan menuju input yang relevan.
- **Progressive disclosure:** Detail formula, audit, parameter, dan data mentah tidak memenuhi layar awal; tampilkan melalui drawer, dialog, tab, atau halaman detail.

### 2.3 Prinsip untuk aplikasi pemerintahan/keuangan

- Gunakan bahasa Indonesia yang jelas, singkat, dan formal namun tidak birokratis.
- Nominal Rupiah, tanggal, periode, dan satuan hari kerja harus mudah dibedakan.
- Jangan memakai warna sebagai satu-satunya penanda status; tambahkan teks, ikon, badge, atau pola.
- Nilai simulasi harus selalu memiliki disclaimer yang terlihat, terutama pada dashboard, detail skor, dan laporan.
- Jangan menyembunyikan data incomplete. Tampilkan sebagai status yang jelas beserta CTA perbaikan.

---

## 3. Branding dan Token Visual

### 3.1 Identitas visual

| Elemen | Ketentuan |
|---|---|
| Latar belakang utama | Putih dan off-white sangat ringan |
| Warna utama | Biru tua untuk CTA, tombol utama, link penting, dan status informasi utama |
| Warna netral | Slate/gray untuk teks sekunder, border, area latar, tabel, dan state disabled |
| Font | Inter |
| Ikon | `lucide-react` |
| Component library | `shadcn/ui` dengan Radix UI primitives |
| Gaya permukaan | Kartu putih, border halus, radius sedang, shadow lembut dan minim |
| Ilustrasi | Opsional dan terbatas pada landing/empty state; tidak dipakai sebagai dekorasi pada layar kerja padat |

### 3.2 Palet warna awal

Palet berikut menjadi token awal dan dapat disesuaikan saat brand identity final tersedia.

| Token | Nilai awal | Penggunaan |
|---|---|---|
| `--background` | `#FFFFFF` | Latar utama |
| `--surface` | `#F8FAFC` | Latar section, card group, panel ringan |
| `--surface-muted` | `#F1F5F9` | Tabel header, selected ringan, skeleton |
| `--foreground` | `#0F172A` | Teks utama slate-900 |
| `--muted-foreground` | `#64748B` | Teks sekunder slate-500 |
| `--border` | `#E2E8F0` | Border slate-200 |
| `--primary` | `#1E3A8A` | Biru tua utama, CTA, navigasi aktif |
| `--primary-hover` | `#172554` | Hover/focus CTA |
| `--primary-foreground` | `#FFFFFF` | Teks/icon di atas primary |
| `--info` | `#2563EB` | Informasi, link, status proses |
| `--success` | `#15803D` | Sukses, aman, target tercapai |
| `--warning` | `#B45309` | Perlu perhatian, mendekati deadline |
| `--danger` | `#B91C1C` | Risiko tinggi, gagal, terlambat |
| `--danger-surface` | `#FEF2F2` | Latar alert bahaya |
| `--warning-surface` | `#FFFBEB` | Latar alert peringatan |
| `--success-surface` | `#F0FDF4` | Latar status sukses |
| `--info-surface` | `#EFF6FF` | Latar status informasi |

### 3.3 Status semantik

| Status | Warna | Ikon Lucide contoh | Label UI |
|---|---|---|---|
| Aman / lengkap | Success | `CircleCheck` | Aman / Lengkap |
| Perlu perhatian | Warning | `TriangleAlert` | Perlu perhatian |
| Risiko tinggi / terlambat | Danger | `CircleAlert` | Risiko tinggi / Terlambat |
| Informasi / proses | Info | `Info`, `LoaderCircle` | Informasi / Diproses |
| Belum lengkap | Slate | `CircleDashed` | Data belum lengkap |
| Terkunci policy | Primary/Slate | `LockKeyhole` | Dikunci oleh policy |

### 3.4 Tipografi

| Token | Inter | Ukuran mobile | Ukuran desktop | Penggunaan |
|---|---|---:|---:|---|
| Display | 700 | 28 px | 36 px | Hero landing page |
| H1 | 700 | 24 px | 30 px | Judul halaman utama |
| H2 | 700 | 20 px | 24 px | Judul section |
| H3 | 600 | 16 px | 18 px | Judul kartu/panel |
| Body | 400 | 14 px | 14–16 px | Isi umum |
| Body small | 400 | 12 px | 12–13 px | Metadata, helper text |
| Label | 500–600 | 12–14 px | 12–14 px | Form, badge, tabel |
| Numeric score | 700 | 28–32 px | 32–40 px | Nilai IKPA/kartu KPI |

Aturan tipografi:

- Gunakan `font-feature-settings: 'tnum' 1` untuk angka tabel, nilai, tanggal, dan nominal agar sejajar.
- Gunakan format `id-ID` untuk angka dan Rupiah.
- Jangan menggunakan ukuran teks kurang dari 12 px untuk informasi penting.
- Batasi panjang line body text sekitar 60–75 karakter pada desktop untuk keterbacaan.

### 3.5 Spacing, radius, dan shadow

| Token | Nilai |
|---|---:|
| Spacing base | 4 px |
| Padding kartu mobile | 16 px |
| Padding kartu desktop | 20–24 px |
| Gap section mobile | 24 px |
| Gap section desktop | 32 px |
| Radius kecil | 6 px |
| Radius standar | 8 px |
| Radius besar | 12 px |
| Shadow kartu default | Border halus tanpa shadow atau `shadow-sm` sangat lembut |
| Tinggi tombol standar | 40 px |
| Tinggi tombol kecil | 32 px |
| Tinggi input standar | 40 px |
| Target sentuh minimum | 44 × 44 px pada mobile |

---

## 4. Layout dan Responsivitas

### 4.1 Breakpoint

| Breakpoint | Lebar | Pola utama |
|---|---:|---|
| Mobile | `<640px` | Satu kolom, bottom navigation untuk tugas utama, filter dalam sheet, tabel menjadi kartu/scroll horizontal terkontrol |
| Tablet | `640–1023px` | Dua kolom selektif, sidebar dapat collapse, grid kartu 2 kolom |
| Desktop | `≥1024px` | Sidebar tetap, header konteks, grid 3–4 kolom, tabel penuh, panel detail/drawer |
| Large desktop | `≥1280px` | Konten maksimal 1440 px, panel analisis dapat dua/ tiga kolom |

### 4.2 Layout aplikasi

#### Public layout

- Header sederhana: logo/nama produk di kiri, tombol Login di kanan.
- Lebar konten maksimal 1200 px pada desktop.
- Hero tidak boleh lebih tinggi dari satu viewport pada desktop.
- CTA primer hanya satu: **Masuk ke Simulator**.

#### Operator layout

- Desktop: sidebar kiri tetap lebar sekitar 256 px; top bar berisi nama satker, tahun/periode aktif, notifikasi, dan profil pengguna.
- Mobile: sidebar diganti menu sheet; gunakan bottom navigation untuk maksimal lima tujuan utama: Dashboard, Simulasi, Input, Reminder, Lainnya.
- Konteks satker dan periode harus selalu mudah terlihat di header.

#### Admin KPPN layout

- Desktop: sidebar kiri tetap; top bar menunjukkan KPPN scope dan filter periode.
- Mobile: sidebar menjadi sheet; dashboard monitoring memprioritaskan satker berisiko, deadline, dan shortcut Admin Policy.
- Label `Admin KPPN` harus jelas di area header agar pengguna memahami mode akses aktif.

### 4.3 Grid halaman

| Halaman | Mobile | Desktop |
|---|---|---|
| Dashboard Operator | 1 kolom; kartu score di atas | Grid 12 kolom; score/ringkasan 4–8 kolom sesuai kebutuhan |
| Dashboard Admin | 1 kolom; risiko prioritas di atas | Grid 12 kolom; overview, tren, risiko, dan tabel satker |
| Input data | Form berurutan; tabel scroll horizontal | Form/tabel dua panel bila membantu |
| Simulasi | Hasil ringkas sticky di bawah/atas | Panel input 7 kolom, hasil dan rekomendasi 5 kolom sticky |
| Reminder Center | List card; filter sheet | Tabel/list + detail drawer atau panel kanan |
| Admin Policy | List policy + drawer editor | List 4 kolom + editor/detail 8 kolom |

### 4.4 Aturan responsif tabel

- Jangan memaksa tabel lebar masuk seluruhnya pada mobile.
- Pada mobile, prioritaskan 2–3 kolom utama lalu tampilkan detail melalui drawer/detail row.
- Alternatif: ubah baris menjadi card list dengan label-value yang jelas.
- Horizontal scrolling boleh untuk data grid input, tetapi header dan indikator arah scroll harus jelas.
- Kolom aksi selalu tersedia dan tidak boleh tersembunyi tanpa affordance.

---

## 5. Sistem Komponen

### 5.1 Fondasi shadcn/ui

Gunakan shadcn/ui sebagai fondasi, dengan pengaturan token Tailwind/CSS variables agar konsisten. Jangan membuat komponen custom bila shadcn/ui sudah menyediakan primitive yang sesuai.

| Kebutuhan | Komponen utama |
|---|---|
| Navigasi | `Sidebar`, `NavigationMenu`, `Breadcrumb`, `Tabs`, `Sheet` |
| Input | `Input`, `Select`, `Combobox`, `Textarea`, `Checkbox`, `Switch`, `RadioGroup`, `DatePicker` |
| Data | `Table`, `DataTable`, `Pagination`, `Badge`, `Tooltip`, `HoverCard` |
| Aksi | `Button`, `DropdownMenu`, `AlertDialog`, `Dialog`, `Popover` |
| Informasi | `Card`, `Alert`, `Skeleton`, `Progress`, `Separator`, `Sonner/Toast` |
| Detail | `Drawer`, `Sheet`, `Accordion`, `ScrollArea` |
| Visualisasi | Wrapper Recharts yang mengikuti token warna dan tooltip konsisten |

### 5.2 Button

| Variant | Penggunaan | Contoh label |
|---|---|---|
| Primary | Satu aksi utama halaman | Simpan simulasi, Tambah data, Publikasikan rule set |
| Secondary | Aksi penting pendamping | Impor data, Bandingkan skenario |
| Outline | Aksi netral | Atur filter, Lihat detail |
| Ghost | Aksi minor | Batal, Lihat formula |
| Destructive | Aksi berisiko | Hapus, Nonaktifkan akses, Retire rule set |
| Link | Navigasi kontekstual | Buka data tagihan |

Aturan:

- Maksimal satu tombol primary yang dominan per section/viewport.
- Aksi berisiko memakai `AlertDialog`, bukan toast sebagai satu-satunya konfirmasi.
- Tombol disabled selalu memiliki helper text bila alasan tidak jelas.
- Jangan hanya memakai ikon untuk aksi kritis tanpa tooltip dan accessible label.

### 5.3 Form

- Label selalu berada di atas field pada mobile dan desktop.
- Tampilkan helper text untuk format/ketentuan kompleks.
- Validasi inline setelah field disentuh atau saat submit; jangan hanya menampilkan error di toast.
- Angka Rupiah menggunakan input yang memformat tampilan `Rp` dan pemisah ribuan, sementara nilai mentah tetap valid untuk backend.
- Tanggal memakai date picker yang mendukung input keyboard serta format Indonesia.
- Field yang dikunci policy memakai state disabled/read-only, ikon `LockKeyhole`, dan alasan policy.
- Form panjang dibagi berdasarkan section dengan heading; gunakan sticky action bar pada mobile bila form sangat panjang.

### 5.4 Kartu KPI dan indikator

Setiap kartu indikator minimal memuat:

- Nama indikator.
- Nilai indikator.
- Bobot dan kontribusi berbobot.
- Status semantic badge.
- Perubahan dibanding snapshot sebelumnya bila tersedia.
- Link/aksi ke detail atau input terkait.

Kartu nilai IKPA utama memuat:

- Nilai IKPA.
- Target dan gap.
- Status data: lengkap/estimasi/belum lengkap.
- Periode dan `rule_set_version`.
- Disclaimer ringkas: “Simulasi internal, bukan nilai resmi.”

### 5.5 Badge

| Badge | Variant | Contoh |
|---|---|---|
| Status nilai | Success/warning/danger/slate | Aman, Perlu perhatian, Risiko tinggi, Belum lengkap |
| Rule set | Outline/secondary | Rule set 2026.1 |
| Reminder category | Primary/slate | Mandatory, Recommended, Optional |
| Delivery | Success/warning/danger/slate | Terkirim, Dijadwalkan, Gagal, Dilewati |
| Akses | Primary/secondary | Operator Satker, Admin KPPN |

### 5.6 Tabel dan daftar data

- Header tabel sticky untuk halaman tabel panjang di desktop.
- Kolom nominal, angka, dan tanggal harus konsisten alignment-nya: angka/nominal kanan, teks kiri, status tengah bila relevan.
- Tabel selalu memiliki state: loading, empty, no result, error.
- Filter aktif harus tampil sebagai chip yang dapat dihapus.
- Aksi baris menggunakan dropdown menu; aksi utama yang sering dapat tampil langsung jika ruang cukup.
- Jangan mengandalkan warna saja untuk menandai risiko; gunakan badge dan ikon.

### 5.7 Dialog, drawer, dan sheet

| Komponen | Gunakan untuk |
|---|---|
| `Dialog` | Konfirmasi tindakan, form pendek, detail ringkas |
| `Sheet` | Navigasi/filter mobile, form medium, detail panel desktop/mobile |
| `Drawer` | Detail data dari bawah pada mobile, terutama untuk tabel/card list |
| `AlertDialog` | Hapus, nonaktifkan akses, publish/retire rule set, commit import |

### 5.8 Toast dan alert

- Gunakan toast untuk keberhasilan aksi, status proses singkat, atau error sementara.
- Gunakan alert inline untuk kondisi yang memengaruhi pemahaman halaman: data incomplete, rule set lama, policy lock, atau proses yang gagal.
- Jangan gunakan toast sebagai satu-satunya pemberitahuan error validasi form.

---

## 6. Pola UX Inti

### 6.1 Konteks global

Setiap halaman kerja harus memiliki konteks yang jelas:

- Nama satker atau KPPN scope.
- Tahun anggaran.
- Periode penilaian.
- Rule set version bila relevan.
- Status data terakhir diperbarui bila tersedia.

Pada mobile, konteks dapat ditempatkan dalam bar ringkas atau filter sheet, tetapi tahun/periode aktif tidak boleh hilang dari pengguna.

### 6.2 Dashboard Operator Satker

Urutan informasi yang direkomendasikan:

1. Nilai IKPA, target, gap, status data, dan periode.
2. Deadline paling dekat dan tindakan yang perlu dilakukan hari ini.
3. Tujuh indikator serta pengurang dispensasi.
4. Lima rekomendasi prioritas.
5. Grafik tren dan komposisi kontribusi.
6. Kelengkapan data serta link input.

Pola status:

- **Lengkap:** nilai dapat dibaca sebagai simulasi dengan data cukup.
- **Estimasi:** beberapa input belum lengkap; tampilkan dampaknya dan CTA memperbaiki data.
- **Berisiko:** deadline atau gap kritis; tampilkan tindakan utama di atas fold.

### 6.3 Input data

- Gunakan progressive disclosure: grid ringkas → tambah/edit via dialog/drawer bila data tidak cocok diedit langsung.
- Untuk input rutin bulanan seperti RPD/realisasi dan KKP, gunakan spreadsheet-like grid dengan keyboard navigation bila memungkinkan.
- Selalu sediakan tombol **Simpan perubahan** yang terlihat, status perubahan belum tersimpan, serta indikator autosave hanya jika benar-benar diimplementasikan.
- Setelah simpan, tampilkan dampak ringkas ke nilai indikator bila dapat dihitung.
- Hindari kehilangan data: berikan konfirmasi sebelum pengguna keluar dari form dengan perubahan belum disimpan.

### 6.4 Simulasi what-if

- Bedakan jelas mode **Actual**, **Forecast**, dan **Skenario** dengan tabs atau segmented control.
- Skenario wajib menampilkan nama, sumber snapshot, dan label bahwa data tidak mengubah actual.
- Gunakan highlight visual untuk field yang merupakan override skenario.
- Panel hasil tetap terlihat pada desktop; pada mobile gunakan sticky summary yang bisa dibuka/tutup.
- Tampilkan perubahan nilai dengan format: `+1,24 poin` atau `−0,75 poin`, bukan hanya warna.

### 6.5 Reminder Center

Setiap event reminder harus memperlihatkan:

- Nama event dan indikator.
- Deadline dan jenis hari.
- Kategori reminder.
- Status aktif.
- Jadwal berikutnya.
- Dasar rule/policy.
- Penerima wajib dan tambahan.
- Batas konfigurasi Operator.

Pola policy lock:

- Field terkunci tidak disembunyikan; tampilkan disabled/read-only dengan ikon kunci.
- Berikan teks: “Diatur oleh policy KPPN — tidak dapat diubah oleh Operator Satker.”
- Untuk reminder mandatory, switch aktif tidak dapat dimatikan dan harus menunjukkan alasan.
- Preview jadwal wajib diperbarui sebelum pengguna menyimpan perubahan.

### 6.6 Admin Policy

- Gunakan workflow visual: `Draft` → `Published` → `Retired`.
- Rule set draft dapat diedit; published bersifat read-only dan perubahan harus dibuat sebagai versi baru.
- Sebelum publish, tampilkan ringkasan perubahan, validasi, dampak reminder, dan dialog konfirmasi yang eksplisit.
- Tampilkan sumber regulasi serta catatan perubahan sebagai field wajib.
- Jadikan `rule_set_version` sangat terlihat pada list, detail, dan konteks snapshot.

### 6.7 Manajemen akses

- Gunakan tabel email dengan kolom: nama, email, akses, satker/KPPN scope, status, pembuat, pembaruan terakhir, aksi.
- Form tambah akses harus memakai pencarian user/email dan pilihan jenis akses yang jelas.
- Ketika menambah Operator, tampilkan pemilih satker. Ketika menambah Admin KPPN, tampilkan pemilih KPPN scope.
- Penghapusan/nonaktifkan admin terakhir harus disabled atau menghasilkan error inline yang jelas: “Minimal satu Admin KPPN aktif harus tersedia pada scope ini.”
- Gunakan dialog konfirmasi untuk nonaktifkan/hapus akses.

### 6.8 Audit dan transparansi

- Audit log memakai format yang mudah dipindai: siapa, melakukan apa, pada objek apa, kapan.
- Detail before/after dapat dibuka melalui drawer, tidak perlu selalu tampil di tabel.
- Tampilkan `rule_set_version` dan policy terkait pada event yang relevan.
- Jangan tampilkan JSON mentah secara default; sediakan mode detail teknis opsional untuk Admin KPPN.

---

## 7. Pola Halaman Prioritas

### 7.1 Landing page

**Tujuan:** Membangun kepercayaan dan mengarahkan pengguna ke login.

Section minimal:

1. Header.
2. Hero: “Simulator Penilaian IKPA Satker” + deskripsi singkat + CTA Login.
3. Tiga atau empat manfaat: simulasi real-time, deteksi risiko, reminder deadline, monitoring KPPN.
4. Ringkasan indikator IKPA dalam kartu ringan atau list.
5. Disclaimer nilai simulasi bukan nilai resmi.
6. Footer.

Tidak perlu testimonial, pricing, animasi kompleks, atau konten marketing panjang pada MVP.

### 7.2 Dashboard Operator

**Desktop:**

```text
Header: Satker | Tahun/Periode | Notifikasi | Profil
Judul + status periode + tombol Simulasi / Input Data
[ Nilai IKPA / Target / Gap ] [ Deadline terdekat ]
[ Kartu indikator 1 ] [ Kartu 2 ] [ Kartu 3 ] [ Kartu 4 ]
[ Kartu indikator 5 ] [ Kartu 6 ] [ Kartu 7 ] [ Dispensasi ]
[ Rekomendasi prioritas  ] [ Tren IKPA ]
[ Kelengkapan data       ] [ Realisasi vs RPD ]
```

**Mobile:**

```text
Header ringkas: Satker + periode
Nilai IKPA / target / gap
Deadline dan tindakan hari ini
Rekomendasi prioritas
Kartu indikator vertikal
Grafik ringkas
Kelengkapan data
Bottom navigation
```

### 7.3 Simulasi IKPA

**Desktop:** panel kiri untuk filter/input scenario, panel kanan sticky untuk nilai akhir, breakdown, gap, dan rekomendasi.

**Mobile:** filter dan input dalam section/accordion; ringkasan skor sticky; detail formula dalam drawer.

### 7.4 Input data

Pola konsisten untuk seluruh domain:

```text
Breadcrumb
Judul + deskripsi singkat + periode
Kartu ringkasan nilai/validasi domain
Toolbar: Cari | Filter | Import | Tambah data
Tabel/grid data
Panel atau dialog Tambah/Edit
Helper/panduan singkat di bawah atau side panel
```

### 7.5 Dashboard Admin KPPN

**Desktop:**

```text
Header: KPPN Scope | Tahun/Periode | Profil
Nilai/ringkasan agregat
[ Satker berisiko ] [ Deadline terdekat ] [ Delivery gagal ]
Tabel monitoring satker dengan filter
Grafik tren/indikator agregat
Perubahan policy terbaru
```

**Mobile:** Prioritaskan daftar satker berisiko, deadline, dan shortcut Admin Policy; tabel berubah menjadi card list.

### 7.6 Reminder Center

```text
Judul + keterangan policy aktif + rule set version
Filter: kategori | indikator | status
Daftar reminder
  Nama event | deadline | kategori | jadwal berikutnya | status
Detail reminder (drawer/panel)
  Dasar rule
  Deadline formula ringkas
  Penerima wajib
  Konfigurasi delivery
  Preview jadwal
  Audit perubahan
```

### 7.7 Admin Policy

```text
Sidebar/list rule set
  Tahun | versi | status | efektif
Detail/editor
  Metadata aturan
  Bobot dan parameter IKPA
  Reminder policy
  Kalender kerja
  Validasi
  Ringkasan perubahan
  Aksi simpan draft / publish
```

---

## 8. Aksesibilitas dan Kualitas UI

### 8.1 Standar minimum

- Target minimum WCAG 2.1 AA untuk kontras, focus state, keyboard navigation, dan label form.
- Semua input memiliki label yang terkait programatis.
- Semua tombol ikon memiliki `aria-label` dan tooltip.
- Focus indicator terlihat jelas menggunakan warna primary dengan outline cukup kontras.
- Dialog, sheet, drawer, dan dropdown harus focus-trapped dan bisa ditutup dengan keyboard sesuai primitive Radix.
- Status error tidak boleh hanya ditandai merah; berikan ikon dan teks.
- Grafik harus memiliki tabel/summary alternatif atau tooltip data yang bisa dibaca.
- Jangan memaksa penggunaan hover sebagai satu-satunya cara mengakses informasi penting.

### 8.2 Bahasa dan format lokal

- Gunakan Bahasa Indonesia konsisten.
- Format Rupiah: `Rp1.250.000` atau sesuai utilitas `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })`.
- Format angka skor: dua desimal, misalnya `92,67`.
- Format tanggal: `31 Agu 2026` untuk UI ringkas; `31 Agustus 2026` untuk laporan/detail.
- Gunakan “hari kerja” dan “hari kalender” secara eksplisit; jangan memakai “H+17” tanpa konteks pada UI awam.

### 8.3 Performa persepsi

- Gunakan skeleton untuk dashboard dan tabel; jangan blank screen.
- Optimistic update hanya untuk aksi rendah risiko yang mudah dibatalkan; untuk policy, import commit, publish, delete, dan akses gunakan respons server terkonfirmasi.
- Hindari grafik berat pada mobile awal; lazy-load Recharts dan tampilkan ringkasan angka terlebih dahulu.
- Untuk tabel besar, gunakan pagination server-side dan debounced search.

---

## 9. Deliverables UI/UX Designer Agent

UI/UX Designer Agent harus menghasilkan artefak berikut berdasarkan PRD, FSD, TSD, ERD, dan dokumen ini.

### 9.1 Informasi arsitektur

- Sitemap area publik, Operator Satker, dan Admin KPPN.
- User flow: login/routing akses, onboarding satker, input data, simulasi, scenario, reminder configuration, publish policy, dan manajemen akses.
- Navigasi desktop dan mobile.

### 9.2 Wireframe low fidelity

Buat wireframe desktop dan mobile untuk minimal:

- Landing page.
- Login dan halaman akses belum diberikan.
- Dashboard Operator Satker.
- Simulasi IKPA.
- Satu pola halaman input data dan contoh data grid RPD/Realisasi.
- Kontrak & Tagihan.
- Reminder Center dan detail konfigurasi reminder mandatory.
- Skenario & Riwayat.
- Dashboard Admin KPPN.
- Daftar dan detail satker read-only.
- Admin Policy: list/detail rule set dan publish confirmation.
- Kalender Hari Kerja.
- Manajemen Akses.

### 9.3 High fidelity UI

- Design token warna, typography, spacing, radius, shadow, dan state.
- Komponen inti: navigation, button, badge, card, table, form field, dialog, drawer, alert, toast, tabs, filter bar, empty/loading/error state.
- Visualisasi dashboard: kartu nilai, indikator, tren, bar realisasi vs target, radar/waterfall bila dibutuhkan.
- Variasi mobile, tablet, desktop untuk halaman prioritas.

### 9.4 Spesifikasi handoff

- Nama komponen dan varian.
- State interaksi: default, hover, focus, disabled, loading, error, success, policy-locked.
- Spacing/padding dan breakpoint.
- Contoh konten realistis Bahasa Indonesia.
- Catatan aksesibilitas.
- Mapping elemen UI ke route/fitur FSD.

---

## 10. Checklist Frontend Agent

Sebelum mengimplementasikan halaman, Frontend Agent wajib memastikan:

- Halaman dan hak aksesnya sesuai FSD/TSD.
- Tidak ada data atau tombol mutasi satker pada Dashboard Admin KPPN di MVP.
- Semua data UI memakai context satker/KPPN scope, tahun, dan periode yang benar.
- Komponen mengikuti token pada dokumen ini.
- Layout dirancang mobile-first dan diuji pada mobile, tablet, dan desktop.
- Semua state tersedia: loading, empty, incomplete, error, success, dan policy-locked bila relevan.
- Form memakai validasi yang jelas dan accessible.
- Nominal, skor, tanggal, dan hari kerja menggunakan format Indonesia.
- Disclaimer simulator dan rule set version tampil pada hasil perhitungan/laporan yang relevan.
- Aksi destructive, publish, commit import, dan perubahan akses memakai dialog konfirmasi.
- Tidak menggunakan warna sebagai satu-satunya indikator status.
- Tidak melakukan hardcode parameter regulasi/mandatory reminder di UI.

---

## 11. Ringkasan Aturan Wajib

1. Gunakan **Inter**, `lucide-react`, Tailwind CSS, dan shadcn/ui.
2. Latar dominan putih dengan aksen **biru tua** untuk CTA dan navigasi aktif.
3. Terapkan gaya clean, modern, minimalis, profesional, dan mobile-first.
4. Utamakan keterbacaan skor, risiko, deadline, tindakan, satker, periode, serta rule set version.
5. Maksimal satu CTA primary dominan per section.
6. Operator Satker dan Admin KPPN memakai layout serta menu yang berbeda sesuai PRD/FSD.
7. Semua Operator Satker memiliki akses menu yang sama pada satkernya; semua Admin KPPN memiliki keleluasaan admin yang sama pada scope-nya.
8. Data incomplete, policy lock, rule set lama, dan error harus terlihat jelas, bukan disembunyikan.
9. Reminder mandatory harus terlihat terkunci dan menjelaskan alasannya.
10. Gunakan dokumen ini sebagai referensi desain tunggal agar PRD/FSD/TSD/ERD tidak perlu memuat aturan visual yang berulang.
