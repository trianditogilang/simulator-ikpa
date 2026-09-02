import { calculateAbsorption } from "./indicators/absorption";
import { calculateContractual } from "./indicators/contractual";
import { calculateDipaRevision } from "./indicators/dipa-revision";
import { calculateInvoiceTimeliness } from "./indicators/invoice-timeliness";
import { calculateOutputAchievement } from "./indicators/output-achievement";
import { calculateRpdDeviation } from "./indicators/rpd-deviation";
import { calculateSpmDispensation } from "./indicators/spm-dispensation";
import { calculateUpTup } from "./indicators/up-tup";
import { generateRecommendations } from "./recommendations";
import type { RuleSetConfig } from "./rule-set";
import type { EngineInput, EngineOutput, IndicatorCalculation } from "./types";
import { DecimalCalc } from "./utils/decimal";

export function calculateIkpa(
	input: EngineInput,
	config: RuleSetConfig,
): EngineOutput {
	const indicators: IndicatorCalculation[] = [];
	const missingData = new Set<string>();
	const warnings = new Set<string>();
	let subtotal = "0";
	let isIncomplete = false;

	const baseIndicators = [
		calculateDipaRevision(input.dipaRevision, config),
		calculateRpdDeviation(input.rpdDeviation, config),
		calculateAbsorption(input.absorption, input.isBlu, config),
		calculateContractual(input.contractual, config),
		calculateInvoiceTimeliness(input.invoiceTimeliness, config),
		calculateUpTup(input.upTup, input.period, config),
		calculateOutputAchievement(input.outputAchievement, config),
	];

	for (const ind of baseIndicators) {
		if (ind.warnings) {
			for (const w of ind.warnings) {
				warnings.add(w);
			}
		}

		let score = ind.score;
		let weightedContrib = ind.weightedContribution;

		if (input.overrides && input.overrides[ind.key] !== undefined) {
			score = input.overrides[ind.key];
			weightedContrib = DecimalCalc.mul(
				score!,
				DecimalCalc.div(ind.weight, "100"),
			);

			ind.score = score;
			ind.weightedContribution = weightedContrib;
			ind.status = "complete";
			ind.formulaTrace.push({
				step: ind.formulaTrace.length + 1,
				label: "Scenario Override",
				formula: "override_value",
				inputs: { override: score! },
				result: score!,
			});
		}

		indicators.push(ind);

		if (ind.status === "incomplete") {
			isIncomplete = true;
			missingData.add(ind.key);
		}

		if (weightedContrib !== null) {
			subtotal = DecimalCalc.add(subtotal, weightedContrib);
		}
	}

	const spm = calculateSpmDispensation(input.spmDispensation, config);
	if (spm.warnings) {
		for (const w of spm.warnings) {
			warnings.add(w);
		}
	}
	const deduction = spm.deduction;

	let totalScore: string | null = null;
	if (!isIncomplete) {
		const rawTotal = DecimalCalc.sub(subtotal, deduction);
		// Note: using roundHalfUp from DecimalCalc for all modes temporarily
		// since DecimalCalc only exposes roundHalfUp currently.
		totalScore = DecimalCalc.roundHalfUp(
			rawTotal,
			config.rounding.fractionDigits,
		);
	}

	const recommendations = generateRecommendations(
		indicators,
		input.targetScore,
		config,
	);

	return {
		totalScore,
		indicators,
		dispensationDeduction: deduction,
		recommendations,
		missingData: Array.from(missingData),
		warnings: Array.from(warnings),
		ruleSetId: input.ruleSetId,
		ruleSetVersion: input.ruleSetVersion,
		calculatedAt: new Date().toISOString(),
	};
}
