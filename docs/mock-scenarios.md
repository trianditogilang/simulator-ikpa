# Katalog Mock Scenario - Simulator Penilaian IKPA

**Status:** Canonical scenario untuk UI-first dan mock service
**Scope:** Fase 0 - F0-12
**Pemilik:** UI/UX Designer
**Sumber:** [UI/UX Wireframes](UI-UX-Wireframes.md), [FSD](FSD-Simulator-IKPA.md), dan [kontrak bersama F0-11](../packages/contracts/src/index.ts)

## 1. Tujuan dan batasan

Dokumen ini menetapkan data minimum, kondisi, expected UI, CTA, dan perilaku akses untuk scenario yang dipakai pada prototype dan mock service. Scenario harus deterministik agar screenshot, component test, dan demo menghasilkan state yang sama pada setiap run.

F0-12 hanya mendefinisikan katalog. Fixture TypeScript, mock service, route, dan komponen UI dibuat pada task berikutnya. Tidak ada scenario yang boleh dianggap sebagai nilai IKPA resmi atau data produksi.

## 2. Konvensi bersama

- Setiap scenario memiliki ID stabil `SCN-*` dan satu kondisi utama.
- Data kontrak memakai `globalContextSchema`, `accessResolutionSchema`, `snapshotDetailSchema`, `reminderPolicySchema`, `deliverySchema`, `paginatedSchema`, `commonListFilterSchema`, atau `apiErrorSchema` sesuai tabel scenario.
- UUID, tanggal, dan timestamp harus valid; timestamp menggunakan offset timezone konteks.
- Skor, bobot, target, gap, kontribusi, dan nominal selalu berupa string desimal, bukan JavaScript number.
- Gunakan organisasi, user, dan request ID sintetis. Jangan masukkan email, token, stack trace, atau data personal nyata.
- Status tidak boleh disampaikan melalui warna saja. Label teks, ikon yang bermakna, dan nama accessible harus tersedia.
- Desktop mempertahankan hierarki dashboard/tabel. Mobile menumpuk kartu, mempertahankan CTA utama, dan tidak menyembunyikan alasan state.
- Setiap CTA memiliki tujuan yang jelas. Jika tindakan tidak diizinkan, tampilkan alasan dan jalur pemulihan.

## 3. Matriks cakupan

| ID | Scenario | Peran utama | Route utama | Wireframe/state | Kontrak utama |
|---|---|---|---|---|---|
| SCN-NORMAL | Data lengkap dan sehat | Operator Satker | `/operator/dashboard` | WF-OPS-01 | Global context, snapshot detail |
| SCN-EMPTY | Belum ada data | Operator Satker | `/operator/data/rpd-realization` | WF-STATE-02, WF-OPS-04 | Pagination, filter |
| SCN-INCOMPLETE | Data belum lengkap | Operator Satker | `/operator/simulation` | WF-STATE-03, WF-OPS-02 | Snapshot detail, indicator result |
| SCN-RISKY | Nilai atau deadline berisiko | Operator Satker | `/operator/dashboard` | WF-OPS-01 | Snapshot detail, policy, delivery |
| SCN-STALE-RULE-SET | Snapshot memakai aturan lama | Operator Satker | `/operator/history` | WF-STATE-05, WF-OPS-10 | Snapshot summary, global context |
| SCN-POLICY-LOCKED | Field reminder dikunci policy | Operator Satker | `/operator/reminders` | WF-STATE-06, WF-OPS-12 | Reminder policy, policy lock |
| SCN-DELIVERY-FAILED | Reminder gagal dikirim | Operator Satker dan Admin KPPN | `/operator/reminders` | WF-OPS-12, WF-ADM-04 | Delivery, reminder policy |
| SCN-UNAUTHORIZED | User login tanpa mapping aktif | Pengguna tanpa akses | `/access-pending` | WF-03, access state | Access resolution |
| SCN-SERVER-ERROR | Fetch atau mutation gagal | Operator Satker | `/operator/dashboard` | WF-STATE-07 | Structured API error |

## 4. Detail scenario

### SCN-NORMAL - Data lengkap dan sehat

