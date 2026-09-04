/**
 * Asumsi operasional UP/TUP untuk Simulasi — pra-F13.
 * Ponytail: pure, tanpa DB. Extensible via `SimulationAssumptions`.
 *
 * Referensi: `referensi/Tools Supporting IKPA.xlsx`, tab "Simulasi Setiap GUP".
 * Rumus: Persentase=C10/C9; Maksimal=hari yang sama bulan depan;
 * Status=IF(rencana<=maksimal); Nilai=C11*(E14/E17)*100, cap 100.
 * Engine (`packages/ikpa-engine/src/indicators/up-tup.ts`) = agregat
 * (Ketepatan 50% + Sebulan 25% + Setoran 25%, Tunai 90% + KKP 10%).
 */

export interface UpTupAssumptions {
	nilaiUP: string;
	nilaiRencanaGUP: string;
	tanggalGUPSebelumnya: string;
	tanggalRencanaGUP: string;
	tupTepat: number;
	tupTerlambat: number;
	ptupTepat: number;
	gupNihilCount: number;
	setoranTepat: number;
	kkpNominal: string;
	kkpTanggal: string;
}

import type { DispensasiAssumptions } from "./dispensasi-assumptions";
import { hasDispensasiChanges } from "./dispensasi-assumptions";

export interface SimulationAssumptions {
	upTup: UpTupAssumptions | null;
	dispensasi: DispensasiAssumptions | null;
	revisiDipa?: unknown | null;
	rpdDeviation?: unknown | null;
	penyerapan?: unknown | null;
	kontraktual?: unknown | null;
	tagihan?: unknown | null;
	capaianOutput?: unknown | null;
}

export const EMPTY_SIMULATION_ASSUMPTIONS: SimulationAssumptions = {
	upTup: null,
	dispensasi: null,
	revisiDipa: null,
	rpdDeviation: null,
	penyerapan: null,
	kontraktual: null,
	tagihan: null,
	capaianOutput: null,
};

export const DEFAULT_UP_TUP_ASSUMPTIONS: UpTupAssumptions = {
	nilaiUP: "18000000",
	nilaiRencanaGUP: "11000000",
	tanggalGUPSebelumnya: "2026-05-05",
	tanggalRencanaGUP: "2026-05-25",
	tupTepat: 0,
	tupTerlambat: 0,
	ptupTepat: 0,
	gupNihilCount: 0,
	setoranTepat: 0,
	kkpNominal: "0",
	kkpTanggal: "2026-05-15",
};

export const UP_TUP_WEIGHT = "10";
export const TOTAL_IKPA_FORMULA =
	"Total IKPA = Σ kontribusi 7 indikator berbobot − pengurang SPM Dispensasi";

export interface GupFormulaStep {
	step: number;
	label: string;
	formula: string;
	inputs: Record<string, string>;
	result: string;
}

export interface GupPreview {
	persentaseGUP: number;
	hariDisebulankan: number;
	hariSP2D: number;
	tanggalMaksimal: string;
	status: "Tepat Waktu" | "Terlambat";
	nilaiRaw: number;
	nilaiCapped: number;
	isCapped: boolean;
	saran: string;
	formulaTrace: GupFormulaStep[];
	isValid: boolean;
	validationMessage: string | null;
}

function parseISODate(s: string): Date | null {
	if (!s || typeof s !== "string") return null;
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
	if (!m) return null;
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const d = Number(m[3]);
	if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
	const dt = new Date(Date.UTC(y, mo - 1, d));
	if (
		dt.getUTCFullYear() !== y ||
		dt.getUTCMonth() !== mo - 1 ||
		dt.getUTCDate() !== d
	) {
		return null;
	}
	return dt;
}

function toISODate(dt: Date): string {
	return dt.toISOString().slice(0, 10);
}

