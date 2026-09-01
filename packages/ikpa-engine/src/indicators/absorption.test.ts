import { describe, it, expect } from "vitest";
import { calculateAbsorption } from "./absorption";
import { default2026RuleSet } from "../rule-set";

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

	it("passes the golden test with 92.67 score", () => {
		const result = calculateAbsorption(
			{
				quarters: [
					{
						quarter: 1,
						budget: {
							"51": "1000",
							"52": "1000",
							"53": "0",
							"57": "0",
						},
						realized: {
							"51": "200", // 20% -> 100 score
							"52": "128.01", // 12.801% -> 85.34 score
							"53": "0",
							"57": "0",
						},
					},
				],
			},
			false,
			default2026RuleSet,
		);
		expect(result.score).toBe("92.67");
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
});
