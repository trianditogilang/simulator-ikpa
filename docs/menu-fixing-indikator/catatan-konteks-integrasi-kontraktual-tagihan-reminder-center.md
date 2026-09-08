# Catatan Konteks Penting — Integrasi Belanja Kontraktual dan Penyelesaian Tagihan ke Reminder Center

## Tujuan dokumen

Dokumen ini adalah **context guard** untuk AI agent saat nanti diminta melakukan setup atau integrasi Reminder Center pada aplikasi Simulator IKPA.

Tujuannya memastikan reminder untuk **Belanja Kontraktual** dan **Penyelesaian Tagihan**:

- tidak memakai data atau deadline yang salah;
- tidak mencampur dua indikator yang rumus dan trigger-nya berbeda;
- mengikuti arsitektur reminder yang sudah dibangun;
- tidak membuat scheduler, tabel, atau engine paralel yang menduplikasi arsitektur eksisting;
- tidak mengaktifkan pengiriman email produksi sebelum data sumber, kalender, dan delivery runtime benar-benar siap.

---

## 1. Prinsip utama

Belanja Kontraktual dan Penyelesaian Tagihan boleh berbagi workspace data:

```text
/operator/data/contracts-invoices
```

Namun keduanya adalah **dua indikator IKPA terpisah**, masing-masing berbobot 10%, dengan objek, tanggal acuan, eligibility, perhitungan, dan reminder yang berbeda.

| Aspek | Belanja Kontraktual | Penyelesaian Tagihan |
|---|---|---|
| Bobot IKPA | 10% | 10% |
| Objek utama | Kontrak | Tagihan/SPM-LS terkait kontrak atau BAST/BAPP |
| Trigger reminder | Peristiwa kontrak dan periode target | BAST/BAPP dicatat untuk tagihan eligible belum konversi |
| Dasar tanggal utama | Tanggal kontrak dan/atau SP2D | Tanggal BAST/BAPP hingga tanggal konversi KPPN |
| Deadline utama | 31 Maret, akhir TW I, 30 Juni, atau policy periode lain | Maksimal H+17 hari kerja |
| Kondisi selesai reminder | Kontrak sudah ditandatangani/terdaftar atau SP2D sudah sesuai target | Tanggal konversi/diterima KPPN sudah diisi |

**Larangan:** Jangan membuat satu reminder generik “Kontrak & Tagihan” yang memakai satu formula atau satu countdown untuk kedua indikator.

---

## 2. Arsitektur reminder yang wajib dipakai

Gunakan fondasi yang sudah tersedia di proyek. Jangan membuat sistem paralel tanpa alasan teknis yang disetujui.

```text
Admin KPPN
  → rule_set + reminder_policies
  → org_reminder_configs (konfigurasi satker dalam batas policy)
  → packages/policy-reminder
      - Rule Set Resolver
      - Deadline Calculator
      - Workday Calendar
      - Compliance Guard
      - Reminder Scheduler
  → notification_deliveries
  → QStash Cron / worker
  → Resend + React Email
  → audit_logs + monitoring
```

### Struktur yang sudah tersedia

| Kebutuhan | Struktur/fondasi yang harus dipakai |
|---|---|
| Policy dan deadline regulasi | `reminder_policies` dalam `rule_sets` aktif |
| Preferensi delivery satker | `org_reminder_configs` |
| Validasi policy mandatory/lead time/penerima | `Compliance Guard` |
| Kalkulasi deadline | `packages/policy-reminder` dan `WorkdayCalendar` |
| Jadwal dan histori email | `notification_deliveries` |
| Pengiriman background | QStash Cron / queue / server endpoint yang tervalidasi |
| Email | Resend + React Email atau adapter provider backend yang kompatibel |
| Audit | `audit_logs` |
| Operator monitoring | `/operator/reminders` |
| Admin monitoring | `/admin-kppn/monitoring/reminders` |

### Ketentuan implementasi

- Semua kalkulasi deadline harus server-authoritative.
- Jangan membuat kalkulator hari kerja baru di komponen UI.
- Jangan memakai preview dummy sebagai dasar job email.
- Jangan mengirim email langsung dari browser.
- Jangan menyimpan API key/provider secret di frontend, database umum, atau audit log.
- Semua job harus idempotent dan memiliki `idempotency_key` unik.
- Setiap delivery wajib menyimpan policy/rule set version yang dipakai saat dijadwalkan.
- Reminder yang sudah selesai, dibatalkan, atau tidak eligible tidak boleh dikirim ulang.

