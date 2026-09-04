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

/** Rasio permil + bucket pengurang (selaras rule set 2026.1). */
export function calcDispensasiPreview(a: DispensasiAssumptions): {
	ratio: number;
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
		return { ratio: 0, deduction: 0, isValid: false, message: "Isi angka ≥ 0." };
	}
	if (totalSpmQ4 === 0) {
		return {
			ratio: 0,
			deduction: 0,
			isValid: true,
			message: dispensationCount > 0 ? "Total Q4 0 — isi total dulu." : null,
		};
	}
	if (dispensationCount > totalSpmQ4) {
		return {
			ratio: (dispensationCount / totalSpmQ4) * 1000,
			deduction: 1,
			isValid: false,
			message: "Dispensasi tidak boleh melebihi total Q4.",
		};
	}
	const ratio = (dispensationCount / totalSpmQ4) * 1000;
	const buckets: Array<{ min: number; max: number; deduction: number }> = [
		{ min: 0, max: 0.009, deduction: 0 },
		{ min: 0.01, max: 0.099, deduction: 0.25 },
		{ min: 0.1, max: 0.999, deduction: 0.5 },
		{ min: 1, max: 4.999, deduction: 0.75 },
		{ min: 5, max: Number.POSITIVE_INFINITY, deduction: 1 },
	];
	const hit = buckets.find((b) => ratio >= b.min && ratio <= b.max);
	return {
		ratio,
		deduction: hit?.deduction ?? 0,
		isValid: true,
		message: null,
	};
}
