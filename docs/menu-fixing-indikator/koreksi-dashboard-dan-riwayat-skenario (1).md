# KOREKSI — Menu Dashboard IKPA & Riwayat & Skenario

**Produk:** Simulator Penilaian IKPA Satker
**Tanggal:** 8 September 2026
**Audience:** AI agent developer
**Status:** Siap implementasi
**Sumber acuan:** FSD OPS-01/OPS-10, ERD (simulations, simulation_overrides, score_snapshots), hasil review implementasi dashboard, dan keputusan diskusi arsitektur menu.

> Prinsip utama: **Dashboard = deteksi & pengarahan. Menu indikator = input aktual + simulasi lokal. Riwayat & Skenario = penyimpanan & perbandingan.** Tidak ada angka yang sama dikerjakan ulang di tiga tempat, dan tidak ada dua tempat yang menampilkan angka berbeda untuk data yang sama.

---

## 0. Ringkasan keputusan (TL;DR)

1. Hapus menu **Simulasi IKPA** (`/operator/simulation`) dari sidebar MVP. Route di-redirect ke `/operator/history`.
2. Simulasi lokal tetap hidup di masing-masing menu indikator (dua mode: Data Aktual vs Simulasi Lokal).
3. Rename menu **Riwayat & Perbandingan** menjadi **Riwayat & Skenario** (`/operator/history` tetap), dengan 3 tab: Snapshot Aktual, Skenario Tersimpan, Bandingkan.
4. Dashboard: hapus tombol `Simpan skenario IKPA`; ganti `Buka Simulasi` menjadi `Buka Riwayat & Skenario`; tombol aksi ketiga menjadi kontekstual (`Lengkapi Data` / `Buka {indikator prioritas}`).
5. **Paritas data wajib:** dashboard dan menu indikator memakai satu engine, satu rule set, satu sumber data. Angka, status, prioritas, dan CTA selalu sama di semua halaman (lihat §3).
6. Dashboard tidak lagi auto-insert snapshot setiap kunjungan; penyimpanan idempoten via `input_hash`.
7. Semua CTA rekomendasi memakai nama halaman asli (bukan `indicator_key`), dengan satu mapping kanonis yang dipakai engine, dashboard, dan kartu tenggat.
8. Kartu tenggat bersumber dari reminder/policy + kalender kerja, dengan label tombol sesuai domain event.
9. ERD: tidak perlu tabel baru; cukup pengetatan constraint dan kolom opsional (lihat §9). Penyesuaian ERD diperbolehkan, bukan pakem.

---

## 1. Konteks masalah

- Dashboard, halaman `/operator/simulation`, dan header kartu pada tiap menu indikator menampilkan angka yang sama (nilai indikator, bobot, skor terbobot). Operator bingung membedakan fungsi ketiganya.
- Halaman `/operator/simulation` saat ini hanya mengulang hasil gabungan plus toggle asumsi UP/TUP & dispensasi, tanpa kemampuan what-if lintas indikator yang menyimpan override nyata. Belum impactful bagi operator satker.
- **Risiko divergensi jalur hitung:** dashboard menghitung lewat engine di server, sementara workspace indikator memakai library client terpisah (`lib/simulation/*-workspace.ts`). Bila rule set published berbeda dari default yang dipakai salah satu jalur, dashboard dan halaman indikator dapat menampilkan angka berbeda untuk data yang sama.
- Tombol `Simpan skenario IKPA` di dashboard menyimpan skenario tanpa asumsi dan dengan periode yang tidak konsisten dengan periode yang sedang ditampilkan.
- CTA rekomendasi membocorkan kode teknis ke UI: `Buka output_achievement`, `Buka invoice_timeliness`, `Buka budget_absorption`, dst.
- Kartu tenggat menampilkan deadline hardcode dan tombol salah domain (event = Konfirmasi Capaian Output, tombol = `Buka Data Tagihan`).
- Konteks dashboard hardcode: target `95.00`, tahun `2026`, `periodMonth` default 8, label rule set statis `PER-5/PB/2024`, `lastUpdated = now()`.
- Setiap kunjungan dashboard men-insert snapshot `actual` baru tanpa cek `input_hash`, mencemari Riwayat.
- Fallback tanpa-DB menampilkan `94,20` sebagai angka demo yang dapat disangka hasil nyata.

