import { describe, expect, it } from "vitest";
import { default2026RuleSet } from "../rule-set";
import { calculateAbsorption } from "./absorption";

describe("calculateAbsorption", () => {
	it("returns 100 with warning for BLU organizations", () => {
		const result = calculateAbsorption(
			{ quarters: [] },
			true,
			default2026RuleSet,
		);
		expect(result.score).toBe("100");
		expect(result.status).toBe("warning");
		expect(result.warnings.some((w) => w.includes("BLU"))).toBe(true);
	});

	it("passes Golden Test A (TW1 = 92.67)", () => {
		// Pagu: 51=250, 52=200, 53=50 (Total 500)
		// Target: 20%, 15%, 10% -> Target Rp: 50, 30, 5
		// Realisasi: 60, 24.5, 7
		// PA 51 = 60/50 = 120% -> cap 100, tertimbang = 100 * (250/500) = 50.00
		// PA 52 = 24.5/30 = 81.6667%, tertimbang = 81.6667 * (200/500) = 32.6667
		// PA 53 = 7/5 = 140% -> cap 100, tertimbang = 100 * (50/500) = 10.00
		// Nilai TW1 = 50 + 32.6667 + 10 = 92.6667 -> 92.67
		// IKPA TW1 = 92.67
		const result = calculateAbsorption(
			{
				quarters: [
					{
						quarter: 1,
						budget: {
							"51": "250",
							"52": "200",
							"53": "50",
							"57": "0",
						},
						realized: {
							"51": "60",
							"52": "24.5",
							"53": "7",
							"57": "0",
						},
					},
				],
			},
			false,
			default2026RuleSet,
		);
		expect(result.score).toBe("92.67");
		expect(result.weightedContribution).toBe("18.53");
		expect(result.status).toBe("complete");
	});

	it("passes Golden Test B (TW2 = 85.15)", () => {
		// TW1: Nilai TW1 = 92.6667
		// TW2 Pagu (revisi cut-off): 51=250, 52=250, 53=50 (Total 550)
		// Target TW2: 50%, 50%, 40% -> Target Rp: 125, 125, 20
		// Realisasi akumulatif Jan–Jun: 164, 63.5, 22
		// PA 51 = 164/125 = 131.2% -> cap 100, tertimbang = 100 * (250/550) = 45.4545
		// PA 52 = 63.5/125 = 50.8%, tertimbang = 50.8 * (250/550) = 23.0909
		// PA 53 = 22/20 = 110% -> cap 100, tertimbang = 100 * (50/550) = 9.0909
		// Nilai TW2 = 45.4545 + 23.0909 + 9.0909 = 77.6364
		// IKPA TW2 = (92.6667 + 77.6364) / 2 = 85.1515 -> 85.15
		const result = calculateAbsorption(
			{
				quarters: [
					{
						quarter: 1,
						budget: {
							"51": "250",
							"52": "200",
							"53": "50",
							"57": "0",
						},
						realized: {
							"51": "60",
							"52": "24.5",
							"53": "7",
							"57": "0",
						},
					},
					{
						quarter: 2,
						budget: {
							"51": "250",
							"52": "250",
							"53": "50",
							"57": "0",
						},
						realized: {
							"51": "164",
							"52": "63.5",
							"53": "22",
							"57": "0",
						},
					},
				],
			},
			false,
			default2026RuleSet,
		);
		expect(result.score).toBe("85.15");
		expect(result.weightedContribution).toBe("17.03");
		expect(result.status).toBe("complete");
	});

	it("caps the score at 100 per account type", () => {
		const result = calculateAbsorption(
			{
				quarters: [
					{
						quarter: 1,
						budget: {
							"51": "1000",
							"52": "0",
							"53": "0",
							"57": "0",
						},
						realized: {
							"51": "300", // 30% > 20% target -> should cap at 100
							"52": "0",
							"53": "0",
							"57": "0",
						},
					},
				],
			},
			false,
			default2026RuleSet,
		);
		expect(result.score).toBe("100.00");
	});

	it("handles empty quarters with incomplete status", () => {
		const result = calculateAbsorption(
			{ quarters: [] },
			false,
			default2026RuleSet,
		);
		expect(result.score).toBe("0");
		expect(result.status).toBe("incomplete");
	});

	it("excludes account types with zero budget from weighting", () => {
		const result = calculateAbsorption(
			{
				quarters: [
					{
						quarter: 1,
						budget: {
							"51": "1000",
							"52": "0",
							"53": "0",
							"57": "0",
						},
						realized: {
							"51": "200", // 20% of 1000 = 200 -> exact 100% PA
							"52": "0",
							"53": "0",
							"57": "0",
						},
					},
				],
			},
			false,
			default2026RuleSet,
		);
		expect(result.score).toBe("100.00");
	});
});

