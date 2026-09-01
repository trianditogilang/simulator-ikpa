import type {
	RpdDeviationInput,
	IndicatorCalculation,
	FormulaStep,
} from "../types";
import type { RuleSetConfig } from "../rule-set";
export function calculateRpdDeviation(
	input: RpdDeviationInput,
	config: RuleSetConfig,
): IndicatorCalculation {
	const steps: FormulaStep[] = [];
	const warnings: string[] = [];
	let stepCount = 1;

	if (config.assumptionWarnings) {
		for (const warning of config.assumptionWarnings) {
			if (warning.startsWith("DEV-")) {
				warnings.push(warning);
			}
		}
	}

	if (!input.months || input.months.length === 0) {
		return {
			key: "rpd_deviation",
			label: "Deviasi Halaman III DIPA",
			weight: config.weights.rpd_deviation,
			score: null,
			weightedContribution: null,
			status: "incomplete",
			formulaTrace: steps,
			warnings,
		};
	}

	let totalBudget = 0;
	const accountTypes = ["51", "52", "53", "57"] as const;
	for (const acc of accountTypes) {
		totalBudget += parseFloat(input.budgetByType[acc] || "0");
	}

	if (totalBudget === 0) {
		warnings.push(
			"Total budget is zero, unable to calculate weighted deviation.",
		);
		return {
			key: "rpd_deviation",
			label: "Deviasi Halaman III DIPA",
			weight: config.weights.rpd_deviation,
			score: null,
			weightedContribution: null,
			status: "incomplete",
			formulaTrace: steps,
			warnings,
		};
	}

	let sumWeightedDeviation = 0;
	let monthsProcessed = 0;

	for (const monthData of input.months) {
		if (monthData.month > 11) continue;

		let monthWeightedDev = 0;
		const monthInputs: Record<string, string> = {};

		for (const acc of accountTypes) {
			const plannedStr = monthData.planned[acc] || "0";
			const realizedStr = monthData.realized[acc] || "0";
			const planned = parseFloat(plannedStr);
			const realized = parseFloat(realizedStr);

			let deviation = 0;
			if (planned === 0) {
				deviation = realized === 0 ? 0 : 100;
			} else {
				deviation = (Math.abs(planned - realized) / planned) * 100;
			}
			deviation = Math.min(deviation, 100);

			const accBudget = parseFloat(input.budgetByType[acc] || "0");
			const weight = accBudget / totalBudget;
			monthWeightedDev += deviation * weight;

			monthInputs[`dev_${acc}`] = deviation.toFixed(
				config.rounding.fractionDigits,
			);
		}

		sumWeightedDeviation += monthWeightedDev;
		monthsProcessed++;

		steps.push({
			step: stepCount++,
			label: `Deviasi Bulan ${monthData.month}`,
			formula: "Sum(Deviasi Akun * (Pagu Akun / Total Pagu))",
			inputs: monthInputs,
			result: monthWeightedDev.toFixed(config.rounding.fractionDigits),
		});
	}

	if (monthsProcessed === 0) {
		return {
			key: "rpd_deviation",
			label: "Deviasi Halaman III DIPA",
			weight: config.weights.rpd_deviation,
			score: null,
			weightedContribution: null,
			status: "incomplete",
			formulaTrace: steps,
			warnings,
		};
	}

	const averageDeviation = sumWeightedDeviation / monthsProcessed;
	steps.push({
		step: stepCount++,
		label: "Rata-rata Deviasi",
		formula: "Sum(Deviasi Bulanan) / Jumlah Bulan",
		inputs: {
			total_deviasi: sumWeightedDeviation.toFixed(
				config.rounding.fractionDigits,
			),
			jumlah_bulan: monthsProcessed.toString(),
		},
		result: averageDeviation.toFixed(config.rounding.fractionDigits),
	});

	let score = 100;
	if (averageDeviation <= 5) {
		score = 100;
	} else {
		score = Math.max(0, 100 - averageDeviation);
	}

	steps.push({
		step: stepCount++,
		label: "Nilai Deviasi Halaman III DIPA",
		formula: "deviasi <= 5% ? 100 : 100 - deviasi",
		inputs: {
			rata_rata_deviasi: averageDeviation.toFixed(
				config.rounding.fractionDigits,
			),
		},
		result: score.toFixed(config.rounding.fractionDigits),
	});

	const weight = parseFloat(config.weights.rpd_deviation);
	const weighted = (score * weight) / 100;
	steps.push({
		step: stepCount++,
		label: "Nilai Tertimbang",
		formula: "Nilai * Bobot",
		inputs: {
			nilai: score.toFixed(config.rounding.fractionDigits),
			bobot: weight.toString(),
		},
		result: weighted.toFixed(config.rounding.fractionDigits),
	});

	return {
		key: "rpd_deviation",
		label: "Deviasi Halaman III DIPA",
		weight: config.weights.rpd_deviation,
		score: score.toFixed(config.rounding.fractionDigits),
		weightedContribution: weighted.toFixed(config.rounding.fractionDigits),
		status: monthsProcessed < 11 ? "incomplete" : "complete",
		formulaTrace: steps,
		warnings,
	};
}
