# ADR-008 — Residensi Data dan Stack Self-Hosted di Indonesia

- Status: Accepted (keputusan pemilik 2026-11-15); implementasi berjalan. Per 2026-11-18: MIG-00, MIG-01, MIG-02, MIG-04 selesai; MIG-03 dan MIG-05 terimplementasi (Needs Fix, menunggu SMTP dan DNS pengirim); MIG-06 Ready; MIG-07 Blocked. Status terkini: `docs/BACKLOG.md`
- Tanggal: 15 November 2026
- Pemilik: Solution Architect / Product Owner
- Task: MIG-00
- Terkait: MIG-01–MIG-07, F13-09, F13-10, F13-11, ADR-005, ADR-006, ADR-007, `docs/data-retention-and-classification.md`
- Menggantikan sebagian: ADR-006 bagian 4 (Cloudflare R2) dan seluruh asumsi runtime serverless Vercel

## Konteks

Kontrak aktif Revisi v2 menetapkan stack terkelola yang seluruhnya berada di luar Indonesia: Vercel (hosting), Neon (PostgreSQL), Clerk (autentikasi), Upstash QStash (scheduler/antrean), Resend (email), dan Cloudflare (DNS/CDN/WAF, R2 untuk berkas import).

Pemilik produk menetapkan bahwa data aplikasi, yang mencakup data anggaran dan realisasi satker (`CONFIDENTIAL`) serta data identitas dan akses (`RESTRICTED`), harus disimpan dan diproses pada server yang berada di Indonesia demi kepatuhan terhadap aturan penempatan data terkait keuangan.

Kondisi saat keputusan dibuat:

- Fase 13 belum selesai; task yang tersisa (F13-09, F13-10, F13-11, F13-13, F13-14) semuanya bergantung pada infrastruktur.
- Belum ada pengguna atau data produksi. Clerk dan Neon hanya berisi data uji, dan environment Production di Vercel belum pernah diaktifkan.
- Bukti F13-02 sampai F13-08 diperoleh pada stack lama (Clerk + Neon + Vercel Preview).

## Keputusan

Seluruh layanan pihak ketiga yang menyimpan atau memproses data aplikasi diganti dengan komponen yang dijalankan sendiri pada VPS di Indonesia.

| Kebutuhan | Stack lama | Stack baru | Task |
|---|---|---|---|
| Database | Neon (`@neondatabase/serverless`) | PostgreSQL di VPS, driver `pg` + `drizzle-orm/node-postgres` | MIG-01 |
| Hosting/runtime | Vercel, Nitro zero-config | Nitro preset `node-server` dalam container di VPS | MIG-02 |
| Autentikasi | Clerk | Better Auth self-hosted; tabel auth di PostgreSQL yang sama | MIG-03 |
| Scheduler/antrean | Upstash QStash | Cron di VPS memanggil endpoint job dengan shared secret; antrean memakai tabel delivery yang sudah ada | MIG-04 |
| Email | Resend API | SMTP (`nodemailer`); template React Email tidak berubah | MIG-05 |
| Storage import | Cloudflare R2 (baru sebatas env, belum ada `S3Client` di kode) | Direktori privat di VPS, tidak dilayani publik | MIG-06 |
| Edge/security | Cloudflare DNS/CDN/WAF | Reverse proxy (Caddy atau Nginx) + TLS Let's Encrypt + firewall host | F13-10 |
| Observability | Vercel Logs; Sentry opsional | Log terstruktur ke stdout dengan rotasi di host; alert lewat SMTP | F13-11 |

### Ketentuan autentikasi