---

## 2. Arsitektur menu final (sidebar operator)

```text
Dashboard IKPA

Indikator IKPA
  Revisi DIPA                 /operator/data/budget-revisions
  Deviasi Halaman III         /operator/deviasi
  Penyerapan Anggaran         /operator/penyerapan
  Belanja Kontraktual         /operator/data/contracts-invoices?tab=contracts
  Penyelesaian Tagihan        /operator/data/contracts-invoices?tab=invoices
  UP/TUP & KKP                /operator/up-tup
  Capaian Output              /operator/data/output-achievement
  Dispensasi SPM              /operator/data/spm-dispensation

Reminder Center               /operator/reminders

Lainnya
  Riwayat & Skenario          /operator/history
  Panduan IKPA                /operator/guides
  Pengaturan Satker           /operator/settings
```

Pembagian peran yang harus dijaga di seluruh implementasi:

| Menu | Pertanyaan yang dijawab | Boleh menyimpan? |
|---|---|---|
| Dashboard IKPA | Kondisi saya bagaimana, apa yang paling mendesak? | Tidak (hanya membaca snapshot/hasil hitung) |
| Menu indikator | Data apa yang perlu dicek/diubah, bagaimana jika saya ubah asumsi indikator ini? | Ya: data aktual (`Simpan Data`) atau skenario (`Simpan sebagai Skenario`) |
| Riwayat & Skenario | Apa hasil sebelum/sesudah, skenario mana yang dipilih? | Membaca, menduplikasi, soft delete |
| Reminder Center | Tenggat apa yang harus ditindaklanjuti, kapan, ke siapa? | Konfigurasi delivery dalam batas policy |
| Panduan IKPA | Mengapa indikator dihitung demikian? | Tidak |
| Pengaturan Satker | Target, tahun/periode, konteks apa yang berlaku? | Pengaturan konteks |

---

## 3. Prinsip paritas data (WAJIB)

Dashboard adalah **cerminan**, bukan sumber hitung baru. Seluruh informasi di dashboard harus merupakan rangkuman persis dari menu-menu lain, terutama 8 indikator IKPA.

### 3.1 Satu jalur kalkulasi

- Dashboard dan seluruh menu indikator **wajib** memakai engine IKPA yang sama (paket `ikpa-engine`), rule set **published** yang sama untuk fiscal year/periode yang sama, dan data aktual dari tabel domain yang sama.
- Dilarang menghitung ulang indikator di sisi client dashboard dengan implementasi terpisah — termasuk memakai `lib/simulation/*-workspace.ts` atau tipe/nilai dari `mocks/operator-dashboard.ts` sebagai sumber angka dashboard.
- Kartu dashboard dirender dari output engine yang sama yang mengisi header kartu pada halaman indikator. Satu response server boleh memuat breakdown per indikator; halaman indikator membaca sumber yang sama.

### 3.2 Kesetaraan angka (parity)

Untuk kombinasi (satker, tahun anggaran, periode, rule set) yang sama:

- `Nilai Asli` pada kartu dashboard === nilai indikator pada header halaman indikator terkait.
- `Bobot` pada kartu dashboard === bobot pada halaman indikator dan rule set published.
- `Skor Terbobot` pada kartu dashboard === kontribusi berbobot pada halaman indikator.
- Total IKPA dashboard === Σ kontribusi 7 indikator − pengurang dispensasi, sebagaimana dihitung engine.
- Nilai pengurang pada kartu SPM Dispensasi identik dengan angka pada halaman Dispensasi SPM.

