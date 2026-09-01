import type {
	IndicatorCalculation,
	OutputAchievementInput,
	FormulaStep,
	SubComponent,
} from "../types";
import type { RuleSetConfig } from "../rule-set";
import { DecimalCalc } from "../utils/decimal";

export function calculateOutputAchievement(
	input: OutputAchievementInput,
	config: RuleSetConfig,
): IndicatorCalculation {
	const key = "output_achievement";
	const weight = config.weights[key] || "25";
	const warnings: string[] = [];
	const formulaTrace: FormulaStep[] = [];

	if (!input.reports || input.reports.length === 0) {
		return {
			key,
			label: "Capaian Output",
			weight,
			score: null,
			weightedContribution: null,
			status: "incomplete",
			formulaTrace: [],
			warnings: ["No output reports found"],
		};
	}

	let timelinessTotal = "0";
	let achievementTotal = "0";
	let validTimelinessCount = 0;
	let validAchievementCount = 0;

	let step = 1;

	// Process each report
	for (const report of input.reports) {
		// 1. Timeliness
		// On-time if reportedDate <= deadlineDate
		let isTimely = false;
		if (report.reportedDate <= report.deadlineDate) {
			isTimely = true;
		}
		const timelinessScore = isTimely ? "100" : "0";
		timelinessTotal = DecimalCalc.add(timelinessTotal, timelinessScore);
		validTimelinessCount++;

		formulaTrace.push({
			step: step++,
			label: `Ketepatan Waktu Periode ${report.period}`,
			formula: "reportedDate <= deadlineDate ? 100 : 0",
			inputs: {
				reportedDate: report.reportedDate,
				deadlineDate: report.deadlineDate,
			},
			result: timelinessScore,
		});

		// 2. Achievement
		let achievementScore = "0";
		if (report.period === 12) {
			// December special
			achievementScore = "100";
			warnings.push(
				config.assumptionWarnings.find((w: string) => w.includes("OUT-004")) ||
					"OUT-004: Formula Desember menggunakan asumsi PCRO 100%.",
			);

			formulaTrace.push({
				step: step++,
				label: `Capaian Output Periode ${report.period} (Desember)`,
				formula: "Asumsi PCRO = 100%",
				inputs: {},
				result: "100",
			});
			achievementTotal = DecimalCalc.add(achievementTotal, achievementScore);
			validAchievementCount++;
		} else {
			if (DecimalCalc.eq(report.target, "0")) {
				warnings.push(
					`Target nol untuk periode ${report.period}, periode dilewati untuk perhitungan capaian.`,
				);
			} else {
				// realized / target * 100
				const ratio = DecimalCalc.mul(
					DecimalCalc.div(report.realized, report.target),
					"100",
				);
				// cap at 100
				achievementScore = DecimalCalc.gt(ratio, "100")
					? "100"
					: DecimalCalc.roundHalfUp(ratio, 4);
				achievementScore = DecimalCalc.roundHalfUp(achievementScore, 2); // Rounding half up based on general
				achievementTotal = DecimalCalc.add(achievementTotal, achievementScore);
				validAchievementCount++;

				formulaTrace.push({
					step: step++,
					label: `Capaian Output Periode ${report.period}`,
					formula: "min((realized / target) * 100, 100)",
					inputs: {
						realized: report.realized.toString(),
						target: report.target.toString(),
					},
					result: achievementScore,
				});
			}
		}
	}

	let avgTimeliness = "0";
	if (validTimelinessCount > 0) {
		avgTimeliness = DecimalCalc.roundHalfUp(
			DecimalCalc.div(timelinessTotal, validTimelinessCount.toString()),
			config.rounding.fractionDigits,
		);
		formulaTrace.push({
			step: step++,
			label: "Rata-rata Ketepatan Waktu",
			formula: "Total Timeliness / Jumlah Periode",
			inputs: {
				total: timelinessTotal,
				count: validTimelinessCount.toString(),
			},
			result: avgTimeliness,
		});
	}

	let avgAchievement = "0";
	if (validAchievementCount > 0) {
		avgAchievement = DecimalCalc.roundHalfUp(
			DecimalCalc.div(achievementTotal, validAchievementCount.toString()),
			config.rounding.fractionDigits,
		);
		formulaTrace.push({
			step: step++,
			label: "Rata-rata Capaian (PCRO/TPCRO)",
			formula: "Total Achievement / Jumlah Periode Valid",
			inputs: {
				total: achievementTotal,
				count: validAchievementCount.toString(),
			},
			result: avgAchievement,
		});
	}

	// Final Score = 30% * Timeliness + 70% * Achievement
	const timelinessWeightStr = "0.30";
	const achievementWeightStr = "0.70";

	const timelinessComponent = DecimalCalc.mul(
		avgTimeliness,
		timelinessWeightStr,
	);
	const achievementComponent = DecimalCalc.mul(
		avgAchievement,
		achievementWeightStr,
	);
	let score = DecimalCalc.add(timelinessComponent, achievementComponent);
	score = DecimalCalc.roundHalfUp(score, config.rounding.fractionDigits);

	formulaTrace.push({
		step: step++,
		label: "Nilai Akhir Capaian Output",
		formula: "(30% * Rata-rata Ketepatan Waktu) + (70% * Rata-rata Capaian)",
		inputs: {
			avgTimeliness,
			avgAchievement,
		},
		result: score,
	});

	const weightedContribution = DecimalCalc.roundHalfUp(
		DecimalCalc.mul(DecimalCalc.div(score, "100"), weight),
		config.rounding.fractionDigits,
	);

	const subComponents: SubComponent[] = [
		{
			key: "timeliness",
			label: "Ketepatan Waktu",
			score: avgTimeliness,
			weight: "30",
			weightedContribution: timelinessComponent,
		},
		{
			key: "achievement",
			label: "Capaian (PCRO)",
			score: avgAchievement,
			weight: "70",
			weightedContribution: achievementComponent,
		},
	];

	return {
		key,
		label: "Capaian Output",
		weight,
		score,
		weightedContribution,
		status: warnings.length > 0 ? "warning" : "complete",
		formulaTrace,
		warnings,
		subComponents,
	};
}
