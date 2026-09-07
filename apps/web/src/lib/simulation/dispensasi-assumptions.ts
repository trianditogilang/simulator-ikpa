import {
	calculateSpmDispensation,
	default2026RuleSet,
} from "@simulator-ikpa/ikpa-engine";

/**
 * Asumsi operasional SPM Dispensasi — ponytail minimal.
 * Total tetap: Σ 7 kontribusi − pengurang (bukan bobot positif).
 */

export interface DispensasiAssumptions {
	dispensationCount: number;
	totalSpmQ4: number;
}

export const DEFAULT_DISPENSASI_ASSUMPTIONS: DispensasiAssumptions = {
	dispensationCount: 0,
	totalSpmQ4: 0,
};

export function hasDispensasiChanges(
	a: DispensasiAssumptions | null,
): boolean {
	if (!a) return false;
	return (
		a.dispensationCount !== DEFAULT_DISPENSASI_ASSUMPTIONS.dispensationCount ||
		a.totalSpmQ4 !== DEFAULT_DISPENSASI_ASSUMPTIONS.totalSpmQ4
	);
}

/** Rasio permil + bucket pengurang (selaras engine resmi 2026). */
export function calcDispensasiPreview(a: DispensasiAssumptions): {
	ratio: number;
	ratioFormatted: string;
	category: number;
	deduction: number;
	isValid: boolean;
	message: string | null;
} {
	const { dispensationCount, totalSpmQ4 } = a;
	if (
		!Number.isFinite(dispensationCount) ||
		!Number.isFinite(totalSpmQ4) ||
		dispensationCount < 0 ||
		totalSpmQ4 < 0
	) {
		return {
			ratio: 0,
			ratioFormatted: "0,00",
			category: 1,
			deduction: 0,
			isValid: false,
			message: "Isi angka ≥ 0.",
		};
	}

	const intDisp = Math.floor(dispensationCount);
	const intTotal = Math.floor(totalSpmQ4);

	if (intTotal === 0) {
		return {
			ratio: 0,
			ratioFormatted: "0,00",
			category: 1,
			deduction: 0,
			isValid: true,
			message: intDisp > 0 ? "Total SPM Q4 bernilai 0. Isi total SPM terlebih dahulu." : null,
		};
	}

	if (intDisp > intTotal) {
		const rawRatio = (intDisp / intTotal) * 1000;
		return {
			ratio: rawRatio,
			ratioFormatted: rawRatio.toFixed(2).replace(".", ","),
			category: 5,
			deduction: 1.0,
			isValid: false,
			message: "Dispensasi tidak boleh melebihi total SPM Q4.",
		};
	}

	const engineResult = calculateSpmDispensation(
		{
			dispensationCount: intDisp,
			totalSpmQ4: intTotal,
		},
		default2026RuleSet,
	);

	const ratioNum = parseFloat(engineResult.ratio) || 0;
	const deductionNum = parseFloat(engineResult.deduction) || 0;

	return {
		ratio: ratioNum,
		ratioFormatted: engineResult.ratio.replace(".", ","),
		category: engineResult.category,
		deduction: deductionNum,
		isValid: true,
		message: null,
	};
}
