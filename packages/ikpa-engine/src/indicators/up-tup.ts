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

function getDaysInMonth(dateStr: string): number {
	const parts = dateStr.split("-");
	const year = parseInt(parts[0], 10);
	const month = parseInt(parts[1], 10);
	return new Date(year, month, 0).getDate();
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
	const revolvingTxs = transactions.filter(
		(tx) =>
			tx.type === "GUP" ||
			tx.type === "GUP_NIHIL" ||
			tx.type === "PTUP",
	);

	let scoreKetepatan = 100;
	if (revolvingTxs.length > 0) {
		let onTimeCount = 0;
		for (const tx of revolvingTxs) {
			if (tx.isSettled && tx.settlementDate) {
				const days = countDays(tx.date, tx.settlementDate);
				if (days <= 31 || getMonth(tx.date) === getMonth(tx.settlementDate)) {
					onTimeCount++;
				}
			}
		}
		scoreKetepatan = (onTimeCount / revolvingTxs.length) * 100;
	} else if (transactions.length > 0) {
		// Fallback for datasets where types are UP/TUP
		let onTimeCount = 0;
		for (const tx of transactions) {
			if (tx.isSettled && tx.settlementDate) {
				const days = countDays(tx.date, tx.settlementDate);
				if (days <= 31 || getMonth(tx.date) === getMonth(tx.settlementDate)) {
					onTimeCount++;
				}
			}
		}
		scoreKetepatan = (onTimeCount / transactions.length) * 100;
	}

	// 2. GUP Disebulankan (25%)
	const gupTxs = transactions.filter(
		(tx) => tx.type === "GUP" && parseFloat(tx.amount) > 0,
	);
	let scoreGupSebulan = 100;
	if (gupTxs.length > 0) {
		const upTx = transactions.find((tx) => tx.type === "UP");
		const upBasis =
			upTx && parseFloat(upTx.amount) > 0 ? parseFloat(upTx.amount) : 0;

		let totalGupScore = 0;
		for (const tx of gupTxs) {
			const amountGup = parseFloat(tx.amount);
			const baseUp = upBasis > 0 ? upBasis : amountGup;
			const ratio = (amountGup / baseUp) * 100;
			const intervalDays = tx.settlementDate
				? Math.max(countDays(tx.date, tx.settlementDate), 1)
				: 30;
			const daysInMonth = getDaysInMonth(tx.date);
			const monthlyFactor = daysInMonth / intervalDays;
			const normalizedGup = ratio * monthlyFactor;
			totalGupScore += Math.min(Math.max(normalizedGup, 0), 100);
		}
		scoreGupSebulan = totalGupScore / gupTxs.length;
	} else {
		// Fallback for legacy 2-type datasets where UP has settlementDate
		const upLegacy = transactions.filter((tx) => tx.type === "UP");
		if (
			upLegacy.length > 0 &&
			upLegacy.some(
				(tx) =>
					tx.settlementDate && countDays(tx.date, tx.settlementDate) > 31,
			)
		) {
			let onTimeGupSebulan = 0;
			for (const tx of upLegacy) {
				if (tx.isSettled && tx.settlementDate) {
					const days = countDays(tx.date, tx.settlementDate);
					if (
						getMonth(tx.date) === getMonth(tx.settlementDate) ||
						days <= 31
					) {
						onTimeGupSebulan++;
					}
				}
			}
			scoreGupSebulan = (onTimeGupSebulan / upLegacy.length) * 100;
		} else {
			scoreGupSebulan = 100;
		}
	}

	// 3. Setoran TUP (25%)
	// Formula: 100 - (% Setoran TUP terhadap Total TUP)
	const tupTxs = transactions.filter((tx) => tx.type === "TUP");
	const setoranTupTxs = transactions.filter((tx) => tx.type === "SETORAN_TUP");

	const totalTupAmount = tupTxs.reduce(
		(sum, tx) => sum + (parseFloat(tx.amount) || 0),
		0,
	);
	const totalSetoranTupAmount = setoranTupTxs.reduce(
		(sum, tx) => sum + (parseFloat(tx.amount) || 0),
		0,
	);

	let scoreTup = 100;
	if (totalTupAmount > 0) {
		const pctSetoran = (totalSetoranTupAmount / totalTupAmount) * 100;
		scoreTup = Math.max(0, Math.min(100, 100 - pctSetoran));
	} else if (setoranTupTxs.length > 0) {
		// Setoran exists without registered TUP (anomaly)
		scoreTup = 0;
	} else {
		scoreTup = 100;
	}

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
			totalTUP: totalTupAmount.toFixed(2),
			totalSetoranTUP: totalSetoranTupAmount.toFixed(2),
		},
		result: tunaiScore.toFixed(config.rounding.fractionDigits),
	});

	// KKP Score & Status Evaluasi
	// Secara default satker tidak memiliki UP KKP (hasKkp = false), sehingga maksimal hanya mendapat 90% nilai dari Tunai.
	// Jika status KKP diaktifkan atau satker memiliki transaksi KKP, KKP dievaluasi terhadap target triwulanan (peluang nilai 100).
	const hasKkp = input.hasKkp ?? (input.kkpTransactions.length > 0);
	let kkpScore = 0;

	if (hasKkp) {
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
				statusKKP: "Aktif",
				jumlahTriwulanDievaluasi: kkpQuarterScores.length.toString(),
			},
			result: kkpScore.toFixed(config.rounding.fractionDigits),
		});
	} else {
		formulaTrace.push({
			step: 2,
			label: "Komponen KKP (Tanpa UP KKP)",
			formula: "Satker tidak memiliki UP KKP (Maksimal nilai indikator: 90,00)",
			inputs: {
				statusKKP: "Tidak Memiliki UP KKP",
			},
			result: "0.00",
		});
		warnings.push(
			"Satker terkonfigurasi tidak memiliki UP KKP. Maksimal nilai capaian indikator UP/TUP adalah 90,00 (hanya 90% komponen Tunai).",
		);
	}

	// Total UP/TUP Score = 90% Tunai + (hasKkp ? 10% KKP : 0)
	const finalRawScore = tunaiScore * 0.9 + (hasKkp ? kkpScore * 0.1 : 0);
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
		label: hasKkp ? "Nilai Akhir UP/TUP" : "Nilai Akhir UP/TUP (Tanpa KKP)",
		formula: hasKkp ? "(Tunai * 0.9) + (KKP * 0.1)" : "(Tunai * 0.9) + 0",
		inputs: {
			Tunai: tunaiScore.toFixed(2),
			KKP: hasKkp ? kkpScore.toFixed(2) : "0.00",
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
				key: "timeliness",
				label: "Ketepatan Waktu GUP/PTUP",
				score: scoreKetepatan.toFixed(config.rounding.fractionDigits),
				weight: "50",
				weightedContribution: (scoreKetepatan * 0.5).toFixed(
					config.rounding.fractionDigits,
				),
			},
			{
				key: "monthlyGup",
				label: "%GUP Disebulankan",
				score: scoreGupSebulan.toFixed(config.rounding.fractionDigits),
				weight: "25",
				weightedContribution: (scoreGupSebulan * 0.25).toFixed(
					config.rounding.fractionDigits,
				),
			},
			{
				key: "tupDeposit",
				label: "Kinerja Setoran TUP",
				score: scoreTup.toFixed(config.rounding.fractionDigits),
				weight: "25",
				weightedContribution: (scoreTup * 0.25).toFixed(
					config.rounding.fractionDigits,
				),
			},
			{
				key: "kkp",
				label: hasKkp
					? "Kartu Kredit Pemerintah"
					: "Kartu Kredit Pemerintah (Tanpa KKP)",
				score: hasKkp ? kkpScore.toFixed(config.rounding.fractionDigits) : "0.00",
				weight: "10",
				weightedContribution: (hasKkp ? kkpScore * 0.1 : 0).toFixed(
					config.rounding.fractionDigits,
				),
			},
		],
	};
}