**Kondisi**

- `access.status` adalah `operator_single_scope`.
- `globalContext.ruleSet.status` adalah `published` dan `activeOrganization` terisi.
- Snapshot memiliki `totalScore: "94.20"`, tujuh indikator berstatus `complete`, `missingData: []`, dan `warnings: []`.
- Tidak ada deadline kritis; delivery terdekat berstatus `scheduled` bila kartu reminder ditampilkan.

**Expected UI**

- Desktop menampilkan nilai IKPA, target, gap, rule set, tujuh kartu indikator, tren, kelengkapan data, deadline, dan tindakan prioritas dalam urutan wireframe.
- Mobile menampilkan nilai dan status rule set terlebih dahulu, lalu deadline, tindakan prioritas, indikator, tren ringkas, dan kelengkapan data secara vertikal.
- Nilai `94.20` diberi konteks periode, waktu kalkulasi, dan label `Simulasi internal`; status sehat tetap memiliki label teks.
- Kartu indikator dapat dibuka ke detail formula atau halaman sumber data.

**CTA dan batasan**

- `Input Data` membuka domain input yang relevan.
- `Simulasi` membuka mode actual pada periode aktif.
- Kartu indikator dan tindakan prioritas membuka detail sesuai domainnya.
- Tidak menampilkan tombol atau klaim yang menyiratkan nilai resmi pemerintah.

**Acceptance**

- Semua informasi utama terbaca tanpa hover.
- Keyboard dapat mencapai kartu/CTA yang interaktif.
- Tidak ada data personal atau field database mentah pada tampilan.

### SCN-EMPTY - Belum ada data

**Kondisi**

- Context operator valid dan periode sudah dipilih.
- Hasil list memakai `items: []`, `totalItems: 0`, dan `totalPages: 0`.
- Filter yang aktif tidak menghasilkan data tersimpan pada domain RPD dan realisasi.

**Expected UI**

- Tabel tidak dirender sebagai tabel kosong tanpa penjelasan.
- Tampilkan ikon non-dekoratif, judul `Belum ada data RPD dan realisasi`, serta penjelasan bahwa data dapat ditambahkan manual atau melalui template.
- Desktop menempatkan empty state pada area konten dengan dua CTA yang sejajar; mobile menumpuk CTA dengan lebar yang mudah ditekan.
- Jangan menampilkan score nol seolah-olah hasil perhitungan.

**CTA dan batasan**

- `Tambah Data` membuka form domain RPD dan realisasi.
- `Import Template` membuka alur import.
- Filter dan pagination tetap tersedia bila pengguna ingin mengubah konteks.

**Acceptance**

- Empty state membedakan `belum ada data` dari `data tidak ditemukan` akibat filter.
- CTA memiliki accessible name dan fokus terlihat.
- Setelah filter diubah, state dapat beralih ke normal atau empty tanpa reload penuh.

### SCN-INCOMPLETE - Data belum lengkap

**Kondisi**

- Snapshot memiliki `totalScore: null` atau score estimasi sesuai keputusan engine.
- Setidaknya satu `indicatorResult.status` adalah `incomplete` dengan `score: null`.
- `missingData` berisi domain yang dapat ditindaklanjuti, misalnya `Capaian Output` dan `RPD bulan Agustus akun 53`.
- `warnings` menjelaskan mengapa hasil belum mewakili seluruh indikator.

**Expected UI**

- Banner di atas hasil menyatakan bahwa nilai masih estimasi atau belum lengkap.
- Tampilkan daftar domain terdampak dan jumlah data yang belum lengkap; jangan menyembunyikannya di tooltip.
- Nilai yang tidak dapat dihitung ditampilkan sebagai `-` atau label `Belum tersedia`, bukan angka yang tampak final.
- Desktop mempertahankan breakdown agar pengguna memahami bagian yang tersedia; mobile menampilkan banner dan CTA perbaikan sebelum grafik.

**CTA dan batasan**

