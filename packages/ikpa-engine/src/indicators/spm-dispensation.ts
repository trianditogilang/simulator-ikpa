import type { RuleSetConfig } from "../rule-set";
import type { FormulaStep, SpmDispensationInput } from "../types";
import { DecimalCalc } from "../utils/decimal";

export function calculateSpmDispensation(
	input: SpmDispensationInput,
	config: RuleSetConfig,
): {
	deduction: string;
	ratio: string;
	category: number;
	formulaTrace: FormulaStep[];
	warnings: string[];
} {
	const warnings: string[] = [];
	const formulaTrace: FormulaStep[] = [];

	let step = 1;

	if (input.totalSpmQ4 === 0) {
		warnings.push(
			"Belum ada SPM Triwulan IV. Pengurang dispensasi dihitung 0.",
		);
		return {
			deduction: "0",
			ratio: "0.00",
			category: 1,
			formulaTrace: [
				{
					step: step++,
					label: "Rasio SPM Dispensasi (Permil)",
					formula:
						"totalSpmQ4 == 0 ? 0 : (dispensationCount / totalSpmQ4) * 1000",
					inputs: {
						dispensationCount: input.dispensationCount.toString(),
						totalSpmQ4: "0",
					},
					result: "0.00‰",
				},
				{
					step: step++,
					label: "Kategori & Pengurang Dispensasi",
					formula: "Kategori 1 (rentang 0,00‰) → pengurang 0,00",
					inputs: {
						ratio: "0.00",
						category: "1",
						deduction: "0",
					},
					result: "0",
				},
				{
					step: step++,
					label: "Dampak terhadap Nilai IKPA Akhir",
					formula: "Nilai IKPA Akhir = Subtotal 7 Indikator − Pengurang",
					inputs: {
						deduction: "0",
					},
					result: "Pengurang 0 poin (tanpa potongan)",
				},
			],
			warnings,
		};
	}

	if (input.dispensationCount > input.totalSpmQ4) {
		warnings.push("Jumlah SPM dispensasi tidak boleh melebihi total SPM Q4.");
	}

	// Ratio in permil: (dispensationCount * 1000) / totalSpmQ4
	const numerator = (BigInt(input.dispensationCount) * 1000n).toString();
	const ratioRaw = DecimalCalc.div(numerator, input.totalSpmQ4.toString());
	const ratioRounded = DecimalCalc.roundHalfUp(ratioRaw, 2);

	formulaTrace.push({
		step: step++,
		label: "Rasio SPM Dispensasi (Permil)",
		formula: "(dispensationCount / totalSpmQ4) * 1000",
		inputs: {
			dispensationCount: input.dispensationCount.toString(),
			totalSpmQ4: input.totalSpmQ4.toString(),
		},
		result: `${ratioRounded}‰`,
	});

	let deduction = "0";
	let appliedBucket: (typeof config.dispensationBuckets)[number] | null = null;

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
		const maxBucket = [...config.dispensationBuckets]
			.sort((a, b) => (DecimalCalc.gt(a.maxRatio, b.maxRatio) ? 1 : -1))
			.pop();

		if (maxBucket && DecimalCalc.gt(ratioRounded, maxBucket.maxRatio)) {
			deduction = maxBucket.deduction;
			appliedBucket = maxBucket;
		}
	}

	const category =
		appliedBucket?.category ??
		(DecimalCalc.eq(deduction, "0")
			? 1
			: DecimalCalc.eq(deduction, "0.25")
				? 2
				: DecimalCalc.eq(deduction, "0.50")
					? 3
					: DecimalCalc.eq(deduction, "0.75")
						? 4
						: 5);

	formulaTrace.push({
		step: step++,
		label: "Kategori & Pengurang Dispensasi",
		formula: `Kategori ${category} (rentang ${appliedBucket?.minRatio ?? "0"}–${appliedBucket?.maxRatio ?? "9999"}‰) → pengurang ${deduction}`,
		inputs: {
			ratio: ratioRounded,
			category: category.toString(),
			bucketMin: appliedBucket?.minRatio || "0",
			bucketMax: appliedBucket?.maxRatio || "9999",
			deduction,
		},
		result: `−${deduction}`,
	});

	formulaTrace.push({
		step: step++,
		label: "Dampak terhadap Nilai IKPA Akhir",
		formula: "Nilai IKPA Akhir = Subtotal 7 Indikator − Pengurang",
		inputs: {
			deduction,
		},
		result: `Pengurang ${deduction} poin`,
	});

	return {
		deduction,
		ratio: ratioRounded,
		category,
		formulaTrace,
		warnings,
	};
}
