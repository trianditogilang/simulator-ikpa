import { describe, expect, it } from "vitest";
import { default2026RuleSet } from "../rule-set";
import type { SpmDispensationInput } from "../types";
import { calculateSpmDispensation } from "./spm-dispensation";

describe("F6-10 Dispensasi SPM", () => {
	it("returns 0 deduction with warning if totalSpmQ4 is 0", () => {
		const input: SpmDispensationInput = {
			dispensationCount: 0,
			totalSpmQ4: 0,
		};
		const result = calculateSpmDispensation(input, default2026RuleSet);

		expect(result.deduction).toBe("0");
		expect(result.ratio).toBe("0");
		expect(
			result.warnings.some((w) => w.includes("Total SPM Q4 adalah 0")),
		).toBe(true);
	});

	it("passes the golden test: 24/5200 SPM -> 0.75 deduction", () => {
		const input: SpmDispensationInput = {
			dispensationCount: 24,
			totalSpmQ4: 5200,
		};
		// Ratio = (24 / 5200) * 1000 = 4.615...
		// In default ruleset: { minRatio: "1", maxRatio: "4.999", deduction: "0.75" }
		const result = calculateSpmDispensation(input, default2026RuleSet);

		expect(result.ratio).toBe("4.615");
		expect(result.deduction).toBe("0.75");
		expect(result.warnings.length).toBe(0);
	});

	it("handles exact boundary values", () => {
		// Boundary: 0.1 permil -> 0.50 deduction
		// minRatio: "0.1", maxRatio: "0.999", deduction: "0.50"
		let result = calculateSpmDispensation(
			{
				dispensationCount: 1,
				totalSpmQ4: 10000,
			},
			default2026RuleSet,
		);
		expect(result.ratio).toBe("0.100");
		expect(result.deduction).toBe("0.50");

		// Boundary: 1.0 permil -> 0.75 deduction
		result = calculateSpmDispensation(
			{
				dispensationCount: 1,
				totalSpmQ4: 1000,
			},
			default2026RuleSet,
		);
		expect(result.ratio).toBe("1.000");
		expect(result.deduction).toBe("0.75");
	});
});
