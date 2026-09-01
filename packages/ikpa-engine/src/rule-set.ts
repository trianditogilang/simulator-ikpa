import {
	decimalStringSchema,
	indicatorKeySchema,
} from "@simulator-ikpa/contracts";
import { z } from "zod";
import { accountTypeSchema } from "./schemas";
import type { AccountType } from "./types";

export const roundingConfigSchema = z.strictObject({
	mode: z.enum(["half_up", "half_down", "down", "up"]),
	fractionDigits: z.number().int().min(0).max(4),
});

export const scoreBucketSchema = z.strictObject({
	min: decimalStringSchema,
	max: decimalStringSchema,
	score: decimalStringSchema,
});

export const dispensationBucketSchema = z.strictObject({
	minRatio: decimalStringSchema,
	maxRatio: decimalStringSchema,
	deduction: decimalStringSchema,
});

export const ruleSetConfigSchema = z.strictObject({
	weights: z.record(indicatorKeySchema, decimalStringSchema),
	dipaRevisionBuckets: z.array(scoreBucketSchema),
	contractualDistributionBuckets: z.array(scoreBucketSchema),
	dispensationBuckets: z.array(dispensationBucketSchema),
	absorptionTargets: z.record(
		accountTypeSchema,
		z.record(z.string(), decimalStringSchema),
	),
	contractualWeights: z.strictObject({
		earlyProcurement: decimalStringSchema,
		acceleration53: decimalStringSchema,
		distribution: decimalStringSchema,
	}),
	kkpTargets: z.record(z.string(), decimalStringSchema),
	revisionEligibilityCodes: z.array(z.string()),
	rounding: roundingConfigSchema,
	assumptionWarnings: z.array(z.string()),
});

export type RuleSetConfig = z.infer<typeof ruleSetConfigSchema>;

export function parseRuleSet(raw: unknown): RuleSetConfig {
	return ruleSetConfigSchema.parse(raw);
}

export type ValidationError = {
	path: string;
	message: string;
};

// Decimal addition helper since we don't have Decimal.js imported yet (using basic float for 100 check, but should ideally use string arithmetic or big number).
// For 100% checks with 2 decimal places, simple float parsing is acceptable just for validation invariant, or we do integer cents.
function sumDecimals(decimals: string[]): number {
	return (
		decimals.reduce(
			(acc, val) => acc + Math.round(parseFloat(val) * 10000),
			0,
		) / 10000
	);
}

export function validateInvariants(config: RuleSetConfig): ValidationError[] {
	const errors: ValidationError[] = [];

	// 1. Indicator weights sum to 100
	const weights = Object.values(config.weights);
	if (weights.length !== 7) {
		errors.push({
			path: "weights",
			message: "Must have exactly 7 indicator weights",
		});
	}
	const totalWeight = sumDecimals(weights);
	if (Math.abs(totalWeight - 100) > 0.0001) {
		errors.push({
			path: "weights",
			message: `Indicator weights must sum to 100, got ${totalWeight}`,
		});
	}

	// 2. Contractual weights sum to 100
	const contractualWeights = [
		config.contractualWeights.earlyProcurement,
		config.contractualWeights.acceleration53,
		config.contractualWeights.distribution,
	];
	const totalContractual = sumDecimals(contractualWeights);
	if (Math.abs(totalContractual - 100) > 0.0001) {
		errors.push({
			path: "contractualWeights",
			message: `Contractual weights must sum to 100, got ${totalContractual}`,
		});
	}

	// 3. Bucket overlaps
	const checkOverlap = (
		buckets: { min: string; max: string }[],
		path: string,
	) => {
		const sorted = [...buckets].sort(
			(a, b) => parseFloat(a.min) - parseFloat(b.min),
		);
		for (let i = 0; i < sorted.length - 1; i++) {
			const currentMax = parseFloat(sorted[i].max);
			const nextMin = parseFloat(sorted[i + 1].min);
			if (currentMax >= nextMin) {
				errors.push({
					path,
					message: `Bucket overlap detected between max ${sorted[i].max} and min ${sorted[i + 1].min}`,
				});
			}
		}
	};

	checkOverlap(config.dipaRevisionBuckets, "dipaRevisionBuckets");
	checkOverlap(
		config.contractualDistributionBuckets,
		"contractualDistributionBuckets",
	);
	checkOverlap(
		config.dispensationBuckets.map((b) => ({
			min: b.minRatio,
			max: b.maxRatio,
		})),
		"dispensationBuckets",
	);

	// 4. Missing parameters (Zod already handles most, but check absorption targets)
	const requiredAccountTypes: AccountType[] = ["51", "52", "53", "57"];
	for (const acc of requiredAccountTypes) {
		if (!config.absorptionTargets[acc]) {
			errors.push({
				path: `absorptionTargets.${acc}`,
				message: "Missing absorption targets for account type",
			});
		} else {
			for (let q = 1; q <= 4; q++) {
				if (!config.absorptionTargets[acc][q.toString()]) {
					errors.push({
						path: `absorptionTargets.${acc}.${q}`,
						message: `Missing absorption target for quarter ${q}`,
					});
				}
			}
		}
	}

	return errors;
}

