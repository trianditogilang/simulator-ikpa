import type {
	DipaRevisionInput,
	IndicatorCalculation,
	FormulaStep,
} from "../types";
import type { RuleSetConfig } from "../rule-set";
function getScore(
	revisions: number,
	buckets: RuleSetConfig["dipaRevisionBuckets"],
): number {
	for (const bucket of buckets) {
		if (
			revisions >= parseFloat(bucket.min) &&
			revisions <= parseFloat(bucket.max)
		) {
			return parseFloat(bucket.score);
		}
	}
	return 0;
}

export function calculateDipaRevision(
	input: DipaRevisionInput,
	config: RuleSetConfig,
): IndicatorCalculation {
	const steps: FormulaStep[] = [];
	const warnings: string[] = [];
	let stepCount = 1;

	if (config.assumptionWarnings) {
		for (const warning of config.assumptionWarnings) {
			if (warning.startsWith("REV-")) {
				warnings.push(warning);
			}
		}
	}

	if (
		input.semester1Revisions === undefined ||
		input.semester2Revisions === undefined
	) {
		return {
			key: "dipa_revision",
			label: "Revisi DIPA",
			weight: config.weights.dipa_revision,
			score: null,
			weightedContribution: null,
			status: "incomplete",
			formulaTrace: steps,
			warnings,
		};
	}

	const scoreS1 = getScore(
		input.semester1Revisions,
		config.dipaRevisionBuckets,
	);
	steps.push({
		step: stepCount++,
		label: "Nilai Revisi Semester 1",
		formula: "Match bucket untuk jumlah revisi",
		inputs: { revisi_s1: input.semester1Revisions.toString() },
		result: scoreS1.toString(),
	});

	const scoreS2 = getScore(
		input.semester2Revisions,
		config.dipaRevisionBuckets,
	);
	steps.push({
		step: stepCount++,
		label: "Nilai Revisi Semester 2",
		formula: "Match bucket untuk jumlah revisi",
		inputs: { revisi_s2: input.semester2Revisions.toString() },
		result: scoreS2.toString(),
	});

	const annualScore = (scoreS1 + scoreS2) / 2;
	steps.push({
		step: stepCount++,
		label: "Nilai Revisi DIPA Tahunan",
		formula: "(Nilai S1 + Nilai S2) / 2",
		inputs: { nilai_s1: scoreS1.toString(), nilai_s2: scoreS2.toString() },
		result: annualScore.toString(),
	});

	const weight = parseFloat(config.weights.dipa_revision);
	const weighted = (annualScore * weight) / 100;
	steps.push({
		step: stepCount++,
		label: "Nilai Tertimbang",
		formula: "Nilai Tahunan * Bobot",
		inputs: { nilai_tahunan: annualScore.toString(), bobot: weight.toString() },
		result: weighted.toString(),
	});

	return {
		key: "dipa_revision",
		label: "Revisi DIPA",
		weight: config.weights.dipa_revision,
		score: annualScore.toString(),
		weightedContribution: weighted.toString(),
		status: "complete",
		formulaTrace: steps,
		warnings,
	};
}