### 3.3 Paritas status dan kelengkapan

- Status `complete` / `estimated` / `incomplete` pada setiap kartu berasal dari status validasi domain yang sama yang dipakai halaman indikator — bukan threshold terpisah yang dihitung ulang di dashboard.
- Blok kelengkapan data memakai hasil validasi yang sama; angka `N data belum lengkap` konsisten dengan indikator kelengkapan pada halaman domain terkait.

### 3.4 Paritas prioritas dan CTA

- Daftar `Tindakan Prioritas` dirender dari output rekomendasi engine yang dihitung dari data aktual yang sama — bukan daftar statis atau sumber terpisah.
- Urutan prioritas mengikuti ranking engine. Badge `Prioritas 1` pada kartu indikator merujuk ke rekomendasi peringkat 1 untuk indikator yang sama.
- Setiap CTA rekomendasi me-resolve `key → label + route` melalui peta kanonis §8. Jika key tidak dikenal di peta: **jangan render tombol, jangan tampilkan key mentah**, catat warning di log.
- Kartu tenggat me-resolve domain event melalui peta §8 yang sama, sehingga label tombol selalu sesuai halaman tujuan.

### 3.5 Uji silang antar halaman (contract test)

- Tambahkan test otomatis yang membandingkan response dashboard dengan header halaman indikator untuk fixture/periode yang sama. Test **gagal** bila ada selisih nilai asli, bobot, atau skor terbobot.
- Test juga mengunci bahwa perubahan data pada satu menu indikator langsung tercermin di dashboard setelah rekalkulasi — tidak ada cache basi. Jika ada cache, invalidasi wajib berbasis `input_hash`.
- Tidak boleh ada tabel/kolom "cache angka dashboard" terpisah; dashboard membaca dari snapshot/hasil engine (lihat §9).

---

## 4. Perubahan Dashboard (`/operator/dashboard`)

### 4.1 Baris aksi utama

| Sekarang | Menjadi | Perilaku |
|---|---|---|
| `Simpan skenario IKPA` | DIHAPUS | Menyimpan skenario hanya boleh dari menu indikator setelah ada override; dashboard tidak punya asumsi untuk disimpan |
| `Input Data` | `Lengkapi Data` (kontekstual) | Jika ada data belum lengkap → buka domain pertama yang bermasalah. Jika semua lengkap → ganti `Buka {nama indikator prioritas 1}` |
| `Buka Simulasi` | `Buka Riwayat & Skenario` | Navigasi ke `/operator/history` |

### 4.2 Kartu Proyeksi IKPA

- Jika `totalScore = null` (data belum lengkap): tampilkan `—` dengan badge `Estimasi — data belum lengkap`. DILARANG fallback ke angka apa pun (termasuk `94,20`).
- Target dibaca dari Pengaturan Satker (`organizations`), bukan hardcode `95.00`.
- Tahun dan periode dibaca dari ActiveContext/header, bukan hardcode tahun 2026 dan `periodMonth ?? 8`.
- Loader wajib mengirim `periodMonth` dan `fiscalYearId` dari konteks aktif ke server function.
- Label `Diperbarui` memakai `score_snapshots.created_at` dari snapshot aktif, bukan `now()`.
- Badge rule set memakai `rule_sets.version` yang benar-benar dipakai snapshot, bukan string statis `PER-5/PB/2024`.

### 4.3 Kartu Tenggat Terdekat

- Sumber data: reminder engine (policy + kalender hari kerja), bukan objek hardcode.
- Label tombol mengikuti domain event sesuai peta §8. Contoh: event konfirmasi capaian output → tombol `Buka Capaian Output` → `/operator/data/output-achievement`.
- Jika ada lebih dari satu deadline aktif: tambahkan tautan `Lihat {N} tenggat lainnya` → `/operator/reminders`.
- Jika tidak ada deadline: tampilkan empty state, misal `Tidak ada tenggat dalam periode ini`.
- Hapus seluruh hardcode: tanggal statis, `deadlineDays: 5`, dan label `Buka Data Tagihan` universal.

