export type ValidationSeverity =
	| "valid"
	| "info"
	| "warning"
	| "correctable"
	| "confirmation_required"
	| "blocking";

export type ValidationCode =
	| "00"
	| "01"
	| "02"
	| "03"
	| "04"
	| "05"
	| "06"
	| "07"
	| "08";

export interface OutputValidationResult {
	code: ValidationCode;
	severity: ValidationSeverity;
	status: "passed" | "failed" | "not_evaluable" | "resolved";
	title: string;
	message: string;
	affectedFields: string[];
	requiresOperatorNote: boolean;
	requiresEvidence: boolean;
	requiresPPKReview: boolean;
	requiresKPPNFollowUp: boolean;
	policyVersion: string;
	resolvedAt?: string;
	resolvedBy?: string;
	resolutionNote?: string;
}

export interface OutputValidationInput {
	fiscalYear?: number;
	organizationId?: string;
	roCode: string;
	month: number;
	isPriorityNational?: boolean;
	unit?: string;
	unitAllowsDecimal?: boolean;
	volumeDipa: number;
	pcroCumulative: number;
	tpcroCumulative: number;
	rvroCumulative: number;
	ppaCumulative?: number | null; // null/undefined if PPA data not available
	hasPpaData?: boolean;
	confirmed?: boolean;
	fairnessStatus?: "included" | "excluded";
	evidenceStatus?: boolean;
	ruleSetVersion?: string;
}

export interface AnomalyEvaluationResult {
	hasAnomaly: boolean;
	anomalyType?: "ANOMALI_CAPAIAN_TERLALU_TINGGI" | "ANOMALI_CAPAIAN_TERLALU_RENDAH";
	gap: number; // PCRO - PPA
	threshold: { high: number; low: number };
	isPriorityNational: boolean;
	message?: string;
}

export function evaluateOutputAnomaly(
	input: OutputValidationInput,
): AnomalyEvaluationResult {
	const isPN = input.isPriorityNational ?? false;
	const threshold = isPN
		? { high: 5, low: -5 }
		: { high: 20, low: -20 };

	if (input.ppaCumulative === null || input.ppaCumulative === undefined) {
		return {
			hasAnomaly: false,
			gap: 0,
			threshold,
			isPriorityNational: isPN,
		};
	}

	const gap = Math.round((input.pcroCumulative - input.ppaCumulative) * 100) / 100;

	if (gap > threshold.high) {
		return {
			hasAnomaly: true,
			anomalyType: "ANOMALI_CAPAIAN_TERLALU_TINGGI",
			gap,
			threshold,
			isPriorityNational: isPN,
			message: `Progres fisik (PCRO ${input.pcroCumulative}%) melampaui serapan anggaran (PPA ${input.ppaCumulative}%) sebesar +${gap} poin (ambang batas +${threshold.high} poin).`,
		};
	}

	if (gap < threshold.low) {
		return {
			hasAnomaly: true,
			anomalyType: "ANOMALI_CAPAIAN_TERLALU_RENDAH",
			gap,
			threshold,
			isPriorityNational: isPN,
			message: `Progres fisik (PCRO ${input.pcroCumulative}%) tertinggal dari serapan anggaran (PPA ${input.ppaCumulative}%) sebesar ${gap} poin (ambang batas ${threshold.low} poin).`,
		};
	}

	return {
		hasAnomaly: false,
		gap,
		threshold,
		isPriorityNational: isPN,
	};
}

