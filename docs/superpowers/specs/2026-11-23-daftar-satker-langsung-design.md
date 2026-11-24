# Jalur Akses Operator Satker — Rancangan Singkat

Tanggal: 2026-11-23 · Task: MIG-03 (butir layar daftar digabung ke MIG-03 sesuai UIFIX-00) · Status: disetujui pemilik dan diimplementasi (DEVLOG Session 325)

> Versi pertama dokumen ini memakai opsi "dibawa browser, langsung aktif". Versi itu digantikan setelah diskusi risiko: aplikasi terbuka ke internet, dan pendaftaran yang langsung aktif memungkinkan orang asing mengklaim kode satker, bahkan melihat data satker yang Operator-nya sedang kosong.

## Maksud

Satker KPPN Malang masuk dengan cepat. Tidak ada yang bisa mengklaim satker sendiri, dan Admin tidak kewalahan saat peluncuran.

## Keputusan pemilik

1. **Satker KPPN Malang** diundang Admin. Penerima undangan, Operator maupun Admin KPPN, membuat kata sandi lewat **Masuk → Lupa kata sandi**.
2. **Daftar mandiri tetap ada**, tetapi menghasilkan **permintaan akses** yang disetujui atau ditolak Admin KPPN.
3. **Halaman Masuk** menampilkan "Email belum terdaftar, silakan Daftar Akun Baru atau hubungi Admin KPPN" untuk email tanpa akun.
4. **Undangan massal** dari Excel (INVITE-BULK-01) dan **mode demo** untuk umum (DEMO-01) dikerjakan sebagai task terpisah.

## Pendekatan yang dipertimbangkan

| Opsi | Untung | Rugi | Status |
|---|---|---|---|
| Langsung aktif setelah OTP | Paling cepat | Satker dapat diserobot; data satker yang Operator-nya kosong terbuka | Ditolak |
| Langsung aktif, Admin mencabut | Cepat | Data sempat terlihat sebelum dicabut | Ditolak |
| **Undangan + permintaan akses yang disetujui Admin** | Aman; beban Admin kecil setelah undangan massal | Pendaftar mandiri menunggu persetujuan | **Dipilih** |
| Persetujuan untuk semua tanpa undangan | Sederhana | ±150 permintaan sekaligus saat peluncuran | Ditolak |

## Rancangan yang diimplementasi

- Tabel `access_requests`: satu permintaan per user, berstatus `pending` atau `rejected`. Tabel ini tidak menyentuh `organizations` atau `user_accesses` sampai disetujui.
- **Form Daftar:** Kode Satker, Nama Satker, Email, Kata sandi, Konfirmasi. Setelah OTP benar, `requestSatkerAccessFn` dipanggil, lalu pengguna dibawa ke `/access-pending`.
- **`/access-pending`** punya tiga keadaan: menunggu persetujuan, ditolak (dengan form ajukan ulang), dan belum ada permintaan (dengan form).
- **Admin, Manajemen Akses:** bagian "Permintaan Akses Operator" dengan tombol Setujui dan Tolak (Tolak memakai dialog konfirmasi), plus petunjuk verifikasi. Persetujuan memakai `registerSatkerForUser`. Kedua keputusan memicu email ke pemohon.
- **Undangan:** akun dibuat tanpa kata sandi, akses langsung `active`, dan email meminta penerima memakai Lupa kata sandi. Di daftar akses, akun ini tampil "Menunggu – Belum membuat kata sandi".
- **Pesan dari server:** `EMAIL_NOT_REGISTERED` pada Masuk dan Lupa kata sandi; `PASSWORD_NOT_SET` pada Masuk.
