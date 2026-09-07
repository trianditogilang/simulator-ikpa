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

export type GupSubmissionStatus =
	| "INCOMPLETE"
	| "BELOW_MINIMUM"
	| "ELIGIBLE_OPTIMAL"
	| "NOT_PROPORTIONAL"
	| "LATE";

export type GupIkpaQualityStatus =
	| "UNAVAILABLE"
	| "OPTIMAL"
	| "BELOW_OPTIMAL"
	| "LATE_NOT_OPTIMAL";

export interface GupAnalysisAction {
	type: "adjust_amount" | "adjust_date" | "maintain";
	label: string;
	description: string;
}

export interface GupAnalysisResult {
	isValid: boolean;
	validationMessage: string | null;
	upAmount: number;
	plannedGupAmount: number;
	previousSp2dDate: string;
	plannedSp2dDate: string;
	intervalDays: number;
	referenceMonthDays: number;
	referenceMonthName: string;
	rawGupRatio: number;
	rawGupPercent: number;
	annualizedGupRatio: number;
	annualizedGupPercent: number;
	minGupRatio: number;
	minGupRatioPercent: number;
	minGupAmount: number;
	isMinimumAmountMet: boolean;
	latestOnTimeDate: string;
	isOnTime: boolean;
	isProportional: boolean;
	lateDays: number;
	marginDays: number;
	submissionStatus: GupSubmissionStatus;
	submissionStatusLabel: string;
	submissionSeverity: "success" | "warning" | "danger" | "neutral";
	ikpaQualityStatus: GupIkpaQualityStatus;
	ikpaQualityLabel: string;
	title: string;
	summaryExplanation: string;
	actions: GupAnalysisAction[];
	notes: string[];
	recommendedMinimumAmount: number;
	minimumAmountForOptimalAtPlannedDate: number;
	latestOptimalDateForCurrentAmount: string | null;
	maxIntervalForCurrentAmount: number;
	latestOptimalDateForMinimumAmount: string | null;
	maxIntervalForMinimumAmount: number;
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
	analysis?: GupAnalysisResult;
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

export function getReferenceMonthDays(date: Date): number {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

export function getMonthNameIndonesian(monthZeroIndexed: number): string {
	const names = [
		"Januari",
		"Februari",
		"Maret",
		"April",
		"Mei",
		"Juni",
		"Juli",
		"Agustus",
		"September",
		"Oktober",
		"November",
		"Desember",
	];
	return names[monthZeroIndexed] ?? "";
}

export function formatDateIndonesian(s?: string | null): string {
	if (!s) return "—";
	const dt = parseISODate(s);
	if (!dt) return s;
	return `${dt.getUTCDate()} ${getMonthNameIndonesian(dt.getUTCMonth())} ${dt.getUTCFullYear()}`;
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

export function analyzeGupPlan(
	a: UpTupAssumptions,
	config?: { minGupRatio?: number; optimalAnnualizedRatio?: number },
): GupAnalysisResult {
	const minGupRatio = config?.minGupRatio ?? 0.5;
	const optimalAnnualizedRatio = config?.optimalAnnualizedRatio ?? 1.0;
	const minGupRatioPercent = Math.round(minGupRatio * 100);

	const upAmount = Number(a.nilaiUP);
	const plannedGupAmount = Number(a.nilaiRencanaGUP);

	if (!Number.isFinite(upAmount) || upAmount <= 0) {
		return {
			isValid: false,
			validationMessage: "Nilai UP harus angka > Rp0.",
			upAmount: 0,
			plannedGupAmount: 0,
			previousSp2dDate: a.tanggalGUPSebelumnya,
			plannedSp2dDate: a.tanggalRencanaGUP,
			intervalDays: 0,
			referenceMonthDays: 30,
			referenceMonthName: "Bulan",
			rawGupRatio: 0,
			rawGupPercent: 0,
			annualizedGupRatio: 0,
			annualizedGupPercent: 0,
			minGupRatio,
			minGupRatioPercent,
			minGupAmount: 0,
			isMinimumAmountMet: false,
			latestOnTimeDate: "—",
			isOnTime: false,
			isProportional: false,
			lateDays: 0,
			marginDays: 0,
			submissionStatus: "INCOMPLETE",
			submissionStatusLabel: "Lengkapi data simulasi",
			submissionSeverity: "neutral",
			ikpaQualityStatus: "UNAVAILABLE",
			ikpaQualityLabel: "Belum dapat dihitung",
			title: "Hasil analisis belum dapat dibuat",
			summaryExplanation: "Nilai UP harus lebih dari Rp0.",
			actions: [],
			notes: ["Hasil analisis belum dapat dibuat. Perbaiki data yang ditandai terlebih dahulu."],
			recommendedMinimumAmount: 0,
			minimumAmountForOptimalAtPlannedDate: 0,
			latestOptimalDateForCurrentAmount: null,
			maxIntervalForCurrentAmount: 0,
			latestOptimalDateForMinimumAmount: null,
			maxIntervalForMinimumAmount: 0,
		};
	}

	if (!Number.isFinite(plannedGupAmount) || plannedGupAmount <= 0) {
		return {
			isValid: false,
			validationMessage: "Nilai rencana GUP harus angka > Rp0.",
			upAmount,
			plannedGupAmount: 0,
			previousSp2dDate: a.tanggalGUPSebelumnya,
			plannedSp2dDate: a.tanggalRencanaGUP,
			intervalDays: 0,
			referenceMonthDays: 30,
			referenceMonthName: "Bulan",
			rawGupRatio: 0,
			rawGupPercent: 0,
			annualizedGupRatio: 0,
			annualizedGupPercent: 0,
			minGupRatio,
			minGupRatioPercent,
			minGupAmount: upAmount * minGupRatio,
			isMinimumAmountMet: false,
			latestOnTimeDate: "—",
			isOnTime: false,
			isProportional: false,
			lateDays: 0,
			marginDays: 0,
			submissionStatus: "INCOMPLETE",
			submissionStatusLabel: "Lengkapi data simulasi",
			submissionSeverity: "neutral",
			ikpaQualityStatus: "UNAVAILABLE",
			ikpaQualityLabel: "Belum dapat dihitung",
			title: "Hasil analisis belum dapat dibuat",
			summaryExplanation: "Nilai rencana GUP harus lebih dari Rp0.",
			actions: [],
			notes: ["Hasil analisis belum dapat dibuat. Perbaiki data yang ditandai terlebih dahulu."],
			recommendedMinimumAmount: 0,
			minimumAmountForOptimalAtPlannedDate: 0,
			latestOptimalDateForCurrentAmount: null,
			maxIntervalForCurrentAmount: 0,
			latestOptimalDateForMinimumAmount: null,
			maxIntervalForMinimumAmount: 0,
		};
	}

	if (plannedGupAmount > upAmount) {
		return {
			isValid: false,
			validationMessage: "Nilai rencana GUP tidak boleh melebihi nilai UP.",
			upAmount,
			plannedGupAmount,
			previousSp2dDate: a.tanggalGUPSebelumnya,
			plannedSp2dDate: a.tanggalRencanaGUP,
			intervalDays: 0,
			referenceMonthDays: 30,
			referenceMonthName: "Bulan",
			rawGupRatio: plannedGupAmount / upAmount,
			rawGupPercent: (plannedGupAmount / upAmount) * 100,
			annualizedGupRatio: 0,
			annualizedGupPercent: 0,
			minGupRatio,
			minGupRatioPercent,
			minGupAmount: upAmount * minGupRatio,
			isMinimumAmountMet: true,
			latestOnTimeDate: "—",
			isOnTime: false,
			isProportional: false,
			lateDays: 0,
			marginDays: 0,
			submissionStatus: "INCOMPLETE",
			submissionStatusLabel: "Lengkapi data simulasi",
			submissionSeverity: "neutral",
			ikpaQualityStatus: "UNAVAILABLE",
			ikpaQualityLabel: "Belum dapat dihitung",
			title: "Nilai rencana GUP melebihi UP",
			summaryExplanation: "Nilai rencana GUP tidak boleh melebihi nilai UP.",
			actions: [],
			notes: ["Nilai rencana GUP tidak boleh melebihi nilai UP."],
			recommendedMinimumAmount: 0,
			minimumAmountForOptimalAtPlannedDate: 0,
			latestOptimalDateForCurrentAmount: null,
			maxIntervalForCurrentAmount: 0,
			latestOptimalDateForMinimumAmount: null,
			maxIntervalForMinimumAmount: 0,
		};
	}

	const prev = parseISODate(a.tanggalGUPSebelumnya);
	const rencana = parseISODate(a.tanggalRencanaGUP);
	const latestOnTimeDate = calcTanggalMaksimal(a.tanggalGUPSebelumnya);

	if (!prev || !rencana || !latestOnTimeDate) {
		return {
			isValid: false,
			validationMessage: "Format tanggal harus YYYY-MM-DD yang valid.",
			upAmount,
			plannedGupAmount,
			previousSp2dDate: a.tanggalGUPSebelumnya,
			plannedSp2dDate: a.tanggalRencanaGUP,
			intervalDays: 0,
			referenceMonthDays: 30,
			referenceMonthName: "Bulan",
			rawGupRatio: plannedGupAmount / upAmount,
			rawGupPercent: (plannedGupAmount / upAmount) * 100,
			annualizedGupRatio: 0,
			annualizedGupPercent: 0,
			minGupRatio,
			minGupRatioPercent,
			minGupAmount: upAmount * minGupRatio,
			isMinimumAmountMet: false,
			latestOnTimeDate: latestOnTimeDate ?? "—",
			isOnTime: false,
			isProportional: false,
			lateDays: 0,
			marginDays: 0,
			submissionStatus: "INCOMPLETE",
			submissionStatusLabel: "Lengkapi data simulasi",
			submissionSeverity: "neutral",
			ikpaQualityStatus: "UNAVAILABLE",
			ikpaQualityLabel: "Belum dapat dihitung",
			title: "Hasil analisis belum dapat dibuat",
			summaryExplanation: "Lengkapi tanggal SP2D sebelumnya dan tanggal rencana SP2D.",
			actions: [],
			notes: ["Format tanggal harus YYYY-MM-DD."],
			recommendedMinimumAmount: 0,
			minimumAmountForOptimalAtPlannedDate: 0,
			latestOptimalDateForCurrentAmount: null,
			maxIntervalForCurrentAmount: 0,
			latestOptimalDateForMinimumAmount: null,
			maxIntervalForMinimumAmount: 0,
		};
	}

	const maxDate = parseISODate(latestOnTimeDate)!;
	const intervalDays = diffDays(prev, rencana);

	if (intervalDays <= 0) {
		return {
			isValid: false,
			validationMessage: "Tanggal rencana harus setelah tanggal SP2D sebelumnya.",
			upAmount,
			plannedGupAmount,
			previousSp2dDate: a.tanggalGUPSebelumnya,
			plannedSp2dDate: a.tanggalRencanaGUP,
			intervalDays,
			referenceMonthDays: 30,
			referenceMonthName: "Bulan",
			rawGupRatio: plannedGupAmount / upAmount,
			rawGupPercent: (plannedGupAmount / upAmount) * 100,
			annualizedGupRatio: 0,
			annualizedGupPercent: 0,
			minGupRatio,
			minGupRatioPercent,
			minGupAmount: upAmount * minGupRatio,
			isMinimumAmountMet: false,
			latestOnTimeDate,
			isOnTime: false,
			isProportional: false,
			lateDays: 0,
			marginDays: 0,
			submissionStatus: "INCOMPLETE",
			submissionStatusLabel: "Tanggal rencana tidak valid",
			submissionSeverity: "danger",
			ikpaQualityStatus: "UNAVAILABLE",
			ikpaQualityLabel: "Belum dapat dihitung",
			title: "Tanggal rencana tidak valid",
			summaryExplanation: "Tanggal rencana SP2D harus lebih baru dari tanggal SP2D sebelumnya (interval > 0 hari).",
			actions: [],
			notes: ["Perbaiki tanggal rencana SP2D agar setelah tanggal SP2D sebelumnya."],
			recommendedMinimumAmount: 0,
			minimumAmountForOptimalAtPlannedDate: 0,
			latestOptimalDateForCurrentAmount: null,
			maxIntervalForCurrentAmount: 0,
			latestOptimalDateForMinimumAmount: null,
			maxIntervalForMinimumAmount: 0,
		};
	}

	const referenceMonthDays = getReferenceMonthDays(prev);
	const referenceMonthName = getMonthNameIndonesian(prev.getUTCMonth());
	const rawGupRatio = plannedGupAmount / upAmount;
	const rawGupPercent = rawGupRatio * 100;
	const annualizedGupRatio = rawGupRatio * (referenceMonthDays / intervalDays);
	const annualizedGupPercent = annualizedGupRatio * 100;

	const minGupAmount = upAmount * minGupRatio;
	const isMinimumAmountMet = plannedGupAmount >= minGupAmount;
	const isOnTime = rencana.getTime() <= maxDate.getTime();
	const isProportional = annualizedGupRatio >= optimalAnnualizedRatio;

	const lateDays = Math.max(0, diffDays(maxDate, rencana));
	const marginDays = Math.max(0, diffDays(rencana, maxDate));

	// Minimum for optimal at planned date
	const minimumAmountForOptimalAtPlannedDate = Math.min(
		upAmount,
		Math.ceil(upAmount * optimalAnnualizedRatio * (intervalDays / referenceMonthDays)),
	);
	const recommendedMinimumAmount = Math.min(
		upAmount,
		Math.max(minGupAmount, minimumAmountForOptimalAtPlannedDate),
	);

	const maxIntervalForCurrentAmount = Math.floor(
		(rawGupRatio * referenceMonthDays) / optimalAnnualizedRatio,
	);
	const maxIntervalForMinimumAmount = Math.floor(
		(minGupRatio * referenceMonthDays) / optimalAnnualizedRatio,
	);

	const latestOptimalDateForCurrentAmount =
		maxIntervalForCurrentAmount > 0
			? toISODate(new Date(prev.getTime() + maxIntervalForCurrentAmount * 86400000))
			: null;

	const latestOptimalDateForMinimumAmount =
		maxIntervalForMinimumAmount > 0
			? toISODate(new Date(prev.getTime() + maxIntervalForMinimumAmount * 86400000))
			: null;

	// Determine statuses
	let submissionStatus: GupSubmissionStatus;
	let submissionStatusLabel: string;
	let submissionSeverity: "success" | "warning" | "danger" | "neutral";
	let ikpaQualityStatus: GupIkpaQualityStatus;
	let ikpaQualityLabel: string;
	let title: string;
	let summaryExplanation: string;
	const actions: GupAnalysisAction[] = [];
	const notes: string[] = [];

	if (!isMinimumAmountMet) {
		submissionStatus = "BELOW_MINIMUM";
		submissionStatusLabel = "Nominal di Bawah Batas Minimum";
		submissionSeverity = "danger";
		ikpaQualityStatus = isOnTime ? "BELOW_OPTIMAL" : "LATE_NOT_OPTIMAL";
		ikpaQualityLabel = isOnTime ? "IKPA GUP belum optimal" : "IKPA GUP tidak optimal karena terlambat";
		title = "Nilai rencana GUP belum memenuhi batas minimum";
		summaryExplanation = `Nilai rencana GUP sebesar ${formatRupiah(plannedGupAmount)} (${rawGupPercent.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%) masih di bawah batas minimum ${minGupRatioPercent}% dari UP (${formatRupiah(minGupAmount)}). Nilai GUP minimum adalah ${formatRupiah(minGupAmount)}.`;

		actions.push({
			type: "adjust_amount",
			label: "Naikkan Nilai Rencana GUP",
			description: `Naikkan nilai rencana GUP minimal menjadi ${formatRupiah(minGupAmount)}.`,
		});

		if (latestOptimalDateForMinimumAmount) {
			actions.push({
				type: "adjust_date",
				label: "Target Tanggal SP2D untuk Nominal Minimum",
				description: `Agar nilai minimum tersebut tetap setara 100% disebulankan, rencanakan SP2D paling lambat ${formatDateIndonesian(latestOptimalDateForMinimumAmount)} (selisih ${maxIntervalForMinimumAmount} hari kalender dari SP2D sebelumnya).`,
			});
		}

		if (!isOnTime) {
			notes.push(
				"Tanggal rencana saat ini melewati batas satu bulan. Memenuhi nominal minimum saja tidak membuat kualitas IKPA GUP optimal; tanggal perlu dimajukan.",
			);
		}
	} else if (!isOnTime) {
		submissionStatus = "LATE";
		submissionStatusLabel = "Melewati Batas Satu Bulan";
		submissionSeverity = "warning";
		ikpaQualityStatus = "LATE_NOT_OPTIMAL";
		ikpaQualityLabel = "IKPA GUP tidak optimal karena terlambat";
		title = "Rencana SP2D melewati batas satu bulan";
		summaryExplanation = `Rencana SP2D ${formatDateIndonesian(a.tanggalRencanaGUP)} berada ${lateDays} hari kalender setelah batas tepat waktu (${formatDateIndonesian(latestOnTimeDate)}). Pengajuan dapat memenuhi batas nominal, tetapi kualitas IKPA GUP tidak optimal karena terlambat.`;

		actions.push({
			type: "adjust_date",
			label: "Majukan Rencana SP2D",
			description: `Majukan rencana SP2D paling lambat ke ${formatDateIndonesian(latestOnTimeDate)}.`,
		});

		if (intervalDays > referenceMonthDays) {
			notes.push(
				`Menaikkan nilai GUP hingga ${formatRupiah(upAmount)} tidak dapat membuat nilai disebulankan mencapai 100% jika interval (${intervalDays} hari) sudah lebih panjang daripada ${referenceMonthDays} hari (${referenceMonthName}).`,
			);
		}
	} else if (!isProportional) {
		submissionStatus = "NOT_PROPORTIONAL";
		submissionStatusLabel = "Nominal Belum Proporsional terhadap Waktu";
		submissionSeverity = "warning";
		ikpaQualityStatus = "BELOW_OPTIMAL";
		ikpaQualityLabel = "IKPA GUP belum optimal";
		title = "Nilai GUP belum proporsional terhadap interval SP2D";
		summaryExplanation = `Dengan nilai GUP ${formatRupiah(plannedGupAmount)} dan interval ${intervalDays} hari kalender, persentase GUP disebulankan baru mencapai ${annualizedGupPercent.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%. Target kualitas optimal adalah minimal 100%.`;

		actions.push({
			type: "adjust_amount",
			label: "Pertahankan Tanggal Rencana",
			description: `Jika tanggal SP2D tetap ${formatDateIndonesian(a.tanggalRencanaGUP)}, tingkatkan nilai rencana GUP minimal menjadi ${formatRupiah(minimumAmountForOptimalAtPlannedDate)}.`,
		});

		if (latestOptimalDateForCurrentAmount) {
			actions.push({
				type: "adjust_date",
				label: "Pertahankan Nilai GUP",
				description: `Jika nilai GUP tetap ${formatRupiah(plannedGupAmount)}, rencanakan SP2D paling lambat ${formatDateIndonesian(latestOptimalDateForCurrentAmount)}.`,
			});
		} else {
			notes.push(
				"Dengan nominal saat ini, target 100% disebulankan tidak realistis pada interval rencana. Prioritaskan penyesuaian nominal GUP.",
			);
		}
	} else {
		submissionStatus = "ELIGIBLE_OPTIMAL";
		submissionStatusLabel = "Memenuhi Syarat Nominal & Proporsional";
		submissionSeverity = "success";
		ikpaQualityStatus = "OPTIMAL";
		ikpaQualityLabel = "IKPA GUP optimal";
		title = "Rencana GUP telah optimal untuk simulasi ini";
		summaryExplanation = `Nilai GUP memenuhi batas minimum, rencana SP2D masih dalam batas satu bulan, dan persentase GUP disebulankan mencapai ${annualizedGupPercent.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%.`;

		actions.push({
			type: "maintain",
			label: "Pertahankan Rencana",
			description: "Pertahankan kelengkapan dokumen dan verifikasi tanggal pengiriman agar realisasi SP2D tidak bergeser dari rencana.",
		});

		notes.push(
			"Simulasi ini bersifat internal satker untuk alat bantu perencanaan operasional dan bukan merupakan penetapan resmi KPPN.",
		);
	}

	return {
		isValid: true,
		validationMessage: null,
		upAmount,
		plannedGupAmount,
		previousSp2dDate: a.tanggalGUPSebelumnya,
		plannedSp2dDate: a.tanggalRencanaGUP,
		intervalDays,
		referenceMonthDays,
		referenceMonthName,
		rawGupRatio,
		rawGupPercent,
		annualizedGupRatio,
		annualizedGupPercent,
		minGupRatio,
		minGupRatioPercent,
		minGupAmount,
		isMinimumAmountMet,
		latestOnTimeDate,
		isOnTime,
		isProportional,
		lateDays,
		marginDays,
		submissionStatus,
		submissionStatusLabel,
		submissionSeverity,
		ikpaQualityStatus,
		ikpaQualityLabel,
		title,
		summaryExplanation,
		actions,
		notes,
		recommendedMinimumAmount,
		minimumAmountForOptimalAtPlannedDate,
		latestOptimalDateForCurrentAmount,
		maxIntervalForCurrentAmount,
		latestOptimalDateForMinimumAmount,
		maxIntervalForMinimumAmount,
	};
}

export function calcGupPreview(a: UpTupAssumptions): GupPreview {
	const analysis = analyzeGupPlan(a);
	if (!analysis.isValid) {
		return {
			persentaseGUP: analysis.rawGupRatio,
			hariDisebulankan: analysis.referenceMonthDays,
			hariSP2D: analysis.intervalDays,
			tanggalMaksimal: analysis.latestOnTimeDate,
			status: analysis.isOnTime ? "Tepat Waktu" : "Terlambat",
			nilaiRaw: 0,
			nilaiCapped: 0,
			isCapped: false,
			saran: analysis.validationMessage ?? "Data tidak valid.",
			formulaTrace: [],
			isValid: false,
			validationMessage: analysis.validationMessage,
			analysis,
		};
	}

	const trace: GupFormulaStep[] = [
		{
			step: 1,
			label: "Persentase GUP (C11 = C10 / C9)",
			formula: "nilaiRencanaGUP / nilaiUP",
			inputs: { C9_nilaiUP: a.nilaiUP, C10_rencanaGUP: a.nilaiRencanaGUP },
			result: `${analysis.rawGupPercent.toFixed(2)}%`,
		},
		{
			step: 2,
			label: "Tanggal Maksimal (hari yang sama bulan depan)",
			formula: "DATE(YEAR(C14), MONTH(C14)+1, DAY(C14))",
			inputs: { C14_sebelumnya: a.tanggalGUPSebelumnya },
			result: `${analysis.latestOnTimeDate} (${analysis.referenceMonthDays} hari)`,
		},
		{
			step: 3,
			label: "Status (D17 = IF(C17 <= D14, Tepat, Terlambat)) + Hari SP2D (E17 = C17 - C14)",
			formula: 'IF(rencana <= maksimal, "Tepat Waktu", "Terlambat")',
			inputs: {
				C17_rencana: a.tanggalRencanaGUP,
				D14_maksimal: analysis.latestOnTimeDate,
				E17_hariSP2D: String(analysis.intervalDays),
			},
			result: analysis.isOnTime ? "Tepat Waktu" : "Terlambat",
		},
		{
			step: 4,
			label: "Nilai Kualitas GUP (C19 = C11 × (E14 / E17) × 100, cap 100)",
			formula: "(nilaiRencana/nilaiUP) × (hariDisebulankan/hariSP2D) × 100",
			inputs: {
				C11_persen: `${analysis.rawGupPercent.toFixed(2)}%`,
				E14_disebulankan: String(analysis.referenceMonthDays),
				E17_hariSP2D: String(analysis.intervalDays),
			},
			result: `${analysis.annualizedGupPercent.toFixed(2)} → ${Math.min(100, analysis.annualizedGupPercent).toFixed(2)}${analysis.annualizedGupPercent >= 100 ? " (cap 100)" : ""}`,
		},
	];

	const isCapped = analysis.annualizedGupPercent >= 100;
	const nilaiCapped = isCapped ? 100 : analysis.annualizedGupPercent;
	const saran = isCapped
		? "OKE — sudah maksimal 100."
		: "Ubah Tanggal Rencana GUP (SP2D) LEBIH CEPAT atau TAMBAHKAN Nilai Rencana GUP.";

	return {
		persentaseGUP: analysis.rawGupRatio,
		hariDisebulankan: analysis.referenceMonthDays,
		hariSP2D: analysis.intervalDays,
		tanggalMaksimal: analysis.latestOnTimeDate,
		status: analysis.isOnTime ? "Tepat Waktu" : "Terlambat",
		nilaiRaw: analysis.annualizedGupPercent,
		nilaiCapped,
		isCapped,
		saran,
		formulaTrace: trace,
		isValid: true,
		validationMessage: null,
		analysis,
	};
}

function formatRupiah(value: number): string {
	return `Rp${Math.round(value).toLocaleString("id-ID")}`;
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