function diffDays(start: Date, end: Date): number {
	return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

/** Tanggal maksimal GUP = hari yang sama bulan depan. */
export function calcTanggalMaksimal(tanggalSebelumnya: string): string | null {
	const prev = parseISODate(tanggalSebelumnya);
	if (!prev) return null;
	const max = new Date(
		Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate()),
	);
	return toISODate(max);
}

/** Batas hari SP2D agar nilai 100 untuk %GUP dan panjang bulan tertentu (tabel G4:M18). */
export function maxHariSP2DAgar100(
	persentaseGUP: number,
	hariDisebulankan: 28 | 30 | 31,
): number {
	return Math.floor(persentaseGUP * hariDisebulankan);
}

export function calcGupPreview(a: UpTupAssumptions): GupPreview {
	const trace: GupFormulaStep[] = [];
	const nilaiUP = Number(a.nilaiUP);
	const nilaiGUP = Number(a.nilaiRencanaGUP);

	if (!Number.isFinite(nilaiUP) || nilaiUP <= 0) {
		return {
			persentaseGUP: 0,
			hariDisebulankan: 0,
			hariSP2D: 0,
			tanggalMaksimal: "-",
			status: "Terlambat",
			nilaiRaw: 0,
			nilaiCapped: 0,
			isCapped: false,
			saran: "Isi Nilai UP > 0.",
			formulaTrace: [],
			isValid: false,
			validationMessage: "Nilai UP harus angka > 0.",
		};
	}
	if (!Number.isFinite(nilaiGUP) || nilaiGUP < 0) {
		return {
			persentaseGUP: 0,
			hariDisebulankan: 0,
			hariSP2D: 0,
			tanggalMaksimal: "-",
			status: "Terlambat",
			nilaiRaw: 0,
			nilaiCapped: 0,
			isCapped: false,
			saran: "Isi Nilai Rencana GUP ≥ 0.",
			formulaTrace: [],
			isValid: false,
			validationMessage: "Nilai Rencana GUP harus angka ≥ 0.",
		};
	}

	const prev = parseISODate(a.tanggalGUPSebelumnya);
	const rencana = parseISODate(a.tanggalRencanaGUP);
	const tanggalMaksimal = calcTanggalMaksimal(a.tanggalGUPSebelumnya);
	if (!prev || !rencana || !tanggalMaksimal) {
		return {
			persentaseGUP: nilaiGUP / nilaiUP,
			hariDisebulankan: 0,
			hariSP2D: 0,
			tanggalMaksimal: tanggalMaksimal ?? "-",
			status: "Terlambat",
			nilaiRaw: 0,
			nilaiCapped: 0,
			isCapped: false,
			saran: "Format tanggal harus YYYY-MM-DD.",
			formulaTrace: [],
			isValid: false,
			validationMessage: "Tanggal harus format YYYY-MM-DD yang valid.",
		};
	}

	const maxDate = parseISODate(tanggalMaksimal);
	if (!maxDate) {
		return {
			persentaseGUP: 0,
			hariDisebulankan: 0,
			hariSP2D: 0,
			tanggalMaksimal: "-",
			status: "Terlambat",
			nilaiRaw: 0,
			nilaiCapped: 0,
			isCapped: false,
			saran: "-",
			formulaTrace: [],
			isValid: false,
			validationMessage: "Tanggal maksimal tidak valid.",
		};
	}

	const persentaseGUP = nilaiGUP / nilaiUP;
	const hariDisebulankan = diffDays(prev, maxDate);
	const hariSP2D = diffDays(prev, rencana);
	const status: GupPreview["status"] =
		rencana.getTime() <= maxDate.getTime() ? "Tepat Waktu" : "Terlambat";

	trace.push({
		step: 1,
		label: "Persentase GUP (C11 = C10 / C9)",
		formula: "nilaiRencanaGUP / nilaiUP",
		inputs: { C9_nilaiUP: a.nilaiUP, C10_rencanaGUP: a.nilaiRencanaGUP },
		result: `${(persentaseGUP * 100).toFixed(2)}%`,
	});
	trace.push({
		step: 2,
		label: "Tanggal Maksimal (hari yang sama bulan depan)",
		formula: "DATE(YEAR(C14), MONTH(C14)+1, DAY(C14))",
		inputs: { C14_sebelumnya: a.tanggalGUPSebelumnya },
		result: `${tanggalMaksimal} (${hariDisebulankan} hari)`,
	});
	trace.push({
		step: 3,
		label: "Status (D17 = IF(C17 <= D14, Tepat, Terlambat)) + Hari SP2D (E17 = C17 - C14)",
		formula: 'IF(rencana <= maksimal, "Tepat Waktu", "Terlambat")',
		inputs: {
			C17_rencana: a.tanggalRencanaGUP,
			D14_maksimal: tanggalMaksimal,
			E17_hariSP2D: String(hariSP2D),
		},
		result: status,
	});

	if (hariSP2D <= 0) {
		return {
			persentaseGUP,
			hariDisebulankan,
			hariSP2D,
			tanggalMaksimal,
			status,
			nilaiRaw: 0,
			nilaiCapped: 0,
			isCapped: false,
			saran: "Tanggal rencana harus setelah tanggal GUP sebelumnya.",
			formulaTrace: trace,
			isValid: false,
			validationMessage:
				"Tanggal rencana harus setelah tanggal GUP sebelumnya.",
		};
	}

	const nilaiRaw = persentaseGUP * (hariDisebulankan / hariSP2D) * 100;
	const isCapped = nilaiRaw >= 100;
	const nilaiCapped = isCapped ? 100 : nilaiRaw;
	const saran = isCapped
		? "OKE — sudah maksimal 100."
		: "UBAH Tanggal Rencana GUP (SP2D) LEBIH CEPAT ATAU Nilai Rencana GUP DITAMBAHKAN.";

	trace.push({
		step: 4,
		label: "Nilai Kualitas GUP (C19 = C11 × (E14 / E17) × 100, cap 100)",
		formula: "(nilaiRencana/nilaiUP) × (hariDisebulankan/hariSP2D) × 100",
		inputs: {
			C11_persen: (persentaseGUP * 100).toFixed(2) + "%",
			E14_disebulankan: String(hariDisebulankan),
			E17_hariSP2D: String(hariSP2D),
		},
		result: `${nilaiRaw.toFixed(2)} → ${nilaiCapped.toFixed(2)}${isCapped ? " (cap 100)" : ""}`,
	});

	return {
		persentaseGUP,
		hariDisebulankan,
		hariSP2D,
		tanggalMaksimal,
		status,
		nilaiRaw,
		nilaiCapped,
		isCapped,
		saran,
		formulaTrace: trace,
		isValid: true,
		validationMessage: null,
	};
}