- Pengguna dapat mendaftar dan masuk sendiri dengan email dan kata sandi.
- Undangan dari Admin KPPN tetap tersedia sebagai jalur tambahan; undangan bukan syarat untuk mendaftar.
- Verifikasi kedua memakai kode OTP yang dikirim ke email pengguna (keputusan pemilik 2026-11-15). Aplikasi authenticator (TOTP) dan SMS tidak dipakai.
- Kode OTP diminta saat mendaftar (verifikasi email), saat reset kata sandi, dan saat login dari perangkat atau browser yang belum dikenal. Login berikutnya dari perangkat yang sama cukup email + kata sandi.
- "Perangkat dikenal" ditandai cookie tepercaya `HttpOnly`/`Secure` berumur terbatas (usulan 30 hari) yang dicabut saat kata sandi diganti atau akun di-reset Admin. Mekanisme persisnya ditetapkan pada desain MIG-03.
- Aturan pengaman OTP: 6 digit, berlaku sekitar 10 menit, sekali pakai, disimpan ter-hash, dengan batas percobaan salah dan batas kirim ulang per email dan IP. Kode tidak pernah masuk log atau response.
- Karena OTP email adalah bagian alur login, MIG-05 (SMTP) dikerjakan bersama MIG-03. Pengembangan lokal memakai penangkap email lokal.
- Otorisasi tidak berubah: `user_accesses` dan Access Resolver tetap menjadi sumber kebenaran, dan precedence pada ADR-007 tetap berlaku. Rujukan "login Clerk" pada ADR-007 dibaca sebagai "login Better Auth" setelah MIG-03 selesai.
- Perilaku yang wajib dipertahankan: onboarding kode + nama satker, satu Operator aktif per satker, slot admin, hard delete dengan proteksi self dan admin terakhir, serta blind auth guard.
- Sinkronisasi lewat webhook (`/api/webhooks/clerk`) dan route `sso-callback` dihapus karena akun dan mapping akses berada dalam satu database; hard delete menjadi satu transaksi lokal.
- `users.clerk_user_id` diganti rujukan ke user auth dan `organizations.clerk_org_id` dihapus. Bentuk kolom final ditetapkan pada tahap desain MIG-03 dan dicatat sebagai addendum ERD lanjutan sebelum migration dibuat.
- "MFA opsional" pada kontrak v2 dibaca sebagai OTP email di atas. Tidak ada bentuk MFA lain dalam scope.

### Ketentuan scheduler, email, dan storage

- Idempotency key, status delivery, dan aturan retry yang sudah lulus F13-03 dipertahankan. Hanya pemicu dan verifikasi asal request yang berubah.
- Endpoint job menolak request tanpa secret yang benar dan tidak boleh dapat diakses dari internet publik bila reverse proxy bisa membatasinya ke loopback.
- Library antrean berbasis PostgreSQL boleh dipilih pada MIG-04 hanya bila cron + tabel delivery tidak cukup untuk retry/backoff; pilihan itu dicatat di DEVLOG.
- Berkas import disimpan dengan nama acak buatan server, dihapus saat job terminal, dan disapu paling lambat 7 hari sesuai kebijakan retensi. Batas 10 MB dan 10.000 baris tidak berubah; batas body 4,5 MB milik Vercel tidak lagi relevan.

### Yang tidak berubah

- Formula IKPA, IA 8 indikator, actual/what-if, Slot A/B/C, reminder mandatory, dan seluruh acceptance criteria V2-AC-01..24.
- Skema data domain di luar tabel identitas.
- Drizzle ORM, TanStack Start, React Email, `big.js`, dan `exceljs`.

## Hubungan dengan aturan Fase 13

Mode Fase 13 melarang refactor lintas folder dan penggantian dependency besar kecuali terbukti wajib untuk security atau deployment. Keputusan ini adalah pengecualian eksplisit yang disetujui pemilik karena merupakan syarat deployment. Pengecualian hanya berlaku untuk task MIG-01–MIG-07; perubahan perilaku produk tetap mengikuti jalur UIFIX dengan amandemen spesifikasi.

Selama sebuah task MIG belum selesai, implementasi dan bagian spesifikasi lama untuk komponen itu tetap menggambarkan perilaku yang berjalan. Dokumen v2 tidak ditulis ulang sekaligus; addendum ADR-008 pada tiap dokumen menyatakan target, dan setiap task MIG memperbarui bagian yang disentuhnya.

## Konsekuensi

### Positif

- Seluruh data aplikasi dan data identitas berada pada satu server di Indonesia.
- Akun dan mapping akses berada dalam satu database, sehingga webhook sinkronisasi dan kegagalan parsial Clerk/Neon hilang.
- Driver `node-postgres` menyediakan transaksi interaktif pada semua jalur.
- Biaya layanan terkelola berkurang dan tidak ada batas payload fungsi serverless.

### Negatif