- Setiap item `missingData` memiliki CTA `Buka` menuju domain sumber.
- `Simpan Snapshot` dinonaktifkan atau diberi konfirmasi yang jelas bila snapshot incomplete memang diizinkan oleh engine.
- Ekspor harus mempertahankan label incomplete dan disclaimer.

**Acceptance**

- Pengguna dapat menemukan alasan incomplete dalam satu langkah dari hasil.
- Status incomplete tidak bergantung pada warna.
- Perbaikan data mengarahkan kembali ke perhitungan tanpa menghapus data actual.

### SCN-RISKY - Nilai atau deadline berisiko

**Kondisi**

- Snapshot memiliki score di bawah target, misalnya `totalScore: "74.80"`, dan minimal satu gap negatif atau warning risiko.
- Terdapat delivery reminder berstatus `scheduled` dengan jadwal dekat deadline dan policy `dayType: "workday"`.
- Tindakan prioritas memiliki domain sumber yang dapat dibuka, misalnya tagihan, realisasi, atau capaian output.

**Expected UI**

- Kartu risiko muncul sebelum tren atau informasi sekunder.
- Tampilkan alasan risiko, sisa waktu dalam unit yang benar, rule set, dan konsekuensi yang dapat dipahami tanpa menjanjikan skor tertentu.
- Desktop menampilkan deadline dan tindakan prioritas berdampingan dengan score; mobile menempatkan deadline di bawah score dan sebelum daftar tindakan.
- Indikator berisiko memiliki label `Perlu perhatian` atau label domain setara, ikon, dan teks penjelas.

**CTA dan batasan**

- `Buka data` mengarah ke entitas sumber dengan filter yang relevan.
- `Lihat reminder` mengarah ke konfigurasi atau status delivery.
- Jangan mengubah data actual hanya karena pengguna membuka atau menjalankan scenario forecast.

**Acceptance**

- Risiko terlihat sebelum pengguna perlu membuka grafik.
- Sisa waktu mengikuti timezone dan kalender kerja konteks.
- CTA tidak mengarah ke halaman yang tidak dapat diakses oleh role aktif.

### SCN-STALE-RULE-SET - Snapshot memakai aturan lama

**Kondisi**

- `snapshot.ruleSet.status` adalah `retired` atau versinya berbeda dari `globalContext.ruleSet.version` yang aktif.
- Snapshot menyimpan `ruleSet`, `calendarVersionId`, dan `createdAt` historis.
- Rule set aktif tidak menggantikan referensi yang tersimpan pada snapshot.

**Expected UI**

- Tampilkan banner informatif: snapshot dihitung dengan versi lama, sedangkan versi aktif saat ini berbeda.
- Badge versi muncul dekat judul snapshot dan dapat dibaca pada desktop maupun mobile.
- Desktop menampilkan banner penuh di atas breakdown; mobile menampilkan banner ringkas dengan detail yang dapat dibuka.
- Score historis tetap ditampilkan sebagai hasil historis, bukan dihitung ulang diam-diam.

**CTA dan batasan**

- `Lihat perbedaan aturan` membuka detail perbandingan read-only bila tersedia.
- `Hitung dengan aturan aktif` membuat simulasi baru atau forecast terpisah; tidak menimpa snapshot lama.
- Jangan menawarkan edit langsung pada snapshot immutable.

**Acceptance**

- Versi snapshot dan versi aktif tidak tertukar.
- Informasi historis tetap dapat dibaca ketika rule set lama sudah retired.
- State tidak memaksa pengguna menerima hasil baru sebagai pengganti hasil lama.

### SCN-POLICY-LOCKED - Field reminder dikunci policy

**Kondisi**

- `reminderPolicy.category` adalah `mandatory`.
- `reminderPolicy.lock.locked` adalah `true`, `reason` menjelaskan dasar penguncian, dan `fields` menyebut field yang tidak dapat diubah.
- `allowedLeadDays` dan `requiredLeadDays` tersedia; konfigurasi mengikuti policy yang aktif.

**Expected UI**