export function hasUpTupChanges(a: UpTupAssumptions | null): boolean {
	if (!a) return false;
	const d = DEFAULT_UP_TUP_ASSUMPTIONS;
	return (
		a.nilaiUP !== d.nilaiUP ||
		a.nilaiRencanaGUP !== d.nilaiRencanaGUP ||
		a.tanggalGUPSebelumnya !== d.tanggalGUPSebelumnya ||
		a.tanggalRencanaGUP !== d.tanggalRencanaGUP ||
		a.tupTepat !== d.tupTepat ||
		a.tupTerlambat !== d.tupTerlambat ||
		a.ptupTepat !== d.ptupTepat ||
		a.gupNihilCount !== d.gupNihilCount ||
		a.setoranTepat !== d.setoranTepat ||
		a.kkpNominal !== d.kkpNominal ||
		a.kkpTanggal !== d.kkpTanggal
	);
}

export function hasSimulationChanges(s: SimulationAssumptions): boolean {
	return hasUpTupChanges(s.upTup) || hasDispensasiChanges(s.dispensasi);
}

/**
 * Konversi asumsi operasional → EngineInput UP/TUP.
 * Mapping (didokumentasikan, lossy mengikuti engine saat ini):
 * - Rencana GUP → 1 transaksi UP (date=sebelumnya, settlement=rencana).
 * - tupTepat → N transaksi TUP tepat (selisih 20 hari, settled).
 * - tupTerlambat → N transaksi TUP terlambat (selisih 35 hari).
 * - ptupTepat → N transaksi TUP tepat (engine belum bedakan PTUP; DB punya tipe
 *   PTUP tapi `calculate.ts` collapse ke UP/TUP — keterbatasan diketahui).
 * - gupNihilCount → N transaksi UP nominal 0 tepat waktu (GUP Nihil).
 * - setoranTepat → N transaksi TUP tepat (Setoran TUP).
 * - kkpNominal > 0 → 1 transaksi KKP.
 */
