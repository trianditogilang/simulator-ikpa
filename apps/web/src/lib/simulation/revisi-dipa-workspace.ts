import {
  calculateDipaRevision,
  default2026RuleSet,
  type RuleSetConfig,
} from "@simulator-ikpa/ikpa-engine";

export interface RevisiRow {
  revisionDate: string;
  revisionCode: string;
  paguBefore: string;
  paguAfter: string;
}

export type RevisiReason =
  | "awal"
  | "pagu-berubah"
  | "kode-luar"
  | "objek";

export interface ClassifiedRevisi extends RevisiRow {
  semester: 1 | 2 | 0;
  isObjek: boolean;
  reason: RevisiReason;
  delta: number;
}

export function parseRevisionCodes(code: string): string[] {
  return code
    .split(/[,\s;|/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isDipaAwal(code: string): boolean {
  const c = code.trim().toUpperCase();
  return c === "DIPA-AWAL" || c.startsWith("DIPA-AWAL");
}

function wibParts(dateStr: string): { year: number; month: number } | null {
  const d = new Date(`${dateStr}T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return null;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return { year, month };
}

export function classifyRevision(
  row: RevisiRow,
  eligibleCodes: string[],
  fiscalYear: number,
): ClassifiedRevisi {
  const delta =
    (Number.parseFloat(row.paguAfter) || 0) -
    (Number.parseFloat(row.paguBefore) || 0);
  if (isDipaAwal(row.revisionCode))
    return { ...row, semester: 0, isObjek: false, reason: "awal", delta };
  const parts = wibParts(row.revisionDate);
  const semester: 1 | 2 | 0 =
    !parts || parts.year !== fiscalYear ? 0 : parts.month <= 6 ? 1 : 2;
  if (Math.abs(delta) > 0.005)
    return { ...row, semester, isObjek: false, reason: "pagu-berubah", delta };
  const codes = parseRevisionCodes(row.revisionCode);
  const hit = codes.some((c) => eligibleCodes.includes(c));
  if (!hit)
    return { ...row, semester, isObjek: false, reason: "kode-luar", delta };
  return { ...row, semester, isObjek: true, reason: "objek", delta };
}

export function countObjek(
  rows: RevisiRow[],
  eligibleCodes: string[],
  fiscalYear: number,
): { s1: number; s2: number; classified: ClassifiedRevisi[] } {
  const classified = rows.map((r) =>
    classifyRevision(r, eligibleCodes, fiscalYear),
  );
  return {
    s1: classified.filter((c) => c.isObjek && c.semester === 1).length,
    s2: classified.filter((c) => c.isObjek && c.semester === 2).length,
    classified,
  };
}

export function calcRevisiScore(
  s1: number,
  s2: number,
  config: RuleSetConfig = default2026RuleSet,
) {
  const r = calculateDipaRevision(
    { semester1Revisions: s1, semester2Revisions: s2, hasBudgetChange: [] },
    config,
  );
  const trace = Object.fromEntries(
    r.formulaTrace.map((s) => [s.label, s.result]),
  );
  return {
    nkraS1: Number(trace["Nilai Revisi Semester 1"] ?? 0),
    nkraS2: Number(trace["Nilai Revisi Semester 2"] ?? 0),
    annual: Number(r.score ?? 0),
    contribution: Number(r.weightedContribution ?? 0),
  };
}

export function previewRevisi(
  row: RevisiRow,
  eligibleCodes: string[],
  fiscalYear: number,
): { isObjek: boolean; reason: RevisiReason; semester: 1 | 2 | 0 } {
  const c = classifyRevision(row, eligibleCodes, fiscalYear);
  return { isObjek: c.isObjek, reason: c.reason, semester: c.semester };
}

export function semesterStatus(count: number): string {
  if (count <= 1) return "Aman";
  if (count === 2) return "Hati-hati";
  return "Risiko";
}

export function semesterRoman(s: 1 | 2 | 0): string {
  return s === 1 ? "I" : s === 2 ? "II" : "-";
}

export const MAX_REVISI_JENIS = 5;

export const REVISI_JENIS: Readonly<Record<string, string>> = {
  "201": "Antar-Fungsi/Sub-Fungsi dan/atau Antar-Program",
  "211": "Pemenuhan Belanja Operasional",
  "212": "Penyelesaian Pagu Minus Belanja Pegawai Operasional",
  "213": "Pergeseran Anggaran dari Belanja Operasional ke Belanja Non-Operasional",
  "217": "Penyelesaian Tunggakan",
  "220": "Pemanfaatan Sisa Anggaran Kontraktual dan/atau Swakelola",
  "221": "Pergeseran anggaran Antarjenis Belanja",
  "222": "Kontrak Tahun Jamak",
  "225": "RO Cadangan",
  "226": "Penurunan volume RO secara total",
  "229": "Penyelesaian putusan pengadilan yang telah mempunyai kekuatan hukum tetap (inkracht)",
  "231": "Penyelesaian Pekerjaan yang Tidak Terselesaikan sampai dengan Akhir Tahun Anggaran",
  "236": "Pergeseran Anggaran Antar-KRO dan/atau Antar-Kegiatan",
  "239": "Revisi dalam rangka Pagu Anggaran Tetap lainnya",
};