### 4.4 Grid 8 kartu indikator

- Bobot tampil satu kali saja (chip di atas); hapus baris `Bobot: N%` yang duplikat.
- Tambahkan delta terhadap snapshot periode sebelumnya: `↑ +1,20 poin vs Jul` / `↓ −0,75 poin vs Jul` / `Belum ada pembanding` / `Data belum lengkap`. Hapus `deltaPoints: 0` permanen.
- Seluruh area kartu dapat diklik dan mengarah ke halaman indikator sesuai peta rute §8. Beri affordance visual (ikon `→` atau teks hover `Buka detail indikator`).
- Perbaiki kontrak props `IndicatorCard`: gunakan `onDetailClick` sesuai definisi, atau jadikan kartu `<Link>`. Dilarang meneruskan `onClick` sebagai DOM prop yang tidak terdefinisi di tipe props.
- Semua navigasi internal memakai TanStack `Link`/router, bukan `window.location.href`.
- Indikator dengan dampak terbesar diberi badge eksplisit `Prioritas 1` (selaras dengan rekomendasi peringkat 1, lihat §3.4); jangan mengandalkan border biru tanpa keterangan.
- Status data per kartu: `complete` / `estimated` / `incomplete`. Bila `incomplete`, nilai tampil `—`.

### 4.5 Tindakan Prioritas

- Jangan pernah me-render `indicator_key` ke UI. Render hanya label aksi dan nama halaman asli (lihat peta §8).
- Format dampak diubah: `Ruang perbaikan: hingga +10,05 poin`, bukan `Potensi Dampak: +10,05 poin`.
- Tambahkan satu catatan kecil di bawah judul section:

  > Ruang perbaikan adalah estimasi maksimum bila gap indikator ditutup; hasil aktual bergantung pada kelengkapan dan validitas data.

- Tampilkan maksimal 5 prioritas. Tombol `Lihat semua (N)` hanya dirender jika halaman tujuan (Analisis) benar-benar ada; jika tidak ada, hapus tombol tersebut.
- Hapus default palsu pada rekomendasi: `deadlineDays: 5` dan `deadlineDate ?? "2026-09-15"`. Jika engine tidak memberi deadline, jangan tampilkan angka deadline.

### 4.6 Blok kelengkapan data (baru)

- Tambahkan blok ringkas lintas 7 domain + dispensasi, ditempatkan di bawah kartu utama atau di atas grid indikator.
- Tampil hanya jika ada domain kosong/tidak valid; bila lengkap semua, cukup badge `Data Lengkap` pada kartu utama.
- Format:

  ```text
  Kelengkapan data periode Agustus 2026          6 dari 7 lengkap
  ✓ Pagu & Revisi DIPA   ✓ RPD & Realisasi   ✓ Kontrak & Tagihan
  ! UP/TUP & KKP — 2 transaksi belum dilengkapi
  ✓ Capaian Output   ✓ Dispensasi SPM
  [Lengkapi 2 data]
  ```

- CTA `Lengkapi N data` mengarah ke domain pertama yang bermasalah sesuai peta rute §8.
- Sumber status kelengkapan mengikuti §3.3 (validasi yang sama dengan halaman domain).

### 4.7 Tren (bertahap)

- Tampilkan grafik garis total IKPA YTD hanya jika sudah ada minimal 2 snapshot pada periode berbeda.
- Jika belum: placeholder `Tren akan muncul setelah 2 periode tersimpan`. Jangan render mock `scoreHistory`/`completeness` yang tidak terhubung data nyata.

### 4.8 Aturan backend dashboard

