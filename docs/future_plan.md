<!--chatbot
integrasi myintress
tidak hanya wib
migrasi ke vps/ dc kemenkeu
fitur: setting profile pop up, tooltip, darkmode-->


<!--Kalau *default branch* di GitHub kamu sudah `main`, tetapi setiap kali kamu *push* dari komputer lokal malah masuk ke `master`, berarti **nama cabang aktif di komputer lokal kamu yang masih `master**`.

Hal ini sangat umum terjadi ketika kamu membuat repositori pertama kali di komputer lewat perintah `git init` sebelum menghubungkannya ke GitHub.

Berikut cara cepat menyatukan dan menyinkronkannya agar kode kamu di `master` pindah ke `main`:

---

### Langkah 1: Ubah Cabang Lokal ke `main` & Push

Jalankan perintah ini di terminal komputer kamu secara berurutan:

1. **Ubah nama cabang lokal dari `master` jadi `main`:**
```bash
git branch -m master main

```


2. **Kirim (*push*) kode dari `main` lokal ke `main` di GitHub:**
```bash
git push -u origin main

```



---

### Langkah 2: Hapus Cabang `master` yang Terlanjur Terbuat di GitHub

Karena sebelumnya kamu sempat *push* ke `master`, di GitHub sekarang ada dua cabang (`main` dan `master`). Untuk menghapus `master` yang redundan di GitHub:

```bash
git push origin --delete master

```

---

### Langkah 3: Amankan untuk Proyek-Proyek Berikutnya

Agar setiap kali kamu mengetik `git init` di komputer langsung otomatis bernama `main` (bukan `master` lagi), jalankan perintah konfigurasi ini sekali saja:

```bash
git config --global init.defaultBranch main

```

Sekarang cabang di lokal dan GitHub kamu sudah sama-sama menggunakan `main`.-->
