import { describe, expect, it } from "vitest";
import {
	default2026RuleSet,
	parseRuleSet,
	validateInvariants,
} from "./rule-set";

describe("RuleSetConfig", () => {
	it("parses valid config and passes invariants", () => {
		const config = parseRuleSet(default2026RuleSet);
		const errors = validateInvariants(config);
		expect(errors).toHaveLength(0);
	});

	it("rejects invalid indicator weights", () => {
		const invalidConfig = {
			...default2026RuleSet,
			weights: {
				...default2026RuleSet.weights,
				dipa_revision: "20", // makes sum 110
			},
		};
		const config = parseRuleSet(invalidConfig);
		const errors = validateInvariants(config);
		expect(errors).toContainEqual(
			expect.objectContaining({
				path: "weights",
				message: expect.stringContaining("sum to 100"),
			}),
		);
	});

	it("rejects invalid contractual weights", () => {
		const invalidConfig = {
			...default2026RuleSet,
			contractualWeights: {
				...default2026RuleSet.contractualWeights,
				distribution: "30", // makes sum 110
			},
		};
		const config = parseRuleSet(invalidConfig);
		const errors = validateInvariants(config);
		expect(errors).toContainEqual(
			expect.objectContaining({
				path: "contractualWeights",
				message: expect.stringContaining("sum to 100"),
			}),
		);
	});

	it("detects bucket overlap", () => {
		const invalidConfig = {
			...default2026RuleSet,
			dipaRevisionBuckets: [
				{ min: "0", max: "2", score: "110" },
				{ min: "1", max: "3", score: "100" }, // overlap at 1-2
			],
		};
		const config = parseRuleSet(invalidConfig);
		const errors = validateInvariants(config);
		expect(errors).toContainEqual(
			expect.objectContaining({
				path: "dipaRevisionBuckets",
				message: expect.stringContaining("overlap detected"),
			}),
		);
	});

	it("detects missing parameters", () => {
		const invalidConfig = {
			...default2026RuleSet,
			absorptionTargets: {
				"51": { "1": "20", "2": "50", "3": "75", "4": "95" },
				"52": { "1": "15", "2": "50", "3": "70", "4": "90" },
				"53": { "1": "10", "2": "40", "3": "70" }, // missing quarter 4
				"57": { "1": "25", "2": "50", "3": "75", "4": "95" },
			},
		};
		const config = parseRuleSet(invalidConfig);
		const errors = validateInvariants(config);
		expect(errors).toContainEqual(
			expect.objectContaining({ path: "absorptionTargets.53.4" }),
		);
	});

	it("rejects invalid money values (decimal check in schema)", () => {
		const invalidConfig = {
			...default2026RuleSet,
			weights: {
				...default2026RuleSet.weights,
				dipa_revision: "abc",
			},
		};
		expect(() => parseRuleSet(invalidConfig)).toThrowError(
			/Expected a decimal string/,
		);
	});
});
