import type { RuleSetConfig } from "../rule-set";
import type {
	FormulaStep,
	IndicatorCalculation,
	OutputAchievementInput,
	OutputReport,
	SubComponent,
} from "../types";
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
			warnings: ["Tidak ada data laporan Capaian Output."],
		};
	}

	// Filter by evaluation period if specified
	const reportsToEvaluate: OutputReport[] =
		input.evalPeriod !== undefined
			? input.reports.filter((r) => r.period === input.evalPeriod)
			: input.reports;

	if (reportsToEvaluate.length === 0) {
		return {
			key,
			label: "Capaian Output",
			weight,
			score: null,
			weightedContribution: null,
			status: "incomplete",
			formulaTrace: [],
			warnings: [
				`Tidak ada data laporan Capaian Output untuk periode bulan ${input.evalPeriod}.`,
			],
		};
	}

	let timelinessTotal = "0";
	let achievementTotal = "0";
	let validTimelinessCount = 0;
	let includedRoCount = 0;
	let excludedRoCount = 0;
	let hasPendingTimeliness = false;

	let step = 1;

	// Process each report for the evaluation period
	for (const report of reportsToEvaluate) {
		const roLabel = report.roCode || `RO-${report.id}`;

		// 1. Fairness treatment evaluation (§3 & §7)
		if (report.isExcluded) {
			excludedRoCount++;
			formulaTrace.push({
				step: step++,
				label: `Pengecualian Fairness (RO: ${roLabel})`,
				formula: "Dikecualikan dari objek penilaian",
				inputs: {
					roCode: roLabel,
					reason: report.exclusionReason || "RO Khusus",
					reference: report.policyReference || "Fairness Treatment 2026",
				},
				result: "Dikecualikan (tidak dihitung)",
			});
			continue;
		}

		includedRoCount++;

		// 2. Ketepatan Waktu Pelaporan (NKKW)
		let timelinessScore: string | null = null;
		if (report.reportedDate) {
			const isTimely = report.reportedDate <= report.deadlineDate;
			timelinessScore = isTimely ? "100" : "0";
			timelinessTotal = DecimalCalc.add(timelinessTotal, timelinessScore);
			validTimelinessCount++;

			formulaTrace.push({
				step: step++,
				label: `Ketepatan Waktu Pelaporan (RO: ${roLabel}, Periode ${report.period})`,
				formula: "reportedDate <= deadlineDate ? 100 : 0",
				inputs: {
					roCode: roLabel,
					reportedDate: report.reportedDate,
					deadlineDate: report.deadlineDate,
				},
				result: timelinessScore,
			});
		} else {
			hasPendingTimeliness = true;
			formulaTrace.push({
				step: step++,
				label: `Ketepatan Waktu Pelaporan (RO: ${roLabel}, Periode ${report.period})`,
				formula: "Belum dilaporkan (reportedDate kosong)",
				inputs: {
					roCode: roLabel,
					deadlineDate: report.deadlineDate,
				},
				result: "Belum dilaporkan",
			});
		}

		// 3. Capaian RO (NKCRO)
		// Map inputs (supporting both new rich fields and legacy fields)
		const pcroStr =
			report.pcro !== undefined ? report.pcro : (report.realized ?? "0");
		const tpcroStr =
			report.tpcro !== undefined ? report.tpcro : (report.target ?? "0");
		const rvroStr =
			report.rvro !== undefined ? report.rvro : (report.realized ?? "0");
		const volumeDipaStr =
			report.volumeDipa !== undefined
				? report.volumeDipa
				: (report.target ?? "0");
		const isConfirmed = report.confirmed ?? false;

		let achievementScore = "0";
		let formulaUsed = "";

		if (!isConfirmed) {
			// Scope gate konfirmasi (§2.5 & §2.3)
			achievementScore = "0.00";
			formulaUsed = "ZERO_UNCONFIRMED: Laporan belum dikonfirmasi -> 0";
		} else if (DecimalCalc.eq(pcroStr, "0")) {
			// Aturan khusus PCRO = 0% (§2.3)
			achievementScore = "0.00";
			formulaUsed = "ZERO_PCRO: PCRO 0% -> 0";
		} else if (report.period === 12 || DecimalCalc.gte(pcroStr, "100")) {
			// Formula 2 — periode Desember atau PCRO 100% (§2.3)
			if (DecimalCalc.lte(volumeDipaStr, "0")) {
				warnings.push(
					`VOLUME_DIPA_MUST_BE_GT_ZERO: Volume DIPA harus > 0 untuk RO ${roLabel}.`,
				);
				achievementScore = "0.00";
				formulaUsed = "F2_RVRO_VOLUME: Target Volume DIPA nol/invalid -> 0";
			} else {
				const ratio = DecimalCalc.mul(
					DecimalCalc.div(rvroStr, volumeDipaStr),
					"100",
				);
				const cappedRatio = DecimalCalc.gt(ratio, "100")
					? "100"
					: DecimalCalc.roundHalfUp(ratio, 4);
				achievementScore = DecimalCalc.roundHalfUp(cappedRatio, 2);
				formulaUsed = "Formula 2: min((RVRO / Volume DIPA) * 100, 100)";
			}
		} else {
			// Formula 1 — periode Januari–November saat PCRO belum 100% (§2.3)
			if (DecimalCalc.lte(tpcroStr, "0")) {
				warnings.push(
					`TPCRO_MUST_BE_GT_ZERO_WHEN_PCRO_GT_ZERO: Target TPCRO harus > 0 untuk RO ${roLabel}.`,
				);
				achievementScore = "0.00";
				formulaUsed = "F1_PCRO_TPCRO: TPCRO nol/invalid -> 0";
			} else {
				const ratio = DecimalCalc.mul(
					DecimalCalc.div(pcroStr, tpcroStr),
					"100",
				);
				const cappedRatio = DecimalCalc.gt(ratio, "100")
					? "100"
					: DecimalCalc.roundHalfUp(ratio, 4);
				achievementScore = DecimalCalc.roundHalfUp(cappedRatio, 2);
				formulaUsed = "Formula 1: min((PCRO / TPCRO) * 100, 100)";
			}
		}

		achievementTotal = DecimalCalc.add(achievementTotal, achievementScore);

		formulaTrace.push({
			step: step++,
			label: `Nilai Capaian RO (RO: ${roLabel})`,
			formula: formulaUsed,
			inputs: {
				roCode: roLabel,
				pcro: `${pcroStr}%`,
				tpcro: `${tpcroStr}%`,
				rvro: rvroStr,
				volumeDipa: volumeDipaStr,
				confirmed: isConfirmed ? "Terkonfirmasi" : "Belum Konfirmasi",
			},
			result: achievementScore,
		});
	}

	// If all reports were excluded by fairness treatment
	if (includedRoCount === 0) {
		return {
			key,
			label: "Capaian Output",
			weight,
			score: null,
			weightedContribution: null,
			status: "incomplete",
			formulaTrace,
			warnings: [
				`Seluruh (${excludedRoCount}) RO pada periode ini dikecualikan dari objek penilaian.`,
			],
		};
	}

	// Calculate Averages
	let avgTimeliness = "0.00";
	if (validTimelinessCount > 0) {
		avgTimeliness = DecimalCalc.roundHalfUp(
			DecimalCalc.div(timelinessTotal, validTimelinessCount.toString()),
			2,
		);
		formulaTrace.push({
			step: step++,
			label: "Nilai Kinerja Komponen Ketepatan Waktu (NK-ROKW)",
			formula: "Total Nilai Ketepatan Waktu / Jumlah RO Dinilai",
			inputs: {
				total: timelinessTotal,
				count: validTimelinessCount.toString(),
			},
			result: avgTimeliness,
		});
	} else {
		formulaTrace.push({
			step: step++,
			label: "Nilai Kinerja Komponen Ketepatan Waktu (NK-ROKW)",
			formula: "Belum ada laporan yang disampaikan",
			inputs: {
				count: includedRoCount.toString(),
			},
			result: "0.00",
		});
	}

	const avgAchievement = DecimalCalc.roundHalfUp(
		DecimalCalc.div(achievementTotal, includedRoCount.toString()),
		2,
	);
	formulaTrace.push({
		step: step++,
		label: "Nilai Kinerja Komponen Capaian RO (NK-CRO)",
		formula: "Total Nilai Capaian RO / Jumlah RO Dinilai",
		inputs: {
			total: achievementTotal,
			count: includedRoCount.toString(),
		},
		result: avgAchievement,
	});

	// Final Score IKPA-CO = (NK-ROKW * 30%) + (NK-CRO * 70%)
	const timelinessWeightStr = "0.30";
	const achievementWeightStr = "0.70";

	const timelinessComponent = DecimalCalc.roundHalfUp(
		DecimalCalc.mul(avgTimeliness, timelinessWeightStr),
		2,
	);
	const achievementComponent = DecimalCalc.roundHalfUp(
		DecimalCalc.mul(avgAchievement, achievementWeightStr),
		2,
	);
	const rawScore = DecimalCalc.add(timelinessComponent, achievementComponent);
	const score = DecimalCalc.roundHalfUp(
		rawScore,
		config.rounding.fractionDigits,
	);

	formulaTrace.push({
		step: step++,
		label: "Nilai Akhir Capaian Output (IKPA-CO)",
		formula: "(NK-ROKW × 30%) + (NK-CRO × 70%)",
		inputs: {
			nkkw: avgTimeliness,
			nkcro: avgAchievement,
			timelinessComponent,
			achievementComponent,
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
			label: "Ketepatan Waktu (NK-ROKW)",
			score: avgTimeliness,
			weight: "30",
			weightedContribution: timelinessComponent,
		},
		{
			key: "achievement",
			label: "Capaian RO (NK-CRO)",
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
		status: hasPendingTimeliness ? "warning" : "complete",
		formulaTrace,
		warnings,
		subComponents,
	};
}
