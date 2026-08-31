# ADR-007 — Precedence Akses Admin KPPN dan Operator Satker

- Status: Accepted
- Tanggal: 31 Agustus 2026
- Pemilik: Product & IKPA Analyst
- Task: F0-09
- Terkait: F0-11, F2-05, F8-03, F8-04, ADR-005

## Konteks

Simulator IKPA memiliki satu mekanisme login Clerk dan dua jenis akses aplikasi:

- `operator_satker`, untuk mengelola data dan simulasi satker yang dipetakan;
- `admin_kppn`, untuk monitoring, policy, audit, dan manajemen akses dalam scope KPPN.

Satu email tidak boleh sekaligus menjadi Admin KPPN dan Operator Satker. Aturan ini menghilangkan kebutuhan memilih role saat login, tetapi tetap harus menetapkan perilaku untuk beberapa scope satker/KPPN, pergantian konteks, session yang masih aktif, mapping yang dicabut, dan akses ke URL yang salah.

Keputusan ini memakai `user_accesses` pada PRD sebagai mapping akses internal. Clerk hanya membuktikan identitas; mapping internal menentukan otorisasi dan scope.

## Keputusan

### Invariant akses

1. Satu identitas aplikasi hanya memiliki satu `access_type` aktif: `operator_satker` atau `admin_kppn`.
2. Satu email ter-normalisasi tidak boleh dipetakan ke dua jenis akses aktif.
3. Beberapa baris mapping dengan jenis yang sama tetap diperbolehkan untuk beberapa scope. Contohnya, satu Operator dapat memiliki mapping ke beberapa satker; ini bukan akses ganda.
4. Mapping Operator wajib memiliki `org_id` dan tidak memiliki `kppn_scope_id`.
5. Mapping Admin wajib memiliki `kppn_scope_id` dan tidak memiliki `org_id` sebagai scope mutasi satker.
6. Mapping nonaktif tidak ikut dalam resolver, tetapi tetap dipertahankan untuk audit.
7. Konflik legacy atau race condition yang menghasilkan dua jenis akses tidak diselesaikan dengan precedence. Resolver fail closed, mencatat security event, dan menampilkan halaman akses perlu diperbaiki.

Identitas canonical untuk request adalah `clerk_user_id` dari session yang telah diverifikasi. Email dipakai untuk provisioning dan uniqueness bisnis, bukan sebagai nilai identitas yang dipercaya dari browser. Email yang digunakan untuk mapping harus ter-normalisasi dan terverifikasi sesuai kebijakan account Clerk.

### Enforcement data

Implementasi F8-03/F8-04 wajib menjamin invariant di atas pada dua lapisan:

- constraint/trigger atau access-profile canonical di database untuk mencegah mixed access type;
- transaksi server yang mengunci user saat menambah, mengubah, menonaktifkan, atau menghapus mapping.

Model minimal yang disarankan adalah satu access profile aktif per user yang menyimpan `access_type`, dengan baris scope terpisah untuk `org_id` atau `kppn_scope_id`. Jika implementasi mempertahankan `access_type` di setiap baris `user_accesses`, constraint database tetap harus menolak lebih dari satu jenis aktif untuk `user_id`; validasi aplikasi saja tidak cukup.

Perubahan access mapping selalu menghasilkan audit log dengan actor, target user, access type lama/baru, scope lama/baru, aksi, timestamp, dan request ID. Perubahan dilakukan atomik: tidak ada jendela sukses yang membuat user tanpa kontrol akses yang konsisten atau memiliki dua jenis akses aktif.

## Resolver dan redirect

Resolver berjalan di server setelah Clerk mengautentikasi request. Resolver mengembalikan salah satu hasil berikut:

| Hasil | Kondisi | Perilaku |
|---|---|---|
| `unauthenticated` | Tidak ada session Clerk valid | Route publik tetap tersedia; route protected mengarah ke login dengan return path relatif yang aman |
| `unmapped` | User terautentikasi, tetapi tidak ada mapping aktif | Arahkan ke `/access-pending`; jangan query atau tampilkan data aplikasi |
| `operator_single_scope` | Satu jenis akses Operator dan satu satker aktif | Arahkan ke dashboard Operator dengan satker tersebut sebagai konteks |
| `operator_multiple_scopes` | Satu jenis akses Operator dan lebih dari satu satker aktif | Arahkan ke `/select-organization` sebelum membuka data |
| `admin` | Satu jenis akses Admin dengan satu atau beberapa scope KPPN | Arahkan ke dashboard Admin KPPN; filter scope adalah konteks monitoring, bukan role baru |
| `invalid_conflict` | Mapping aktif memiliki dua jenis akses atau shape tidak valid | Fail closed, tampilkan error akses aman, audit security event, dan minta Admin memperbaiki mapping |

