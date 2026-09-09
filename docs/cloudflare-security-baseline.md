# Cloudflare Security Baseline — Simulator IKPA

**Status:** Rancangan penerapan; belum aktif pada zone produksi.

## Rules wajib sebelum go-live

- TLS end-to-end dan HSTS hanya setelah origin preview tervalidasi.
- Cache bypass untuk route authenticated, ServerFn, export, upload, webhook,
  dan seluruh response yang memuat data satker.
- Rate limit login, onboarding, export, upload, dan endpoint job/webhook.
- WAF rule menolak payload malformed dan request method yang tidak sesuai.
- QStash webhook hanya menerima signature current/next yang valid.
- Origin hanya menerima traffic yang diperlukan; secret tidak diletakkan pada
  client bundle atau query string.
- Log firewall tidak menyimpan token, cookie, email payload, atau dokumen
  upload mentah.

## Verification evidence

Catat zone, rule ID, mode (simulate/block), sample request, dan tanggal review
di release record. Jalankan kembali smoke authenticated dan export setelah setiap
perubahan cache/WAF. F13-10 tetap `Blocked` sampai zone dan staging URL nyata
tersedia.