- Hentikan auto-insert snapshot `actual` pada setiap kunjungan. Dashboard menghitung live; snapshot hanya dibuat jika `input_hash` berubah (idempoten) atau ada aksi simpan eksplisit.
- Hapus fallback demo `totalScore: 94.2` dari jalur produksi. Jika database tidak tersedia di environment produksi/audit: tampilkan error state, bukan angka demo. Angka demo hanya boleh dengan badge `Demo` yang sangat jelas di environment lokal.
- Seluruh aturan paritas §3 berlaku untuk server function dashboard: satu jalur engine, satu rule set, tanpa perhitungan indikator terpisah.

---

## 5. Perubahan halaman `/operator/simulation`

- Keputusan: **keluar dari sidebar MVP**.
- Route `/operator/simulation` melakukan redirect (308) ke `/operator/history`. Opsional: tampilkan notice satu kali `Halaman Simulasi digabung ke Riwayat & Skenario`.
- Fungsi yang ada dipindahkan: tab `Aktual` → terwakili oleh Dashboard; tab `Skenario` → simulasi lokal per indikator + Riwayat & Skenario.
- Fitur what-if **lintas indikator** masuk backlog pasca-MVP dengan nama kerja `Skenario Perbaikan IKPA`. Kriteria layak dibangun (jangan bangun sebelum terpenuhi):
  - Operator menetapkan target (mis. 95,00) dan sistem menunjukkan kekurangan poin.
  - Override bisa mencakup beberapa indikator sekaligus dan tersimpan eksplisit.
  - Ada perbandingan Baseline vs Skenario (per indikator, sebelum → sesudah, dampak ke total).
  - Skenario wajib bernama, bercatatan, dan terhubung ke `parent_snapshot_id`.

---

## 6. Simulasi lokal di menu indikator

Berlaku untuk kedelapan menu indikator.

### 6.1 Dua mode eksplisit

| Mode | Default | Boleh mengubah data aktual? | Tombol utama |
|---|---|---|---|
| Data Aktual | Ya | Ya (tabel domain) | `Simpan Data` |
| Simulasi Lokal | Tidak | Tidak (hanya override) | `Hitung Ulang Pratinjau`, `Simpan sebagai Skenario`, `Buang Perubahan` |

- Saat mode Simulasi Lokal aktif, tampilkan banner: `Mode Simulasi — perubahan tidak mengubah data aktual sampai Anda menyimpannya sebagai data.`
- Tombol `Simpan sebagai Skenario` **disabled** sampai ada minimal satu perubahan asumsi.
- Header kartu halaman indikator (nilai, bobot, skor terbobot) dihitung dari jalur yang sama dengan dashboard (§3.1) sehingga angka selalu identik.
- Hasil pratinjau wajib menampilkan dampak ke total IKPA, bukan hanya skor lokal indikator:

  ```text
  Baseline aktual            94,20
  Setelah asumsi             96,20
  Perubahan                  +2,00 poin
  Target                     95,00
  Status                     Tercapai
  ```

### 6.2 Dialog Simpan sebagai Skenario

Field wajib/opsional:

- Nama skenario (wajib). Contoh auto-suggest: `Tutup gap via Penyelesaian Tagihan — Agu 2026`.
- Periode (default = konteks aktif).
- Target (default dari Pengaturan Satker).
- Ringkasan override read-only: `{field}: {nilai asal} → {nilai baru}`.
- Catatan (opsional).

Setelah tersimpan, tampilkan tiga aksi:

- `Lihat di Riwayat & Skenario` → `/operator/history?tab=scenarios`
- `Bandingkan dengan Aktual` → `/operator/history?tab=compare&a={snapshotId}&b={simulationId}`
- `Kembali ke Dashboard`

### 6.3 Alur data penyimpanan skenario