Redirect setelah login tidak ditentukan oleh role dari URL, query parameter, local storage, atau claim buatan client. `returnTo` hanya boleh berupa path internal yang diizinkan; URL absolut atau host lain ditolak untuk mencegah open redirect.

### Matriks route protected

| Pengguna | Route Operator | Route Admin | Route public |
|---|---|---|---|
| Tidak terautentikasi | 401/login | 401/login | Boleh |
| Tidak memiliki mapping | 403/`/access-pending` | 403/`/access-pending` | Boleh |
| `operator_satker` | Boleh hanya pada `org_id` terpetakan | 403; tidak membocorkan data Admin | Boleh |
| `admin_kppn` | 403 untuk route mutasi Operator | Boleh dalam scope KPPN | Boleh |
| Konflik akses | Fail closed | Fail closed | Boleh |

Untuk resource individual di luar scope, server dapat merespons 404 generik agar keberadaan data tidak dapat dienumerasi. Untuk route yang benar tetapi jenis akses salah, gunakan structured 403 yang tidak memuat data sensitif.

## Pemilihan dan pergantian konteks

### Operator Satker

- Satu satker: sistem memilih otomatis dan tidak menampilkan picker yang tidak perlu.
- Beberapa satker: pengguna wajib memilih satker pada `/select-organization`.
- Pilihan satker hanya berasal dari mapping aktif milik user; daftar tidak menerima `org_id` bebas dari client.
- Satker aktif direpresentasikan di URL route atau parameter route yang divalidasi server. State client hanya membantu tampilan dan bukan security boundary.
- Pergantian satker hanya boleh menuju mapping satker lain milik user yang sama. Setelah berganti, semua query dan mutation memakai `org_id` aktif yang telah diverifikasi.
- Jika satker dinonaktifkan atau mapping dicabut, request berikutnya membatalkan konteks dan mengarah ke picker atau `/access-pending`.

### Admin KPPN

- Dashboard Admin memuat seluruh KPPN scope yang diizinkan atau filter scope yang dipilih pengguna.
- Admin dapat membuka detail satker dalam scope KPPN secara read-only sesuai PRD.
- Memilih detail satker bukan pergantian menjadi Operator dan tidak memberi hak mutasi data operasional satker.
- Semua filter/detail scope divalidasi server terhadap `kppn_scope_id`; ID satker dari URL tidak cukup untuk membuktikan kewenangan.

### Batas pergantian akses

Pengguna tidak dapat mengganti `operator_satker` menjadi `admin_kppn` dari UI, dan tidak ada session yang membawa dua role. Hanya Admin KPPN yang berwenang mengubah mapping sesuai fitur manajemen akses. Perubahan jenis akses dilakukan sebagai satu transaksi terkontrol dan berlaku pada pemeriksaan authorization berikutnya.

## Perilaku session

1. Clerk session yang terverifikasi adalah sumber identitas dan status autentikasi.
2. Server mengambil `userId`/subject dari session; server kemudian membaca access mapping internal pada setiap request protected atau melalui cache yang memiliki invalidation yang dapat dibuktikan.
3. Role, `org_id`, dan `kppn_scope_id` tidak dipercaya dari cookie client, local storage, hidden input, atau query tanpa re-check database.
4. Tidak dibuat custom role session kedua. Konteks satker aktif cukup disimpan sebagai bagian dari route/UI dan diverifikasi ulang; ini menghindari state role yang stale.
5. Setelah refresh atau login ulang, resolver mengulang aturan redirect yang sama: Admin ke dashboard Admin, Operator satu scope ke dashboard, Operator multi-scope ke picker.
6. Session Clerk yang masih hidup tidak menjadikan mapping lama tetap valid. Setelah mapping dicabut atau diubah, request berikutnya harus memakai mapping baru; konteks lama menerima 403/redirect sesuai hasil resolver.
7. Perubahan access type tidak memerlukan role switch manual. Aplikasi meng-invalidasi konteks lama secara logis dan mengarahkan ke dashboard kanonis pada request berikutnya.
8. Semua device/session user menerima aturan mapping yang sama. Tidak ada bypass berbasis session perangkat.
9. Setelah logout, seluruh konteks UI dibuang. Login kembali tidak boleh memulihkan satker yang sudah tidak terpetakan.
10. Error resolver tidak menampilkan daftar satker/KPPN, email internal, atau alasan detail yang membantu enumerasi akses.