---

## 3. Dependency sebelum reminder diaktifkan

Jangan aktifkan QStash scheduler atau email provider produksi untuk dua indikator ini sampai seluruh dependency berikut selesai dan lulus test.

### 3.1 Belanja Kontraktual

- [ ] DAK memakai jumlah kontrak, bukan total nilai rupiah.
- [ ] Pra-DIPA dihitung deterministik dari tanggal kontrak sebelum 1 Januari.
- [ ] Kontrak Januari–31 Maret diberi poin 110.
- [ ] Kontrak setelah 31 Maret tidak dimasukkan penyebut komponen Pra-DIPA.
- [ ] Akselerasi 53 memfilter akun 53, nilai Rp50–200 juta, dan tipe sekaligus.
- [ ] Akselerasi 53 memakai tanggal SP2D, bukan tanggal kontrak.
- [ ] Data kontrak memiliki `accountCode`, `value`, `signedAt`, `paymentType`, `sp2dAt`, dan fiscal year yang valid.
- [ ] Nilai kosong/tidak eligible tidak diberi nilai sempurna otomatis.

### 3.2 Penyelesaian Tagihan

- [ ] Hanya SPM-LS kontraktual non-belanja pegawai yang dihitung dan dapat menghasilkan event reminder.
- [ ] Tanggal BAST/BAPP menjadi titik awal H+17.
- [ ] Tanggal konversi/diterima KPPN menjadi titik akhir; bukan tanggal SPM dibuat.
- [ ] Tanggal konversi KPPN dapat kosong untuk tagihan yang masih berjalan.
- [ ] Tanggal konversi sebelum BAST/BAPP ditolak.
- [ ] Kalender kerja kanonis mengecualikan Sabtu, Minggu, libur, dan menghormati override.
- [ ] Engine indikator, tabel UI, Reminder Center, Dashboard, dan scheduler memakai kalender yang sama.
- [ ] Pengisian konversi KPPN menutup event dan membatalkan delivery yang belum terkirim.

---

## 4. Integrasi Belanja Kontraktual

## 4.1 Ingat: reminder kontraktual berbeda dari H+17 tagihan

Reminder Belanja Kontraktual tidak dipicu oleh BAST/BAPP dan tidak menggunakan countdown H+17. Reminder ini berfungsi mengarahkan percepatan proses kontrak agar tiga subkomponen indikator dapat optimal.

### Event kontraktual yang direkomendasikan

| Event type kanonis | Tujuan | Entitas sumber | Deadline/policy dasar | Status selesai |
|---|---|---|---|---|
| `early_contract_due` | Mendorong kontrak dini/Pra-DIPA atau TTD paling lambat 31 Maret | `contracts` atau rencana kontrak yang diizinkan sistem | 31 Maret tahun anggaran; kalender/policy | Kontrak ditandatangani sesuai target atau event ditutup policy |
| `contract_distribution_due` | Mendorong kontrak eligible ≥Rp50 juta tercatat sebelum/hingga TW II | `contracts` | 30 Juni; target rasio distribusi DAK | Rasio/daftar kontrak target sudah terpenuhi atau periode berakhir |
| `capital_53_contract_due` | Mendorong kontrak akun 53 Rp50–200 juta sekaligus selesai pada TW I | `contracts` | 31 Maret; penyelesaian memakai SP2D | `sp2dAt` tersedia dalam target atau event ditutup/overdue |

### Eligibility dan data per event

#### A. Kontrak dini / Pra-DIPA

- Target penilaian: kontrak bernilai ≥ Rp50 juta, seluruh jenis belanja.
- Tanggal penilaian: `signedAt`.
- Pra-DIPA: tanggal sebelum 1 Januari → poin 120.
- Non-Pra-DIPA awal tahun: 1 Januari–31 Maret → poin 110.
- Kontrak setelah 31 Maret tidak memperoleh poin KD.
- Reminder dapat dibuat pada tingkat agregat/daftar tindakan, misalnya kontrak/rencana pengadaan prioritas yang belum ditandatangani menjelang 31 Maret.