```text
Menu indikator (mode Simulasi Lokal)
  → client kirim: simulationType="scenario", fiscalYearId, period, targetScore,
    parentSnapshotId, overrides[], name, sourceContext
  → server: ambil data aktual + rule set aktif
  → terapkan overrides pada salinan input (data aktual tidak disentuh)
  → jalankan engine IKPA (engine yang sama dengan dashboard, §3.1)
  → insert simulations(type="scenario")
  → insert simulation_overrides (≥1, wajib)
  → insert score_snapshots (total, breakdown, rule_set_version, rule_set_id, input_hash)
  → kembalikan ringkasan hasil + link riwayat/perbandingan
```

---

## 7. Riwayat & Skenario (`/operator/history`)

### 7.1 Rename

- Label sidebar: `Riwayat & Perbandingan` → **`Riwayat & Skenario`**.
- Route tetap `/operator/history`.

### 7.2 Struktur tab

```text
Riwayat & Skenario
├── Tab Snapshot Aktual      (?tab=snapshots)
├── Tab Skenario Tersimpan   (?tab=scenarios)
└── Tab Bandingkan           (?tab=compare)
```

**Tab Snapshot Aktual** — daftar snapshot yang benar-benar tersimpan (bukan hasil auto-load). Kolom: Periode, Nilai IKPA, Target, Gap, Status data, Dibuat oleh, Waktu, Rule Set. Aksi: Lihat detail, Bandingkan.

**Tab Skenario Tersimpan** — kolom: Nama, Periode, Hasil IKPA, Δ vs baseline, Indikator terdampak, Jumlah asumsi, Dibuat oleh, Waktu. Aksi per baris: `Lihat`, `Bandingkan`, `Duplikasi`, `Hapus` (soft delete, dengan konfirmasi).

**Tab Bandingkan** — pilih 2–3 item (snapshot dan/atau skenario). Tampilkan:

- Baris total: nilai masing-masing + selisih terhadap item pertama (baseline).
- Tabel per indikator: sebelum → sesudah + delta.
- Daftar override tiap skenario.
- Badge versi rule set tiap item; tampilkan warning bila item dibandingkan memakai versi rule set berbeda.

### 7.3 Detail skenario

Menampilkan: baseline (parent snapshot), daftar override (`{field}: asal → baru`), breakdown hasil per indikator, target & gap, pembuat, waktu, rule set. Tombol: `Buka Indikator Terkait` (sesuai override pertama / indikator dominan, resolve via peta §8), `Bandingkan dengan Aktual`.

### 7.4 Filter & empty state

- Filter: periode, tipe (snapshot/skenario), pencarian nama.
- Empty state skenario: `Belum ada skenario. Buat dari menu indikator dengan mode Simulasi Lokal.` + CTA `Buka Indikator IKPA`.
- Semua query wajib memfilter `deleted_at IS NULL`.

---

## 8. Peta CTA kanonis (satu sumber kebenaran)

Buat satu modul mapping yang dipakai oleh: rekomendasi engine, tombol dashboard, kartu tenggat, dan tombol di Riwayat & Skenario.

| Key teknis | Label UI | Route kanonis |
|---|---|---|
| `dipa_revision` / `revisi_dipa` | Revisi DIPA | `/operator/data/budget-revisions` |
| `deviation` / `deviasi` | Deviasi Halaman III | `/operator/deviasi` |
| `budget_absorption` | Penyerapan Anggaran | `/operator/penyerapan` |
| `contractual` | Belanja Kontraktual | `/operator/data/contracts-invoices?tab=contracts` |
| `invoice_timeliness` | Penyelesaian Tagihan | `/operator/data/contracts-invoices?tab=invoices` |
| `up_tup` | UP/TUP & KKP | `/operator/up-tup` |
| `output_achievement` | Capaian Output | `/operator/data/output-achievement` |
| `spm_dispensation` | Dispensasi SPM | `/operator/data/spm-dispensation` |

Contoh implementasi:

```ts
// lib/indicator-routes.ts — satu-satunya sumber mapping
export type IndicatorRoute = {
  key: string;
  label: string;      // nama halaman asli untuk CTA
  route: string;
};

export const INDICATOR_ROUTES: Record<string, IndicatorRoute> = {
  dipa_revision: {
    key: "dipa_revision",
    label: "Revisi DIPA",
    route: "/operator/data/budget-revisions",
  },
  deviation: {
    key: "deviation",
    label: "Deviasi Halaman III",
    route: "/operator/deviasi",
  },
  budget_absorption: {
    key: "budget_absorption",
    label: "Penyerapan Anggaran",
    route: "/operator/penyerapan",
  },
  contractual: {
    key: "contractual",
    label: "Belanja Kontraktual",
    route: "/operator/data/contracts-invoices?tab=contracts",
  },
  invoice_timeliness: {
    key: "invoice_timeliness",
    label: "Penyelesaian Tagihan",
    route: "/operator/data/contracts-invoices?tab=invoices",
  },
  up_tup: {
    key: "up_tup",
    label: "UP/TUP & KKP",
    route: "/operator/up-tup",
  },
  output_achievement: {
    key: "output_achievement",
    label: "Capaian Output",
    route: "/operator/data/output-achievement",
  },
  spm_dispensation: {
    key: "spm_dispensation",
    label: "Dispensasi SPM",
    route: "/operator/data/spm-dispensation",
  },
};

// Aturan render: tombol selalu `Buka ${label}`.
// Dilarang me-render `key` ke UI.
// Key tidak dikenal → jangan render tombol, catat warning.
```

Catatan: selaraskan juga mapping di sisi engine rekomendasi yang saat ini mengarah ke `rpd-realization`, agar memakai tabel yang sama.

---

## 9. Penyesuaian ERD & aturan data

Tabel yang dipakai sudah ada: `simulations`, `simulation_overrides`, `score_snapshots`. Tidak perlu tabel baru. Penyesuaian berikut disarankan dan boleh diubah selama prinsipnya terpenuhi:

1. **Idempotensi snapshot actual.** Tambahkan unique constraint pada `score_snapshots` — minimal unik pada `(simulation_id, period_end, input_hash)`. Sebelum insert snapshot `actual`, cek apakah kombinasi ini sudah ada; jika ya, pakai yang ada.
2. **`simulations.source_context` (text, nullable).** Mencatat asal pembuatan skenario, mis. `invoice_timeliness`, `dashboard`. Memudahkan CTA `Buka Indikator Terkait` dan analitik.
3. **`simulations.period_month` (smallint, nullable)** — opsional, untuk memudahkan listing tanpa join ke snapshot; alternatif: derive dari `score_snapshots.period_end`.
4. **Validasi scenario wajib override.** Tolak penyimpanan `type="scenario"` tanpa satu pun baris `simulation_overrides`. Pesan ke user: `Belum ada asumsi yang berubah. Skenario hanya dapat disimpan setelah Anda mengubah minimal satu asumsi.`
5. **`parent_snapshot_id` wajib terisi untuk scenario** agar baseline selalu jelas.
6. **Immutability:** `score_snapshots` tidak pernah di-update setelah insert; koreksi dilakukan dengan snapshot baru.
7. **Soft delete konsisten:** semua query Riwayat & Skenario memfilter `deleted_at IS NULL` pada `simulations`.
8. **Audit log:** catat `create`, `duplicate`, `delete` skenario beserta `simulation_id` dan ringkasannya.
9. **Tidak ada tabel/kolom cache angka dashboard terpisah.** Dashboard membaca dari snapshot atau hasil engine; satu-satunya "cache" yang boleh ada adalah snapshot itu sendiri (lihat §3).
10. **Tidak ada jalur "terapkan skenario ke data aktual" pada MVP** (lihat §11).

---

## 10. Acceptance criteria

Dashboard:

- [ ] Sidebar tidak lagi menampilkan `Simulasi IKPA`; mengakses `/operator/simulation` me-redirect ke `/operator/history`.
- [ ] Tombol `Simpan skenario IKPA` tidak ada; `Buka Simulasi` menjadi `Buka Riwayat & Skenario`.
- [ ] Target, tahun, dan periode mengikuti Pengaturan/ActiveContext; tidak ada hardcode `95.00`, `2026`, atau bulan 8.
- [ ] Membuka dashboard dua kali tanpa perubahan data tidak menambah baris `score_snapshots`/`simulations`.
- [ ] Saat `totalScore = null`, UI menampilkan `—` + status estimasi; tidak pernah menampilkan `94,20` sebagai fallback.
- [ ] Badge rule set menampilkan versi asli dari snapshot; `Diperbarui` memakai waktu snapshot.
- [ ] Kartu tenggat berasal dari data reminder/policy; label tombol sesuai domain event; tanpa hardcode tanggal/`deadlineDays`.
- [ ] Bobot tampil sekali per kartu; setiap kartu punya delta vs snapshot sebelumnya atau teks `Belum ada pembanding`.
- [ ] Seluruh kartu indikator dapat diklik via TanStack `Link` ke rute kanonis §8; tidak ada `window.location.href` dan tidak ada props `onClick` liar.
- [ ] Tidak ada string `output_achievement`, `invoice_timeliness`, `budget_absorption`, dll. yang tampil di UI; semua tombol memakai `Buka {nama halaman}`.
- [ ] Blok kelengkapan data muncul saat ada domain bermasalah dan CTA-nya menuju domain tersebut.

Paritas data (§3):

- [ ] Untuk fixture/periode yang sama, `Nilai Asli`, `Bobot`, dan `Skor Terbobot` setiap kartu dashboard **identik** dengan header halaman indikator terkait (uji otomatis/contract test).
- [ ] Total dashboard = Σ kontribusi 7 indikator − pengurang dispensasi sesuai output engine; tidak ada perhitungan indikator di client dashboard.
- [ ] Mengubah data pada menu indikator lalu kembali ke dashboard menampilkan angka terbaru tanpa cache basi (invalidasi via `input_hash`).
- [ ] Status `complete/estimated/incomplete` dan blok kelengkapan data konsisten dengan status validasi pada halaman domain.
- [ ] Badge `Prioritas 1` pada kartu sesuai rekomendasi peringkat 1 dari engine.
- [ ] Rekomendasi dengan key tidak dikenal tidak merender tombol/key mentah dan tercatat sebagai warning.

Menu indikator:

- [ ] Ada dua mode jelas (Data Aktual vs Simulasi Lokal) dengan banner pada mode simulasi.
- [ ] `Simpan sebagai Skenario` disabled tanpa perubahan asumsi; dialog mewajibkan nama dan menampilkan ringkasan override.
- [ ] Menyimpan skenario tidak mengubah tabel data aktual mana pun.

Riwayat & Skenario:

- [ ] Label sidebar `Riwayat & Skenario`; halaman punya 3 tab berfungsi.
- [ ] Skenario tampil dengan nama, periode, hasil, Δ vs baseline, dan indikator terdampak.
- [ ] Perbandingan 2–3 item menampilkan total, per indikator (sebelum → sesudah), override, dan warning beda versi rule set.
- [ ] Soft delete menyembunyikan skenario dari semua daftar.
- [ ] Menyimpan skenario tanpa override ditolak dengan pesan yang jelas.

---

## 11. Di luar scope (pasca-MVP)

- Menerapkan skenario menjadi data aktual.
- Halaman what-if lintas indikator terpadu (`Skenario Perbaikan IKPA`) — hanya dibangun setelah kriteria di §5 terpenuhi.
- Integrasi OMSPAN/SPAN/SAKTI.
- Notifikasi/reminder otomatis yang dipicu dari skenario.
- Halaman Analisis & Rekomendasi penuh (selama belum ada, dashboard menampilkan maksimal 5 prioritas tanpa tombol `Lihat semua`).