Server menggunakan pola verifikasi session Clerk pada boundary protected sebelum menjalankan query atau mutation. `clerk_user_id` yang telah diverifikasi dipetakan ke record internal; response API hanya mengembalikan context DTO minimum yang diperlukan UI.

## Audit perubahan akses

Audit wajib untuk:

- menambah mapping Admin atau Operator;
- mengubah tipe akses atau scope;
- menonaktifkan atau menghapus mapping;
- menolak perubahan karena akan membuat mixed access type;
- mendeteksi konflik mapping legacy atau inkonsistensi data.

Pergantian konteks satker biasa tidak perlu menjadi audit mutation tersendiri. Jika observability membutuhkannya, catat sebagai security/access event minimal tanpa email atau daftar scope penuh.

## Perbandingan pendekatan

| Pendekatan | Redirect dan scope | Keamanan session | Kompleksitas | Putusan |
|---|---|---|---|---|
| Satu jenis akses per email + resolver deterministik | Tidak perlu role picker; picker hanya untuk beberapa scope sejenis | Fail closed, server re-check, tidak ada role stale | Rendah; sesuai model mapping PRD | Dipilih |
| Dua role per email + Admin precedence | Redirect memang deterministik, tetapi Operator tetap tersembunyi di session | Risiko privilege confusion dan kebocoran konteks | Sedang; membutuhkan aturan role switching tambahan | Ditolak karena bertentangan dengan aturan pengguna |
| Role switch dalam satu session | Fleksibel untuk berpindah area | Context/role stale sulit dibatalkan dan memperbesar attack surface | Tinggi; perlu session state dan invalidation tambahan | Ditolak untuk MVP |
| Memakai Clerk organization role sebagai sumber tunggal | Integrasi auth tampak sederhana | Tidak merepresentasikan mapping internal dan scope bisnis secara cukup | Sedang; migrasi model akses lebih mahal | Ditolak; mapping aplikasi tetap source of truth |

## Konsekuensi

### Positif

- redirect login dapat diprediksi dan tidak membutuhkan pilihan role;
- satu email tidak memiliki ambiguitas hak akses;
- operator multi-satker tetap didukung melalui picker scope sejenis;
- setiap request dapat dipastikan memakai scope yang terotorisasi;
- revokasi akses berlaku tanpa menunggu logout manual;
- model cocok dengan UI `/select-organization`, dashboard terpisah, dan access resolver downstream.

### Negatif

- resolver dan scope guard harus berjalan di server pada semua route/data mutation;
- perubahan mapping perlu transaksi, constraint/trigger, dan audit log;
- operator multi-satker memerlukan picker dan state konteks;
- session Clerk yang valid tidak cukup untuk menjelaskan otorisasi sehingga perlu lookup internal.

## Kontrak downstream

ADR ini menjadi dasar untuk:

- F0-11: DTO context harus memuat `accessType`, scope yang diizinkan, dan `activeOrgId` bila relevan; tidak memuat data sensitif yang tidak dibutuhkan UI.
- F2-05: halaman pilih satker hanya muncul untuk Operator dengan lebih dari satu mapping aktif.
- F8-03: resolver mengimplementasikan hasil `unauthenticated`, `unmapped`, `operator_single_scope`, `operator_multiple_scopes`, `admin`, dan `invalid_conflict`.
- F8-04: setiap query/mutation menerapkan scope guard server-side.
- Manajemen akses Admin: perubahan mapping menggunakan konfirmasi, audit, dan transaksi atomik.

## Checklist Penerimaan F0-09

- [x] Satu email hanya boleh memiliki satu jenis akses aktif: Admin KPPN atau Operator Satker.
- [x] Redirect default untuk unauthenticated, unmapped, Operator single-scope, Operator multi-scope, dan Admin ditetapkan.
- [x] Pilihan satker untuk Operator multi-scope ditetapkan.
- [x] Pergantian konteks satker dan batas scope Admin ditetapkan.
- [x] Session Clerk, lookup mapping internal, invalidasi konteks, dan larangan role switch ditetapkan.
- [x] Konflik legacy/mixed access memiliki perilaku fail-closed.
- [x] Perubahan mapping memiliki transaksi dan audit log.

## Referensi

- [PRD Simulator IKPA](../PRD-Simulator-IKPA.md)
- [UI/UX Design System](../UI-UX-Design-System.md)
- [Task List Simulator IKPA](../TASK-LIST-Simulator-IKPA.md)
- [Clerk — authenticate incoming requests](https://github.com/clerk/clerk-docs/blob/main/docs/_partials/authenticate-req.mdx)
- [Clerk — Backend overview](https://github.com/clerk/clerk-docs/blob/main/docs/reference/backend/overview.mdx)