export function buildUpTupEngineInput(a: UpTupAssumptions): {
	transactions: Array<{
		id: string;
		type: "UP" | "TUP";
		amount: string;
		date: string;
		settlementDate: string | null;
		isSettled: boolean;
	}>;
	kkpTransactions: Array<{ id: string; amount: string; date: string }>;
} {
	const transactions: ReturnType<
		typeof buildUpTupEngineInput
	>["transactions"] = [];
	const kkpTransactions: ReturnType<
		typeof buildUpTupEngineInput
	>["kkpTransactions"] = [];

	const baseDate = parseISODate(a.tanggalGUPSebelumnya)
		? a.tanggalGUPSebelumnya
		: "2026-05-05";
	const rencanaDate = parseISODate(a.tanggalRencanaGUP)
		? a.tanggalRencanaGUP
		: baseDate;

	transactions.push({
		id: "asumsi-gup-1",
		type: "UP",
		amount: String(Number(a.nilaiRencanaGUP) || 0),
		date: baseDate,
		settlementDate: rencanaDate,
		isSettled: true,
	});

	const addDays = (iso: string, days: number): string => {
		const d = parseISODate(iso);
		if (!d) return iso;
		return toISODate(new Date(d.getTime() + days * 86400000));
	};

	const safeCount = (n: number): number =>
		Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 0), 20) : 0;

	for (let i = 0; i < safeCount(a.tupTepat); i++) {
		transactions.push({
			id: `asumsi-tup-tepat-${i + 1}`,
			type: "TUP",
			amount: "1000000",
			date: baseDate,
			settlementDate: addDays(baseDate, 20),
			isSettled: true,
		});
	}
	for (let i = 0; i < safeCount(a.tupTerlambat); i++) {
		transactions.push({
			id: `asumsi-tup-lambat-${i + 1}`,
			type: "TUP",
			amount: "1000000",
			date: baseDate,
			settlementDate: addDays(baseDate, 35),
			isSettled: true,
		});
	}
	for (let i = 0; i < safeCount(a.ptupTepat); i++) {
		transactions.push({
			id: `asumsi-ptup-${i + 1}`,
			type: "TUP",
			amount: "1000000",
			date: baseDate,
			settlementDate: addDays(baseDate, 20),
			isSettled: true,
		});
	}
	for (let i = 0; i < safeCount(a.gupNihilCount); i++) {
		transactions.push({
			id: `asumsi-gup-nihil-${i + 1}`,
			type: "UP",
			amount: "0",
			date: baseDate,
			settlementDate: addDays(baseDate, 10),
			isSettled: true,
		});
	}
	for (let i = 0; i < safeCount(a.setoranTepat); i++) {
		transactions.push({
			id: `asumsi-setoran-${i + 1}`,
			type: "TUP",
			amount: "1000000",
			date: baseDate,
			settlementDate: addDays(baseDate, 20),
			isSettled: true,
		});
	}

	const kkpNum = Number(a.kkpNominal);
	if (Number.isFinite(kkpNum) && kkpNum > 0) {
		kkpTransactions.push({
			id: "asumsi-kkp-1",
			amount: String(kkpNum),
			date: parseISODate(a.kkpTanggal) ? a.kkpTanggal : baseDate,
		});
	}

	return { transactions, kkpTransactions };
}