export function validateOutputRecord(
	input: OutputValidationInput,
): OutputValidationResult[] {
	const results: OutputValidationResult[] = [];
	const policyVersion = input.ruleSetVersion || "2026.1";
	const unitAllowsDecimal = input.unitAllowsDecimal ?? false;
	const unit = input.unit || "Layanan";
	const hasPpa = input.ppaCumulative !== null && input.ppaCumulative !== undefined;
	const ppa = hasPpa ? Number(input.ppaCumulative) : 0;
	const pcro = Number(input.pcroCumulative);
	const rvro = Number(input.rvroCumulative);
	const volume = Number(input.volumeDipa);

	// Rule 01: PPA > 0 dan PCRO = 0 (blocking)
	if (!hasPpa) {
		results.push({
			code: "01",
			severity: "info",
			status: "not_evaluable",
			title: "PPA belum tersedia per RO",
			message: "PPA belum tersedia per RO; validasi realisasi anggaran vs PCRO 0% tidak dapat dilakukan.",
			affectedFields: ["pcro", "ppa"],
			requiresOperatorNote: false,
			requiresEvidence: false,
			requiresPPKReview: false,
			requiresKPPNFollowUp: false,
			policyVersion,
		});
	} else if (ppa > 0 && pcro === 0) {
		results.push({
			code: "01",
			severity: "blocking",
			status: "failed",
			title: "Realisasi Anggaran Tanpa Progres Fisik (PCRO 0%)",
			message: `Terdapat realisasi anggaran (PPA ${ppa}%), namun progres fisik (PCRO) masih 0%. Wajib diisi progres fisik aktual atau dilakukan penyesuaian data sebelum dikirim.`,
			affectedFields: ["pcro"],
			requiresOperatorNote: true,
			requiresEvidence: false,
			requiresPPKReview: true,
			requiresKPPNFollowUp: false,
			policyVersion,
		});
	}

	// Rule 02: PCRO < PPA (confirmation_required)
	if (!hasPpa) {
		results.push({
			code: "02",
			severity: "info",
			status: "not_evaluable",
			title: "PPA belum tersedia per RO",
			message: "PPA belum tersedia per RO; validasi PCRO < PPA tidak dapat dilakukan.",
			affectedFields: ["pcro", "ppa"],
			requiresOperatorNote: false,
			requiresEvidence: false,
			requiresPPKReview: false,
			requiresKPPNFollowUp: false,
			policyVersion,
		});
	} else if (pcro < ppa) {
		results.push({
			code: "02",
			severity: "confirmation_required",
			status: "failed",
			title: "Progres Fisik Tertinggal dari Serapan Anggaran (PCRO < PPA)",
			message: `PCRO (${pcro}%) lebih rendah daripada PPA (${ppa}%). Perlu penjelasan penyebab progres fisik tertinggal dari serapan anggaran.`,
			affectedFields: ["pcro", "ppa"],
			requiresOperatorNote: true,
			requiresEvidence: false,
			requiresPPKReview: true,
			requiresKPPNFollowUp: false,
			policyVersion,
		});
	}

	// Rule 03: PCRO = 100 dan RVRO = 0 (correctable default warning kuat)
	if (pcro >= 100 && rvro === 0) {
		results.push({
			code: "03",
			severity: "correctable",
			status: "failed",
			title: "PCRO 100% dengan RVRO Nol",
			message: `PCRO sudah mencapai 100%, namun realisasi volume (RVRO) masih 0. Periksa kembali pengisian volume capaian.`,
			affectedFields: ["rvro", "pcro"],
			requiresOperatorNote: false,
			requiresEvidence: false,
			requiresPPKReview: false,
			requiresKPPNFollowUp: false,
			policyVersion,
		});
	}

	// Rule 04: PCRO = 100 dan RVRO < volumeDipa (blocking)
	if (pcro >= 100 && rvro < volume && rvro > 0) {
		results.push({
			code: "04",
			severity: "blocking",
			status: "failed",
			title: "PCRO 100% tetapi Volume Belum Tercapai Penuh",
			message: `PCRO sudah 100%, tetapi realisasi volume (${rvro}) masih lebih kecil dari target volume DIPA (${volume}).`,
			affectedFields: ["rvro", "pcro"],
			requiresOperatorNote: true,
			requiresEvidence: false,
			requiresPPKReview: true,
			requiresKPPNFollowUp: false,
			policyVersion,
		});
	}

	// Rule 05: RVRO > 0 dan PPA = 0 (confirmation_required)
	if (!hasPpa) {
		results.push({
			code: "05",
			severity: "info",
			status: "not_evaluable",
			title: "PPA belum tersedia per RO",
			message: "PPA belum tersedia per RO; validasi RVRO > 0 vs PPA 0% tidak dapat dilakukan.",
			affectedFields: ["rvro", "ppa"],
			requiresOperatorNote: false,
			requiresEvidence: false,
			requiresPPKReview: false,
			requiresKPPNFollowUp: false,
			policyVersion,
		});
	} else if (rvro > 0 && ppa === 0) {
		results.push({
			code: "05",
			severity: "confirmation_required",
			status: "failed",
			title: "Volume Tercapai Tanpa Serapan Anggaran (PPA 0%)",
			message: `Terdapat realisasi volume (${rvro}), namun realisasi anggaran (PPA) masih 0%. Perlu konfirmasi sumber pendanaan atau status penerbitan SP2D.`,
			affectedFields: ["rvro", "ppa"],
			requiresOperatorNote: true,
			requiresEvidence: true,
			requiresPPKReview: true,
			requiresKPPNFollowUp: false,
			policyVersion,
		});
	}

	// Rule 06: RVRO desimal dan satuan RO tidak mengizinkan desimal (correctable)
	if (!unitAllowsDecimal && !Number.isInteger(rvro)) {
		results.push({
			code: "06",
			severity: "correctable",
			status: "failed",
			title: "Format Desimal Tidak Diizinkan pada Satuan RO",
			message: `Satuan '${unit}' tidak mengizinkan nilai desimal pada realisasi volume (${rvro}). Masukkan bilangan bulat murni.`,
			affectedFields: ["rvro"],
			requiresOperatorNote: false,
			requiresEvidence: false,
			requiresPPKReview: false,
			requiresKPPNFollowUp: false,
			policyVersion,
		});
	}

	// Rule 07: RVRO > volumeDipa (confirmation_required)
	if (rvro > volume) {
		results.push({
			code: "07",
			severity: "confirmation_required",
			status: "failed",
			title: "Realisasi Volume Melampaui Target DIPA (Over-target)",
			message: `Realisasi volume (${rvro}) melampaui target volume DIPA (${volume}). Data aktual tetap disimpan, skor Formula 2 di-cap pada 100%.`,
			affectedFields: ["rvro"],
			requiresOperatorNote: true,
			requiresEvidence: true,
			requiresPPKReview: true,
			requiresKPPNFollowUp: false,
			policyVersion,
		});
	}

	// Rule 08: RVRO >= volumeDipa dan PCRO < 100 (confirmation_required)
	if (rvro >= volume && pcro < 100 && volume > 0) {
		results.push({
			code: "08",
			severity: "confirmation_required",
			status: "failed",
			title: "Target Volume Tercapai tetapi PCRO Belum 100%",
			message: `Realisasi volume telah mencapai/melampaui target DIPA (${rvro}/${volume}), namun PCRO masih ${pcro}%. Perlu konfirmasi penyelesaian administrasi atau tahapan akhir.`,
			affectedFields: ["pcro", "rvro"],
			requiresOperatorNote: true,
			requiresEvidence: false,
			requiresPPKReview: true,
			requiresKPPNFollowUp: false,
			policyVersion,
		});
	}

	// Rule 00: Jika tidak ada rule yang berstatus failed
	const failedFindings = results.filter((r) => r.status === "failed");
	if (failedFindings.length === 0) {
		results.unshift({
			code: "00",
			severity: "valid",
			status: "passed",
			title: "Data Konsisten & Valid",
			message: "Seluruh data target, realisasi fisik, dan serapan anggaran konsisten dan siap dilaporkan.",
			affectedFields: [],
			requiresOperatorNote: false,
			requiresEvidence: false,
			requiresPPKReview: false,
			requiresKPPNFollowUp: false,
			policyVersion,
		});
	}

	return results;
}

export function hasBlockingValidation(results: OutputValidationResult[]): boolean {
	return results.some((r) => r.status === "failed" && r.severity === "blocking");
}

export function hasConfirmationRequiredValidation(
	results: OutputValidationResult[],
): boolean {
	return results.some(
		(r) => r.status === "failed" && r.severity === "confirmation_required",
	);
}
