# ADR-004 — Resolver Versi Rule Set

**Status:** Accepted for implementation; production use requires regulatory approval  
**Date:** 31 Agustus 2026  
**Decision owner:** Solution Architect  
**Related:** F0-06, [ADR-001 — Batas Hari Kerja, H+17, dan H-0](ADR-001-workday-boundaries.md), [ADR-002 — Versioning Kalender Kerja](ADR-002-workday-versioning.md), [ADR-003 — Semantik Lead Time dan H-0](ADR-003-reminder-lead-days.md)

## Context

`rule_sets` menyimpan konfigurasi IKPA dan policy reminder per tahun dengan
`effective_from`, `status`, dan `version`. Dokumen produk membutuhkan satu
rule set yang berlaku pada setiap tanggal efektif, tetapi schema awal belum
menjelaskan:

- apakah `effective_to` disimpan atau diturunkan;
- bagaimana draft, published, dan retired diperlakukan resolver;
- bagaimana menolak overlap dan publish yang ambigu;
- bagaimana rollback dilakukan tanpa mengubah snapshot historis; dan
- bagaimana rule set yang dipakai snapshot tetap dapat direproduksi setelah
  versi baru diterbitkan.

Tanpa kontrak ini, dashboard, scheduler, kalkulasi, dan laporan dapat memilih
versi berbeda untuk tanggal yang sama.

## Decision

Resolver menggunakan **effective range half-open** yang diturunkan dari
`effective_from`:

```text
[effective_from versi ini, effective_from versi published berikutnya)
```

Tidak ada `effective_to` yang disimpan pada MVP. `effective_from` adalah
`timestamptz` canonical yang disimpan dalam UTC; seluruh caller wajib
memberikan `at` sebagai instant yang eksplisit.

### 1. Kontrak resolver

Kontrak logical minimum:

```ts
resolveRuleSet({
  year: number,
  at: Instant,
}): PublishedRuleSet
```

Resolver melakukan langkah berikut:

1. memilih record dengan `rule_sets.year = year`;
2. hanya mempertimbangkan status `published` untuk kebutuhan operasional;
3. membuang record dengan `effective_from > at`;
4. memilih record dengan `effective_from` terbesar yang masih `<= at`; dan
5. mengembalikan rule set beserta calendar version dan policy yang terikat.

Jika tidak ada kandidat, resolver mengembalikan structured error
`RULE_SET_NOT_FOUND`. Resolver tidak boleh diam-diam memakai draft, versi masa
depan, rule set tahun lain, atau versi retired sebagai fallback operasional.

Untuk kalkulasi berbasis tanggal lokal, caller mengubah tanggal bisnis menjadi
awal hari pada timezone organisasi sebelum memanggil resolver. Untuk scheduler,
`at` berasal dari instant event/job yang sebenarnya. Dengan demikian batas
effective tidak bergantung pada timezone server.

### 2. Effective range dan uniqueness

Untuk seluruh rule set published pada satu tahun, urutan `effective_from`
menentukan range:

| Rule set | `effective_from` | Range derived |
|---|---|---|
| `2026.1` | `2026-01-01T00:00:00Z` | `[2026-01-01, 2026-04-01)` |
| `2026.2` | `2026-04-01T00:00:00Z` | `[2026-04-01, 2026-07-01)` |
| `2026.3` | `2026-07-01T00:00:00Z` | `[2026-07-01, +∞)` |

Constraint dan transaksi publish wajib menjamin:

- `(year, version)` unik;
- `(year, effective_from)` unik untuk rule set published;
- calendar version terikat memiliki tahun yang sama dan status published;
- tidak ada dua kandidat dengan effective instant yang sama; dan
- rule set yang sama tidak dapat dipublish ulang dengan isi berbeda.

Karena `effective_to` diturunkan dari start berikutnya, range normal tidak
overlap. Publish dengan `effective_from` yang menyisipkan atau memundurkan
urutan setelah versi yang lebih baru sudah published ditolak oleh workflow
MVP. Koreksi backdated memerlukan workflow koreksi eksplisit, audit, dan
keputusan dampak histori; bukan jalur publish biasa.

### 3. Lifecycle status

State transition yang diizinkan:

```text
draft ──publish──> published ──retire──> retired
```

- `draft`: dapat diedit, tidak dapat dipilih resolver dan tidak dapat menjadi
  sumber snapshot historis.
- `published`: immutable secara bisnis. Formula, policy, calendar binding,
  source, version, dan effective time tidak dapat diedit langsung.
- `retired`: tidak dipilih untuk kalkulasi operasional baru, tetapi tetap
  tersedia untuk audit dan histori. Data tidak dihapus.

`published_at` dan `retired_at` adalah metadata lifecycle, bukan pengganti
`effective_from`. Retire hanya boleh dilakukan setelah ada pengganti published
yang menjaga cakupan operasional, atau setelah tahun tersebut ditutup sesuai
prosedur bisnis. Retire tidak mengubah range historis yang telah dipakai.