- Tampilkan label `Diatur oleh policy KPPN`, ikon lock, alasan, kategori mandatory, jenis hari, dan rentang lead time.
- Field yang dikunci memakai disabled/read-only state dengan alasan yang tetap terbaca oleh screen reader.
- Desktop menampilkan detail policy di samping editor; mobile menampilkan ringkasan lock sebelum field konfigurasi.
- Field yang masih dapat disesuaikan tetap memiliki kontrol normal dan batas validasi yang terlihat.

**CTA dan batasan**

- Operator tidak dapat menonaktifkan event mandatory atau menghapus penerima wajib.
- Operator dapat menambah reminder dalam rentang yang diizinkan dan mengatur opsi personal yang tidak dikunci.
- `Reset ke default` hanya mengembalikan field yang boleh ditimpa.

**Acceptance**

- Pengguna memahami mengapa kontrol tertentu disabled.
- State locked tidak hanya menggunakan warna atau icon tanpa label.
- Nilai konfigurasi tidak keluar dari `allowedLeadDays` dan tidak melewati deadline.

### SCN-DELIVERY-FAILED - Reminder gagal dikirim

**Kondisi**

- `delivery.status` adalah `failed`, `attemptCount` lebih dari nol, `sentAt` null, dan `errorCode` berisi kode aman seperti `DELIVERY_PROVIDER_TIMEOUT`.
- `recipientCount` menunjukkan jumlah penerima yang dituju tanpa menampilkan alamat email mentah.
- Delivery memiliki `idempotencyKey` dan referensi rule set/calendar yang sama dengan event.

**Expected UI**

- Tampilkan status `Gagal dikirim`, waktu jadwal, jumlah percobaan, penerima, dan langkah pemulihan.
- Desktop menampilkan detail delivery dan tindakan retry dalam row/detail panel; mobile menampilkan kartu gagal dengan retry sebagai CTA utama.
- Pesan error menggunakan bahasa pengguna dan tidak membocorkan response provider, credential, atau stack trace.
- Admin KPPN dapat melihat scope organisasi dan status delivery; Operator hanya melihat delivery satkernya.

**CTA dan batasan**

- `Coba lagi` tersedia jika policy dan status mengizinkan retry.
- Retry tidak membuat delivery ganda untuk logical event yang sama.
- Jika retry tidak diizinkan, tampilkan alasan dan arahkan ke Admin KPPN atau konfigurasi penerima yang relevan.

**Acceptance**

- Status failed dapat dibedakan dari cancelled, skipped, dan processing melalui label teks.
- Request retry mempertahankan auditability dan idempotency.
- Detail yang tampil tetap sesuai scope role.

### SCN-UNAUTHORIZED - User login tanpa mapping aktif

**Kondisi**

- `access.status` adalah `unmapped` dengan `userId` terverifikasi.
- Tidak ada `activeOrganization`, `activeKppnScope`, snapshot, delivery, atau data operasional yang dikirim ke halaman.
- Kondisi merepresentasikan pengguna login yang belum memiliki akses aktif, bukan kegagalan autentikasi.

**Expected UI**

- Route `/access-pending` menjelaskan bahwa akses belum diberikan dan pengguna perlu menghubungi Admin KPPN.
- Tampilkan identitas yang sudah disamarkan oleh identity layer bila perlu; jangan menampilkan email mentah dari mock payload.
- Desktop menempatkan pesan, langkah berikutnya, dan tombol logout dalam satu panel; mobile mempertahankan urutan yang sama tanpa overflow.
- Jangan menampilkan navigasi Operator/Admin, nama satker, KPPN, score, atau data lain yang memerlukan scope.

**CTA dan batasan**

- `Hubungi Admin KPPN` membuka instruksi kontak yang aman atau tautan bantuan yang disediakan aplikasi.
- `Keluar` mengakhiri session melalui provider auth.
- Redirect ke dashboard tidak boleh dilakukan sebelum mapping akses tersedia.

**Acceptance**

- State tidak dapat digunakan untuk menebak apakah email tertentu terdaftar pada organisasi.
- Back/refresh tidak membuka data terlindungi.
- Pesan dapat dibaca keyboard dan screen reader.

### SCN-SERVER-ERROR - Fetch atau mutation gagal

**Kondisi**

