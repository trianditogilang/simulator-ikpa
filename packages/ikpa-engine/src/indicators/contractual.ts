import type { RuleSetConfig } from "../rule-set";
import type {
	ContractualInput,
	FormulaStep,
	IndicatorCalculation,
	SubComponent,
} from "../types";
import { div, mul, parseDecimal, round } from "../utils";

export function parseIsoDate(
	dateStr?: string | null,
): { year: number; month: number; day: number } | null {
	if (!dateStr) return null;
	const match = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!match) return null;
	const year = parseInt(match[1], 10);
	const month = parseInt(match[2], 10);
	const day = parseInt(match[3], 10);
	if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
		return null;
	}
	return { year, month, day };
}

export function calculateContractual(
	input: ContractualInput,
	config: RuleSetConfig,
): IndicatorCalculation {
	const formulaTrace: FormulaStep[] = [];
	const warnings: string[] = [];
	let stepCounter = 1;

	const fy = input.fiscalYear ?? 2026;

	// Subcomponent scores (null if incomplete / no eligible data)
	let distributionScore: string | null = null;
	let earlyProcurementScore: string | null = null;
	let acceleration53Score: string | null = null;

	// 1. General Eligible Contracts (>= Rp50.000.000, all account types)
	const eligibleContracts = input.contracts.filter(
		(c) => parseDecimal(c.amount) >= 50000000,
	);

	// --- 1. DAK (Distribusi Akselerasi Kontrak - Bobot 20%) ---
	if (eligibleContracts.length === 0) {
		warnings.push("Belum ada kontrak ≥ Rp50 juta untuk penilaian distribusi.");
	} else {
		// Numerator: count of eligible contracts with signedDate <= 30 Juni (TW II)
		const eligibleQ2Contracts = eligibleContracts.filter((c) => {
			const p = parseIsoDate(c.signedDate);
			if (!p) return false;
			return p.year < fy || (p.year === fy && p.month <= 6);
		});

		const countQ2 = eligibleQ2Contracts.length;
		const totalEligible = eligibleContracts.length;
		const distributionRatio = (countQ2 / totalEligible) * 100;

		let dScore = 0;
		if (distributionRatio === 0) {
			dScore = 0;
		} else if (distributionRatio <= 25) {
			dScore = 50;
		} else if (distributionRatio <= 50) {
			dScore = 60;
		} else if (distributionRatio <= 75) {
			dScore = 80;
		} else {
			dScore = 100;
		}

		distributionScore = dScore.toString();

		formulaTrace.push({
			step: stepCounter++,
			label: "Nilai Distribusi Kontrak (DAK)",
			formula:
				"Bucket berdasar (Jumlah Kontrak Eligible s.d. 30 Juni / Total Kontrak Eligible TA) * 100",
			inputs: {
				countQ2: countQ2.toString(),
				totalEligible: totalEligible.toString(),
				ratio: round(distributionRatio, 2),
			},
			result: distributionScore,
		});
	}

	// --- 2. KD (Kontrak Pra-DIPA / Kontrak Dini - Bobot 40%) ---
	// Denominator: count of eligible contracts with signedDate <= 31 March (or Pra-DIPA)
	const kdEligibleList: { id: string; points: number; isPraDipa: boolean }[] =
		[];

	for (const c of eligibleContracts) {
		const p = parseIsoDate(c.signedDate);
		if (!p) continue;

		if (p.year < fy || c.isEarlyProcurement === true) {
			kdEligibleList.push({ id: c.id, points: 120, isPraDipa: true });
		} else if (p.year === fy && p.month <= 3) {
			kdEligibleList.push({ id: c.id, points: 110, isPraDipa: false });
		}
		// Contracts signed after 31 March (month > 3 in fiscal year) are excluded from KD denominator
	}

	if (kdEligibleList.length === 0) {
		warnings.push(
			"Belum ada kontrak eligible Pra-DIPA atau sampai 31 Maret.",
		);
	} else {
		const totalKdPoints = kdEligibleList.reduce(
			(sum, item) => sum + item.points,
			0,
		);
		const countKd = kdEligibleList.length;
		const kdAvg = totalKdPoints / countKd;
		earlyProcurementScore = round(kdAvg, 2);

		const praDipaCount = kdEligibleList.filter((k) => k.isPraDipa).length;
		const q1Count = kdEligibleList.filter((k) => !k.isPraDipa).length;

		formulaTrace.push({
			step: stepCounter++,
			label: "Nilai Kontrak Pra-DIPA / Dini (KD)",
			formula:
				"(Σ Poin Kontrak Pra-DIPA [120] + Σ Poin Kontrak s.d. 31 Mar [110]) / Jumlah Kontrak s.d. 31 Mar",
			inputs: {
				praDipaCount: praDipaCount.toString(),
				q1Count: q1Count.toString(),
				totalPoints: totalKdPoints.toString(),
				denominatorCount: countKd.toString(),
			},
			result: earlyProcurementScore,
		});
	}

	// --- 3. AK53 (Akselerasi Kontrak 53 - Bobot 40%) ---
	// Eligible AK53: accountCode === "53", amount between 50M and 200M inclusive, paymentType === "sekaligus", has sp2dDate
	const ak53SourceContracts =
		input.contracts.length > 0
			? input.contracts
			: (input.accelerations53 ?? []).map((a) => ({
					id: a.id,
					accountCode: a.accountCode ?? "53",
					amount: a.amount,
					signedDate: a.signedDate,
					paymentType: a.paymentType ?? "sekaligus",
					sp2dDate: a.sp2dDate ?? a.signedDate,
					isEarlyProcurement: false,
				}));

	const ak53CompletedList: { id: string; points: number; quarter: number }[] =
		[];

	for (const c of ak53SourceContracts) {
		const acc = c.accountCode ?? "53";
		if (acc !== "53") continue;

		const amt = parseDecimal(c.amount);
		if (amt < 50000000 || amt > 200000000) continue;

		const payType = c.paymentType ?? "sekaligus";
		if (payType !== "sekaligus") continue;

		// Evaluation based on SP2D date
		const sp2dRaw = c.sp2dDate ?? (c as { sp2dAt?: string | null }).sp2dAt;
		if (!sp2dRaw) {
			// Contract is not completed yet; excluded from evaluated AK53
			continue;
		}

		const sp2d = parseIsoDate(sp2dRaw);
		if (!sp2d) continue;

		let quarter = 4;
		let points = 70;

		if (sp2d.year < fy || (sp2d.year === fy && sp2d.month <= 3)) {
			quarter = 1;
			points = 100;
		} else if (sp2d.year === fy && sp2d.month <= 6) {
			quarter = 2;
			points = 90;
		} else if (sp2d.year === fy && sp2d.month <= 9) {
			quarter = 3;
			points = 80;
		} else {
			quarter = 4;
			points = 70;
		}

		ak53CompletedList.push({ id: c.id, points, quarter });
	}

	if (ak53CompletedList.length === 0) {
		warnings.push(
			"Belum ada kontrak belanja 53, Rp50–200 juta, sekaligus, dengan tanggal SP2D.",
		);
	} else {
		const totalAk53Points = ak53CompletedList.reduce(
			(sum, item) => sum + item.points,
			0,
		);
		const countAk53 = ak53CompletedList.length;
		const ak53Avg = totalAk53Points / countAk53;
		acceleration53Score = round(ak53Avg, 2);

		formulaTrace.push({
			step: stepCounter++,
			label: "Nilai Akselerasi Kontrak 53 (AK53)",
			formula:
				"Σ Poin Kontrak 53 Eligible Selesai SP2D (TW I:100, TW II:90, TW III:80, TW IV:70) / Jumlah Kontrak 53 Selesai",
			inputs: {
				totalPoints: totalAk53Points.toString(),
				completedCount: countAk53.toString(),
			},
			result: acceleration53Score,
		});
	}

	// --- 4. Final Aggregation (Bobot DAK 20%, KD 40%, AK53 40%) ---
	const distWeight = parseDecimal(config.contractualWeights.distribution) / 100;
	const earlyWeight =
		parseDecimal(config.contractualWeights.earlyProcurement) / 100;
	const acc53Weight =
		parseDecimal(config.contractualWeights.acceleration53) / 100;

	const allComponentsReady =
		distributionScore !== null &&
		earlyProcurementScore !== null &&
		acceleration53Score !== null;

	let finalScore: string | null = null;
	let weightedContribution: string | null = null;
	let status: "complete" | "warning" | "incomplete" = "complete";

	if (allComponentsReady) {
		const finalScoreNum =
			parseDecimal(distributionScore!) * distWeight +
			parseDecimal(earlyProcurementScore!) * earlyWeight +
			parseDecimal(acceleration53Score!) * acc53Weight;

		finalScore = round(finalScoreNum, 2);
		const rawContribution = parseDecimal(
			mul(finalScore, div(config.weights.contractual, "100")),
		);
		const maxContribution = parseDecimal(config.weights.contractual);
		const cappedContribution = Math.min(rawContribution, maxContribution);
		weightedContribution = round(cappedContribution, 2);
		status = "complete";

		formulaTrace.push({
			step: stepCounter++,
			label: "Nilai Akhir Belanja Kontraktual",
			formula: "(NK-DAK * 20%) + (NK-KD * 40%) + (NK-AK53 * 40%)",
			inputs: {
				distScore: distributionScore!,
				earlyScore: earlyProcurementScore!,
				accScore: acceleration53Score!,
			},
			result: finalScore,
		});

		formulaTrace.push({
			step: stepCounter++,
			label: "Kontribusi IKPA (Maksimal Bobot)",
			formula: "min(Nilai Akhir * (Bobot / 100), Bobot)",
			inputs: {
				nilaiAkhir: finalScore,
				bobot: config.weights.contractual,
				rawKontribusi: round(rawContribution, 2),
			},
			result: weightedContribution,
		});
	} else {
		status = "incomplete";
		finalScore = null;
		weightedContribution = null;
	}

	const subComponents: SubComponent[] = [
		{
			key: "distribution",
			label: "Distribusi Akselerasi Kontrak (DAK)",
			score: distributionScore,
			weight: config.contractualWeights.distribution,
			weightedContribution:
				distributionScore !== null
					? round(parseDecimal(distributionScore) * distWeight, 2)
					: null,
		},
		{
			key: "early_procurement",
			label: "Kontrak Pra-DIPA / Kontrak Dini (KD)",
			score: earlyProcurementScore,
			weight: config.contractualWeights.earlyProcurement,
			weightedContribution:
				earlyProcurementScore !== null
					? round(parseDecimal(earlyProcurementScore) * earlyWeight, 2)
					: null,
		},
		{
			key: "acceleration_53",
			label: "Akselerasi Kontrak 53 (AK53)",
			score: acceleration53Score,
			weight: config.contractualWeights.acceleration53,
			weightedContribution:
				acceleration53Score !== null
					? round(parseDecimal(acceleration53Score) * acc53Weight, 2)
					: null,
		},
	];

	return {
		key: "contractual",
		label: "Belanja Kontraktual",
		weight: config.weights.contractual,
		score: finalScore,
		weightedContribution,
		status,
		formulaTrace,
		warnings,
		subComponents,
	};
}