Resolver historis tidak boleh menyusun ulang snapshot dari status saat ini.
Snapshot harus memakai `rule_set_id` yang disimpan. Jika suatu laporan historis
hanya memiliki tahun/tanggal tanpa ID snapshot, resolver historis dapat mencari
versi yang range-nya mencakup tanggal tersebut dari seluruh versi published dan
retired; hasil itu tetap diberi warning bahwa sumber tidak pinned.

### 4. Publish workflow

Publish adalah transaksi server-authoritative:

1. validasi draft dan seluruh `reminder_policies`;
2. validasi source regulation dan change notes;
3. validasi parameter `needs_verification` sesuai aturan go-live;
4. validasi calendar version published dari ADR-002;
5. validasi `effective_from`, uniqueness, dan urutan range;
6. ubah status draft menjadi published serta isi `published_at`;
7. perbarui pointer `fiscal_years.active_rule_set_id` hanya bila versi tersebut
   menjadi versi operasional saat ini; dan
8. catat audit serta jadwalkan re-evaluasi delivery yang masih pending.

Jika satu langkah gagal, tidak ada status atau pointer aktif yang boleh berubah.
Pointer pada `fiscal_years.active_rule_set_id` adalah optimasi/context pointer,
bukan sumber kebenaran untuk histori; resolver tetap memeriksa effective range.

### 5. Retire workflow

Retire membutuhkan actor, alasan, dan rule set pengganti atau alasan penutupan
tahun. Sistem harus memeriksa bahwa rule set retired tidak menjadi satu-satunya
kandidat operasional untuk waktu mendatang. Retire tidak menghapus:

- rule set atau reminder policy;
- calendar version yang terikat;
- snapshot dan formula trace;
- delivery yang sudah dibuat; atau
- audit log.

Delivery yang sudah menyimpan `rule_set_id/version` tetap menunjuk versi saat
jadwal dibuat. Delivery `scheduled` dapat dievaluasi ulang hanya melalui
workflow publish yang terdokumentasi, sesuai ADR-002 dan ADR-003.

### 6. Rollback

Rollback bukan edit, reopen, atau penggantian FK pada rule set lama. Rollback
dilakukan dengan:

1. membuat draft rule set baru dengan version baru;
2. menyalin konfigurasi rule set stabil yang ingin dipulihkan, termasuk
   calendar version yang tepat;
3. mengisi source/change notes dengan alasan rollback dan actor;
4. memberi `effective_from` baru yang tidak ambigu;
5. menjalankan validasi dan publish biasa; serta
6. me-re-evaluate reminder `scheduled` yang terkena dampak.

Contoh: bila `2026.3` bermasalah dan konfigurasi `2026.2` ingin dipulihkan,
buat `2026.4` dengan konfigurasi `2026.2` dan effective time baru. Snapshot yang
memakai `2026.2` atau `2026.3` tidak diubah.

### 7. Snapshot dan histori

Saat snapshot dibuat, server menyimpan:

- `score_snapshots.rule_set_id`;
- `score_snapshots.rule_set_version`;
- `score_snapshots.calendar_version_id` sesuai ADR-002;
- input hash yang memasukkan identitas rule set dan calendar version; dan
- formula trace yang menjelaskan `effective_at`, timezone, serta versi yang
  digunakan.

Snapshot dibaca melalui ID yang tersimpan, bukan dengan memanggil resolver
terkini. Ini memastikan publish, retire, rollback, atau perubahan pointer tahun
tidak mengubah hasil historis.

Notification delivery juga harus menyimpan `rule_set_id`/`rule_set_version`
serta calendar version bila day type-nya `workday`. Config reminder baru
selalu memakai resolver pada waktu pembuatan schedule; config lama tidak boleh
menarik policy dari rule set terbaru tanpa re-evaluasi.

### 8. No-rule dan stale context

Jika tidak ada published rule set yang mencakup `year` dan `at`, sistem:

- menghentikan kalkulasi atau pembuatan schedule;
- mengembalikan `RULE_SET_NOT_FOUND` dengan year/effective time yang aman;
- tidak menggunakan versi tertinggi sebagai fallback; dan
- menampilkan state incomplete/policy unavailable pada UI.

Jika snapshot atau delivery merujuk rule set/calendar yang sudah retired, itu
adalah **historical/stale context**, bukan error referensi. UI menampilkan versi
yang dipin dan status retired; sistem hanya memblokir penggunaan baru yang
seharusnya memakai versi published.

## ERD impact summary

| Area | Perubahan/aturan |
|---|---|
| `rule_sets` | Pertahankan `(year, version)` unik; tambahkan unique `(year, effective_from)` untuk published dan enforce status transition |
| Effective range | Tidak menambah `effective_to` pada MVP; range diturunkan dari `effective_from` berikutnya |
| Calendar binding | `calendar_version_id` wajib untuk published dan harus same-year/published sesuai ADR-002 |
| `fiscal_years` | `active_rule_set_id` tetap sebagai pointer/cache; tidak menggantikan resolver |
| `score_snapshots` | Rule set ID/version dan calendar version wajib dipin; `ON DELETE RESTRICT` |
| `notification_deliveries` | Simpan konteks rule set/calendar ketika schedule dibuat; re-evaluasi pending diaudit |
| Audit | Publish, retire, rollback, effective time, before/after metadata, dan actor dicatat |