**Catatan penting:** Kontrak Pra-DIPA terjadi sebelum tahun anggaran. Jangan membuat email reminder mundur ke masa lalu. Pada awal tahun, Reminder Center cukup mendeteksi kontrak eligible yang masih belum ditandatangani dan mengarahkan penyelesaian sebelum 31 Maret.

#### B. Distribusi Akselerasi Kontrak

- Eligible: nilai ≥ Rp50 juta, seluruh jenis belanja.
- Dasar tanggal: `signedAt`.
- Deadline indikator: sampai dengan 30 Juni/Triwulan II.
- Perhitungan DAK memakai **jumlah kontrak**, bukan jumlah nilai rupiah.
- Reminder dapat memakai risiko rasio, contoh:

```text
Jumlah kontrak eligible sampai saat ini / proyeksi total kontrak eligible tahun berjalan
```

Jangan mengklaim skor DAK final dari reminder apabila total kontrak setahun belum dapat diketahui. Gunakan teks risiko/proyeksi, misalnya:

```text
Rasio kontrak eligible sampai Triwulan II masih berisiko tidak mencapai target >75%.
```

#### C. Akselerasi Kontrak 53

Hanya untuk kontrak yang memenuhi seluruh syarat:

- `accountCode = 53`;
- nilai Rp50.000.000 sampai Rp200.000.000, inklusif;
- `paymentType = sekaligus`;
- memiliki/menunggu `sp2dAt`;
- penyelesaian dinilai dari tanggal SP2D.

Target poin:

| SP2D selesai | Poin |
|---|---:|
| Triwulan I | 100 |
| Triwulan II | 90 |
| Triwulan III | 80 |
| Triwulan IV | 70 |

Reminder utama adalah sebelum akhir Triwulan I untuk kontrak eligible yang belum memiliki SP2D.

### Jadwal policy kontraktual yang direkomendasikan

Jangan hardcode. Simpan sebagai policy versi aktif.

| Event | Jenis hari | Rekomendasi jadwal default |
|---|---|---|
| `early_contract_due` | Hari kalender | H-30 dan H-14 sebelum 31 Maret |
| `contract_distribution_due` | Hari kalender | H-30, H-14, H-7 sebelum 30 Juni; hanya bila risk rule aktif |
| `capital_53_contract_due` | Hari kalender | H-14 dan H-7 sebelum 31 Maret |

Kategori policy awal yang disarankan: `recommended` atau `optional`, bukan `mandatory`, kecuali Admin KPPN menetapkan sebaliknya melalui rule set.

### Jangan lakukan ini untuk kontraktual

- Jangan memakai tanggal BAST/BAPP untuk kontraktual.
- Jangan memakai `receivedAtKppn` sebagai status selesai reminder kontraktual.
- Jangan memasukkan kontrak termin ke event akselerasi 53.
- Jangan memasukkan akun non-53 atau nilai di luar Rp50–200 juta ke event akselerasi 53.
- Jangan memakai jumlah nilai rupiah untuk risk DAK.
- Jangan mengirim reminder Pra-DIPA retroaktif untuk kontrak yang tanggalnya sudah berlalu.

---

## 5. Integrasi Penyelesaian Tagihan

## 5.1 Trigger bisnis kanonis

Reminder Penyelesaian Tagihan harus dibuat saat **tanggal BAST/BAPP dicatat/disimpan** untuk tagihan yang eligible.

Namun deadline dihitung dari **tanggal yang tertulis pada BAST/BAPP**, bukan waktu operator melakukan input ke aplikasi.

```text
Kontrak
  → pekerjaan selesai / hak tagih timbul
  → BAST/BAPP diterbitkan
  → BAST/BAPP dicatat ke aplikasi
  → event H+17 dibuat atau diperbarui
  → reminder berjalan sampai konversi KPPN tersedia
  → event selesai dan delivery pending dibatalkan
```

### 5.2 Eligibility event tagihan

Event `spm_ls_contract_17d` dibuat hanya jika:

- SPM-LS terkait kontrak yang valid;
- SPM/tagihan bersifat kontraktual;
- `isPegawai = false`;
- `bastBappDate` tersedia dan valid;
- `receivedAtKppn`/`conversionDate` masih kosong;
- tagihan tidak dibatalkan atau dihapus.

Event tidak boleh dibuat untuk:

- belanja pegawai;
- tagihan non-kontraktual;
- BAST/BAPP kosong;
- tagihan yang telah dikonversi KPPN;
- baris dibatalkan/dihapus.

### 5.3 Deadline dan milestone

- Hari BAST/BAPP adalah hari ke-0.
- Deadline adalah hari kerja ke-17 setelah BAST/BAPP.
- Hari kerja ke-17 masih tepat waktu.
- Hari kerja ke-18 menjadi terlambat.
- Gunakan `WorkdayCalendar` kanonis untuk seluruh perhitungan.

Policy target yang disarankan:

| Event type | Day type | Default milestone | Kategori awal |
|---|---|---|---|
| `spm_ls_contract_17d` | `workday` | H-5, H-2, H-0 | `mandatory` jika ditetapkan Admin KPPN |

**Catatan konflik yang wajib dibereskan:** Seed implementasi saat ini memakai H-10, H-5, H-2 dengan lead minimum 3; rancangan produk mengarah ke H-5, H-2, H-0. Sebelum setup scheduler/email, pilih satu policy kanonis dan version-kan perubahan tersebut. Jika H-0 dipakai, validasi UI/server harus mengizinkan `leadDays = 0`.

### 5.4 Lifecycle delivery

#### Saat BAST/BAPP dibuat atau diperbarui

1. Validasi eligibility.
2. Hitung deadline H+17 dari BAST/BAPP aktual menggunakan kalender kerja aktif.
3. Buat atau update delivery pada `notification_deliveries` untuk setiap milestone/penerima.
4. Gunakan idempotency key yang mencakup minimal satker, policy, entitas SPM-LS, deadline, milestone, dan rule set version.
5. Jika BAST/BAPP diedit, batalkan delivery lama yang belum terkirim lalu jadwalkan ulang delivery baru.

#### Saat BAST/BAPP diinput terlambat

| Posisi saat input | Perilaku |
|---|---|
| Sebelum H-5 | Jadwalkan H-5, H-2, H-0 sesuai policy |
| H-5 sampai H-1 | Tandai milestone sebelumnya sebagai `missed`; kirim/queue hanya reminder risiko yang relevan saat ini |
| H-0 | Queue H-0 bila belum konversi |
| Lewat H+17 | Status `overdue`; queue escalation sesuai policy; jangan mengirim milestone historis |

#### Saat konversi KPPN diisi

1. Validasi `receivedAtKppn >= bastBappDate`.
2. Tandai sumber tagihan selesai.
3. Batalkan delivery belum terkirim (`scheduled`/`queued`) untuk entitas tersebut.
4. Jangan menghapus riwayat delivery yang sudah `sent`, `failed`, `skipped`, atau `missed`.
5. Tampilkan event sebagai selesai pada riwayat Reminder Center.

### 5.5 Jangan lakukan ini untuk tagihan

- Jangan memulai H+17 dari tanggal input operator.
- Jangan memulai H+17 dari tanggal kontrak.
- Jangan memakai tanggal SPM dibuat sebagai titik akhir.
- Jangan menghitung hari kalender untuk aturan H+17.
- Jangan mengikutkan SPM pegawai dalam event atau score tagihan.
- Jangan membiarkan konversi KPPN sebelum BAST/BAPP dianggap tepat waktu.
- Jangan mengirim email setelah konversi KPPN sudah tercatat.
- Jangan menyatukan event satu kontrak menjadi satu countdown jika kontrak memiliki beberapa termin/BAST/BAPP.

---

## 6. Perubahan Reminder Center yang diperlukan

Halaman `/operator/reminders` saat ini berfokus pada policy, konfigurasi lead time, penerima tambahan, dan preview jadwal. Setelah integrasi, halaman harus tetap mempertahankan fungsi tersebut tetapi menambahkan monitoring event aktual.

### Struktur tab yang disarankan

```text
[Event Aktif] [Kebijakan & Jadwal] [Penerima] [Delivery & Riwayat]
```

### Tab Event Aktif

