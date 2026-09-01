import type {
	ContractualInput,
	IndicatorCalculation,
	FormulaStep,
	SubComponent,
} from "../types";
import type { RuleSetConfig } from "../rule-set";
import { mul, div, round, parseDecimal } from "../utils";

export function calculateContractual(
	input: ContractualInput,
	config: RuleSetConfig,
): IndicatorCalculation {
	const formulaTrace: FormulaStep[] = [];
	const warnings: string[] = [];
	let stepCounter = 1;

	// Components
	let distributionScore = "0";
	let earlyProcurementScore = "0";
	let acceleration53Score = "0";

	// 1. Distribution & Early Procurement
	const eligibleContracts = input.contracts.filter(
		(c) => parseDecimal(c.amount) >= 50000000,
	);

	if (eligibleContracts.length === 0) {
		distributionScore = "100";
		earlyProcurementScore = "100";
		warnings.push("Tidak ada kontrak yang memenuhi syarat minimal Rp50 juta.");
	} else {
		// Distribution (s.d. TW II)
		let totalAmount = 0;
		let amountQ2 = 0;

		// Early Procurement
		let totalEarlyScore = 0;

		for (const c of eligibleContracts) {
			const amount = parseDecimal(c.amount);
			totalAmount += amount;

			// Q2 Distribution check (month <= 5, i.e., June)
			const signedMonth = new Date(c.signedDate).getMonth();
			if (signedMonth <= 5) {
				amountQ2 += amount;
			}

			// Early Procurement check
			let cScore = 0;
			if (c.isEarlyProcurement) {
				cScore = 120;
			} else if (signedMonth <= 2) {
				// Jan-Mar
				cScore = 110;
			}
			totalEarlyScore += cScore * amount;
		}

		// Calculate Distribution Bucket
		const distributionRatio = (amountQ2 / totalAmount) * 100;
		let dScore = 0;
		for (const bucket of config.contractualDistributionBuckets) {
			if (
				distributionRatio >= parseDecimal(bucket.min) &&
				distributionRatio <= parseDecimal(bucket.max)
			) {
				dScore = parseDecimal(bucket.score);
				break;
			}
		}
		if (distributionRatio > 100) dScore = 100; // safety
		distributionScore = dScore.toString();

		formulaTrace.push({
			step: stepCounter++,
			label: "Nilai Distribusi Kontrak",
			formula: "Bucket berdasar (Nilai Kontrak TW II / Total Nilai) * 100",
			inputs: { ratio: round(distributionRatio, 4) },
			result: distributionScore,
		});

		// Calculate Early Procurement
		const earlyAvg = totalEarlyScore / totalAmount;
		earlyProcurementScore = round(earlyAvg, 4);

		formulaTrace.push({
			step: stepCounter++,
			label: "Nilai Kontrak Dini",
			formula: "Rata-rata tertimbang nilai kontrak Pra-DIPA(120) & TW I(110)",
			inputs: {
				totalWeighted: round(totalEarlyScore, 4),
				totalAmount: round(totalAmount, 4),
			},
			result: earlyProcurementScore,
		});
	}

	// 2. Acceleration 53
	const eligible53 = input.accelerations53.filter((c) => {
		const amt = parseDecimal(c.amount);
		return amt >= 50000000 && amt <= 200000000;
	});

	if (eligible53.length === 0) {
		acceleration53Score = "100";
		warnings.push("Tidak ada kontrak 53 yang memenuhi syarat Rp50-200 juta.");
	} else {
		let total53 = 0;
		let completed53 = 0;

		for (const c of eligible53) {
			const amount = parseDecimal(c.amount);
			total53 += amount;
			const signedMonth = new Date(c.signedDate).getMonth();
			if (signedMonth <= 2) {
				// Completed by Mar 31
				completed53 += amount;
			}
		}

		acceleration53Score = round((completed53 / total53) * 100, 4);

		formulaTrace.push({
			step: stepCounter++,
			label: "Nilai Akselerasi 53",
			formula:
				"(Nilai Kontrak 53 Selesai TW I / Total Kontrak 53 Eligible) * 100",
			inputs: { completed: round(completed53, 4), total: round(total53, 4) },
			result: acceleration53Score,
		});
	}

	// Calculate Final Score
	const distWeight = parseDecimal(config.contractualWeights.distribution) / 100;
	const earlyWeight =
		parseDecimal(config.contractualWeights.earlyProcurement) / 100;
	const acc53Weight =
		parseDecimal(config.contractualWeights.acceleration53) / 100;

	const finalScoreNum =
		parseDecimal(distributionScore) * distWeight +
		parseDecimal(earlyProcurementScore) * earlyWeight +
		parseDecimal(acceleration53Score) * acc53Weight;

	const finalScore = round(finalScoreNum, 2);

	formulaTrace.push({
		step: stepCounter++,
		label: "Nilai Belanja Kontraktual",
		formula: "Distribusi*20% + KontrakDini*40% + Akselerasi53*40%",
		inputs: {
			distScore: distributionScore,
			earlyScore: earlyProcurementScore,
			accScore: acceleration53Score,
		},
		result: finalScore,
	});

	const subComponents: SubComponent[] = [
		{
			key: "distribution",
			label: "Distribusi Akselerasi",
			score: distributionScore,
			weight: config.contractualWeights.distribution,
			weightedContribution: round(
				parseDecimal(distributionScore) * distWeight,
				2,
			),
		},
		{
			key: "early_procurement",
			label: "Kontrak Dini",
			score: earlyProcurementScore,
			weight: config.contractualWeights.earlyProcurement,
			weightedContribution: round(
				parseDecimal(earlyProcurementScore) * earlyWeight,
				2,
			),
		},
		{
			key: "acceleration_53",
			label: "Akselerasi Kontrak 53",
			score: acceleration53Score,
			weight: config.contractualWeights.acceleration53,
			weightedContribution: round(
				parseDecimal(acceleration53Score) * acc53Weight,
				2,
			),
		},
	];

	if (
		config.assumptionWarnings.includes(
			"KON-006: Agregasi final kontrak dini menggunakan rata-rata nilai kontrak eligible.",
		)
	) {
		warnings.push(
			"KON-006: Agregasi final kontrak dini menggunakan rata-rata nilai kontrak eligible.",
		);
	}

	return {
		key: "contractual",
		label: "Belanja Kontraktual",
		weight: config.weights.contractual,
		score: finalScore,
		weightedContribution: round(
			mul(finalScore, div(config.weights.contractual, "100")),
			2,
		),
		status: "complete",
		formulaTrace,
		warnings,
		subComponents,
	};
}
