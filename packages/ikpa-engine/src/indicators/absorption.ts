import type { RuleSetConfig } from "../rule-set";
import type {
	AbsorptionInput,
	AccountType,
	FormulaStep,
	IndicatorCalculation,
} from "../types";
import { div, mul, parseDecimal, round } from "../utils";

export function calculateAbsorption(
	input: AbsorptionInput,
	isBlu: boolean,
	config: RuleSetConfig,
): IndicatorCalculation {
	const formulaTrace: FormulaStep[] = [];
	const warnings: string[] = [];
	let stepCounter = 1;

	const accountTypes: AccountType[] = ["51", "52", "53", "57"];

	if (isBlu) {
		warnings.push(
			"ABS-008: Satker BLU tidak menjadi objek penilaian Penyerapan Anggaran pada baseline PER-5/PB/2024",
		);
		return {
			key: "budget_absorption",
			label: "Penyerapan Anggaran",
			weight: config.weights.budget_absorption,
			score: "100",
			weightedContribution: round(
				mul("100", div(config.weights.budget_absorption, "100")),
			),
			status: "warning",
			formulaTrace: [
				{
					step: stepCounter++,
					label: "Pengecualian BLU",
					formula: "BLU = 100",
					inputs: { isBlu: "true" },
					result: "100",
				},
			],
			warnings,
		};
	}

	if (input.quarters.length === 0) {
		return {
			key: "budget_absorption",
			label: "Penyerapan Anggaran",
			weight: config.weights.budget_absorption,
			score: "0",
			weightedContribution: "0",
			status: "incomplete",
			formulaTrace,
			warnings: ["Tidak ada data triwulan untuk dihitung."],
		};
	}

	// Calculate per quarter
	let totalAllQuartersScore = 0;
	let validQuartersCount = 0;

	for (const q of input.quarters) {
		let quarterScore = 0;
		let quarterBudget = 0;

		formulaTrace.push({
			step: stepCounter++,
			label: `Mulai Perhitungan Triwulan ${q.quarter}`,
			formula: "",
			inputs: { quarter: q.quarter.toString() },
			result: "Mulai",
		});

		for (const acc of accountTypes) {
			const budgetStr = q.budget[acc] || "0";
			const realizedStr = q.realized[acc] || "0";
			const budget = parseDecimal(budgetStr);

			if (budget > 0) {
				const realized = parseDecimal(realizedStr);
				const targetStr = config.absorptionTargets[acc][q.quarter.toString()];
				const target = parseDecimal(targetStr);

				const realizationPercentage = (realized / budget) * 100;
				let scoreAcc = (realizationPercentage / target) * 100;
				if (scoreAcc > 100) scoreAcc = 100;

				quarterScore += scoreAcc * budget;
				quarterBudget += budget;

				formulaTrace.push({
					step: stepCounter++,
					label: `Nilai Penyerapan Triwulan ${q.quarter} Akun ${acc}`,
					formula: "Min(100, (realized / budget) * 100 / target * 100)",
					inputs: {
						budget: budgetStr,
						realized: realizedStr,
						target: targetStr,
					},
					result: round(scoreAcc, 4),
				});
			}
		}

		if (quarterBudget > 0) {
			const qScore = quarterScore / quarterBudget;
			totalAllQuartersScore += qScore;
			validQuartersCount++;

			formulaTrace.push({
				step: stepCounter++,
				label: `Nilai Akhir Triwulan ${q.quarter}`,
				formula: "Total (Nilai Akun * Pagu Akun) / Total Pagu Triwulan",
				inputs: {
					totalWeightedScore: round(quarterScore, 4),
					totalBudget: round(quarterBudget, 4),
				},
				result: round(qScore, 4),
			});
		}
	}

	let finalScoreStr = "0";
	if (validQuartersCount > 0) {
		finalScoreStr = round(totalAllQuartersScore / validQuartersCount, 2);
	}

	formulaTrace.push({
		step: stepCounter++,
		label: "Nilai Penyerapan Anggaran",
		formula: "Rata-rata Nilai Triwulanan",
		inputs: {
			totalScore: round(totalAllQuartersScore, 4),
			count: validQuartersCount.toString(),
		},
		result: finalScoreStr,
	});

	if (
		config.assumptionWarnings.includes(
			"ABS-006: Batas nilai maksimal cap 100 belum diverifikasi eksplisit.",
		)
	) {
		warnings.push(
			"ABS-006: Batas nilai maksimal cap 100 belum diverifikasi eksplisit.",
		);
	}

	return {
		key: "budget_absorption",
		label: "Penyerapan Anggaran",
		weight: config.weights.budget_absorption,
		score: finalScoreStr,
		weightedContribution: round(
			mul(finalScoreStr, div(config.weights.budget_absorption, "100")),
		),
		status: "complete",
		formulaTrace,
		warnings,
	};
}