- Pemilik menanggung operasional: patch OS, backup, pemantauan, sertifikat, dan pemulihan.
- Satu VPS adalah single point of failure; tidak ada preview deployment per PR.
- Tidak ada perlindungan DDoS terkelola setelah Cloudflare dilepas.
- Aplikasi kini menyimpan hash kata sandi sendiri, sehingga security review autentikasi harus diulang.
- Bukti F13-02 sampai F13-08 diperoleh pada stack lama dan harus dihijaukan ulang pada stack baru (MIG-07) sebelum UAT.
- Keterkiriman email lewat SMTP sendiri lebih rentan masuk spam dibanding penyedia transaksional. Karena pendaftaran dan login dari perangkat baru bergantung pada OTP email, email yang tidak sampai berarti pengguna tidak bisa masuk; SPF, DKIM, dan DMARC pada domain pengirim menjadi syarat.
- Kekuatan verifikasi kedua setara keamanan kotak masuk email pengguna, lebih lemah daripada aplikasi authenticator. Ini pilihan sadar demi kemudahan pengguna.

## Batasan keputusan

- ADR ini tidak memilih penyedia VPS, domain, maupun SMTP.
- ADR ini tidak memberi penilaian hukum. Dasar regulasi dan pasal yang berlaku, termasuk PP 71/2019 yang sudah dirujuk pada kebijakan retensi, perlu dikonfirmasi pemilik bersama pihak yang berwenang.
- Bila aplikasi dipakai secara resmi oleh instansi, aturan internal instansi (misalnya kewajiban memakai pusat data instansi atau domain `.go.id`) bisa lebih ketat daripada "VPS di Indonesia". Hal ini tidak dapat dipastikan dari repositori.
- GitHub dan GitHub Actions tetap dipakai untuk kode sumber dan CI. Keduanya hanya boleh memuat fixture sintetis; data produksi, dump database, dan secret produksi tidak boleh masuk ke sana.
- Email yang terkirim tetap melewati server email penerima di luar kendali aplikasi; isi email mengikuti aturan minimisasi pada kebijakan retensi.

## Keputusan terbuka

| Butir | Pemilik | Dibutuhkan sebelum |
|---|---|---|
| Penyedia VPS (lokasi pusat data di Indonesia) dan domain — VPS sudah dipilih 2026-11-16 (Tencent Cloud region Indonesia, 2 vCPU, 4 GB, 60 GB); domain masih terbuka | Pemilik produk | F13-09 |
| Penyedia SMTP berlokasi di Indonesia atau mail server sendiri, beserta DNS pengirim (SPF, DKIM, DMARC) | Pemilik produk | MIG-03 dan MIG-05 dinyatakan selesai |
| Mitigasi DDoS: cukup firewall + rate limit, atau layanan lokal | Pemilik produk / DevOps | F13-10 |
| Lokasi backup di luar VPS utama (harus tetap di Indonesia) | Pemilik produk / DevOps | F13-09 |
| Konfirmasi aturan internal instansi tentang hosting dan domain | Pemilik produk | F13-14 |
| Daftar perbaikan tampilan dan perilaku fitur | Pemilik produk | UIFIX-00 |

## Urutan pelaksanaan

1. MIG-00 — ADR ini dan addendum dokumen (docs only).
2. MIG-01 — database.
3. MIG-02 — runtime dan container.
4. MIG-03 dan MIG-05 — autentikasi dan email SMTP, dikerjakan bersama.
5. MIG-04, MIG-06 — scheduler dan storage import.
6. MIG-07 — pembersihan dependency lama dan verifikasi ulang gate F13-02..F13-08.
7. UIFIX — perbaikan tampilan dan perilaku fitur yang disetujui.
8. F13-09, F13-10, F13-11, F13-13, F13-14 pada infrastruktur baru.

Perbaikan tampilan murni di luar layar autentikasi boleh berjalan paralel dengan langkah 2–6. Perbaikan yang menyentuh layar masuk, daftar, atau Manajemen Akses digabung ke MIG-03 karena layar tersebut dibangun ulang.

## Checklist penerimaan MIG-00

- [x] Setiap layanan pihak ketiga yang menyimpan atau memproses data aplikasi memiliki pengganti dan task.
- [x] Perilaku yang wajib dipertahankan dinyatakan eksplisit.
- [x] Pengecualian terhadap mode Fase 13 dinyatakan dan dibatasi.
- [x] Bukti yang harus diverifikasi ulang teridentifikasi.
- [x] Keputusan terbuka memiliki pemilik dan batas waktu relatif.
- [x] Tidak ada kode aplikasi yang berubah pada MIG-00.
