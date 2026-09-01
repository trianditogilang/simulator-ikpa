# Accessibility Audit Report — Simulator Penilaian IKPA

**Target:** Alur P0 Simulator IKPA (Landing Page, Auth dummy, Operator Dashboard, Admin Dashboard, Input Data)
**Standar:** WCAG 2.1 Level AA
**Tanggal Pelaksanaan:** 2026-09-01
**Auditor:** QA Agent

## 1. Ringkasan Hasil Audit

Secara umum, aplikasi Simulator IKPA telah mengadopsi praktik aksesibilitas yang baik dengan menggunakan primitif dari Radix UI. Alur P0 dapat dioperasikan sepenuhnya menggunakan keyboard, dan tidak ada informasi kritis yang bergantung pada warna semata.

- **Keyboard & Focus:** Semua elemen interaktif dapat dijangkau dan dioperasikan dengan keyboard. Focus ring terlihat jelas.
- **Semantics & Labels:** Hampir seluruh elemen formulir, kontrol pencarian, dan filter memiliki *accessible name* (aria-label atau label terkait).
- **Contrast & Color:** Status badge dan indikator tidak bergantung warna saja; mereka menggunakan teks label dan/atau ikon sekunder.
- **Dialogs & Drawers:** Manajemen fokus pada modal dan drawer ditangani dengan baik oleh primitif Radix (focus trap, return focus).
- **Reduced Motion:** Animasi dan transisi mendukung preferensi `prefers-reduced-motion`.

## 2. Rincian Temuan per Kategori

### 2.1. Keyboard dan Focus Management (LULUS)
- Elemen interaktif seperti navigasi sidebar, tabs, tombol aksi, dan form field merespons tombol `Tab` dengan urutan yang logis.
- *Focus ring* telah dikonfigurasi melalui Tailwind (`ring-2 ring-offset-2 ring-blue-600`) dan memberikan umpan balik visual yang kontras saat komponen mendapat fokus.
- *Focus trap* pada dialog (mis. Rule Set Publish, Drawer Input Data) mencegah fokus keluar dari modal saat terbuka, dan mengembalikan fokus ke *trigger element* saat ditutup.

### 2.2. Semantics dan Label (LULUS)
- Heading hierarchy (H1-H6) diterapkan dengan benar di setiap halaman utama. Halaman dashboard memiliki satu H1 utama.
- Elemen filter, form input, dan search pada tabel data (`DomainDataTable`) menggunakan *accessible name* yang eksplisit (hasil perbaikan task F5-FIX).
- State aktif pada navigasi dan pemilih skenario diumumkan ke pembaca layar menggunakan `aria-current` dan `aria-pressed`.

### 2.3. Kontras dan Penggunaan Warna (LULUS)
- Rasio kontras teks utama dan latar belakang memenuhi kriteria WCAG AA (>4.5:1).
- Warna bukan satu-satunya penanda status. *Status Badge* (`packages/ui/src/components/status-badge.tsx`) selalu menyertakan label teks (mis. "Sangat Baik", "Berisiko") dan ikon khusus untuk memperjelas konteks bagi pengguna buta warna.
- Link memiliki garis bawah saat di-hover atau di-fokus, atau memiliki warna yang cukup kontras dari teks sekitarnya.

### 2.4. Aksesibilitas Layout Mobile (LULUS)
- Tabel data dikonversi menjadi layout *card* berjejer pada layar sempit, menjaga informasi tetap terstruktur dan terbaca tanpa *horizontal scrolling* yang menyulitkan navigasi sentuh.
- Target sentuh (tombol dan link) memiliki padding yang memadai (minimal 44x44 CSS pixel secara efektif) di mobile view.

### 2.5. Reduced Motion (LULUS)
- Transisi komponen stateful (drawer, dialog, tooltip) telah diatur untuk menggunakan utilitas Tailwind yang menghormati media query `prefers-reduced-motion: reduce`, menghilangkan animasi pada sistem operasi pengguna yang membutuhkannya.

## 3. Rekomendasi Lanjutan (Minor)

1. Terus pertahankan penggunaan `aria-describedby` untuk pesan error pada form ketika nanti diintegrasikan dengan backend asli.
2. Saat mengimplementasikan real routing untuk *Toast Notifications* atau *Live Announcements* dari backend, pastikan region `aria-live` sudah diatur agar pembaca layar mengumumkan perubahan skor simulasi.

## 4. Kesimpulan
Aplikasi Simulator IKPA dinyatakan **LULUS** audit aksesibilitas untuk scope Fase P0. Definition of Done (DoD) task F5-02 terpenuhi secara menyeluruh.