Minimal tampilkan:

| Kolom | Keterangan |
|---|---|
| Indikator | Belanja Kontraktual atau Penyelesaian Tagihan |
| Event | Nama event yang manusiawi |
| Entitas | Nomor kontrak atau nomor SPM/tagihan |
| Dasar tanggal | Tanggal kontrak/SP2D/BAST-BAPP sesuai event |
| Deadline | Hasil policy dan kalender terkait |
| Status | Aman, H-14, H-7, H-5, H-2, H-0, overdue, selesai |
| Delivery berikutnya | Milestone dan waktu kirim berikutnya |
| Penerima | Ringkasan penerima aktif |
| Aksi | Buka data sumber, lihat detail/audit |

### Tab Kebijakan & Jadwal

Pertahankan fungsi yang sudah ada:

- Policy aktif dan versi rule set.
- Kategori mandatory/recommended/optional.
- Konfigurasi lead time yang masih diperbolehkan.
- Penerima wajib dan penerima tambahan.
- Custom message satker.
- Preview jadwal.

**Perbaikan wajib:** Preview untuk event berbasis entitas harus memakai data aktual event/entitas, bukan tanggal dummy.

### Tab Penerima

Penerima default harus diambil dari user aplikasi yang aktif dan memiliki mapping akses ke satker:

```text
users + user_accesses(active, org_id)
```

Aturan:

- Gunakan `users.email` yang sudah terdaftar/verifikasi sebagai sumber email utama.
- Jangan mengandalkan input email bebas sebagai penerima utama.
- Email tambahan eksternal hanya jika policy mengizinkan, formatnya valid, dan setiap perubahan dicatat audit.
- Penerima mandatory dari policy tidak dapat dihapus Operator.
- Jangan menyebut role PPK/Bendahara sebagai penerima teknis apabila aplikasi belum memiliki mapping role tersebut. Untuk MVP, gunakan user Operator Satker aktif atau mapping recipient yang benar-benar tersedia.

### Tab Delivery & Riwayat

Minimal tampilkan:

| Kolom | Keterangan |
|---|---|
| Waktu terjadwal | Asia/Jakarta atau timezone satker |
| Indikator/event | Policy dan milestone |
| Entitas | Nomor SPM/tagihan atau kontrak |
| Penerima | Nama + email termasker |
| Channel | Email |
| Status | `pending_provider`, `scheduled`, `queued`, `sent`, `failed`, `skipped`, `missed`, `cancelled` |
| Percobaan | Attempt/retry count |
| Detail | Error aman atau provider message ID bila tersedia |

---

## 7. Provider email dan scheduler

### Status sebelum provider siap

Jika email provider, sender domain, atau API key belum tersedia:

- Jangan mengirim email nyata.
- Gunakan mode `noop`/`pending_provider` pada dispatcher.
- Tetap buat event dan delivery agar user dapat melihat jadwal di Reminder Center.
- Tampilkan status yang jujur:

```text
Pengiriman email belum aktif. Event dan jadwal reminder telah disiapkan.
```

### Saat provider diaktifkan

Gunakan arsitektur server-side:

```text
QStash Cron
  → endpoint server yang signature-nya tervalidasi
  → select due notification_deliveries
  → idempotency / lock check
  → render React Email template
  → send via Resend/provider adapter
  → update delivery + audit log
```

Kebutuhan minimum:

- `idempotency_key` unik per entitas + event + milestone + penerima.
- Retry untuk error transient dengan batas yang ditentukan policy/sistem.
- Jangan retry alamat email invalid/bounce/suppressed tanpa intervensi.
- Simpan error yang aman; jangan simpan secret atau payload sensitif berlebihan.
- Endpoint QStash dan webhook provider harus memverifikasi signature.
- Gunakan timezone satker/`Asia/Jakarta` sesuai konfigurasi yang benar; jangan hardcode WIB bila timezone satker sudah dapat diatur.

---

## 8. Checklist wajib sebelum go-live

### Checklist data dan formula

