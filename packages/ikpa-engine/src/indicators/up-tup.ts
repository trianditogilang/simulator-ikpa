import type { FiscalPeriod } from "@simulator-ikpa/contracts";
import type { RuleSetConfig } from "../rule-set";
import type { FormulaStep, IndicatorCalculation, UpTupInput } from "../types";

// Helper to count days between two ISO dates
function countDays(start: string, end: string): number {
	const startDate = new Date(`${start}T00:00:00Z`);
	const endDate = new Date(`${end}T00:00:00Z`);
	const diffTime = endDate.getTime() - startDate.getTime();
	return Math.floor(diffTime / (1000 * 3600 * 24));
}

function getMonth(dateStr: string): number {
	return parseInt(dateStr.split("-")[1], 10);
}

function getQuarter(dateStr: string): number {
	return Math.ceil(getMonth(dateStr) / 3);
}

function roundDec(val: number, fractionDigits: number, mode: string): number {
	const factor = 10 ** fractionDigits;
	if (mode === "half_up") return Math.round(val * factor) / factor;
	if (mode === "half_down") {
		const ceil = Math.ceil(val * factor);
		const floor = Math.floor(val * factor);
		return val * factor - floor > 0.5 ? ceil / factor : floor / factor;
	}
	if (mode === "down") return Math.floor(val * factor) / factor;
	if (mode === "up") return Math.ceil(val * factor) / factor;
	return Math.round(val * factor) / factor;
}