export const default2026RuleSet: RuleSetConfig = {
	weights: {
		dipa_revision: "10",
		rpd_deviation: "15",
		budget_absorption: "20",
		contractual: "10",
		invoice_timeliness: "10",
		up_tup: "10",
		output_achievement: "25",
	},
	dipaRevisionBuckets: [
		{ min: "0", max: "1", score: "110" },
		{ min: "2", max: "2", score: "100" },
		{ min: "3", max: "999", score: "50" },
	],
	contractualDistributionBuckets: [
		{ min: "0", max: "0", score: "0" },
		{ min: "0.01", max: "25", score: "50" },
		{ min: "25.01", max: "50", score: "60" },
		{ min: "50.01", max: "75", score: "80" },
		{ min: "75.01", max: "100", score: "100" },
	],
	dispensationBuckets: [
		{ minRatio: "0", maxRatio: "0.009", deduction: "0" },
		{ minRatio: "0.01", maxRatio: "0.099", deduction: "0.25" },
		{ minRatio: "0.1", maxRatio: "0.999", deduction: "0.50" },
		{ minRatio: "1", maxRatio: "4.999", deduction: "0.75" },
		{ minRatio: "5", maxRatio: "9999", deduction: "1.00" },
	],
	absorptionTargets: {
		"51": { "1": "20", "2": "50", "3": "75", "4": "95" },
		"52": { "1": "15", "2": "50", "3": "70", "4": "90" },
		"53": { "1": "10", "2": "40", "3": "70", "4": "90" },
		"57": { "1": "25", "2": "50", "3": "75", "4": "95" },
	},
	contractualWeights: {
		earlyProcurement: "40",
		acceleration53: "40",
		distribution: "20",
	},
	kkpTargets: {
		"1": "1",
		"2": "5",
		"3": "9",
		"4": "12.5",
	},
	revisionEligibilityCodes: [
		"201",
		"211",
		"212",
		"213",
		"217",
		"220",
		"221",
		"222",
		"225",
		"226",
		"229",
		"231",
		"236",
		"239",
	],
	rounding: {
		mode: "half_up",
		fractionDigits: 2,
	},
	assumptionWarnings: [
		"REG-004: Mode pembulatan asumsi half_up 2 desimal.",
		"REV-005: Kode revisi objek memakai daftar sementara.",
		"DEV-004: Kurva di atas 5% memakai asumsi linear.",
		"ABS-006: Batas nilai maksimal cap 100 belum diverifikasi eksplisit.",
		"KON-006: Agregasi final kontrak dini menggunakan rata-rata nilai kontrak eligible.",
		"TAG-003: Pengecualian pegawai belum final.",
		"UPT-006: Setoran TUP/koreksi belum diverifikasi.",
		"OUT-004: Formula Desember menggunakan asumsi PCRO 100%.",
	],
};