- Response memakai `apiErrorSchema`, misalnya `code: "SERVICE_UNAVAILABLE"`, message aman, `requestId: "req_mock_5001"`, dan `retryable: true`.
- Tidak ada raw error, stack trace, query, secret, atau detail provider pada payload client.
- Context dan filter terakhir tetap diketahui oleh shell agar retry tidak kehilangan konteks.

**Expected UI**

- Tampilkan alert `Data tidak dapat dimuat`, penjelasan singkat, request ID, dan CTA `Coba lagi` bila `retryable` true.
- Error ditempatkan pada area yang gagal; shell, context header, dan navigasi tidak ikut menjadi blank screen bila masih tersedia.
- Desktop mempertahankan lebar area konten; mobile menampilkan error card tanpa horizontal overflow.
- Setelah retry berhasil, error diganti state data yang sesuai tanpa toast yang menjadi satu-satunya bukti pemulihan.

**CTA dan batasan**

- `Coba lagi` mengulang operasi idempotent dengan context/filter yang sama.
- Jika `retryable` false, CTA mengarah ke jalur bantuan atau kembali ke halaman aman.
- Jangan meminta pengguna mengirim screenshot yang berisi secret atau data personal.

**Acceptance**

- Request ID dapat disalin atau dibaca, tetapi tidak memuat informasi sensitif.
- Keyboard focus berpindah ke heading/error setelah operasi gagal.
- Error server tidak disamarkan menjadi empty state.

## 5. Aturan transisi state

| Kondisi response | State yang diprioritaskan | Catatan |
|---|---|---|
| Request sedang berjalan | Loading | Gunakan skeleton dan pertahankan layout |
| Response sukses tanpa item | Empty | Bedakan dari hasil filter yang tidak cocok |
| Response sukses dengan data kurang | Incomplete | Data yang tersedia tetap dapat dibaca |
| Response sukses dengan warning deadline/score | Risky | CTA perbaikan tampil dekat sumber risiko |
| Snapshot memiliki rule set berbeda | Stale rule set | Informasi historis tidak diubah |
| Policy mengunci field | Policy locked | Alasan lock wajib terlihat |
| Delivery selesai dengan error | Delivery failed | Retry harus idempotent |
| Access mapping tidak ada | Unauthorized | Tidak boleh memuat data scoped |
| Response gagal | Server error | Jangan jatuh ke empty state |

State `loading` adalah state transisi umum dari wireframe, sedangkan sembilan scenario di atas adalah scenario acceptance F0-12. Satu screen dapat menggabungkan state, tetapi state yang paling membatasi akses atau interpretasi data harus menang.

## 6. Checklist handoff

- [x] Scenario normal memiliki expected UI desktop/mobile dan CTA.
- [x] Scenario empty memiliki empty state yang dapat ditindaklanjuti.
- [x] Scenario incomplete menampilkan domain data yang kurang dan label estimasi.
- [x] Scenario risky menampilkan risiko, deadline, dan tindakan prioritas.
- [x] Scenario stale rule set menjaga snapshot historis tetap immutable.
- [x] Scenario policy locked menjelaskan field yang dikunci dan opsi dinamis yang masih diizinkan.
- [x] Scenario delivery failed menjaga retry, scope, error aman, dan idempotency.
- [x] Scenario unauthorized gagal tertutup tanpa data scoped.
- [x] Scenario server error memakai structured error dan request ID aman.
- [x] Semua scenario memiliki jalur pemulihan dan catatan aksesibilitas.

## 7. Handoff ke task berikutnya

- F1-13 membuat mock service dan scenario selector berdasarkan ID pada katalog ini.
- F3-01 sampai F3-18 memakai scenario sesuai route dan kontrak masing-masing.
- F5-03 memvalidasi state loading, empty, incomplete, error, policy lock, dan stale rule set secara visual/fungsional.
- F5-04 menjalankan smoke test navigasi dan memastikan setiap CTA memiliki route yang valid.

Katalog ini tidak menetapkan nilai regulasi baru. Parameter yang belum diverifikasi tetap mengikuti [status verifikasi regulasi 2026](regulatory-verification-2026.md).