export function calculateUpTup(
	input: UpTupInput,
	period: FiscalPeriod,
	config: RuleSetConfig,
): IndicatorCalculation {
	const { transactions, kkpTransactions } = input;
	const formulaTrace: FormulaStep[] = [];
	const warnings: string[] = config.assumptionWarnings.filter((w) =>
		w.startsWith("UPT-"),
	);

	warnings.push(
		"UPT-007: Asumsi proporsi KKP dihitung dari total nominal transaksi UP/TUP & KKP.",
	);

	if (transactions.length === 0 && kkpTransactions.length === 0) {
		return {
			key: "up_tup",
			label: "Pengelolaan UP dan TUP",
			weight: config.weights.up_tup,
			score: null,
			weightedContribution: null,
			status: "incomplete",
			formulaTrace: [],
			warnings: [...warnings, "Tidak ada data transaksi UP/TUP atau KKP."],
		};
	}

	// 1. Ketepatan Waktu GUP/PTUP (50%)
	let onTimeGupPtup = 0;
	for (const tx of transactions) {
		if (tx.isSettled && tx.settlementDate) {
			const days = countDays(tx.date, tx.settlementDate);
			if (days <= 30) {
				onTimeGupPtup++;
			}
		}
	}
	const scoreKetepatan =
		transactions.length > 0 ? (onTimeGupPtup / transactions.length) * 100 : 100;

	// 2. GUP Disebulankan (25%)
	const upTransactions = transactions.filter((tx) => tx.type === "UP");
	let onTimeGupSebulan = 0;
	for (const tx of upTransactions) {
		if (tx.isSettled && tx.settlementDate) {
			if (getMonth(tx.date) === getMonth(tx.settlementDate)) {
				onTimeGupSebulan++;
			}
		}
	}
	const scoreGupSebulan =
		upTransactions.length > 0
			? (onTimeGupSebulan / upTransactions.length) * 100
			: 100;

	// 3. Setoran TUP (25%)
	const tupTransactions = transactions.filter((tx) => tx.type === "TUP");
	let onTimeTup = 0;
	for (const tx of tupTransactions) {
		if (tx.isSettled && tx.settlementDate) {
			const days = countDays(tx.date, tx.settlementDate);
			if (days <= 30) {
				onTimeTup++;
			}
		}
	}
	const scoreTup =
		tupTransactions.length > 0
			? (onTimeTup / tupTransactions.length) * 100
			: 100;

	const tunaiScore =
		scoreKetepatan * 0.5 + scoreGupSebulan * 0.25 + scoreTup * 0.25;

	formulaTrace.push({
		step: 1,
		label: "Komponen UP/TUP Tunai",
		formula: "(Ketepatan * 0.5) + (GUP_Sebulan * 0.25) + (Setoran_TUP * 0.25)",
		inputs: {
			Ketepatan: scoreKetepatan.toFixed(2),
			GUP_Sebulan: scoreGupSebulan.toFixed(2),
			Setoran_TUP: scoreTup.toFixed(2),
		},
		result: tunaiScore.toFixed(config.rounding.fractionDigits),
	});

	// KKP Score
	// We calculate quarterly targets.
	// Group amounts cumulatively to check targets.
	let kkpScore = 100;

	// Determine which quarters to evaluate based on period
	let maxQuarterToEvaluate = 1;
	if (period.kind === "quarter") maxQuarterToEvaluate = period.value;
	else if (period.kind === "month")
		maxQuarterToEvaluate = Math.ceil(period.value / 3);
	else if (period.kind === "semester") maxQuarterToEvaluate = period.value * 2;
	else if (period.kind === "year") maxQuarterToEvaluate = 4;

	const kkpQuarterScores: number[] = [];
	for (let q = 1; q <= maxQuarterToEvaluate; q++) {
		let totalKkpAmount = 0;
		let totalTunaiAmount = 0;

		for (const tx of kkpTransactions) {
			if (getQuarter(tx.date) <= q) {
				totalKkpAmount += parseFloat(tx.amount);
			}
		}
		for (const tx of transactions) {
			if (getQuarter(tx.date) <= q) {
				totalTunaiAmount += parseFloat(tx.amount);
			}
		}

		const totalAmount = totalKkpAmount + totalTunaiAmount;
		const kkpPercentage =
			totalAmount > 0 ? (totalKkpAmount / totalAmount) * 100 : 0;

		const targetStr = config.kkpTargets[q.toString()] || "0";
		const target = parseFloat(targetStr);

		if (kkpPercentage >= target && totalAmount > 0) {
			kkpQuarterScores.push(110);
		} else {
			kkpQuarterScores.push(100);
		}
	}

	if (kkpQuarterScores.length > 0) {
		kkpScore =
			kkpQuarterScores.reduce((a, b) => a + b, 0) / kkpQuarterScores.length;
	}

	formulaTrace.push({
		step: 2,
		label: "Komponen KKP",
		formula: "Rata-rata capaian triwulanan KKP",
		inputs: {
			jumlahTriwulanDievaluasi: kkpQuarterScores.length.toString(),
		},
		result: kkpScore.toFixed(config.rounding.fractionDigits),
	});

	// Total UP/TUP Score = 90% Tunai + 10% KKP
	const finalRawScore = tunaiScore * 0.9 + kkpScore * 0.1;
	const finalScore = roundDec(
		finalRawScore,
		config.rounding.fractionDigits,
		config.rounding.mode,
	);

	const finalScoreStr = finalScore.toFixed(config.rounding.fractionDigits);

	const weightNum = parseFloat(config.weights.up_tup);
	const rawContrib = (finalScore * weightNum) / 100;
	const roundedContrib = roundDec(
		rawContrib,
		config.rounding.fractionDigits,
		config.rounding.mode,
	);
	const contribStr = roundedContrib.toFixed(config.rounding.fractionDigits);

	formulaTrace.push({
		step: 3,
		label: "Nilai Akhir UP/TUP",
		formula: "(Tunai * 0.9) + (KKP * 0.1)",
		inputs: {
			Tunai: tunaiScore.toFixed(2),
			KKP: kkpScore.toFixed(2),
		},
		result: finalScoreStr,
	});

	formulaTrace.push({
		step: 4,
		label: "Nilai Tertimbang",
		formula: "(score * weight) / 100",
		inputs: {
			score: finalScoreStr,
			weight: config.weights.up_tup,
		},
		result: contribStr,
	});

	return {
		key: "up_tup",
		label: "Pengelolaan UP dan TUP",
		weight: config.weights.up_tup,
		score: finalScoreStr,
		weightedContribution: contribStr,
		status: "complete",
		formulaTrace,
		warnings,
		subComponents: [
			{
				key: "tunai",
				label: "UP/TUP Tunai",
				score: tunaiScore.toFixed(config.rounding.fractionDigits),
				weight: "90",
				weightedContribution: (tunaiScore * 0.9).toFixed(
					config.rounding.fractionDigits,
				),
			},
			{
				key: "kkp",
				label: "Kartu Kredit Pemerintah",
				score: kkpScore.toFixed(config.rounding.fractionDigits),
				weight: "10",
				weightedContribution: (kkpScore * 0.1).toFixed(
					config.rounding.fractionDigits,
				),
			},
		],
	};
}
