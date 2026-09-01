import type { SpmDispensationInput, FormulaStep } from "../types";
import type { RuleSetConfig } from "../rule-set";
import { DecimalCalc } from "../utils/decimal";

export function calculateSpmDispensation(
	input: SpmDispensationInput,
	config: RuleSetConfig,
): {
	deduction: string;
	ratio: string;
	formulaTrace: FormulaStep[];
	warnings: string[];
} {
	const warnings: string[] = [];
	const formulaTrace: FormulaStep[] = [];

	let step = 1;

	if (input.totalSpmQ4 === 0) {
		warnings.push(
			"Total SPM Q4 adalah 0. Tidak ada pengurang (deduction = 0).",
		);
		return {
			deduction: "0",
			ratio: "0",
			formulaTrace: [
				{
					step: step++,
					label: "Rasio Dispensasi SPM",
					formula:
						"totalSpmQ4 == 0 ? 0 : (dispensationCount / totalSpmQ4) * 1000",
					inputs: {
						dispensationCount: input.dispensationCount.toString(),
						totalSpmQ4: "0",
					},
					result: "0",
				},
			],
			warnings,
		};
	}

	// Ratio in permil: (dispensationCount / totalSpmQ4) * 1000
	const fraction = DecimalCalc.div(
		input.dispensationCount.toString(),
		input.totalSpmQ4.toString(),
	);
	const ratio = DecimalCalc.mul(fraction, "1000");
	const ratioRounded = DecimalCalc.roundHalfUp(ratio, 3); // permil typically 3 decimal places max in buckets

	formulaTrace.push({
		step: step++,
		label: "Rasio Dispensasi SPM (Permil)",
		formula: "(dispensationCount / totalSpmQ4) * 1000",
		inputs: {
			dispensationCount: input.dispensationCount.toString(),
			totalSpmQ4: input.totalSpmQ4.toString(),
		},
		result: ratioRounded,
	});

	let deduction = "0";
	let appliedBucket = null;

	// Lookup bucket
	for (const bucket of config.dispensationBuckets) {
		if (
			DecimalCalc.gte(ratioRounded, bucket.minRatio) &&
			DecimalCalc.lte(ratioRounded, bucket.maxRatio)
		) {
			deduction = bucket.deduction;
			appliedBucket = bucket;
			break;
		}
	}

	// If ratio exceeds max bucket, apply the highest one (or fallback)
	if (!appliedBucket) {
		// Find max bucket
		const maxBucket = [...config.dispensationBuckets]
			.sort((a, b) => (DecimalCalc.gt(a.maxRatio, b.maxRatio) ? 1 : -1))
			.pop();

		if (maxBucket && DecimalCalc.gt(ratioRounded, maxBucket.maxRatio)) {
			deduction = maxBucket.deduction;
			appliedBucket = maxBucket;
		}
	}

	formulaTrace.push({
		step: step++,
		label: "Pengurang Dispensasi SPM",
		formula: "Lookup rasio pada tabel dispensationBuckets",
		inputs: {
			ratio: ratioRounded,
			bucketMin: appliedBucket?.minRatio || "N/A",
			bucketMax: appliedBucket?.maxRatio || "N/A",
		},
		result: deduction,
	});

	return {
		deduction,
		ratio: ratioRounded,
		formulaTrace,
		warnings,
	};
}