Validasi lintas row/tabel, termasuk status, same-year, uniqueness conditional,
dan tidak adanya publish ambigu, dijalankan di server dalam transaksi serta
diperkuat constraint database pada F7-05. Foreign key saja tidak cukup.

## Worked examples

### Example A — Resolver normal

Dengan rule set `2026.1` effective 1 Januari dan `2026.2` effective 1 April:

- `at=2026-03-31T23:59:59Z` → `2026.1`;
- `at=2026-04-01T00:00:00Z` → `2026.2`;
- `at=2026-06-01T10:00:00Z` → `2026.2`; dan
- `at=2025-12-31T10:00:00Z` → `RULE_SET_NOT_FOUND` untuk tahun 2026.

Batas awal inclusive dan batas akhir exclusive mencegah dua versi berlaku
bersamaan pada instant yang sama.

### Example B — Snapshot setelah publish baru

Snapshot S-1 dibuat pada Mei menggunakan `2026.2`. Pada Juli `2026.3`
dipublish dan pointer fiscal year berubah. Saat S-1 dibuka kembali, hasil,
formula trace, rule set, dan calendar version tetap `2026.2`.

### Example C — Rollback

`2026.3` dipublish tetapi ditemukan kesalahan konfigurasi. Admin membuat
`2026.4` dengan konfigurasi `2026.2`, effective time 15 Agustus, dan catatan
rollback. S-1 dan snapshot lain tetap immutable; delivery pending dihitung ulang
sesuai workflow.

## Rejected alternatives

### Menyimpan dan mengedit `effective_to`

Ditolak untuk MVP karena setiap perubahan harus mengubah dua boundary dan mudah
menciptakan gap/overlap. Satu ordered `effective_from` menghasilkan range yang
sama dengan lebih sedikit state.

### Selalu memakai versi tertinggi atau terbaru

Ditolak karena versi masa depan dapat bocor ke perhitungan tanggal sebelumnya
dan mengubah histori yang seharusnya memakai rule set lama.

### Mengedit rule set published

Ditolak karena snapshot, delivery, dan formula trace akan menunjuk ID yang sama
tetapi isi berbeda. Semua perubahan harus menjadi version baru.

### Fallback otomatis ke draft atau retired

Ditolak karena draft belum tervalidasi dan retired tidak disetujui untuk
penggunaan baru. Ketiadaan rule harus terlihat sebagai error, bukan keputusan
diam-diam.

### Mengubah `active_rule_set_id` sebagai satu-satunya resolver

Ditolak karena pointer tidak cukup untuk tanggal efektif, future version, dan
histori. Pointer hanya convenience; effective range adalah sumber kebenaran.

## Consequences

### Positif

- Setiap instant hanya memiliki satu rule set operasional yang dapat dijelaskan.
- Future publish tidak mengubah perhitungan masa lalu.
- Rollback aman karena berupa versi baru dan tetap dapat diaudit.
- Snapshot tidak tergantung pada status/pointer resolver saat ini.
- Scheduler dapat menolak no-rule dan stale context secara eksplisit.

### Negatif

- Publish memerlukan validasi lintas row/tabel dan transaction.
- Koreksi backdated tidak dapat memakai jalur sederhana.
- Retire dan rollback menambah record serta audit, bukan memperbarui record lama.
- Query histori membutuhkan pemahaman antara resolver operasional dan snapshot
  yang pinned.

## Follow-up dan batas keputusan

- **F0-07:** Struktur repository dan package boundary untuk resolver/policy.
- **F7-05/F7-11/F7-12:** Constraint, schema, snapshot, dan delivery context.
- **F10-02:** Implementasi resolver dan test effective range/no-rule.
- **F10-05/F10-09:** Re-evaluasi scheduler, publish, retire, dan rollback.
- **F4-08/F4-11:** UI editor, diff, history, dan impact preview.
- **F13-01/F13-03:** Golden/integration test immutability dan publish workflow.

ADR ini tidak menetapkan parameter regulasi 2026 sebagai final. Status
`needs_verification` tetap mengikuti [dokumen verifikasi regulasi](../regulatory-verification-2026.md)
dan gate produksi.

## Definition of Done F0-06

- [x] Effective range half-open dan sumber `effective_from` ditetapkan.
- [x] Perilaku draft, published, retired, dan no-rule dijelaskan.
- [x] Constraint overlap/uniqueness dan publish transaction dijelaskan.
- [x] Rollback sebagai versi baru ditetapkan.
- [x] Snapshot/delivery pinning dan immutability dijelaskan.
- [x] Retire, stale context, histori, dan follow-up implementasi ditetapkan.