- [ ] Rumus Belanja Kontraktual sudah sesuai contoh PDF 97,00.
- [ ] Rumus Penyelesaian Tagihan sudah sesuai contoh PDF 13/15 = 86,67.
- [ ] Kalender H+17 sama pada engine, UI, Reminder Center, Dashboard, scheduler, dan email.
- [ ] Kontrak/akun/tanggal/SP2D valid dan digunakan pada event kontraktual.
- [ ] BAST/BAPP dan konversi KPPN valid dan digunakan pada event tagihan.

### Checklist Reminder Center

- [ ] Nama `eventType` kanonis konsisten, disarankan lowercase snake_case.
- [ ] UI memakai nama event manusiawi, bukan fallback key teknis DB.
- [ ] Drawer edit mem-prefill konfigurasi yang tersimpan, bukan nilai hardcoded.
- [ ] H-0 dapat disimpan dan ditampilkan jika policy tagihan menggunakannya.
- [ ] Preview memakai data aktual untuk event aktual, bukan anchor tanggal dummy.
- [ ] Dashboard deadline terdekat memakai event/delivery nyata, bukan data hardcoded.
- [ ] Operator hanya melihat satkernya sendiri.
- [ ] Admin KPPN hanya melihat satker dalam scope-nya.

### Checklist delivery email

- [ ] Event tagihan dibuat ketika BAST/BAPP eligible disimpan.
- [ ] Event kontraktual dibuat hanya untuk eligibility yang tepat.
- [ ] Delivery dibatalkan jika tagihan sudah konversi atau event kontraktual sudah selesai.
- [ ] Tidak ada email duplikat pada retry/scheduler paralel.
- [ ] Provider belum aktif → status `pending_provider`, tanpa klaim email terkirim.
- [ ] Provider aktif → delivery memiliki `sent`/`failed` dan audit trace.
- [ ] Uji end-to-end dilakukan untuk deadline, libur, weekend, edit tanggal, konversi, cancel, retry, dan multi-termin.

---

## 9. Instruksi singkat untuk AI agent

Saat diminta membangun Reminder Center atau email reminder, gunakan instruksi berikut sebagai tambahan konteks:

```text
Gunakan arsitektur reminder eksisting: reminder_policies → org_reminder_configs → packages/policy-reminder → notification_deliveries → QStash → Resend/React Email → audit_logs. Jangan membuat scheduler atau tabel paralel tanpa kebutuhan yang disetujui.

Belanja Kontraktual dan Penyelesaian Tagihan adalah indikator berbeda. Jangan mencampur trigger atau deadline.

Untuk Penyelesaian Tagihan, event spm_ls_contract_17d dibuat dari BAST/BAPP aktual pada SPM-LS kontraktual non-pegawai yang belum dikonversi KPPN. Deadline H+17 dihitung dari tanggal pada BAST/BAPP dengan WorkdayCalendar kanonis. Event ditutup dan delivery pending dibatalkan ketika tanggal konversi KPPN diisi.

Untuk Belanja Kontraktual, gunakan event terpisah untuk kontrak dini, distribusi sampai Triwulan II, dan akselerasi akun 53. Jangan gunakan BAST/BAPP atau H+17. Gunakan tanggal kontrak untuk kontrak dini/distribusi dan tanggal SP2D untuk akselerasi 53. Filter akun 53, Rp50–200 juta, dan tipe sekaligus secara ketat untuk event akselerasi 53.

Jangan mengaktifkan pengiriman email nyata sebelum engine sumber data, kalender kerja, scheduler, provider, idempotency, audit, dan test end-to-end lulus.
```

---

## 10. Format laporan akhir agent

Agent harus menyampaikan laporan akhir minimal:

```markdown
## Perubahan arsitektur
- ...

## Event yang diintegrasikan
- `spm_ls_contract_17d`: ...
- `early_contract_due`: ...
- `contract_distribution_due`: ...
- `capital_53_contract_due`: ...

## Sumber data dan eligibility
- ...

## Deadline dan kalender kerja
- ...

## Delivery dan provider
- Provider mode: noop/pending atau aktif
- Scheduler: ...
- Idempotency: ...
- Retry/cancel: ...

## Test
- Unit: ...
- Integration: ...
- End-to-end: ...

## Risiko atau keputusan yang perlu konfirmasi
- ...
```

Jangan menyatakan reminder email siap produksi jika provider/domain sender belum dikonfigurasi atau test pengiriman end-to-end belum berhasil.